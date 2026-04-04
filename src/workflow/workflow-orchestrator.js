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

import { FlowEngine, FLOW_STATES, FLOW_EVENTS } from '../flow/flow-engine.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { TokenBudgetManager } from '../budget/token-budget.js';
import { ContextMonitor, CONTEXT_THRESHOLDS, CONTEXT_STATUS } from '../budget/context-monitor.js';
import { routeModel, MODEL_TIERS } from '../router/model-router.js';
import { SkillIndexer } from '../skills/skill-indexer.js';
import { compactTrace } from '../utils/trace-compactor.js';
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

    // 初始化核心模块
    this.flowEngine = new FlowEngine(WORKFLOW_ID, { maxRetries: 2 });
    this.memory = new MemoryManager({ projectDir: this.projectDir });
    this.tokenBudget = new TokenBudgetManager();
    this.contextMonitor = new ContextMonitor();
    this.skillIndexer = new SkillIndexer(this.skillsDir);

    // 当前上下文
    this.phaseContext = createPhaseContext();

    // Quest 引擎缓存（每个 Quest 一个）
    this.questEngines = new Map();

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

    try {
      // 1. 确定执行模式
      const mode = detectExecutionMode(task, options);
      this.phaseContext = updatePhaseContext(this.phaseContext, { mode, task });

      logger.info(`[Orchestrator] 开始执行工作流，模式: ${mode}, 任务: ${task}`);

      // 2. 执行 PHASE 1
      await this._runDiscover();
      if (mode === EXECUTION_MODES.MICRO) {
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

    // 上下文窗口检查
    const contextStatus = this.contextMonitor.getStatus();
    if (contextStatus === CONTEXT_STATUS.COMPRESS_REQUIRED) {
      logger.warn('[PHASE 1] 上下文窗口严重不足，建议压缩');
    }

    // 存储发现结果到记忆
    await this.memory.set(
      'last_discover',
      {
        skillsCount: skillIndex.totalSkills,
        contextStatus,
        timestamp: Date.now()
      },
      { tier: 'session' }
    );

    // FlowEngine 状态转移
    this.flowEngine.transition(FLOW_EVENTS.START, { phase: 1 });
    this.flowEngine.transition(FLOW_EVENTS.ANALYSIS_DONE, {
      skillsIndexed: skillIndex.totalSkills
    });

    // 消耗资源
    this.tokenBudget.consume('discover', 3000, 'PHASE 1 扫描');
    this.contextMonitor.record(5000, 'PHASE 1');

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      capabilities: {
        commands: 0, // 待实现
        agents: 0, // 待实现
        skills: skillIndex.totalSkills,
        hooks: 0
      },
      contextStatus
    });

    logger.info(`[PHASE 1] 完成，索引了 ${skillIndex.totalSkills} 个 Skills`);
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

    // 存储 Quest 设计结果
    await this.memory.set(
      'last_quest_design',
      {
        model: modelRoute.model,
        tier: modelRoute.tier,
        timestamp: Date.now()
      },
      { tier: 'session' }
    );

    // FlowEngine 状态转移
    this.flowEngine.transition(FLOW_EVENTS.PLAN_DONE, {
      model: modelRoute.model,
      reason: modelRoute.reason
    });

    // 消耗资源
    this.tokenBudget.consume('reason', 12000, 'PHASE 2 Quest 设计');
    this.contextMonitor.record(15000, 'PHASE 2');

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      modelRecommendations: modelRoute
    });
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

    this.flowEngine.transition(FLOW_EVENTS.EXECUTE_DONE);

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      completedQuests,
      failedQuests
    });

    logger.info(`[PHASE 3] 完成，成功: ${completedQuests.length}, 失败: ${failedQuests.length}`);
  }

  /**
   * 执行单个 Quest
   * @private
   */
  async _executeQuest(quest, modelRoute, questEngine) {
    logger.debug(`[Quest ${quest.id}] 使用模型 ${modelRoute.model} 执行`);

    // 根据模型路由选择执行策略
    // 这里会调用对应的 Agent

    // 记录变更
    this.phaseContext = updatePhaseContext(this.phaseContext, {
      currentQuest: quest,
      changedFiles: quest.changedFiles
        ? [...this.phaseContext.changedFiles, ...quest.changedFiles]
        : this.phaseContext.changedFiles
    });

    return { success: true };
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

    // 验证失败场景处理
    if (this.phaseContext.failedQuests && this.phaseContext.failedQuests.length > 0) {
      for (const failed of this.phaseContext.failedQuests) {
        const compacted = compactTrace(new Error(failed.error));
        logger.error(`[PHASE 4] Quest ${failed.questId} 验证失败: ${compacted.compacted}`);
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
      contextStatus
    });
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

    // 记录提交的文件到记忆
    await this.memory.set(
      'last_commit',
      {
        files: this.phaseContext.changedFiles,
        questCount: this.phaseContext.completedQuests.length,
        timestamp: Date.now()
      },
      {
        tier: 'project',
        tags: ['commit', 'changes']
      }
    );

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

    // 重置 FlowEngine
    this.flowEngine.transition(FLOW_EVENTS.RESET);

    this.tokenBudget.consume('learn', 1000, 'PHASE 6 知识沉淀');

    this.phaseContext = updatePhaseContext(this.phaseContext, {
      insights: [...this.phaseContext.insights, insight]
    });
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
   * 构建执行结果
   * @private
   */
  _buildResult(status, error = null) {
    return {
      status,
      error,
      mode: this.phaseContext.mode,
      completedQuests: this.phaseContext.completedQuests,
      failedQuests: this.phaseContext.failedQuests,
      changedFiles: this.phaseContext.changedFiles,
      insights: this.phaseContext.insights,
      tokenBudget: this.phaseContext.tokenBudget,
      contextStatus: this.phaseContext.contextStatus
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
