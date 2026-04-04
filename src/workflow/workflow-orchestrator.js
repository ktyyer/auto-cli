/**
 * Workflow Orchestrator — /auto 工作流编排器
 *
 * 集成 7 个核心模块到 6 PHASE 工作流：
 * - FlowEngine: PHASE 3 状态管理和重试
 * - MemoryManager: PHASE 5/6 记忆存储
 * - TokenBudgetManager: 全局 Token 预算控制
 * - ContextMonitor: 上下文窗口监控
 * - ModelRouter: PHASE 2 模型推荐
 * - SkillIndexer: PHASE 1 技能索引
 * - TraceCompactor: PHASE 4 错误栈压缩
 */

import { FlowEngine, FLOW_EVENTS } from '../flow/flow-engine.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { TokenBudgetManager } from '../budget/token-budget.js';
import { ContextMonitor, CONTEXT_STATUS } from '../budget/context-monitor.js';
import { routeModel } from '../router/model-router.js';
import { SkillIndexer } from '../skills/skill-indexer.js';
import { compactTrace } from '../utils/trace-compactor.js';
import {
  compressContext,
  createSessionSummary,
  createResumeDirective
} from '../budget/context-compressor.js';
import { twoTurnExtract, AutoDreamScheduler } from '../memory/auto-dream.js';
import { CanonicalRouter } from '../router/canonical-router.js';
import { AgentRegistry } from '../router/agent-registry.js';
import { RepoIndexer } from '../indexer/repo-indexer.js';
import { KnowledgeSteward } from '../knowledge/knowledge-steward.js';
import fs from 'fs-extra';
import path from 'node:path';
import {
  createPhaseContext,
  updatePhaseContext,
  detectExecutionMode,
  PHASE_NAMES,
  EXECUTION_MODES
} from './phase-context.js';
import { logger } from '../logger.js';

const WORKFLOW_ID = 'auto-workflow';

/**
 * 生成 Quest 执行指令文本
 * @param {Object} quest
 * @param {Object} modelRoute
 * @param {Object} team
 * @returns {string}
 */
function _generateQuestInstructions(quest, modelRoute, team) {
  const lines = [];
  lines.push(`Execute quest "${quest.id}" using model ${modelRoute.model}`);
  if (team.lead) lines.push(`Lead agent: ${team.lead.name}`);
  if (team.members?.length) lines.push(`Supporting: ${team.members.map((m) => m.name).join(', ')}`);
  if (quest.changedFiles?.length) lines.push(`Files to modify: ${quest.changedFiles.join(', ')}`);
  if (quest.acceptanceCriteria?.length) {
    lines.push('Acceptance criteria:');
    for (const ac of quest.acceptanceCriteria) lines.push(`  - ${ac}`);
  }
  return lines.join('\n');
}

/**
 * 语义动作映射 — 将 Agent 能力标签映射为自然语言动作描述
 * @readonly
 */
const CAPABILITY_SEMANTICS = Object.freeze({
  planning: '规划任务拆解和执行顺序',
  testing: '编写和运行测试用例',
  'code-review': '审查代码质量和规范合规',
  security: '检查安全漏洞和合规性',
  debugging: '定位和修复错误',
  refactoring: '优化代码结构和消除冗余',
  documentation: '更新文档和注释',
  'e2e-testing': '端到端测试验证关键流程',
  design: '设计系统架构和接口',
  implementation: '实现功能代码',
  optimization: '优化性能和资源使用'
});

/**
 * 生成 Agent 执行语义说明
 * @param {Object} agent - Agent 清单
 * @param {Object} quest - Quest 描述
 * @returns {string} 语义描述
 */
function _generateSemanticDescription(agent, quest) {
  if (!agent) return '执行任务';

  const parts = [];

  // Agent 角色描述
  parts.push(`${agent.displayName || agent.name}: ${agent.description || '通用执行'}`);

  // 能力映射到动作
  if (agent.capabilities?.length) {
    const actions = agent.capabilities
      .map((cap) => CAPABILITY_SEMANTICS[cap] || cap)
      .filter(Boolean);
    if (actions.length > 0) {
      parts.push(`执行动作: ${actions.join(', ')}`);
    }
  }

  // Quest 目标
  if (quest.title || quest.id) {
    parts.push(`目标: ${quest.title || quest.id}`);
  }

  return parts.join(' | ');
}

/**
 * 工作流编排器
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
    this.flowEngine = new FlowEngine(WORKFLOW_ID, { maxRetries: 2 });
    this.memory = new MemoryManager({ projectDir: this.projectDir });
    this.tokenBudget = new TokenBudgetManager();
    this.contextMonitor = new ContextMonitor();
    this.skillIndexer = new SkillIndexer(this.skillsDir);

    // 懒初始化模块（避免测试环境的文件系统依赖）
    this._agentRegistry = null;
    this._repoIndexer = null;

    // 当前上下文
    this.phaseContext = createPhaseContext();

    // Quest 引擎缓存（每个 Quest 一个）
    this.questEngines = new Map();

    // 消息累加器（上限 50 条，供 twoTurnExtract 使用）
    this._messageAccumulator = [];

    // 待续接的会话摘要
    this._pendingSessionSummary = null;

    // 验证路由器（懒初始化）
    this._canonicalRouter = null;

    // 自动记忆整理调度器
    this._dreamScheduler = new AutoDreamScheduler();

    // 知识管家（懒初始化，避免测试环境的文件系统依赖）
    this._knowledgeSteward = null;

    logger.info('[Orchestrator] 工作流编排器初始化完成');
  }

  /**
   * 执行完整工作流
   * @param {string} task 任务描述
   * @param {Object} options 执行选项
   * @returns {Promise<Object>} 执行结果
   */
  async run(task, options = {}) {
    const startTime = Date.now();

    // 初始化消息累加器
    this._messageAccumulator = [{ role: 'user', content: task }];
    this._pendingSessionSummary = null;

    try {
      // 1. 确定执行模式
      const mode = detectExecutionMode(task, options);
      this.phaseContext = updatePhaseContext(this.phaseContext, { mode, task });

      logger.info(`[Orchestrator] 开始执行工作流，模式: ${mode}, 任务: ${task}`);

      // 2. 执行 PHASE 1
      await this._runDiscover();
      if (mode === EXECUTION_MODES.MICRO) {
        // P0-2: 微型模式直接执行任务（不经过 Quest 设计）
        await this._runMicroExecute();
        await this._runLearn();
        return this._buildResult('completed');
      }

      // 3. 执行 PHASE 2
      await this._runReason();
      if (mode === EXECUTION_MODES.LIGHT) {
        await this._runVerify();
        await this._runLearn();
        return this._buildResult('completed');
      }

      // 4. 执行 PHASE 3
      await this._runExecute();

      // 5. 执行 PHASE 4
      await this._runVerify();

      // 6. 执行 PHASE 5
      await this._runCommit();

      // 7. 执行 PHASE 6
      await this._runLearn();

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

  /**
   * PHASE 1: DISCOVER — 扫描 + 能力清单
   */
  async _runDiscover() {
    logger.info('[PHASE 1] DISCOVER - 扫描上下文和能力');

    this.phaseContext = updatePhaseContext(this.phaseContext, { currentPhase: 1 });

    // Token 预算检查
    if (!this.tokenBudget.canAfford('discover', 5000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 1');
    }

    // 构建 Skill 索引
    let skillIndex = { totalSkills: 0, indexSize: 0 };
    try {
      skillIndex = await this.skillIndexer.buildIndex();
    } catch (e) {
      logger.warn(`[PHASE 1] SkillIndexer 失败: ${e.message}`);
    }

    // 统计 Agent 数量
    let agentCount = 0;
    try {
      const registry = await this._ensureAgentRegistry();
      agentCount = registry.listAgents().length;
    } catch (e) {
      logger.warn(`[PHASE 1] AgentRegistry 失败: ${e.message}`);
    }

    // 统计 Command 数量
    const commandCount = await this._countCommands();

    // 统计 Hook 数量
    const hookCount = await this._countHooks();

    // 确保 REPO_MAP.md 存在且新鲜
    await this._ensureRepoMap();

    // Doctor 快检：项目健康度诊断
    const doctorResult = await this._runDoctorCheck();
    if (doctorResult.issues.length > 0) {
      logger.warn(`[PHASE 1] Doctor 检测到 ${doctorResult.issues.length} 个问题`);
      for (const issue of doctorResult.issues) {
        logger.warn(`  - ${issue.severity}: ${issue.message}`);
      }
    } else {
      logger.info('[PHASE 1] Doctor 快检通过');
    }

    // 上下文窗口检查
    const contextStatus = this.contextMonitor.getStatus();
    if (contextStatus === CONTEXT_STATUS.COMPRESS_REQUIRED) {
      logger.warn('[PHASE 1] 上下文窗口严重不足，建议压缩');
    }

    // 上下文溢出检测 → 生成会话摘要
    this._checkContextOverflow(contextStatus);

    // 存储发现结果到记忆
    await this.memory.set(
      'last_discover',
      {
        commands: commandCount,
        agents: agentCount,
        skills: skillIndex.totalSkills,
        hooks: hookCount,
        contextStatus,
        timestamp: Date.now()
      },
      { tier: 'session' }
    );

    // FlowEngine 状态转移
    this.flowEngine.transition(FLOW_EVENTS.START, { phase: 1 });
    this.flowEngine.transition(FLOW_EVENTS.ANALYSIS_DONE, {
      skillsIndexed: skillIndex.totalSkills,
      agentsDiscovered: agentCount,
      commandsDiscovered: commandCount,
      hooksDiscovered: hookCount
    });

    // 消耗资源
    this.tokenBudget.consume('discover', 3000, 'PHASE 1 扫描');
    this.contextMonitor.record(5000, 'PHASE 1');

    const capabilities = Object.freeze({
      commands: commandCount,
      agents: agentCount,
      skills: skillIndex.totalSkills,
      hooks: hookCount
    });

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      capabilities,
      contextStatus,
      doctorResult
    });

    logger.info(
      `[PHASE 1] 完成: ${commandCount} cmd, ${agentCount} agents, ` +
        `${skillIndex.totalSkills} skills, ${hookCount} hooks`
    );
  }

  /**
   * 微型模式直接执行（P0-2: 不经过 Quest 设计，直接执行任务）
   * @private
   */
  async _runMicroExecute() {
    logger.info('[MICRO] 直接执行微型任务');

    this.phaseContext = updatePhaseContext(this.phaseContext, { currentPhase: 3 });

    // 模型路由
    const modelRoute = routeModel({
      keywords: this._extractKeywords(this.phaseContext.task)
    });

    // 创建单 Quest 并执行
    const microQuest = Object.freeze({
      id: 'micro-1',
      title: this.phaseContext.task.slice(0, 80),
      description: this.phaseContext.task,
      keywords: Object.freeze(this._extractKeywords(this.phaseContext.task)),
      complexity: 'low',
      changedFiles: Object.freeze([]),
      acceptanceCriteria: Object.freeze(['编译通过', '相关测试通过']),
      decisionNotes: Object.freeze([]),
      skills: Object.freeze([]),
      agent: null
    });

    const questEngine = new FlowEngine('quest-micro-1', { maxRetries: 1 });
    questEngine.transition(FLOW_EVENTS.START, { questId: microQuest.id });

    try {
      await this._executeQuest(microQuest, modelRoute, questEngine);
      questEngine.transition(FLOW_EVENTS.EXECUTE_DONE);

      this.phaseContext = updatePhaseContext(this.phaseContext, {
        completedQuests: [microQuest.id],
        failedQuests: [],
        questMap: [microQuest]
      });

      // 简化验证：编译 + 相关测试
      await this._runVerify();

      logger.info('[MICRO] 微型任务执行完成');
    } catch (error) {
      const compacted = compactTrace(error);
      logger.error(`[MICRO] 微型任务执行失败: ${compacted.compacted}`);

      this.phaseContext = updatePhaseContext(this.phaseContext, {
        completedQuests: [],
        failedQuests: [{ questId: microQuest.id, error: compacted.compacted }]
      });
    }

    // 状态转移
    this.flowEngine.transition(FLOW_EVENTS.EXECUTE_DONE);
    this.flowEngine.transition(FLOW_EVENTS.REVIEW_DONE);

    this.tokenBudget.consume('execute', 5000, 'MICRO 执行');
    this.contextMonitor.record(8000, 'MICRO');
  }

  /**
   * PHASE 2: REASON — Quest 设计
   */
  async _runReason() {
    logger.info('[PHASE 2] REASON - Quest 设计');

    this.phaseContext = updatePhaseContext(this.phaseContext, { currentPhase: 2 });

    if (!this.tokenBudget.canAfford('reason', 15000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 2');
    }

    // 模型路由
    const modelRoute = routeModel({
      keywords: this._extractKeywords(this.phaseContext.task)
    });

    logger.info(`[PHASE 2] 推荐模型: ${modelRoute.model} (${modelRoute.tier})`);

    // Agent 路由推荐
    let agentRecommendation = null;
    try {
      if (!this._canonicalRouter) {
        this._canonicalRouter = new CanonicalRouter();
        await this._canonicalRouter.initialize();
      }
      agentRecommendation = await this._canonicalRouter.route(this.phaseContext.task, {
        scope: 'on-demand'
      });
      logger.info(
        `[PHASE 2] 推荐 Agent: ${agentRecommendation.agent.name} (score=${agentRecommendation.score})`
      );
    } catch (routeError) {
      logger.warn(`[PHASE 2] Agent 路由失败: ${routeError.message}`);
    }

    // P0-3 + P2-4: 搜索匹配的 Skill 内容并注入上下文
    let matchedSkills = [];
    try {
      const keywords = this._extractKeywords(this.phaseContext.task);
      const searchResult = await this.skillIndexer.search(keywords);
      matchedSkills = Array.isArray(searchResult) ? searchResult.slice(0, 3) : [];
      if (matchedSkills.length > 0) {
        logger.info(`[PHASE 2] 匹配 Skills: ${matchedSkills.map((s) => s.name).join(', ')}`);
      }
    } catch (skillError) {
      logger.debug(`[PHASE 2] Skill 搜索跳过: ${skillError.message}`);
    }

    // P0-1: 生成 Quest Map（之前为空，导致 PHASE 3 永远跳过）
    const questMap = this._generateQuestMap(this.phaseContext.task, {
      agentRecommendation,
      matchedSkills,
      modelRoute,
      mode: this.phaseContext.mode
    });

    logger.info(`[PHASE 2] Quest Map 生成: ${questMap.length} 个 Quest`);

    // 存储 Quest 设计结果
    await this.memory.set(
      'last_quest_design',
      {
        model: modelRoute.model,
        tier: modelRoute.tier,
        agent: agentRecommendation ? agentRecommendation.agent.name : null,
        questCount: questMap.length,
        matchedSkills: matchedSkills.map((s) => s.name),
        timestamp: Date.now()
      },
      { tier: 'session' }
    );

    // FlowEngine 状态转移
    this.flowEngine.transition(FLOW_EVENTS.PLAN_DONE, {
      model: modelRoute.model,
      reason: modelRoute.reason,
      agent: agentRecommendation ? agentRecommendation.agent.name : null,
      questCount: questMap.length
    });

    // 消耗资源
    this.tokenBudget.consume('reason', 12000, 'PHASE 2 Quest 设计');
    this.contextMonitor.record(15000, 'PHASE 2');

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      modelRecommendations: modelRoute,
      agentRecommendation: agentRecommendation,
      matchedSkills: Object.freeze(matchedSkills),
      questMap: Object.freeze(questMap)
    });
  }

  /**
   * 根据 Agent 路由结果生成 Quest Map
   * @param {string} task - 任务描述
   * @param {Object} context - 路由上下文
   * @returns {Object[]} Quest Map 数组
   * @private
   */
  _generateQuestMap(task, { agentRecommendation, matchedSkills, modelRoute, mode }) {
    const keywords = this._extractKeywords(task);

    // 轻量模式：生成简化 Quest Map
    if (mode === EXECUTION_MODES.LIGHT) {
      return Object.freeze([
        Object.freeze({
          id: 'light-1',
          title: task.slice(0, 80),
          description: task,
          keywords: Object.freeze(keywords),
          complexity: 'medium',
          changedFiles: Object.freeze([]),
          acceptanceCriteria: Object.freeze(['编译通过', '相关测试通过']),
          decisionNotes: Object.freeze([]),
          skills: Object.freeze(matchedSkills.map((s) => s.name)),
          agent: agentRecommendation ? agentRecommendation.agent.name : null
        })
      ]);
    }

    // 完整模式：基于 Agent 能力生成多 Quest
    const quests = [];

    // Quest 1: 分析和设计
    if (agentRecommendation) {
      const agent = agentRecommendation.agent;
      const hasPlanning = agent.capabilities?.some((c) =>
        ['planning', 'design', 'architecture'].includes(c)
      );
      if (hasPlanning) {
        quests.push({
          id: 'quest-1',
          title: `分析和设计: ${task.slice(0, 60)}`,
          description: `使用 ${agent.name} 进行任务分析和设计`,
          keywords: Object.freeze(keywords),
          complexity: 'high',
          changedFiles: Object.freeze([]),
          acceptanceCriteria: Object.freeze(['任务分析完成', '设计方案确定', '风险评估完成']),
          decisionNotes: Object.freeze([]),
          skills: Object.freeze(matchedSkills.map((s) => s.name)),
          agent: agent.name
        });
      }
    }

    // Quest 2: 核心实现
    quests.push({
      id: `quest-${quests.length + 1}`,
      title: `核心实现: ${task.slice(0, 60)}`,
      description: task,
      keywords: Object.freeze(keywords),
      complexity: 'high',
      changedFiles: Object.freeze([]),
      acceptanceCriteria: Object.freeze(['功能实现完成', '编译通过', '测试通过']),
      decisionNotes: Object.freeze(
        matchedSkills.length > 0
          ? [`参考 Skill: ${matchedSkills.map((s) => s.name).join(', ')}`]
          : []
      ),
      skills: Object.freeze(matchedSkills.map((s) => s.name)),
      agent: agentRecommendation ? agentRecommendation.agent.name : null
    });

    // Quest 3: 验证（完整模式）
    if (mode === EXECUTION_MODES.FULL) {
      quests.push({
        id: `quest-${quests.length + 1}`,
        title: `验证和测试`,
        description: '验证实现质量，确保测试覆盖',
        keywords: Object.freeze(['test', 'verify', 'review']),
        complexity: 'medium',
        changedFiles: Object.freeze([]),
        acceptanceCriteria: Object.freeze(['测试覆盖率 >= 80%', '安全扫描通过', '代码审查通过']),
        decisionNotes: Object.freeze([]),
        skills: Object.freeze([]),
        agent: 'tdd-guide'
      });
    }

    return Object.freeze(quests.map((q) => Object.freeze(q)));
  }

  /**
   * PHASE 3: EXECUTE — 逐关执行
   */
  async _runExecute() {
    logger.info('[PHASE 3] EXECUTE - 逐关执行');

    this.phaseContext = updatePhaseContext(this.phaseContext, { currentPhase: 3 });

    if (!this.tokenBudget.canAfford('execute', 30000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 3');
    }

    const questMap = this.phaseContext.questMap;
    if (!questMap || questMap.length === 0) {
      logger.warn('[PHASE 3] 无 Quest 地图，跳过执行');
      this.flowEngine.transition(FLOW_EVENTS.EXECUTE_DONE);
      return;
    }

    const completedQuests = [];
    const failedQuests = [];

    for (const quest of questMap) {
      // 创建 Quest 级别的 FlowEngine 实例
      const questEngine = new FlowEngine(`quest-${quest.id}`, { maxRetries: 2 });
      this.questEngines.set(quest.id, questEngine);

      questEngine.transition(FLOW_EVENTS.START, { questId: quest.id });

      try {
        // 模型路由
        const modelRoute = routeModel({ keywords: quest.keywords || [] });

        // 执行 Quest
        await this._executeQuest(quest, modelRoute, questEngine);

        // 成功
        questEngine.transition(FLOW_EVENTS.EXECUTE_DONE);
        completedQuests.push(quest.id);

        // 记录变更文件
        if (quest.changedFiles) {
          await this.memory.set(`quest_${quest.id}_files`, quest.changedFiles, {
            tier: 'project',
            tags: ['quest', 'changes']
          });
        }

        logger.info(`[PHASE 3] Quest ${quest.id} 执行成功`);
      } catch (error) {
        const compacted = compactTrace(error);
        logger.error(`[PHASE 3] Quest ${quest.id} 执行失败: ${compacted.compacted}`);

        // 尝试重试
        let retrySuccess = false;
        for (let retry = 1; retry <= 2; retry++) {
          questEngine.transition(FLOW_EVENTS.FAIL);
          questEngine.transition(FLOW_EVENTS.RETRY);

          try {
            const modelRoute = routeModel({ keywords: quest.keywords || [] });
            await this._executeQuest(quest, modelRoute, questEngine);
            questEngine.transition(FLOW_EVENTS.EXECUTE_DONE);
            retrySuccess = true;
            completedQuests.push(quest.id);
            logger.info(`[PHASE 3] Quest ${quest.id} 重试成功`);
            break;
          } catch (retryError) {
            if (retry === 2) {
              // 保存快照
              await questEngine.saveSnapshot(this.projectDir);
              failedQuests.push({ questId: quest.id, error: compactTrace(retryError).compacted });
            }
          }
        }

        if (!retrySuccess && !failedQuests.find((f) => f.questId === quest.id)) {
          failedQuests.push({ questId: quest.id, error: compacted.compacted });
        }
      }

      // 更新 Token 和上下文
      this.tokenBudget.consume('execute', 8000, `Quest ${quest.id}`);
      this.contextMonitor.record(10000, `PHASE 3 Quest ${quest.id}`);
    }

    // Quest 间压缩检查
    this._checkContextOverflow(this.contextMonitor.getStatus());

    this.flowEngine.transition(FLOW_EVENTS.EXECUTE_DONE);

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      completedQuests,
      failedQuests
    });

    logger.info(`[PHASE 3] 完成，成功: ${completedQuests.length}, 失败: ${failedQuests.length}`);
  }

  /**
   * 执行单个 Quest（生成结构化执行计划）
   * @param {Object} quest - Quest 描述
   * @param {Object} modelRoute - 模型路由结果
   * @param {FlowEngine} questEngine - Quest 级别 FSM
   * @returns {Promise<{success: boolean, executionPlan?: Object}>}
   * @private
   */
  async _executeQuest(quest, modelRoute, questEngine) {
    logger.debug(`[Quest ${quest.id}] 使用模型 ${modelRoute.model} 执行`);

    // 解析团队
    let team = { lead: null, members: [], fallbacks: [] };
    try {
      const registry = await this._ensureAgentRegistry();
      team = registry.resolveTeam({
        keywords: quest.keywords || [],
        complexity: quest.complexity,
        maxSize: 3
      });
    } catch (e) {
      logger.warn(`[Quest ${quest.id}] 团队解析失败: ${e.message}`);
    }

    // 构建执行计划
    const semanticDescription = _generateSemanticDescription(team.lead, quest);
    const executionPlan = Object.freeze({
      questId: quest.id,
      model: modelRoute.model,
      tier: modelRoute.tier,
      semanticDescription,
      lead: team.lead
        ? { name: team.lead.name, capabilities: Object.freeze([...team.lead.capabilities]) }
        : null,
      members: Object.freeze(
        team.members.map((m) => ({
          name: m.name,
          capabilities: Object.freeze([...m.capabilities])
        }))
      ),
      fallbacks: Object.freeze((team.fallbacks || []).map((f) => ({ name: f.name }))),
      acceptanceCriteria: Object.freeze([...(quest.acceptanceCriteria || [])]),
      decisionNotes: Object.freeze([...(quest.decisionNotes || [])]),
      changedFiles: Object.freeze([...(quest.changedFiles || [])]),
      instructions: _generateQuestInstructions(quest, modelRoute, team)
    });

    // 记录合成消息到累加器（上限 50 条）
    if (this._messageAccumulator.length < 50) {
      this._messageAccumulator.push({
        role: 'quest-plan',
        content: JSON.stringify(executionPlan)
      });
    }

    // 记录变更
    this.phaseContext = updatePhaseContext(this.phaseContext, {
      currentQuest: quest,
      changedFiles: quest.changedFiles
        ? [...this.phaseContext.changedFiles, ...quest.changedFiles]
        : this.phaseContext.changedFiles
    });

    // P2-1: 持久化 Agent 执行结果
    const leadName = team.lead ? team.lead.name : 'unknown';
    await this._persistAgentResult(leadName, { success: true }, quest.id);

    return { success: true, executionPlan };
  }

  /**
   * PHASE 4: VERIFY — 门禁验证
   */
  async _runVerify() {
    logger.info('[PHASE 4] VERIFY - 门禁验证');

    this.phaseContext = updatePhaseContext(this.phaseContext, { currentPhase: 4 });

    if (!this.tokenBudget.canAfford('verify', 8000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 4');
    }

    // 验证失败场景处理 — 自动路由到 build-error-resolver
    const verificationActions = [];
    if (this.phaseContext.failedQuests && this.phaseContext.failedQuests.length > 0) {
      for (const failed of this.phaseContext.failedQuests) {
        const compacted = compactTrace(new Error(failed.error));
        logger.error(`[PHASE 4] Quest ${failed.questId} 验证失败: ${compacted.compacted}`);

        // 路由失败 Quest 到合适的 agent
        try {
          if (!this._canonicalRouter) {
            this._canonicalRouter = new CanonicalRouter();
            await this._canonicalRouter.initialize();
          }
          const routeResult = await this._canonicalRouter.route(
            `build error: ${compacted.compacted}`,
            { scope: 'on-demand', flags: { failedQuest: true } }
          );
          verificationActions.push({
            questId: failed.questId,
            agentName: routeResult.agent.name,
            score: routeResult.score,
            matchReason: routeResult.matchReason
          });
          logger.info(`[PHASE 4] Quest ${failed.questId} 路由到 ${routeResult.agent.name}`);
        } catch (routeError) {
          logger.warn(`[PHASE 4] 路由失败，使用默认: ${routeError.message}`);
          verificationActions.push({
            questId: failed.questId,
            agentName: 'build-error-resolver',
            score: 0,
            matchReason: 'fallback'
          });
        }
      }
    }

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      verificationActions: Object.freeze(verificationActions)
    });

    const mode = this.phaseContext.mode || EXECUTION_MODES.FULL;
    const isFullMode = mode === EXECUTION_MODES.FULL;

    // 测试运行器检测和执行
    let testResult = null;
    let coverageResult = null;
    let securityResult = null;
    const testRunner = await this._detectTestRunner();
    if (testRunner) {
      logger.info(`[PHASE 4] 检测到测试运行器: ${testRunner.command}`);

      // 完整模式：带覆盖率测试
      testResult = await this._runTests(testRunner, isFullMode);
      if (!testResult.passed) {
        logger.error(`[PHASE 4] 测试失败 (exit ${testResult.exitCode})`);
      } else {
        logger.info('[PHASE 4] 测试通过');
      }

      // 覆盖率检查（仅完整模式）
      if (isFullMode && testResult.coverage) {
        coverageResult = testResult.coverage;
        if (coverageResult.passing) {
          logger.info(`[PHASE 4] 覆盖率达标: ${coverageResult.overall}%`);
        } else {
          logger.warn(`[PHASE 4] 覆盖率不足: ${coverageResult.overall}% < 80%`);
        }
      }
    } else {
      logger.debug('[PHASE 4] 未检测到测试运行器，跳过测试');
    }

    // 安全扫描路由（仅完整模式）
    if (isFullMode) {
      securityResult = await this._runSecurityScan();
      if (securityResult.scanTriggered) {
        logger.info(`[PHASE 4] 安全扫描已路由到 ${securityResult.agentName}`);
      }
    }

    // 检查上下文窗口
    const contextStatus = this.contextMonitor.getStatus();
    if (contextStatus === CONTEXT_STATUS.OVERFLOW) {
      logger.error('[PHASE 4] 上下文窗口溢出');
    }

    this.flowEngine.transition(FLOW_EVENTS.REVIEW_DONE);

    this.tokenBudget.consume('verify', 5000, 'PHASE 4 验证');
    this.contextMonitor.record(6000, 'PHASE 4');

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      contextStatus,
      testResult,
      coverageResult,
      securityResult
    });

    // P2-2: 验证结果持久化到 MemoryManager（后续会话可查询）
    try {
      await this.memory.set(
        'last_verification',
        {
          testPassed: testResult?.passed ?? null,
          coverageOverall: coverageResult?.overall ?? null,
          securityScanTriggered: securityResult?.scanTriggered ?? false,
          failedQuests: [...this.phaseContext.failedQuests].map((f) => f.questId),
          timestamp: Date.now()
        },
        { tier: 'session', tags: ['verification', 'results'] }
      );
    } catch (persistError) {
      logger.debug(`验证结果持久化失败: ${persistError.message}`);
    }
  }

  /**
   * PHASE 5: COMMIT — 增量提交
   */
  async _runCommit() {
    logger.info('[PHASE 5] COMMIT - 增量提交');

    this.phaseContext = updatePhaseContext(this.phaseContext, { currentPhase: 5 });

    if (!this.tokenBudget.canAfford('commit', 3000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 5');
    }

    // 构建 commit 消息
    const questCount = this.phaseContext.completedQuests?.length || 0;
    const commitMessage =
      questCount > 0
        ? `auto: complete ${questCount} quest(s) - ${(this.phaseContext.task || 'task').slice(0, 60)}`
        : `auto: update - ${(this.phaseContext.task || 'task').slice(0, 60)}`;

    // 执行 git commit
    const gitResult = await this._executeGitCommit(this.phaseContext.changedFiles, commitMessage);

    // 记录提交结果到记忆
    await this.memory.set(
      'last_commit',
      {
        files: this.phaseContext.changedFiles,
        questCount,
        gitResult,
        timestamp: Date.now()
      },
      {
        tier: 'project',
        tags: ['commit', 'changes']
      }
    );

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      gitResult
    });

    this.tokenBudget.consume('commit', 2000, 'PHASE 5 提交');
  }

  /**
   * PHASE 6: LEARN — 知识沉淀
   */
  async _runLearn() {
    logger.info('[PHASE 6] LEARN - 知识沉淀');

    this.phaseContext = updatePhaseContext(this.phaseContext, { currentPhase: 6 });

    if (!this.tokenBudget.canAfford('learn', 2000)) {
      logger.warn('[PHASE 6] Token 预算不足，跳过知识沉淀');
      return;
    }

    // 两轮记忆提取：从消息累加器提取用户偏好、错误修正、项目模式
    try {
      const extractResult = await twoTurnExtract(this.memory, this._messageAccumulator);
      logger.info(
        `[PHASE 6] 记忆提取: ${extractResult.turn2Writes} 条写入, ${extractResult.extracted.length} 条提取`
      );
    } catch (extractError) {
      logger.warn(`[PHASE 6] 记忆提取失败: ${extractError.message}`);
    }

    // Auto Dream 自动记忆整理（门控触发：需要 >=3 次 session 且间隔 >=5 分钟）
    try {
      this._dreamScheduler.incrementSession();
      const dreamResult = await this._dreamScheduler.run(this.memory);
      if (dreamResult.executed) {
        logger.info(
          `[PHASE 6] AutoDream: ${dreamResult.reason}, 合并=${dreamResult.stats.merged}, 晋升=${dreamResult.stats.promoted}, 清理=${dreamResult.stats.pruned}`
        );
      } else {
        logger.debug(`[PHASE 6] AutoDream 跳过: ${dreamResult.reason}`);
      }
    } catch (dreamError) {
      logger.warn(`[PHASE 6] AutoDream 失败: ${dreamError.message}`);
    }

    // KnowledgeSteward: 将执行经验持久化到 .auto/insights/
    try {
      if (!this._knowledgeSteward) {
        this._knowledgeSteward = new KnowledgeSteward(this.projectDir);
      }
      const insightSummary = [
        `任务: ${this.phaseContext.task}`,
        `模式: ${this.phaseContext.mode}`,
        `完成: ${this.phaseContext.completedQuests.length} 关, 失败: ${this.phaseContext.failedQuests.length} 关`,
        `变更文件: ${this.phaseContext.changedFiles.length} 个`
      ].join('\n');

      await this._knowledgeSteward.save({
        content: insightSummary,
        category: 'pattern',
        tags: ['auto-workflow', 'experience']
      });
      logger.info('[PHASE 6] KnowledgeSteward: 经验已持久化');
    } catch (stewardError) {
      logger.warn(`[PHASE 6] KnowledgeSteward 失败: ${stewardError.message}`);
    }

    // 存储执行经验到 project 层
    const insight = {
      task: this.phaseContext.task,
      mode: this.phaseContext.mode,
      completedQuests: this.phaseContext.completedQuests.length,
      failedQuests: this.phaseContext.failedQuests.length,
      totalFiles: this.phaseContext.changedFiles.length,
      modelRecommendations: this.phaseContext.modelRecommendations,
      timestamp: Date.now()
    };

    await this.memory.set(`insight_${Date.now()}`, insight, {
      tier: 'project',
      tags: ['experience', 'workflow']
    });

    // Git 历史模式分析（类似 /learn --git 模式）
    try {
      const gitPatterns = await this._analyzeGitPatterns();
      if (
        gitPatterns &&
        (gitPatterns.commitConventions.length > 0 || gitPatterns.fileCochanges.length > 0)
      ) {
        await this.memory.set('git_patterns', gitPatterns, {
          tier: 'project',
          tags: ['git', 'patterns', 'learn']
        });
        logger.info(
          `[PHASE 6] Git 模式分析: ${gitPatterns.commitConventions.length} 提交约定, ${gitPatterns.fileCochanges.length} 文件联动`
        );
      }
    } catch (gitError) {
      logger.debug(`[PHASE 6] Git 模式分析跳过: ${gitError.message}`);
    }

    // P1-3: 架构变更时自动触发 doc-updater 更新文档和 CODEMAPS
    try {
      const isArchitectureChange = this._detectArchitectureChange();
      if (isArchitectureChange) {
        const docRouteResult = await this._canonicalRouter.route(
          'update documentation and code maps',
          { scope: 'on-demand' }
        );
        await this.memory.set(
          'pending_doc_update',
          {
            agent: docRouteResult.agent.name,
            trigger: 'architecture-change',
            changedFiles: [...this.phaseContext.changedFiles],
            timestamp: Date.now()
          },
          { tier: 'session', tags: ['doc-updater', 'pending'] }
        );
        logger.info(
          `[PHASE 6] 架构变更检测: 已记录 doc-updater 任务 (→ ${docRouteResult.agent.name})`
        );
      }
    } catch (docError) {
      logger.debug(`[PHASE 6] doc-updater 触发跳过: ${docError.message}`);
    }

    // P1-4: refactor-cleaner DELETION_LOG 持久化
    try {
      const deletionLog = await this._generateDeletionLog();
      if (deletionLog.entries.length > 0) {
        const logDir = path.join(this.projectDir, 'docs');
        await fs.ensureDir(logDir);
        await fs.writeJson(path.join(logDir, 'DELETION_LOG.json'), deletionLog, { spaces: 2 });
        logger.info(`[PHASE 6] DELETION_LOG: ${deletionLog.entries.length} 条记录已持久化`);
      }
    } catch (logError) {
      logger.debug(`[PHASE 6] DELETION_LOG 生成跳过: ${logError.message}`);
    }

    // 重置 FlowEngine
    this.flowEngine.transition(FLOW_EVENTS.RESET);

    this.tokenBudget.consume('learn', 1000, 'PHASE 6 知识沉淀');

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      insights: [...this.phaseContext.insights, insight]
    });
  }

  // --- 能力发现辅助方法 ---

  /**
   * 懒初始化 Agent 注册表
   * @returns {Promise<import('../router/agent-registry.js').AgentRegistry>}
   * @private
   */
  async _ensureAgentRegistry() {
    if (!this._agentRegistry) {
      this._agentRegistry = new AgentRegistry(this.projectDir);
      await this._agentRegistry.initialize();
    }
    return this._agentRegistry;
  }

  /**
   * 扫描 commands/ 目录统计 .md 文件数
   * @returns {Promise<number>}
   * @private
   */
  async _countCommands() {
    try {
      const commandsDir = path.join(this.projectDir, 'commands');
      if (!(await fs.pathExists(commandsDir))) return 0;
      const files = await fs.readdir(commandsDir);
      return files.filter((f) => f.endsWith('.md')).length;
    } catch {
      return 0;
    }
  }

  /**
   * 读取 hooks/hooks.json 统计 hook 数量
   * @returns {Promise<number>}
   * @private
   */
  async _countHooks() {
    try {
      const hooksPath = path.join(this.projectDir, 'hooks', 'hooks.json');
      if (!(await fs.pathExists(hooksPath))) return 0;
      const data = await fs.readJson(hooksPath);
      const hookSections = data.hooks || {};
      return Object.values(hookSections).reduce((total, entries) => {
        // entries 是数组（每个 matcher 下的 hooks 数组）
        const sectionEntries = Array.isArray(entries) ? entries : [];
        return (
          total +
          sectionEntries.reduce((sum, matcher) => {
            return sum + (matcher.hooks ? matcher.hooks.length : 0);
          }, 0)
        );
      }, 0);
    } catch {
      return 0;
    }
  }

  /**
   * 确保 REPO_MAP.md 存在且新鲜（<24h），否则生成
   * @private
   */
  async _ensureRepoMap() {
    try {
      const repoMapPath = path.join(this.projectDir, 'REPO_MAP.md');

      if (await fs.pathExists(repoMapPath)) {
        const stat = await fs.stat(repoMapPath);
        const age = Date.now() - stat.mtimeMs;
        if (age < 24 * 60 * 60 * 1000) {
          logger.debug('[PHASE 1] REPO_MAP.md 新鲜，跳过重新生成');
          return;
        }
      }

      const indexer = new RepoIndexer(this.projectDir);
      await indexer.generateRepoMap();
      logger.info('[PHASE 1] REPO_MAP.md 已生成');
    } catch (e) {
      logger.warn(`[PHASE 1] RepoIndexer 失败: ${e.message}`);
    }
  }

  /**
   * 检测测试运行器
   * @returns {Promise<{command: string, runner: string}|null>}
   * @private
   */
  async _detectTestRunner() {
    try {
      const pkgPath = path.join(this.projectDir, 'package.json');
      if (!(await fs.pathExists(pkgPath))) return null;
      const pkg = await fs.readJson(pkgPath);
      const testScript = pkg.scripts?.test;
      if (!testScript || testScript === 'echo "Error: no test specified" && exit 1') return null;
      return { command: testScript, runner: 'npm' };
    } catch {
      return null;
    }
  }

  /**
   * 执行测试（带覆盖率）
   * @param {Object} _testRunner
   * @param {boolean} [withCoverage=false] - 是否收集覆盖率
   * @returns {Promise<{passed: boolean, output: string, exitCode?: number, coverage?: Object}>}
   * @private
   */
  async _runTests(_testRunner, withCoverage = false) {
    try {
      const { execSync } = await import('node:child_process');
      const command = withCoverage ? 'npm test -- --coverage 2>&1' : 'npm test 2>&1';
      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: this.projectDir,
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = { passed: true, output: output.slice(-2000) };

      if (withCoverage) {
        result.coverage = this._parseCoverageOutput(output);
      }

      return Object.freeze(result);
    } catch (error) {
      const combinedOutput = ((error.stdout || '') + (error.stderr || '')).slice(-2000);
      const result = {
        passed: false,
        output: combinedOutput,
        exitCode: error.status ?? 1
      };

      if (withCoverage) {
        result.coverage = this._parseCoverageOutput(combinedOutput);
      }

      return Object.freeze(result);
    }
  }

  /**
   * 解析测试覆盖率输出
   * 支持 Vitest、Jest、nyc/c8 格式
   * @param {string} output - 测试输出
   * @returns {Object} 覆盖率数据
   * @private
   */
  _parseCoverageOutput(output) {
    const coverage = { lines: 0, branches: 0, functions: 0, statements: 0, passing: false };

    // Vitest / Jest coverage table format: "All files | 80.5 | 75.2 | 90.1 | 82.3"
    const summaryLine = output.match(
      /All files[|\s]+(\d+(?:\.\d+)?)\s*[|]\s*(\d+(?:\.\d+)?)\s*[|]\s*(\d+(?:\.\d+)?)\s*[|]\s*(\d+(?:\.\d+)?)/
    );
    if (summaryLine) {
      coverage.statements = parseFloat(summaryLine[1]);
      coverage.branches = parseFloat(summaryLine[2]);
      coverage.functions = parseFloat(summaryLine[3]);
      coverage.lines = parseFloat(summaryLine[4]);
    } else {
      // nyc / c8 format: "Statements   : 80.5% ( 160/200 )"
      const statements = output.match(/Statements\s*:\s*(\d+(?:\.\d+)?)%/);
      const branches = output.match(/Branches\s*:\s*(\d+(?:\.\d+)?)%/);
      const functions = output.match(/Functions\s*:\s*(\d+(?:\.\d+)?)%/);
      const lines = output.match(/Lines\s*:\s*(\d+(?:\.\d+)?)%/);

      if (statements) coverage.statements = parseFloat(statements[1]);
      if (branches) coverage.branches = parseFloat(branches[1]);
      if (functions) coverage.functions = parseFloat(functions[1]);
      if (lines) coverage.lines = parseFloat(lines[1]);
    }

    // 综合覆盖率 = 最低指标（最保守）
    const all = [coverage.statements, coverage.branches, coverage.functions, coverage.lines].filter(
      (v) => v > 0
    );
    coverage.overall = all.length > 0 ? Math.min(...all) : 0;
    coverage.passing = coverage.overall >= 80;

    return Object.freeze(coverage);
  }

  /**
   * Doctor 快检：项目健康度诊断
   * @returns {Promise<{healthy: boolean, issues: Object[], checks: Object}>}
   * @private
   */
  async _runDoctorCheck() {
    const issues = [];
    const checks = {};

    // 1. 关键文件检查
    const criticalFiles = [
      { path: 'CLAUDE.md', severity: 'warning', message: 'CLAUDE.md 缺失 — 项目上下文文件不存在' },
      { path: 'REPO_MAP.md', severity: 'info', message: 'REPO_MAP.md 缺失 — 代码地图未生成' },
      {
        path: 'package.json',
        severity: 'info',
        message: 'package.json 缺失 — 非 Node.js 项目或未初始化'
      }
    ];

    for (const cf of criticalFiles) {
      const exists = await fs.pathExists(path.join(this.projectDir, cf.path));
      checks[cf.path] = exists;
      if (!exists) {
        issues.push({ severity: cf.severity, message: cf.message, file: cf.path });
      }
    }

    // 2. Git 状态检查
    try {
      const { execSync } = await import('node:child_process');
      const branch = execSync('git branch --show-current', {
        cwd: this.projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      })
        .toString()
        .trim();
      checks.gitBranch = branch;

      // 检查是否有未提交的变更（仅信息提示）
      const status = execSync('git status --porcelain', {
        cwd: this.projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      })
        .toString()
        .trim();
      checks.dirtyFiles = status ? status.split('\n').length : 0;
    } catch {
      checks.gitAvailable = false;
      issues.push({ severity: 'info', message: 'Git 不可用 — 无法检查仓库状态' });
    }

    // 3. 依赖安装检查
    const nodeModulesExists = await fs.pathExists(path.join(this.projectDir, 'node_modules'));
    checks.nodeModules = nodeModulesExists;
    if (!nodeModulesExists && checks['package.json']) {
      issues.push({
        severity: 'warning',
        message: 'node_modules 缺失 — 运行 npm install 安装依赖'
      });
    }

    // 4. 测试运行器检查
    const testRunner = await this._detectTestRunner();
    checks.testRunner = testRunner ? testRunner.runner : null;
    if (!testRunner && checks['package.json']) {
      issues.push({
        severity: 'info',
        message: '未配置测试运行器 — 建议在 package.json 中添加 test 脚本'
      });
    }

    // 5. Hooks 配置检查
    const hooksPath = path.join(this.projectDir, 'hooks', 'hooks.json');
    const hooksExists = await fs.pathExists(hooksPath);
    checks.hooksConfigured = hooksExists;

    // 6. 记忆系统检查
    try {
      const stats = await this.memory.getStats();
      checks.memoryStats = stats;
    } catch {
      checks.memoryAvailable = false;
    }

    return Object.freeze({
      healthy: issues.filter((i) => i.severity === 'error').length === 0,
      issues: Object.freeze(issues),
      checks: Object.freeze(checks)
    });
  }

  /**
   * 分析 Git 历史模式（/learn --git 轻量版）
   * 提取提交约定、文件联动、工作流序列
   * @param {number} [commitCount=50] - 分析最近 N 次提交
   * @returns {Promise<Object|null>}
   * @private
   */
  async _analyzeGitPatterns(commitCount = 50) {
    try {
      const { execSync } = await import('node:child_process');

      // 获取最近提交消息
      const logOutput = execSync(`git log --oneline -n ${commitCount} --pretty=format:"%s"`, {
        cwd: this.projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000
      }).toString();

      const messages = logOutput.split('\n').filter(Boolean);
      if (messages.length < 3) return null;

      // 检测提交约定
      const commitConventions = [];
      const conventionPatterns = [
        {
          pattern: /^(feat|fix|refactor|docs|test|chore|perf|ci|build|style)(\(.+\))?:/,
          name: 'conventional-commits'
        },
        { pattern: /^(Merge|Revert)\s/, name: 'merge-revert' }
      ];

      const conventionCounts = {};
      for (const msg of messages) {
        for (const { pattern, name } of conventionPatterns) {
          if (pattern.test(msg)) {
            conventionCounts[name] = (conventionCounts[name] || 0) + 1;
          }
        }
      }

      for (const [name, count] of Object.entries(conventionCounts)) {
        const ratio = count / messages.length;
        if (ratio >= 0.3) {
          commitConventions.push({ name, ratio: Math.round(ratio * 100), sampleCount: count });
        }
      }

      // 获取文件变更频率
      const nameOnlyOutput = execSync(
        `git log --oneline -n ${commitCount} --name-only --pretty=format:""`,
        { cwd: this.projectDir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }
      ).toString();

      const fileChanges = {};
      const fileCochanges = [];
      const lines = nameOnlyOutput.split('\n').filter(Boolean);

      for (const line of lines) {
        const file = line.trim();
        if (!file || file.startsWith('Merge')) continue;
        fileChanges[file] = (fileChanges[file] || 0) + 1;
      }

      // 检测文件联动（出现在同一提交中的文件对）
      const commits = nameOnlyOutput.split('\n\n').filter(Boolean);
      for (const commit of commits) {
        const files = commit.split('\n').filter((f) => f.trim() && !f.startsWith('Merge'));
        if (files.length >= 2 && files.length <= 10) {
          for (let i = 0; i < files.length - 1; i++) {
            for (let j = i + 1; j < files.length; j++) {
              const pair = [files[i].trim(), files[j].trim()].sort().join(' <-> ');
              const existing = fileCochanges.find((fc) => fc.pair === pair);
              if (existing) {
                existing.count++;
              } else if (fileCochanges.length < 20) {
                fileCochanges.push({ pair, count: 1 });
              }
            }
          }
        }
      }

      // 只保留高频联动
      const significantCochanges = fileCochanges
        .filter((fc) => fc.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // 热点文件（变更频率 >= 3）
      const hotFiles = Object.entries(fileChanges)
        .filter(([, count]) => count >= 3)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([file, count]) => ({ file, changes: count }));

      return Object.freeze({
        analyzedCommits: messages.length,
        commitConventions: Object.freeze(commitConventions),
        fileCochanges: Object.freeze(significantCochanges),
        hotFiles: Object.freeze(hotFiles),
        analyzedAt: Date.now()
      });
    } catch {
      return null;
    }
  }

  /**
   * 运行安全扫描（通过路由到 security-reviewer）
   * @returns {Promise<Object>}
   * @private
   */
  async _runSecurityScan() {
    try {
      if (!this._canonicalRouter) {
        this._canonicalRouter = new CanonicalRouter();
        await this._canonicalRouter.initialize();
      }

      const routeResult = await this._canonicalRouter.route('security scan audit review', {
        scope: 'on-demand',
        flags: { securityReview: true }
      });

      const securityResult = {
        agentName: routeResult.agent.name,
        score: routeResult.score,
        matchReason: routeResult.matchReason,
        scanTriggered: true
      };

      logger.info(
        `[PHASE 4] 安全扫描路由到: ${routeResult.agent.name} (score=${routeResult.score})`
      );

      return Object.freeze(securityResult);
    } catch (error) {
      logger.warn(`[PHASE 4] 安全扫描路由失败: ${error.message}`);
      return Object.freeze({
        agentName: 'security-reviewer',
        score: 0,
        matchReason: 'fallback',
        scanTriggered: false,
        error: error.message
      });
    }
  }

  /**
   * 执行 git commit（dryRun 时跳过）
   * @param {string[]} files - 变更文件列表
   * @param {string} message - commit 消息
   * @returns {Promise<{committed: boolean, reason?: string, fileCount?: number}>}
   * @private
   */
  async _executeGitCommit(files, message) {
    if (this.dryRun || !files || files.length === 0) {
      logger.info('[PHASE 5] DRY RUN - 跳过 git commit');
      return Object.freeze({ committed: false, reason: files?.length ? 'dry-run' : 'no-files' });
    }

    try {
      const { execSync } = await import('node:child_process');

      for (const file of files) {
        execSync(`git add "${file}"`, { cwd: this.projectDir, stdio: 'pipe' });
      }

      const safeMessage = message.replace(/"/g, '\\"').slice(0, 500);
      execSync(`git commit -m "${safeMessage}"`, { cwd: this.projectDir, stdio: 'pipe' });

      logger.info(`[PHASE 5] Git commit: ${files.length} files`);
      return Object.freeze({ committed: true, fileCount: files.length });
    } catch (error) {
      logger.warn(`[PHASE 5] Git commit 失败: ${error.message}`);
      return Object.freeze({ committed: false, reason: error.message });
    }
  }

  /**
   * 从任务中提取关键词
   * @private
   */
  _extractKeywords(task) {
    if (!task) return [];
    // 简单的关键词提取
    return task.split(/[\s,.，。]+/).filter((w) => w.length > 2);
  }

  /**
   * 检测是否涉及架构变更（P1-3: 触发 doc-updater）
   * @returns {boolean}
   * @private
   */
  _detectArchitectureChange() {
    const task = (this.phaseContext.task || '').toLowerCase();
    const architectureKeywords = [
      '架构',
      'architecture',
      '重构',
      'refactor',
      '迁移',
      'migrate',
      '系统',
      'system',
      '模块',
      'module',
      '接口',
      'interface',
      '新增模块',
      '删除模块',
      '合并',
      '拆分',
      '整合'
    ];
    return architectureKeywords.some((kw) => task.includes(kw));
  }

  /**
   * 生成 DELETION_LOG（P1-4: refactor-cleaner 日志持久化）
   * @returns {Promise<{entries: Object[], generatedAt: string}>}
   * @private
   */
  async _generateDeletionLog() {
    const entries = [];

    // 从 session memory 中查找删除相关记录
    try {
      const deletionEntries = this.memory.search('deletion remove delete removed clean');
      for (const entry of deletionEntries.slice(0, 20)) {
        if (entry.value?.tags?.includes('deletion') || entry.value?.tags?.includes('cleanup')) {
          entries.push({
            key: entry.key,
            reason: entry.value?.reason || 'auto-cleanup',
            timestamp: entry.value?.timestamp || Date.now()
          });
        }
      }
    } catch {
      // 搜索失败返回空日志
    }

    return Object.freeze({
      entries: Object.freeze(entries),
      generatedAt: new Date().toISOString()
    });
  }

  /**
   * 持久化 Agent 执行结果到 MemoryManager（P2-1）
   * @param {string} agentName - Agent 名称
   * @param {Object} result - 执行结果
   * @param {string} questId - Quest ID
   * @private
   */
  async _persistAgentResult(agentName, result, questId) {
    try {
      await this.memory.set(
        `agent_result_${questId}_${Date.now()}`,
        {
          agent: agentName,
          questId,
          success: result.success !== false,
          timestamp: Date.now()
        },
        { tier: 'project', tags: ['agent-result', agentName] }
      );
    } catch (persistError) {
      logger.debug(`Agent 结果持久化失败: ${persistError.message}`);
    }
  }

  /**
   * 使用 RepoIndexer 搜索符号（P2-3: architect 等 Agent 使用）
   * @param {string} query - 搜索查询
   * @returns {Promise<Object[]>} 符号搜索结果
   * @private
   */
  async _searchRepoIndex(query) {
    try {
      if (!this._repoIndexer) {
        this._repoIndexer = new RepoIndexer(this.projectDir);
        await this._repoIndexer.buildIndex();
      }
      return this._repoIndexer.search(query);
    } catch (indexError) {
      logger.debug(`RepoIndexer 搜索失败: ${indexError.message}`);
      return [];
    }
  }

  /**
   * 获取运行时模块状态摘要（P3-1: 供 status 命令使用）
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
        initialized: this._agentRegistry !== null,
        stats: this._agentRegistry ? this._agentRegistry.getStats() : null,
        healthy: true
      },
      canonicalRouter: {
        initialized: this._canonicalRouter !== null,
        healthy: true
      },
      repoIndexer: {
        initialized: this._repoIndexer !== null,
        healthy: true
      },
      knowledgeSteward: {
        initialized: this._knowledgeSteward !== null,
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
   * 检查上下文溢出 → 生成会话摘要
   * @private
   * @param {string} contextStatus - 当前上下文状态
   */
  _checkContextOverflow(contextStatus) {
    if (contextStatus !== CONTEXT_STATUS.OVERFLOW) return;

    logger.warn('[Orchestrator] 上下文窗口溢出，生成会话摘要');

    this._pendingSessionSummary = createSessionSummary({
      task: this.phaseContext.task,
      userMessages: this._messageAccumulator.filter((m) => m.role === 'user').map((m) => m.content),
      errors: this.phaseContext.failedQuests.map((f) => ({
        error: f.error,
        fix: ''
      })),
      pendingTasks: this.phaseContext.failedQuests.map((f) => `修复 Quest ${f.questId}`),
      currentWork: {
        phase: this.phaseContext.currentPhase,
        completedQuests: this.phaseContext.completedQuests.length,
        failedQuests: this.phaseContext.failedQuests.length
      }
    });

    logger.info('[Orchestrator] 会话摘要已生成，可通过 resumeDirective 续接');
  }

  /**
   * 构建执行结果
   * @private
   */
  _buildResult(status, error = null) {
    const questPlans = this._messageAccumulator
      .filter((m) => m.role === 'quest-plan')
      .map((m) => JSON.parse(m.content));

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
