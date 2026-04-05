/**
 * Workflow Orchestrator — /auto 工作流编排器（精简协调器）
 *
 * 职责：
 * - 初始化核心模块和 Phase 子模块
 * - 编排 6 PHASE 执行顺序
 * - 聚合执行结果（_buildResult / getRuntimeStatus）
 * - 上下文溢出检测和会话摘要生成
 *
 * 具体 PHASE 逻辑委托给 phase-* 子模块：
 * - PhaseDiscover: PHASE 1 扫描 + 能力清单
 * - PhaseExecute: PHASE 2 Quest 设计 + PHASE 3 逐关执行
 * - PhaseVerify: PHASE 4 门禁验证
 * - PhaseCommit: PHASE 5 增量提交
 * - PhaseLearn: PHASE 6 知识沉淀
 */

import { FlowEngine } from '../flow/flow-engine.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { TokenBudgetManager } from '../budget/token-budget.js';
import { ContextMonitor, CONTEXT_STATUS } from '../budget/context-monitor.js';
import { SkillIndexer } from '../skills/skill-indexer.js';
import { compactTrace } from '../utils/trace-compactor.js';
import {
  createSessionSummary,
  createResumeDirective,
  ADAPTIVE_PROFILES
} from '../budget/context-compressor.js';
import {
  createPhaseContext,
  updatePhaseContext,
  detectExecutionMode,
  EXECUTION_MODES
} from './phase-context.js';
import { logger } from '../logger.js';

// Phase 子模块
import { PhaseDiscover } from './phase-discover.js';
import { PhaseExecute } from './phase-execute.js';
import { PhaseVerify } from './phase-verify.js';
import { PhaseCommit } from './phase-commit.js';
import { PhaseLearn } from './phase-learn.js';

const WORKFLOW_ID = 'auto-workflow';

/**
 * 工作流编排器（精简协调器）
 */
export class WorkflowOrchestrator {
  /**
   * @param {Object} options
   * @param {string} [options.projectDir] 项目目录
   * @param {string} [options.skillsDir] Skills 目录
   */
  constructor(options = {}) {
    this.projectDir = options.projectDir || process.cwd();
    this.skillsDir = options.skillsDir || 'skills';
    this.dryRun = options.dryRun ?? false;

    // 初始化核心模块
    this.flowEngine = new FlowEngine(WORKFLOW_ID, { maxRetries: 3 });
    this.memory = new MemoryManager({ projectDir: this.projectDir });
    this.tokenBudget = new TokenBudgetManager();
    this.contextMonitor = new ContextMonitor();
    this.skillIndexer = new SkillIndexer(this.skillsDir);

    // 当前上下文
    this.phaseContext = createPhaseContext();

    // 消息累加器（上限 50 条）
    this._messageAccumulator = [];

    // 待续接的会话摘要
    this._pendingSessionSummary = null;

    // 初始化 Phase 子模块
    this.phaseDiscover = new PhaseDiscover({
      memory: this.memory,
      tokenBudget: this.tokenBudget,
      contextMonitor: this.contextMonitor,
      skillIndexer: this.skillIndexer,
      flowEngine: this.flowEngine,
      projectDir: this.projectDir
    });

    this.phaseExecute = new PhaseExecute({
      memory: this.memory,
      tokenBudget: this.tokenBudget,
      contextMonitor: this.contextMonitor,
      flowEngine: this.flowEngine,
      projectDir: this.projectDir
    });
    this.phaseExecute.setSkillIndexer(this.skillIndexer);

    this.phaseVerify = new PhaseVerify({
      memory: this.memory,
      tokenBudget: this.tokenBudget,
      contextMonitor: this.contextMonitor,
      flowEngine: this.flowEngine,
      projectDir: this.projectDir,
      skillIndexer: this.skillIndexer
    });

    this.phaseCommit = new PhaseCommit({
      memory: this.memory,
      tokenBudget: this.tokenBudget,
      flowEngine: this.flowEngine,
      contextMonitor: this.contextMonitor,
      projectDir: this.projectDir,
      dryRun: this.dryRun,
      skillIndexer: this.skillIndexer
    });

    this.phaseLearn = new PhaseLearn({
      memory: this.memory,
      tokenBudget: this.tokenBudget,
      flowEngine: this.flowEngine,
      projectDir: this.projectDir
    });

    logger.info('[Orchestrator] 工作流编排器初始化完成');
  }

  /**
   * 执行完整工作流
   * @param {string} task 任务描述
   * @param {Object} options 执行选项
   * @returns {Promise<Object>} 执行结果
   */
  async run(task, options = {}) {
    // 初始化消息累加器并注入到 Phase 子模块
    this._messageAccumulator = [{ role: 'user', content: task }];
    this._pendingSessionSummary = null;

    // 同步测试可能 mock 的依赖到子模块
    this._syncDepsToModules();
    this.phaseExecute.setMessageAccumulator(this._messageAccumulator);
    this.phaseLearn.setMessageAccumulator(this._messageAccumulator);

    try {
      // 1. 确定执行模式
      const mode = detectExecutionMode(task, options);
      this.phaseContext = updatePhaseContext(this.phaseContext, { mode, task });

      logger.info(`[Orchestrator] 开始执行工作流，模式: ${mode}, 任务: ${task}`);

      // 2. PHASE 1: DISCOVER
      this.phaseContext = await this.phaseDiscover.run(this.phaseContext);
      this._checkContextOverflow(this.contextMonitor.getStatus());

      // 微型模式：DISCOVER → MICRO_EXECUTE → VERIFY → LEARN
      if (mode === EXECUTION_MODES.MICRO) {
        this.phaseContext = await this.phaseExecute.runMicroExecute(this.phaseContext);
        this.phaseContext = await this.phaseVerify.run(this.phaseContext);
        this.phaseContext = await this.phaseLearn.run(this.phaseContext);
        return this._buildResult('completed');
      }

      // 3. PHASE 2: REASON
      this.phaseContext = await this.phaseExecute.runReason(this.phaseContext);

      // 轻量模式：REASON → VERIFY → LEARN
      if (mode === EXECUTION_MODES.LIGHT) {
        this.phaseContext = await this.phaseVerify.run(this.phaseContext);
        this.phaseContext = await this.phaseLearn.run(this.phaseContext);
        return this._buildResult('completed');
      }

      // 4. PHASE 3: EXECUTE
      this.phaseContext = await this.phaseExecute.runExecute(this.phaseContext);
      this._checkContextOverflow(this.contextMonitor.getStatus());

      // 5. PHASE 4: VERIFY
      this.phaseContext = await this.phaseVerify.run(this.phaseContext);

      // P1-1: 门禁失败时回滚
      if (this.phaseContext.gateFailed) {
        logger.error(`[Orchestrator] 门禁失败: ${this.phaseContext.gateReason}，回滚变更`);
        try {
          const { execSync } = await import('node:child_process');
          execSync('git checkout -- .', { cwd: this.projectDir, stdio: 'pipe' });
        } catch (rollbackError) {
          logger.warn(`[Orchestrator] 回滚失败: ${rollbackError.message}`);
        }
        return this._buildResult('gate_failed', new Error(this.phaseContext.gateReason));
      }

      // 6. PHASE 5: COMMIT
      this.phaseContext = await this.phaseCommit.run(this.phaseContext);

      // 7. PHASE 6: LEARN
      this.phaseContext = await this.phaseLearn.run(this.phaseContext);

      return this._buildResult('completed');
    } catch (error) {
      const compacted = compactTrace(error);
      logger.error(`[Orchestrator] 工作流执行失败: ${compacted.compacted}`);

      this.phaseContext = updatePhaseContext(this.phaseContext, {
        error: compacted.compacted
      });

      return this._buildResult('failed', error);
    }
  }

  // --- 结果聚合方法（保留在协调器） ---

  /**
   * 获取运行时模块状态摘要
   * @returns {Object} 各模块的初始化状态和健康信息
   */
  getRuntimeStatus() {
    return Object.freeze({
      flowEngine: {
        state: this.flowEngine.state,
        phase: this.flowEngine.getPhase(),
        healthy: true
      },
      memory: {
        stats: this.memory.getStats(),
        healthy: true
      },
      tokenBudget: {
        status: this.tokenBudget.getStatus(),
        summary: this.tokenBudget.getSummary(),
        healthy: true
      },
      contextMonitor: {
        status: this.contextMonitor.getStatus(),
        summary: this.contextMonitor.getSummary(),
        healthy: true
      },
      skillIndexer: {
        initialized: this.skillIndexer._cache !== null,
        healthy: true
      },
      agentRegistry: {
        initialized: this.phaseExecute._agentRegistry !== null,
        stats: this.phaseExecute._agentRegistry
          ? this.phaseExecute._agentRegistry.getStats()
          : null,
        healthy: true
      },
      canonicalRouter: {
        initialized: this.phaseExecute._canonicalRouter !== null,
        healthy: true
      },
      repoIndexer: {
        initialized: this.phaseLearn._repoIndexer !== null,
        healthy: true
      },
      knowledgeSteward: {
        initialized: this.phaseLearn._knowledgeSteward !== null,
        healthy: true
      },
      dreamScheduler: {
        healthy: true
      },
      workflow: {
        currentPhase: this.phaseContext.currentPhase,
        mode: this.phaseContext.mode,
        completedQuests: this.phaseContext.completedQuests.length,
        failedQuests: this.phaseContext.failedQuests.length
      },
      healthy: true,
      timestamp: Date.now()
    });
  }

  /**
   * 构建执行结果
   * @private
   */
  _buildResult(status, error = null) {
    const questPlans = this._messageAccumulator
      .filter((m) => m.role === 'quest-plan')
      .map((m) => JSON.parse(m.content));

    const agentInvocations = questPlans
      .filter((p) => p.agentInvocation)
      .map((p) => p.agentInvocation);

    return {
      status,
      error,
      mode: this.phaseContext.mode,
      capabilities: this.phaseContext.capabilities,
      completedQuests: this.phaseContext.completedQuests,
      failedQuests: this.phaseContext.failedQuests,
      verificationActions: this.phaseContext.verificationActions,
      testResult: this.phaseContext.testResult,
      coverageResult: this.phaseContext.coverageResult,
      securityResult: this.phaseContext.securityResult,
      doctorResult: this.phaseContext.doctorResult,
      gitResult: this.phaseContext.gitResult,
      questPlans,
      agentInvocations: Object.freeze(agentInvocations),
      changedFiles: this.phaseContext.changedFiles,
      insights: this.phaseContext.insights,
      tokenBudget: this.phaseContext.tokenBudget,
      contextStatus: this.phaseContext.contextStatus,
      sessionSummary: this._pendingSessionSummary,
      resumeDirective: this._pendingSessionSummary
        ? createResumeDirective(this._pendingSessionSummary)
        : null
    };
  }

  /**
   * 检查上下文溢出 → 生成会话摘要
   * @private
   */
  _checkContextOverflow(contextStatus) {
    if (contextStatus !== CONTEXT_STATUS.OVERFLOW) return;

    // P2-3: 使用 adaptive profile 压缩策略
    const profile = this.phaseContext.projectProfile || 'default';
    const profileConfig = ADAPTIVE_PROFILES[profile] || ADAPTIVE_PROFILES.default;
    logger.warn(`[Orchestrator] 上下文窗口溢出，生成会话摘要 (profile=${profile})`);

    this._pendingSessionSummary = createSessionSummary({
      task: this.phaseContext.task,
      keyConcepts: this._extractKeyConcepts(),
      filesAndCode: this.phaseContext.changedFiles.map((f) => ({ file: f })),
      errors: this.phaseContext.failedQuests.map((f) => ({
        error: f.error,
        fix: ''
      })),
      problemSolving: this._messageAccumulator
        .filter((m) => m.role === 'quest-plan')
        .slice(-profileConfig.snipKeepRecent || 5)
        .map((m) => ({ plan: m.content })),
      userMessages: this._messageAccumulator.filter((m) => m.role === 'user').map((m) => m.content),
      pendingTasks: this.phaseContext.failedQuests.map((f) => `修复 Quest ${f.questId}`),
      currentWork: {
        phase: this.phaseContext.currentPhase,
        completedQuests: this.phaseContext.completedQuests.length,
        failedQuests: this.phaseContext.failedQuests.length
      },
      profileConfig
    });

    logger.info('[Orchestrator] 会话摘要已生成，可通过 resumeDirective 续接');
  }

  /**
   * 从任务上下文中提取关键概念（P2-7: 用于 Session Summary）
   * @returns {string[]}
   * @private
   */
  _extractKeyConcepts() {
    const concepts = [];
    const task = this.phaseContext.task || '';

    const techPatterns = [
      /\b(REST|API|CRUD|CRDT|CQRS|ORM|TDD|BDD|DDD|SOLID|DRY)\b/gi,
      /\b(React|Vue|Angular|Next|Nuxt|Svelte)\b/gi,
      /\b(Node|Express|Fastify|Koa)\b/gi,
      /\b(TypeScript|JavaScript|Python|Java|Go|Rust)\b/gi,
      /\b(REST|GraphQL|gRPC|WebSocket)\b/gi,
      /\b(SQL|NoSQL|Redis|Mongo|Postgres)\b/gi,
      /\b(Docker|K8s|CI\/CD|GitHub Actions)\b/gi
    ];

    for (const pattern of techPatterns) {
      const matches = task.match(pattern) || [];
      concepts.push(...matches.map((m) => m.toUpperCase()));
    }

    return [...new Set(concepts)].slice(0, 10);
  }

  // --- 向后兼容委托方法 ---
  // 测试和外部调用者通过 orchestrator 实例访问这些方法，
  // 实际实现已移到对应的 Phase 子模块中。
  // 每个委托方法在调用前同步测试可能 mock 的依赖项。

  /**
   * 将 orchestrator 上测试可能 mock 的依赖同步到子模块
   * @private
   */
  _syncDepsToModules() {
    const modules = [
      this.phaseDiscover,
      this.phaseExecute,
      this.phaseVerify,
      this.phaseCommit,
      this.phaseLearn
    ];
    for (const mod of modules) {
      if ('tokenBudget' in mod) mod.tokenBudget = this.tokenBudget;
      if ('contextMonitor' in mod) mod.contextMonitor = this.contextMonitor;
      if ('memory' in mod) mod.memory = this.memory;
    }
    // 同步 orchestrator 上测试可能 stub 的 _canonicalRouter 到子模块
    if (this._canonicalRouter !== undefined) {
      this.phaseVerify._canonicalRouter = this._canonicalRouter;
      this.phaseExecute._canonicalRouter = this._canonicalRouter;
    }
  }

  /**
   * @deprecated 使用 phaseDiscover.run() 代替
   */
  async _runDiscover() {
    this._syncDepsToModules();
    this.phaseContext = await this.phaseDiscover.run(this.phaseContext);
  }

  /**
   * @deprecated 使用 phaseExecute.runReason() 代替
   */
  async _runReason() {
    this._syncDepsToModules();
    this.phaseContext = await this.phaseExecute.runReason(this.phaseContext);
  }

  /**
   * @deprecated 使用 phaseExecute.runExecute() 代替
   */
  async _runExecute() {
    this._syncDepsToModules();
    this.phaseExecute.setMessageAccumulator(this._messageAccumulator);
    this.phaseContext = await this.phaseExecute.runExecute(this.phaseContext);
  }

  /**
   * @deprecated 使用 phaseExecute.runMicroExecute() 代替
   */
  async _runMicroExecute() {
    this._syncDepsToModules();
    this.phaseExecute.setMessageAccumulator(this._messageAccumulator);
    this.phaseContext = await this.phaseExecute.runMicroExecute(this.phaseContext);
  }

  /**
   * @deprecated 使用 phaseVerify.run() 代替
   */
  async _runVerify() {
    this._syncDepsToModules();
    this.phaseContext = await this.phaseVerify.run(this.phaseContext);
  }

  /**
   * @deprecated 使用 phaseCommit.run() 代替
   */
  async _runCommit() {
    this._syncDepsToModules();
    this.phaseCommit.dryRun = this.dryRun;
    this.phaseContext = await this.phaseCommit.run(this.phaseContext);
  }

  /**
   * @deprecated 使用 phaseLearn.run() 代替
   */
  async _runLearn() {
    this._syncDepsToModules();
    this.phaseLearn.setMessageAccumulator(this._messageAccumulator);
    this.phaseContext = await this.phaseLearn.run(this.phaseContext);
  }

  /**
   * @deprecated 使用 phaseDiscover._ensureAgentRegistry() 代替
   */
  async _ensureAgentRegistry() {
    return this.phaseDiscover._ensureAgentRegistry();
  }

  /**
   * @deprecated 使用 phaseDiscover._countCommands() 代替
   */
  async _countCommands() {
    return this.phaseDiscover._countCommands();
  }

  /**
   * @deprecated 使用 phaseDiscover._countHooks() 代替
   */
  async _countHooks() {
    return this.phaseDiscover._countHooks();
  }

  /**
   * @deprecated 使用 phaseDiscover._runDoctorCheck() 代替
   */
  async _runDoctorCheck() {
    return this.phaseDiscover._runDoctorCheck();
  }

  /**
   * @deprecated 使用 phaseVerify._detectTestRunner() 代替
   */
  async _detectTestRunner() {
    return this.phaseVerify._detectTestRunner();
  }

  /**
   * @deprecated 使用 phaseVerify._parseCoverageOutput() 代替
   */
  _parseCoverageOutput(output) {
    return this.phaseVerify._parseCoverageOutput(output);
  }

  /**
   * @deprecated 使用 phaseVerify._runSecurityScan() 代替
   */
  async _runSecurityScan() {
    this._syncDepsToModules();
    return this.phaseVerify._runSecurityScan();
  }

  /**
   * @deprecated 使用 phaseCommit._executeGitCommit() 代替
   */
  async _executeGitCommit(files, message) {
    this.phaseCommit.dryRun = this.dryRun;
    return this.phaseCommit._executeGitCommit(files, message);
  }

  /**
   * @deprecated 使用 phaseLearn._analyzeGitPatterns() 代替
   */
  async _analyzeGitPatterns(commitCount) {
    return this.phaseLearn._analyzeGitPatterns(commitCount);
  }

  /**
   * @deprecated 使用 phaseLearn._detectArchitectureChange() 代替
   */
  _detectArchitectureChange() {
    return this.phaseLearn._detectArchitectureChange(this.phaseContext.task);
  }

  /**
   * @deprecated 使用 phaseLearn._generateDeletionLog() 代替
   */
  async _generateDeletionLog() {
    return this.phaseLearn._generateDeletionLog();
  }

  /**
   * @deprecated 使用 phaseExecute._executeQuest() 代替
   */
  async _executeQuest(quest, modelRoute, questEngine) {
    this._syncDepsToModules();
    this.phaseExecute.setMessageAccumulator(this._messageAccumulator);
    const result = await this.phaseExecute._executeQuest(
      quest,
      modelRoute,
      questEngine,
      this.phaseContext
    );

    // 同步 phaseContext 变更（_executeQuest 中 changedFiles 合并）
    if (quest.changedFiles) {
      this.phaseContext = updatePhaseContext(this.phaseContext, {
        currentQuest: quest,
        changedFiles: quest.changedFiles
          ? [...this.phaseContext.changedFiles, ...quest.changedFiles]
          : this.phaseContext.changedFiles
      });
    }

    return result;
  }

  /**
   * @deprecated 使用 phaseExecute._generateQuestMap() 代替
   */
  _generateQuestMap(task, context) {
    return this.phaseExecute._generateQuestMap(task, context);
  }

  /**
   * @deprecated 使用 phaseExecute._extractKeywords() 代替
   */
  _extractKeywords(task) {
    return this.phaseExecute._extractKeywords(task);
  }

  /**
   * @deprecated 使用 phaseExecute._persistAgentResult() 代替
   */
  async _persistAgentResult(agentName, result, questId) {
    return this.phaseExecute._persistAgentResult(agentName, result, questId);
  }

  /**
   * @deprecated 使用 phaseExecute.questEngines 代替
   */
  get questEngines() {
    return this.phaseExecute.questEngines;
  }

  /**
   * 获取 FlowEngine 状态
   */
  getFlowState() {
    return this.flowEngine.state;
  }

  /**
   * 获取当前上下文
   */
  getContext() {
    return this.phaseContext;
  }
}

export default WorkflowOrchestrator;
