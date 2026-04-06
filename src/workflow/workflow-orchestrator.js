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
import { FLOW_EVENTS, FLOW_STATES } from '../flow/flow-state.js';
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
import { checkStatus } from '../installer.js';
import { runDoctorChecks } from '../doctor.js';
import { runResume as runResumeWorkflow } from '../resume.js';

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
    this.phaseExecute.setPendingInvocationInspector(
      this.phaseDiscover._inspectPendingInvocations.bind(this.phaseDiscover)
    );

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
    this.phaseContext = createPhaseContext();

    // 同步测试可能 mock 的依赖到子模块
    this._syncDepsToModules();
    this.phaseExecute.setMessageAccumulator(this._messageAccumulator);
    this.phaseLearn.setMessageAccumulator(this._messageAccumulator);

    try {
      // 1. 确定执行模式
      const mode = detectExecutionMode(task, options);
      this.phaseContext = this.phaseExecute.initializeWorkflowContext(this.phaseContext, task, {
        ...options,
        mode
      });

      logger.info(`[Orchestrator] 开始执行工作流，模式: ${mode}, 任务: ${task}`);

      // 2. PHASE 1: DISCOVER
      this.phaseContext = await this.phaseDiscover.run(this.phaseContext);
      this._checkContextOverflow(this.contextMonitor.getStatus());

      const hasPendingInvocations = (this.phaseContext.pendingInvocations?.length || 0) > 0;

      // 微型模式：DISCOVER → MICRO_EXECUTE → VERIFY → LEARN
      if (mode === EXECUTION_MODES.MICRO) {
        this.phaseContext = await this._runPhaseExecuteIsolated(
          'runMicroExecute',
          this.phaseContext
        );

        if (hasPendingInvocations) {
          await this._executePendingInvocationsOnly();
          this._checkContextOverflow(this.contextMonitor.getStatus());
        }

        this._advanceMainFlowTo(FLOW_STATES.REVIEWING);
        this.phaseContext = await this.phaseVerify.run(this.phaseContext);

        const pendingFailureCount = this.phaseContext.pendingExecution?.failedQuests?.length || 0;
        if (this.phaseContext.gateFailed || pendingFailureCount > 0) {
          const gateReason =
            this.phaseContext.gateReason || `${pendingFailureCount} pending invocation(s) failed`;
          logger.error(`[Orchestrator] 门禁失败: ${gateReason}`);
          this._resetMainFlowAfterGateFailure(gateReason);
          return this._buildResult('gate_failed', new Error(gateReason));
        }

        this._advanceMainFlowTo(FLOW_STATES.COMPLETED);
        try {
          this.phaseContext = await this.phaseLearn.run(this.phaseContext);
        } catch (learnError) {
          this._resetMainFlowAfterGateFailure(learnError.message || 'learn failed');
          throw learnError;
        }
        return this._buildResult('completed');
      }

      // 3. PHASE 2: REASON
      this.phaseContext = await this.phaseExecute.runReason(this.phaseContext);

      // 轻量模式：REASON → VERIFY → LEARN
      if (mode === EXECUTION_MODES.LIGHT) {
        if (hasPendingInvocations) {
          await this._executePendingInvocationsOnly();
          this._checkContextOverflow(this.contextMonitor.getStatus());
        }

        this._advanceMainFlowTo(FLOW_STATES.REVIEWING);
        this.phaseContext = await this.phaseVerify.run(this.phaseContext);

        const pendingFailureCount = this.phaseContext.pendingExecution?.failedQuests?.length || 0;
        if (this.phaseContext.gateFailed || pendingFailureCount > 0) {
          const gateReason =
            this.phaseContext.gateReason || `${pendingFailureCount} pending invocation(s) failed`;
          logger.error(`[Orchestrator] 门禁失败: ${gateReason}`);
          this._resetMainFlowAfterGateFailure(gateReason);
          return this._buildResult('gate_failed', new Error(gateReason));
        }

        this._advanceMainFlowTo(FLOW_STATES.COMPLETED);
        try {
          this.phaseContext = await this.phaseLearn.run(this.phaseContext);
        } catch (learnError) {
          this._resetMainFlowAfterGateFailure(learnError.message || 'learn failed');
          throw learnError;
        }
        return this._buildResult('completed');
      }

      // 4. PHASE 3: EXECUTE
      this.phaseContext = await this.phaseExecute.runExecute(this.phaseContext);
      this._checkContextOverflow(this.contextMonitor.getStatus());

      // 5. PHASE 4: VERIFY
      this.phaseContext = await this.phaseVerify.run(this.phaseContext);

      // P1-1: 门禁失败时停止工作流，避免误回滚用户的无关改动
      const pendingFailureCount = this.phaseContext.pendingExecution?.failedQuests?.length || 0;
      if (this.phaseContext.gateFailed || pendingFailureCount > 0) {
        const gateReason =
          this.phaseContext.gateReason || `${pendingFailureCount} pending invocation(s) failed`;
        logger.error(`[Orchestrator] 门禁失败: ${gateReason}`);
        this._resetMainFlowAfterGateFailure(gateReason);
        return this._buildResult('gate_failed', new Error(gateReason));
      }

      if (mode !== EXECUTION_MODES.FULL) {
        this.phaseContext = await this.phaseLearn.run(this.phaseContext);
        return this._buildResult('completed');
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

  async _executePendingInvocationsOnly() {
    const mainContext = this.phaseContext;
    const pendingMessages = [];
    const previousAccumulator = this._messageAccumulator;

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      task: '[pending-invocations]',
      mode: EXECUTION_MODES.LIGHT,
      completedQuests: [],
      failedQuests: [],
      changedFiles: [],
      executionResults: [],
      pendingExecution: null,
      questMap: [],
      matchedSkills: [],
      modelRecommendations: null,
      agentRecommendation: null
    });

    try {
      this.phaseContext = await this._runPhaseExecuteIsolated(
        'runExecute',
        this.phaseContext,
        pendingMessages
      );
    } finally {
      const pendingContext = this.phaseContext;
      const pendingExecution = Object.freeze({
        completedQuests: Object.freeze([...(pendingContext.completedQuests || [])]),
        failedQuests: Object.freeze([...(pendingContext.failedQuests || [])]),
        changedFiles: Object.freeze([...(pendingContext.changedFiles || [])]),
        executionSummary: this.phaseExecute.buildExecutionSummary(pendingContext),
        questPlans: Object.freeze(
          pendingMessages.filter((m) => m.role === 'quest-plan').map((m) => JSON.parse(m.content))
        )
      });
      const pendingInvocations = pendingContext.pendingInvocations || [];

      this._messageAccumulator = previousAccumulator;
      this.phaseExecute.setMessageAccumulator(this._messageAccumulator);
      this.phaseContext = updatePhaseContext(mainContext, {
        pendingInvocations,
        pendingExecution,
        completedQuests: [
          ...new Set([
            ...(mainContext.completedQuests || []),
            ...(pendingContext.completedQuests || [])
          ])
        ],
        changedFiles: [
          ...new Set([...(mainContext.changedFiles || []), ...(pendingContext.changedFiles || [])])
        ],
        executionResults: [
          ...(mainContext.executionResults || []),
          ...(pendingContext.executionResults || [])
        ]
      });
    }
  }

  async _runPhaseExecuteIsolated(methodName, phaseContext, messageAccumulator = null) {
    const previousFlowEngine = this.phaseExecute.flowEngine;
    const previousAccumulator = this.phaseExecute.messageAccumulator;
    const isolatedFlowEngine = this._createIsolatedExecutionFlowEngine();

    this.phaseExecute.flowEngine = isolatedFlowEngine;
    this.phaseExecute.setMessageAccumulator(messageAccumulator || previousAccumulator || []);

    try {
      return await this.phaseExecute[methodName](phaseContext);
    } finally {
      this.phaseExecute.flowEngine = previousFlowEngine;
      this.phaseExecute.setMessageAccumulator(previousAccumulator || this._messageAccumulator);
    }
  }

  _createIsolatedExecutionFlowEngine() {
    const flowEngine = new FlowEngine(`${WORKFLOW_ID}-isolated`, { maxRetries: 1 });
    flowEngine.transition(FLOW_EVENTS.START, { phase: 'isolated-execute' });
    flowEngine.transition(FLOW_EVENTS.ANALYSIS_DONE, { phase: 'isolated-execute' });
    flowEngine.transition(FLOW_EVENTS.PLAN_DONE, { phase: 'isolated-execute' });
    return flowEngine;
  }

  _advanceMainFlowTo(targetState) {
    const nextEventByState = {
      [FLOW_STATES.IDLE]: FLOW_EVENTS.START,
      [FLOW_STATES.ANALYZING]: FLOW_EVENTS.ANALYSIS_DONE,
      [FLOW_STATES.PLANNING]: FLOW_EVENTS.PLAN_DONE,
      [FLOW_STATES.EXECUTING]: FLOW_EVENTS.EXECUTE_DONE,
      [FLOW_STATES.REVIEWING]: FLOW_EVENTS.REVIEW_DONE,
      [FLOW_STATES.COMMITTING]: FLOW_EVENTS.COMMIT_DONE
    };

    const stateOrder = [
      FLOW_STATES.IDLE,
      FLOW_STATES.ANALYZING,
      FLOW_STATES.PLANNING,
      FLOW_STATES.EXECUTING,
      FLOW_STATES.REVIEWING,
      FLOW_STATES.COMMITTING,
      FLOW_STATES.COMPLETED
    ];

    while (this.flowEngine.state !== targetState) {
      const currentIndex = stateOrder.indexOf(this.flowEngine.state);
      const targetIndex = stateOrder.indexOf(targetState);
      const nextEvent = nextEventByState[this.flowEngine.state];

      if (
        nextEvent === undefined ||
        currentIndex === -1 ||
        targetIndex === -1 ||
        currentIndex >= targetIndex
      ) {
        return;
      }

      const transition = this.flowEngine.transition(nextEvent, {
        phase: 'orchestrator-sync',
        targetState
      });
      if (transition?.success === false) {
        return;
      }
    }
  }

  _resetMainFlowAfterGateFailure(gateReason) {
    const failTransition = this.flowEngine.transition(FLOW_EVENTS.FAIL, {
      phase: 'orchestrator-gate-failed',
      reason: gateReason
    });

    if (failTransition?.success === false && this.flowEngine.state === FLOW_STATES.COMPLETED) {
      this.flowEngine.transition(FLOW_EVENTS.RESET, {
        phase: 'orchestrator-gate-failed',
        reason: gateReason
      });
      return;
    }

    if (
      this.flowEngine.state === FLOW_STATES.FAILED ||
      this.flowEngine.state === FLOW_STATES.COMPLETED
    ) {
      this.flowEngine.transition(FLOW_EVENTS.RESET, {
        phase: 'orchestrator-gate-failed',
        reason: gateReason
      });
    }
  }

  async runAutoAction(action, payload = {}, options = {}) {
    const normalizedAction = action || 'run';

    switch (normalizedAction) {
      case 'run':
        if (options.dryRun) {
          return this._runAnalyzeAction(payload.task || '', options);
        }
        return this.run(payload.task || '', options);
      case 'analyze':
        return this._runAnalyzeAction(payload.task || '', options);
      case 'status':
        return this._runStatusAction(payload, options);
      case 'route':
        return this._runRouteAction(payload, options);
      case 'doctor':
        return this._runDoctorAction(payload, options);
      case 'learn':
        return this._runLearnAction(payload, options);
      case 'create-hook':
        return this._runCreateHookAction(payload, options);
      case 'resume':
        return this._runResumeAction(payload, options);
      default:
        throw new Error(`Unsupported auto action: ${normalizedAction}`);
    }
  }

  async _runAnalyzeAction(task, options = {}) {
    const mode = detectExecutionMode(task, options);
    this.phaseContext = this.phaseExecute.initializeWorkflowContext(this.phaseContext, task, {
      ...options,
      mode
    });

    this._syncDepsToModules();
    this.phaseContext = await this.phaseDiscover.run(this.phaseContext);
    this.phaseContext = await this.phaseExecute.runReason(this.phaseContext);

    return this.phaseExecute.buildAnalyzeSnapshot(this.getContext());
  }

  async _runStatusAction(payload = {}, options = {}) {
    const task = payload.task || options.task || 'status';
    const mode = detectExecutionMode(task, options);

    this.phaseContext = this.phaseExecute.initializeWorkflowContext(this.phaseContext, task, {
      ...options,
      mode
    });

    this._syncDepsToModules();
    this.phaseContext = await this.phaseDiscover.run(this.phaseContext);

    const runtime = this.getRuntimeStatus();
    const summary = this.phaseExecute.summarizeStatus(this.getContext());
    const capabilities = this.getContext().capabilities;
    let globalInstall = {};
    try {
      globalInstall = await checkStatus();
    } catch {
      globalInstall = {};
    }

    return {
      runtime,
      summary,
      capabilities,
      capabilitySources: {
        repo: capabilities,
        runtime,
        global: globalInstall
      },
      doctorResult: this.getContext().doctorResult,
      pendingInvocations: this.getContext().pendingInvocations
    };
  }

  async _runRouteAction(payload = {}, options = {}) {
    const { CanonicalRouter } = await import('../router/canonical-router.js');
    const { AgentRegistry } = await import('../router/agent-registry.js');

    const registry = new AgentRegistry(this.projectDir);
    const router = new CanonicalRouter(registry);
    await router.initialize();

    const result = await router.route(payload.intent || payload.task || '', {
      scope: 'on-demand'
    });

    if (!options.debug) {
      return result;
    }

    return {
      ...result,
      diagnose: await router.diagnose()
    };
  }

  async _runDoctorAction(payload = {}, options = {}) {
    return runDoctorChecks({
      ...options,
      ...payload,
      dir: payload.dir || options.dir || this.projectDir
    });
  }

  async _runLearnAction(payload = {}, options = {}) {
    if (payload.git || options.git) {
      const gitPatterns = await this.phaseLearn._analyzeGitPatterns(
        payload.commitCount || options.commitCount || 50
      );
      return {
        mode: 'git',
        gitPatterns
      };
    }

    return {
      mode: 'default',
      gitPatterns: null
    };
  }

  async _runCreateHookAction(payload = {}, options = {}) {
    const hookType = payload.type || options.type || 'template';
    const hookName = payload.name || options.name || 'custom-hook';
    return {
      type: hookType,
      name: hookName,
      template: `${hookType}:${hookName}`,
      recommendedLocation: '.claude/settings.json'
    };
  }

  async _runResumeAction(payload = {}, options = {}) {
    return runResumeWorkflow(payload.directive || '', {
      ...options,
      dir: payload.dir || options.dir || this.projectDir,
      mode: payload.mode || options.mode
    });
  }

  // --- 结果聚合方法（保留在协调器） ---

  /**
   * 获取运行时模块状态摘要
   * @returns {Object} 各模块的初始化状态和健康信息
   */
  getRuntimeStatus() {
    const activeAgentRegistry =
      this.phaseExecute._agentRegistry || this.phaseDiscover._agentRegistry;

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
        initialized: activeAgentRegistry !== null,
        stats: activeAgentRegistry ? activeAgentRegistry.getStats() : null,
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
    const pendingQuestPlans = this.phaseContext.pendingExecution?.questPlans || [];
    const allQuestPlans = Object.freeze([...questPlans, ...pendingQuestPlans]);

    const agentInvocations = allQuestPlans
      .filter((p) => p.agentInvocation)
      .map((p) => p.agentInvocation);
    const executionSummary = this.phaseExecute.buildExecutionSummary(this.phaseContext);
    const allCompletedQuests = Object.freeze([
      ...new Set([
        ...(this.phaseContext.completedQuests || []),
        ...((this.phaseContext.pendingExecution &&
          this.phaseContext.pendingExecution.completedQuests) ||
          [])
      ])
    ]);
    const allFailedQuests = Object.freeze([
      ...(this.phaseContext.failedQuests || []),
      ...((this.phaseContext.pendingExecution && this.phaseContext.pendingExecution.failedQuests) ||
        [])
    ]);
    const allChangedFiles = Object.freeze([
      ...new Set([
        ...(this.phaseContext.changedFiles || []),
        ...((this.phaseContext.pendingExecution &&
          this.phaseContext.pendingExecution.changedFiles) ||
          [])
      ])
    ]);

    const result = {
      status,
      error,
      mode: this.phaseContext.mode,
      capabilities: this.phaseContext.capabilities,
      completedQuests: allCompletedQuests,
      failedQuests: allFailedQuests,
      verificationActions: this.phaseContext.verificationActions,
      testResult: this.phaseContext.testResult,
      coverageResult: this.phaseContext.coverageResult,
      securityResult: this.phaseContext.securityResult,
      doctorResult: this.phaseContext.doctorResult,
      gitResult: this.phaseContext.gitResult,
      questPlans: allQuestPlans,
      agentInvocations: Object.freeze(agentInvocations),
      executionSummary,
      changedFiles: allChangedFiles,
      insights: this.phaseContext.insights,
      tokenBudget: this.phaseContext.tokenBudget,
      contextStatus: this.phaseContext.contextStatus,
      sessionSummary: this._pendingSessionSummary,
      resumeDirective: this._pendingSessionSummary
        ? createResumeDirective(this._pendingSessionSummary)
        : null
    };

    if (this.phaseContext.pendingExecution) {
      result.pendingExecution = {
        ...this.phaseContext.pendingExecution,
        agentInvocations: Object.freeze(
          pendingQuestPlans.filter((p) => p.agentInvocation).map((p) => p.agentInvocation)
        )
      };
    }

    return result;
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
    if (this._canonicalRouter !== undefined) {
      this.phaseVerify._canonicalRouter = this._canonicalRouter;
      this.phaseExecute._canonicalRouter = this._canonicalRouter;
    }
  }

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
