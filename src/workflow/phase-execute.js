/**
 * Phase Execute — PHASE 3: 逐关执行
 *
 * 负责 Quest Map 生成、Quest 执行、Agent 调用指令构建、
 * 微型模式直接执行
 */

import { FlowEngine, FLOW_EVENTS } from '../flow/flow-engine.js';
import { routeModel } from '../router/model-router.js';
import { AgentRegistry } from '../router/agent-registry.js';
import { CanonicalRouter } from '../router/canonical-router.js';
import { compactTrace } from '../utils/trace-compactor.js';
import {
  updatePhaseContext,
  EXECUTION_MODES,
  PHASE_SKILL_MAP,
  detectE2ECapability
} from './phase-context.js';
import { extractKeywords } from '../router/keyword-extractor.js';
import { KnowledgeSteward } from '../knowledge/knowledge-steward.js';
import { logger } from '../logger.js';

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
 * 生成 Agent 执行语义说明
 * @param {Object} agent - Agent 清单
 * @param {Object} quest - Quest 描述
 * @returns {string} 语义描述
 */
function _generateSemanticDescription(agent, quest) {
  if (!agent) return '执行任务';

  const parts = [];

  parts.push(`${agent.displayName || agent.name}: ${agent.description || '通用执行'}`);

  if (agent.capabilities?.length) {
    const actions = agent.capabilities
      .map((cap) => CAPABILITY_SEMANTICS[cap] || cap)
      .filter(Boolean);
    if (actions.length > 0) {
      parts.push(`执行动作: ${actions.join(', ')}`);
    }
  }

  if (quest.title || quest.id) {
    parts.push(`目标: ${quest.title || quest.id}`);
  }

  return parts.join(' | ');
}

export class PhaseExecute {
  /**
   * @param {Object} deps
   * @param {import('../memory/memory-manager.js').MemoryManager} deps.memory
   * @param {import('../budget/token-budget.js').TokenBudgetManager} deps.tokenBudget
   * @param {import('../budget/context-monitor.js').ContextMonitor} deps.contextMonitor
   * @param {import('../flow/flow-engine.js').FlowEngine} deps.flowEngine
   * @param {string} deps.projectDir
   */
  constructor({ memory, tokenBudget, contextMonitor, flowEngine, projectDir }) {
    this.memory = memory;
    this.tokenBudget = tokenBudget;
    this.contextMonitor = contextMonitor;
    this.flowEngine = flowEngine;
    this.projectDir = projectDir;

    // 懒初始化
    this._agentRegistry = null;
    this._canonicalRouter = null;
    this._skillIndexer = null;

    // Quest 引擎缓存（每个 Quest 一个）
    this.questEngines = new Map();

    // 消息累加器引用（由 Orchestrator 注入）
    this.messageAccumulator = null;
  }

  /**
   * 设置消息累加器引用
   * @param {Object[]} accumulator
   */
  setMessageAccumulator(accumulator) {
    this.messageAccumulator = accumulator;
  }

  /**
   * 设置 SkillIndexer 引用
   * @param {SkillIndexer} indexer
   */
  setSkillIndexer(indexer) {
    this._skillIndexer = indexer;
  }

  /**
   * PHASE 2: REASON — Quest 设计
   * @param {Object} phaseContext - 当前阶段上下文
   * @returns {Promise<Object>} 更新后的 phaseContext
   */
  async runReason(phaseContext) {
    logger.info('[PHASE 2] REASON - Quest 设计');

    let ctx = updatePhaseContext(phaseContext, { currentPhase: 2 });

    if (!this.tokenBudget.canAfford('reason', 15000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 2');
    }

    // 模型路由
    const modelRoute = routeModel({
      keywords: this._extractKeywords(ctx.task)
    });

    logger.info(`[PHASE 2] 推荐模型: ${modelRoute.model} (${modelRoute.tier})`);

    // Agent 路由推荐
    let agentRecommendation = null;
    try {
      if (!this._canonicalRouter) {
        this._canonicalRouter = new CanonicalRouter();
        await this._canonicalRouter.initialize();
      }
      agentRecommendation = await this._canonicalRouter.route(ctx.task, {
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
    const skillContents = [];
    try {
      const keywords = this._extractKeywords(ctx.task);
      const searchResult = await this._skillIndexer.search(keywords);
      matchedSkills = Array.isArray(searchResult) ? searchResult.slice(0, 3) : [];

      for (const skill of matchedSkills) {
        try {
          const loaded = await this._skillIndexer.loadContent(skill.relativePath);
          if (loaded) {
            skillContents.push({
              name: skill.name,
              relativePath: skill.relativePath,
              content: loaded.content
            });
          }
        } catch (loadError) {
          logger.debug(`[PHASE 2] Skill 内容加载失败 ${skill.name}: ${loadError.message}`);
        }
      }

      if (matchedSkills.length > 0) {
        logger.info(
          `[PHASE 2] 匹配 Skills: ${matchedSkills.map((s) => s.name).join(', ')} ` +
            `(${skillContents.length} 个内容已加载)`
        );
      }
    } catch (skillError) {
      logger.debug(`[PHASE 2] Skill 搜索跳过: ${skillError.message}`);
    }

    // P1-1: Phase-Skill 映射注入（固定关联，不依赖关键词）
    // 合并 reason + execute + verify 阶段的 Skill，确保全阶段覆盖
    const phaseSkillNames = [
      ...(PHASE_SKILL_MAP.reason || []),
      ...(PHASE_SKILL_MAP.execute || []),
      ...(PHASE_SKILL_MAP.verify || [])
    ];
    for (const skillName of phaseSkillNames) {
      const alreadyMatched = matchedSkills.some((s) => s.name === skillName);
      if (!alreadyMatched && matchedSkills.length < 5) {
        try {
          const allSkills = await this._skillIndexer.buildIndex();
          const found = allSkills.entries.find((e) => e.name === skillName);
          if (found) {
            matchedSkills.push(found);
            const loaded = await this._skillIndexer.loadContent(found.relativePath);
            if (loaded) {
              skillContents.push({
                name: found.name,
                relativePath: found.relativePath,
                content: loaded.content
              });
            }
          }
        } catch (phaseSkillError) {
          logger.debug(`[PHASE 2] Phase-Skill 注入跳过 ${skillName}: ${phaseSkillError.message}`);
        }
      }
    }

    // P1-2: Doctor 推荐的 Skill 自动注入
    if (ctx.doctorResult?.recommendedActions) {
      for (const action of ctx.doctorResult.recommendedActions) {
        if (action.skill && !matchedSkills.some((s) => s.name === action.skill)) {
          try {
            const allSkills = await this._skillIndexer.buildIndex();
            const found = allSkills.entries.find((e) => e.name === action.skill);
            if (found) {
              matchedSkills.push(found);
              const loaded = await this._skillIndexer.loadContent(found.relativePath);
              if (loaded) {
                skillContents.push({
                  name: found.name,
                  relativePath: found.relativePath,
                  content: loaded.content
                });
              }
            }
          } catch (doctorSkillError) {
            logger.debug(`[PHASE 2] Doctor 推荐 Skill 注入跳过: ${doctorSkillError.message}`);
          }
        }
      }
    }

    // P3-1: 从 .auto/insights/ 搜索历史经验并注入上下文
    let insightContents = [];
    try {
      const steward = new KnowledgeSteward(this.projectDir);
      const insightKeywords = this._extractKeywords(ctx.task).filter((kw) => kw.length > 1);
      if (insightKeywords.length > 0) {
        // 用最有区分度的前 3 个关键词搜索
        const topKeywords = insightKeywords.slice(0, 3);
        const insightResults = await steward.search(topKeywords.join(' '), { limit: 3 });
        insightContents = insightResults.flatMap((r) =>
          r.matches.slice(0, 2).map((m) => ({ category: r.category, content: m }))
        );
        if (insightContents.length > 0) {
          logger.info(
            `[PHASE 2] 注入历史经验: ${insightContents.length} 条 (关键词: ${topKeywords.join(',')})`
          );
        }
      }
    } catch (insightError) {
      logger.debug(`[PHASE 2] 经验搜索跳过: ${insightError.message}`);
    }

    // P0-1: 生成 Quest Map
    const questMap = await this._generateQuestMap(ctx.task, {
      agentRecommendation,
      matchedSkills,
      skillContents,
      insightContents,
      modelRoute,
      mode: ctx.mode
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

    ctx = updatePhaseContext(ctx, {
      modelRecommendations: modelRoute,
      agentRecommendation: agentRecommendation,
      matchedSkills: Object.freeze(matchedSkills),
      questMap: Object.freeze(questMap)
    });

    return ctx;
  }

  /**
   * 执行 PHASE 3: EXECUTE
   * @param {Object} phaseContext - 当前阶段上下文
   * @returns {Promise<Object>} 更新后的 phaseContext
   */
  async runExecute(phaseContext) {
    logger.info('[PHASE 3] EXECUTE - 逐关执行');

    let ctx = updatePhaseContext(phaseContext, { currentPhase: 3 });

    if (!this.tokenBudget.canAfford('execute', 30000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 3');
    }

    // P0-1 fix: 将 pendingInvocations 转换为额外 Quest 并注入 Quest Map
    const questMap = ctx.questMap ? [...ctx.questMap] : [];
    if (ctx.pendingInvocations?.length > 0) {
      for (const inv of ctx.pendingInvocations) {
        questMap.push(
          Object.freeze({
            id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: inv.description || `待执行调度: ${inv.subagent_type}`,
            description: inv.prompt || inv.description || '',
            keywords: Object.freeze([inv.subagent_type]),
            complexity: 'low',
            changedFiles: Object.freeze([]),
            acceptanceCriteria: Object.freeze(['执行完成']),
            decisionNotes: Object.freeze([
              `来源: pending-invocation (${inv.trigger || 'unknown'})`
            ]),
            skills: Object.freeze([]),
            skillContents: Object.freeze([]),
            insightContents: Object.freeze([]),
            agent: inv.subagent_type,
            agentInvocation: Object.freeze({
              subagent_type: inv.subagent_type,
              description: inv.description || '',
              prompt: inv.prompt || '',
              model: inv.model || 'sonnet',
              run_in_background: false
            })
          })
        );
      }
      logger.info(
        `[PHASE 3] 注入 ${ctx.pendingInvocations.length} 个 pending-invocations 为 Quest`
      );
    }

    if (questMap.length === 0) {
      logger.warn('[PHASE 3] 无 Quest 地图，跳过执行');
      this.flowEngine.transition(FLOW_EVENTS.EXECUTE_DONE);
      return ctx;
    }

    const completedQuests = [];
    const failedQuests = [];

    // P0-2: 按规模选择执行策略
    const questCount = questMap.length;
    const executionStrategy = this._selectExecutionStrategy(questCount);

    logger.info(`[PHASE 3] 执行策略: ${executionStrategy.name} (Quest数=${questCount})`);

    if (executionStrategy.parallel) {
      // 并行执行：将 Quest 分组为独立批次
      const batches = this._partitionQuests(questMap);
      for (const batch of batches) {
        const batchResults = await this._executeBatch(batch, ctx);
        completedQuests.push(...batchResults.completed);
        failedQuests.push(...batchResults.failed);
        for (const item of batchResults.executionResults) {
          ctx = this.mergeExecutionResult(ctx, item.quest, item.executionResult);
        }
      }
    } else {
      // 串行执行（原有逻辑）
      for (const quest of questMap) {
        const result = await this._executeSingleQuest(quest, ctx);
        if (result.success) {
          completedQuests.push(result.questId);
          if (result.executionResult) {
            ctx = this.mergeExecutionResult(ctx, quest, result.executionResult);
          }
        } else {
          failedQuests.push({ questId: result.questId, error: result.error });
        }
      }
    }

    const executionChangedFiles = ctx.changedFiles || [];

    // P0-1: 执行后收集变更文件列表（含 unstaged / staged / untracked）
    const changedFiles = await this._collectChangedFiles('PHASE 3');

    this.flowEngine.transition(FLOW_EVENTS.EXECUTE_DONE);

    ctx = updatePhaseContext(ctx, {
      completedQuests,
      failedQuests,
      changedFiles: [...new Set([...executionChangedFiles, ...changedFiles])]
    });

    logger.info(
      `[PHASE 3] 完成，成功: ${completedQuests.length}, 失败: ${failedQuests.length}, 变更: ${changedFiles.length} 文件`
    );

    return ctx;
  }

  /**
   * 微型模式直接执行（P0-2: 不经过 Quest 设计，直接执行任务）
   * @param {Object} phaseContext - 当前阶段上下文
   * @returns {Promise<Object>} 更新后的 phaseContext
   */
  async runMicroExecute(phaseContext) {
    logger.info('[MICRO] 直接执行微型任务');

    let ctx = updatePhaseContext(phaseContext, { currentPhase: 3 });

    // 模型路由
    const modelRoute = routeModel({
      keywords: this._extractKeywords(ctx.task)
    });

    // P1-5: 微型模式 Skill 注入（搜索 top 1 匹配 Skill）
    const microSkills = [];
    const microSkillContents = [];
    try {
      const keywords = this._extractKeywords(ctx.task);
      const searchResult = await this._skillIndexer.search(keywords);
      const topSkill = Array.isArray(searchResult) ? searchResult.slice(0, 1) : [];
      for (const skill of topSkill) {
        const loaded = await this._skillIndexer.loadContent(skill.relativePath);
        if (loaded) {
          microSkills.push(skill.name);
          microSkillContents.push({
            name: skill.name,
            relativePath: skill.relativePath,
            content: loaded.content
          });
        }
      }
      if (microSkills.length > 0) {
        logger.info(`[MICRO] Skill 注入: ${microSkills.join(', ')}`);
      }
    } catch (skillErr) {
      logger.debug(`[MICRO] Skill 搜索跳过: ${skillErr.message}`);
    }

    // P3-1: MICRO 模式也注入历史经验
    let microInsightContents = [];
    try {
      const steward = new KnowledgeSteward(this.projectDir);
      const insightKeywords = this._extractKeywords(ctx.task).filter((kw) => kw.length > 1);
      if (insightKeywords.length > 0) {
        const insightResults = await steward.search(insightKeywords.slice(0, 3).join(' '), {
          limit: 2
        });
        microInsightContents = insightResults.flatMap((r) =>
          r.matches.slice(0, 1).map((m) => ({ category: r.category, content: m }))
        );
      }
    } catch {
      // MICRO 模式不因经验搜索失败而中断
    }

    // 创建单 Quest 并执行（P1-5: 附带 Skill）
    const microQuest = Object.freeze({
      id: 'micro-1',
      title: ctx.task.slice(0, 80),
      description: ctx.task,
      keywords: Object.freeze(this._extractKeywords(ctx.task)),
      complexity: 'low',
      changedFiles: Object.freeze([]),
      acceptanceCriteria: Object.freeze(['编译通过', '相关测试通过']),
      decisionNotes: Object.freeze(
        microSkills.length > 0 ? [`参考 Skill: ${microSkills.join(', ')}`] : []
      ),
      skills: Object.freeze(microSkills),
      skillContents: Object.freeze(microSkillContents),
      insightContents: Object.freeze(microInsightContents),
      agent: null
    });

    const questEngine = new FlowEngine('quest-micro-1', { maxRetries: 1 });
    questEngine.transition(FLOW_EVENTS.START, { questId: microQuest.id });

    try {
      const executeResult = await this._executeQuest(microQuest, modelRoute, questEngine, ctx);
      if (executeResult.success === false) {
        throw new Error(executeResult.executionResult?.error || 'Micro execution did not complete');
      }
      questEngine.transition(FLOW_EVENTS.EXECUTE_DONE);

      // P0-1: MICRO 模式也收集变更文件（含 unstaged / staged / untracked）
      const microChangedFiles = await this._collectChangedFiles('MICRO');

      ctx = updatePhaseContext(ctx, {
        completedQuests: [microQuest.id],
        failedQuests: [],
        questMap: [microQuest],
        changedFiles: microChangedFiles
      });

      logger.info('[MICRO] 微型任务执行完成');
    } catch (error) {
      const compacted = compactTrace(error);
      logger.error(`[MICRO] 微型任务执行失败: ${compacted.compacted}`);

      ctx = updatePhaseContext(ctx, {
        completedQuests: [],
        failedQuests: [{ questId: microQuest.id, error: compacted.compacted }]
      });
    }

    // 状态转移
    this.flowEngine.transition(FLOW_EVENTS.EXECUTE_DONE);
    this.flowEngine.transition(FLOW_EVENTS.REVIEW_DONE);

    this.tokenBudget.consume('execute', 5000, 'MICRO 执行');
    this.contextMonitor.record(8000, 'MICRO');

    return ctx;
  }

  /**
   * 执行单个 Quest（P0-1: 生成结构化 Agent 调用指令）
   * @param {Object} quest - Quest 描述
   * @param {Object} modelRoute - 模型路由结果
   * @param {FlowEngine} questEngine - Quest 级别 FSM
   * @param {Object} phaseContext - 当前阶段上下文
   * @returns {Promise<{success: boolean, executionPlan?: Object, agentInvocation?: Object}>}
   * @private
   */
  async _executeQuest(quest, modelRoute, _questEngine, phaseContext) {
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

    // P0-1: 构建 Agent 调用指令
    const agentName = quest.agent || (team.lead ? team.lead.name : 'general-purpose');
    const modelTier = modelRoute.tier?.toLowerCase();
    const modelForAgent = modelTier === 'fast' ? 'haiku' : modelTier === 'deep' ? 'opus' : 'sonnet';

    const agentInvocation = {
      subagent_type: agentName,
      description: quest.title || quest.id,
      model: modelForAgent,
      prompt: this._buildAgentPrompt(quest, team, quest.skillContents || []),
      run_in_background: false
    };

    // 构建执行计划
    const semanticDescription = _generateSemanticDescription(team.lead, quest);
    const executionPlan = Object.freeze({
      questId: quest.id,
      model: modelRoute.model,
      tier: modelRoute.tier,
      semanticDescription,
      agentInvocation,
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

    const executionResult = Object.freeze(
      await this._invokeAgentInvocation(agentInvocation, executionPlan, phaseContext)
    );

    // 记录合成消息到累加器（上限 50 条）
    if (this.messageAccumulator && this.messageAccumulator.length < 50) {
      this.messageAccumulator.push({
        role: 'quest-plan',
        content: JSON.stringify({
          ...executionPlan,
          executionResult
        })
      });
    }

    // P2-1: 持久化 Agent 执行结果
    const leadName = team.lead ? team.lead.name : agentName;
    await this._persistAgentResult(leadName, executionResult, quest.id);

    return {
      success: executionResult.success !== false,
      executionPlan,
      agentInvocation,
      executionResult
    };
  }

  /**
   * P0-1: 统一消费 Agent 调用指令，形成真实执行结果
   * @param {Object} agentInvocation
   * @param {Object} executionPlan
   * @param {Object} phaseContext
   * @returns {Promise<Object>}
   * @private
   */
  async _invokeAgentInvocation(agentInvocation, executionPlan, phaseContext) {
    const phaseChangedFiles = phaseContext?.changedFiles || [];
    const questChangedFiles = executionPlan.changedFiles || [];
    const changedFiles = [...new Set([...phaseChangedFiles, ...questChangedFiles])];

    return {
      success: false,
      status: 'planned',
      summary: `Prepared ${agentInvocation.subagent_type} for quest ${executionPlan.questId} (execution backend not connected)`,
      changedFiles,
      artifacts: {
        executionPlan,
        agentInvocation
      },
      error: 'Execution backend not connected'
    };
  }

  async _collectChangedFiles(scopeLabel) {
    try {
      const { execSync } = await import('node:child_process');
      const outputs = [
        execSync('git diff --name-only HEAD', {
          cwd: this.projectDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000
        })
          .toString()
          .trim(),
        execSync('git diff --cached --name-only', {
          cwd: this.projectDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000
        })
          .toString()
          .trim(),
        execSync('git ls-files --others --exclude-standard', {
          cwd: this.projectDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000
        })
          .toString()
          .trim()
      ];

      const fileSet = new Set();
      for (const output of outputs) {
        for (const file of output.split('\n').filter(Boolean)) {
          fileSet.add(file);
        }
      }
      return [...fileSet];
    } catch (diffError) {
      logger.debug(`[${scopeLabel}] 变更文件检测跳过: ${diffError.message}`);
      return [];
    }
  }

  /**
   * 合并 Quest 执行结果到当前上下文
   * @param {Object} phaseContext
   * @param {Object} quest
   * @param {Object} executionResult
   * @returns {Object}
   */
  mergeExecutionResult(phaseContext, quest, executionResult) {
    const mergedChangedFiles = [
      ...new Set([...(phaseContext.changedFiles || []), ...(executionResult.changedFiles || [])])
    ];
    const prevResults = phaseContext.executionResults || [];
    const nextResult = Object.freeze({
      questId: quest.id,
      success: executionResult.success !== false,
      summary: executionResult.summary || null,
      changedFiles: Object.freeze([...(executionResult.changedFiles || [])]),
      artifacts: executionResult.artifacts || null,
      error: executionResult.error || null
    });

    return updatePhaseContext(phaseContext, {
      currentQuest: quest,
      changedFiles: mergedChangedFiles,
      executionResults: [...prevResults, nextResult]
    });
  }

  /**
   * 初始化工作流上下文
   * @param {Object} phaseContext
   * @param {string} task
   * @param {Object} options
   * @returns {Object}
   */
  initializeWorkflowContext(phaseContext, task, options = {}) {
    const mode = options.mode || EXECUTION_MODES.FULL;
    return updatePhaseContext(phaseContext, { mode, task });
  }

  /**
   * 导出分析摘要
   * @param {Object} phaseContext
   * @returns {Promise<Object>}
   */
  async buildAnalyzeSnapshot(phaseContext) {
    const ctx = phaseContext || this.initializeWorkflowContext({}, '', {});
    const modelResult = ctx.modelRecommendations;
    const agentResult = ctx.agentRecommendation;
    const questMap = ctx.questMap || [];

    const registry = await this._ensureAgentRegistry();
    const teamResult = registry.resolveTeam({
      keywords: this._extractKeywords(ctx.task),
      maxSize: ctx.mode === 'micro' ? 1 : ctx.mode === 'light' ? 2 : 4
    });

    return {
      task: (ctx.task || '').slice(0, 80),
      mode: ctx.mode,
      detected_mode: ctx.mode,
      routing: {
        model: modelResult
          ? {
              id: modelResult.model,
              tier: modelResult.tier,
              reason: modelResult.reason
            }
          : null,
        agent: agentResult
          ? {
              name: agentResult.agent.name,
              displayName: agentResult.agent.displayName,
              score: agentResult.score,
              matchReason: agentResult.matchReason
            }
          : null
      },
      team: {
        lead: teamResult.lead
          ? {
              name: teamResult.lead.name,
              displayName: teamResult.lead.displayName,
              capabilities: teamResult.lead.capabilities
            }
          : null,
        members: teamResult.members.map((m) => ({
          name: m.name,
          displayName: m.displayName,
          capabilities: m.capabilities
        }))
      },
      quests: questMap.map((q) => ({
        id: q.id,
        title: q.title,
        type: q.type,
        keywords: q.keywords,
        agent: q.agent,
        priority: q.priority,
        files: q.files
      }))
    };
  }

  /**
   * 构建执行摘要
   * @param {Object} phaseContext
   * @returns {Object[]}
   */
  buildExecutionSummary(phaseContext) {
    return Object.freeze(
      (phaseContext.executionResults || []).map((result) => ({
        questId: result.questId,
        success: result.success,
        summary: result.summary,
        changedFiles: result.changedFiles || [],
        error: result.error || null
      }))
    );
  }

  /**
   * 获取状态摘要
   * @param {Object} phaseContext
   * @returns {Object}
   */
  summarizeStatus(phaseContext) {
    return Object.freeze({
      mode: phaseContext.mode,
      currentPhase: phaseContext.currentPhase,
      completedQuestsCount: phaseContext.completedQuests.length,
      failedQuestsCount: phaseContext.failedQuests.length,
      changedFilesCount: phaseContext.changedFiles.length,
      doctorIssuesCount: phaseContext.doctorResult?.issues?.length || 0,
      verificationActionsCount: phaseContext.verificationActions.length,
      securityScanTriggered: phaseContext.securityResult?.scanTriggered || false,
      pendingInvocationsCount: phaseContext.pendingInvocations.length,
      hasDoctorIssues: (phaseContext.doctorResult?.issues?.length || 0) > 0,
      hasPendingInvocations: phaseContext.pendingInvocations.length > 0
    });
  }

  /**
   * 导出 Git learn 摘要
   * @param {number} [commitCount=50]
   * @returns {Promise<Object|null>}
   */
  async analyzeGitLearn(commitCount = 50) {
    const result = await this.memory.get('last_git_patterns');
    if (result) {
      return result;
    }
    const steward = new KnowledgeSteward(this.projectDir);
    if (typeof steward.list !== 'function') {
      return null;
    }
    return {
      commitCount,
      available: true
    };
  }

  /**
   * P0-1: 构建 Agent 调用 Prompt
   * @param {Object} quest
   * @param {Object} team
   * @param {Object[]} [skillContents]
   * @returns {string}
   * @private
   */
  _buildAgentPrompt(quest, team, skillContents) {
    const parts = [];

    parts.push(`# Quest: ${quest.title}`);
    parts.push('');
    parts.push('## 任务描述');
    parts.push(quest.description || '');
    parts.push('');

    if (quest.acceptanceCriteria?.length) {
      parts.push('## 验收标准');
      for (const ac of quest.acceptanceCriteria) {
        parts.push(`- ${ac}`);
      }
      parts.push('');
    }

    if (quest.changedFiles?.length) {
      parts.push('## 涉及文件');
      for (const f of quest.changedFiles) {
        parts.push(`- ${f}`);
      }
      parts.push('');
    }

    if (quest.skillContents?.length || skillContents?.length) {
      const skills = quest.skillContents || skillContents || [];
      parts.push('## 参考技能');
      for (const skill of skills) {
        parts.push(`### ${skill.name}`);
        if (skill.content) {
          parts.push(skill.content.slice(0, 1000));
        }
        parts.push('');
      }
    }

    if (quest.insightContents?.length) {
      parts.push('## 历史经验参考');
      for (const insight of quest.insightContents) {
        parts.push(`### [${insight.category}]`);
        if (insight.content) {
          parts.push(insight.content.slice(0, 800));
        }
        parts.push('');
      }
    }

    if (quest.decisionNotes?.length) {
      parts.push('## 决策备忘');
      for (const note of quest.decisionNotes) {
        parts.push(`- ${note}`);
      }
      parts.push('');
    }

    if (team.lead) {
      parts.push(`## 执行 Agent: ${team.lead.name}`);
      if (team.lead.capabilities?.length) {
        parts.push(`能力: ${team.lead.capabilities.join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 根据 Agent 路由结果生成 Quest Map
   * @param {string} task - 任务描述
   * @param {Object} context - 路由上下文
   * @returns {Object[]} Quest Map 数组
   * @private
   */
  async _generateQuestMap(
    task,
    { agentRecommendation, matchedSkills, skillContents, insightContents, modelRoute, mode }
  ) {
    const keywords = this._extractKeywords(task);
    const skillNames = matchedSkills.map((s) => s.name);
    const skillData = skillContents || [];
    const insightData = insightContents || [];

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
          skills: Object.freeze(skillNames),
          skillContents: Object.freeze(skillData),
          insightContents: Object.freeze(insightData),
          agent: agentRecommendation ? agentRecommendation.agent.name : null
        })
      ]);
    }

    // 完整模式：基于 Agent 能力生成多 Quest
    const quests = [];

    // Quest 1: 分析和设计
    const analysisAgent = agentRecommendation ? agentRecommendation.agent : null;
    const hasPlanning = analysisAgent?.capabilities?.some((c) =>
      ['planning', 'design', 'architecture'].includes(c)
    );

    if (hasPlanning) {
      quests.push(
        Object.freeze({
          id: 'quest-1',
          title: `分析和设计: ${task.slice(0, 60)}`,
          description: `使用 ${analysisAgent.name} 进行任务分析和设计`,
          keywords: Object.freeze(keywords),
          complexity: 'high',
          changedFiles: Object.freeze([]),
          acceptanceCriteria: Object.freeze(['任务分析完成', '设计方案确定', '风险评估完成']),
          decisionNotes: Object.freeze([]),
          skills: Object.freeze(skillNames),
          skillContents: Object.freeze(skillData),
          insightContents: Object.freeze(insightData),
          agent: analysisAgent.name,
          agentInvocation: Object.freeze({
            subagent_type: analysisAgent.name,
            description: `分析设计: ${task.slice(0, 50)}`,
            prompt: `分析以下任务并生成设计方案:\n\n任务: ${task}\n\n关键词: ${keywords.join(', ')}\n\n请输出: 1)现状分析 2)设计方案 3)影响文件 4)风险评估`,
            model: modelRoute?.tier?.toLowerCase() === 'fast' ? 'haiku' : 'sonnet'
          })
        })
      );
    }

    // Quest 2: 核心实现
    const implAgent = agentRecommendation ? agentRecommendation.agent.name : null;
    quests.push(
      Object.freeze({
        id: `quest-${quests.length + 1}`,
        title: `核心实现: ${task.slice(0, 60)}`,
        description: task,
        keywords: Object.freeze(keywords),
        complexity: 'high',
        changedFiles: Object.freeze([]),
        acceptanceCriteria: Object.freeze(['功能实现完成', '编译通过', '测试通过']),
        decisionNotes: Object.freeze(
          skillNames.length > 0 ? [`参考 Skill: ${skillNames.join(', ')}`] : []
        ),
        skills: Object.freeze(skillNames),
        skillContents: Object.freeze(skillData),
        insightContents: Object.freeze(insightData),
        agent: implAgent,
        agentInvocation: Object.freeze({
          subagent_type: implAgent || 'general-purpose',
          description: `核心实现: ${task.slice(0, 50)}`,
          prompt: `实现以下任务:\n\n${task}\n\n验收标准:\n- 功能实现完成\n- 编译通过\n- 测试通过\n${skillData.length > 0 ? `\n参考技能:\n${skillData.map((s) => `--- ${s.name} ---\n${s.content?.slice(0, 500) || ''}`).join('\n\n')}` : ''}`,
          model: modelRoute?.tier?.toLowerCase() === 'deep' ? 'opus' : 'sonnet'
        })
      })
    );

    // Quest 3: 代码审查 (P1-4: 自动附带 performance-patterns Skill)
    if (mode === EXECUTION_MODES.FULL) {
      // P2-1: 动态路由 code-reviewer
      const reviewAgent = await this._resolveDynamicAgent(['review', 'quality'], 'code-reviewer');
      // P1-4: 注入 performance-patterns 到审查 Skill
      const perfSkill = skillData.find((s) => s.name === 'performance-patterns');
      const reviewSkillContents = perfSkill ? [perfSkill] : [];
      const reviewSkills = perfSkill ? ['performance-patterns'] : [];

      quests.push(
        Object.freeze({
          id: `quest-${quests.length + 1}`,
          title: '代码审查',
          description: '审查变更代码的质量、安全性和规范性',
          keywords: Object.freeze(['review', 'quality', 'security']),
          complexity: 'low',
          changedFiles: Object.freeze([]),
          acceptanceCriteria: Object.freeze(['无 Critical 级别问题', '无硬编码密钥', '无安全漏洞']),
          decisionNotes: Object.freeze([]),
          skills: Object.freeze(reviewSkills),
          skillContents: Object.freeze(reviewSkillContents),
          agent: reviewAgent,
          agentInvocation: Object.freeze({
            subagent_type: reviewAgent,
            description: '代码审查',
            prompt: `审查最近变更的代码。检查: 1)代码质量 2)命名规范 3)错误处理 4)安全隐患 5)性能问题。输出格式: Critical/Warning/Suggestion 分级。${perfSkill ? `\n\n参考性能模式:\n${perfSkill.content?.slice(0, 500) || ''}` : ''}`,
            model: 'sonnet'
          })
        })
      );

      // Quest 4: 对抗性验证 (P2-1: 动态路由)
      const verifyAgent = await this._resolveDynamicAgent(
        ['verify', 'adversarial'],
        'verification'
      );
      quests.push(
        Object.freeze({
          id: `quest-${quests.length + 1}`,
          title: '对抗性验证',
          description: '以对抗视角验证代码边界情况和异常处理',
          keywords: Object.freeze(['verify', 'boundary', 'edge-case']),
          complexity: 'medium',
          changedFiles: Object.freeze([]),
          acceptanceCriteria: Object.freeze(['边界值测试通过', '错误处理覆盖', '无自欺报告']),
          decisionNotes: Object.freeze([]),
          skills: Object.freeze([]),
          skillContents: Object.freeze([]),
          agent: verifyAgent,
          agentInvocation: Object.freeze({
            subagent_type: verifyAgent,
            description: '对抗性验证',
            prompt:
              '以对抗性视角验证最近的代码变更。攻击面: 1)边界值 2)并发安全 3)幂等性 4)错误路径。每个 PASS 必须包含实际命令输出证明。',
            model: 'sonnet'
          })
        })
      );

      // Quest 5 (条件): E2E 测试
      const hasE2E = this._detectE2ECapability();
      if (hasE2E) {
        quests.push(
          Object.freeze({
            id: `quest-${quests.length + 1}`,
            title: '端到端测试',
            description: '使用 Playwright 验证关键用户流程',
            keywords: Object.freeze(['e2e', 'playwright', 'integration']),
            complexity: 'medium',
            changedFiles: Object.freeze([]),
            acceptanceCriteria: Object.freeze(['E2E 测试通过', '无 flaky 测试']),
            decisionNotes: Object.freeze([]),
            skills: Object.freeze([]),
            skillContents: Object.freeze([]),
            agent: 'e2e-runner',
            agentInvocation: Object.freeze({
              subagent_type: 'e2e-runner',
              description: 'E2E 测试',
              prompt:
                '运行 Playwright E2E 测试验证关键用户流程。如无现有测试，生成覆盖主要路径的测试。',
              model: 'sonnet'
            })
          })
        );
      }

      // P1-3: Quest (条件): 死代码清理（refactor/clean/dead-code 关键词触发）
      const hasRefactor = keywords.some((k) =>
        /refactor|clean|dead.?code|unused|冗余|清理|重构/i.test(k)
      );
      if (hasRefactor) {
        quests.push(
          Object.freeze({
            id: `quest-${quests.length + 1}`,
            title: '死代码清理',
            description: '识别和清理未使用的代码、导入和依赖',
            keywords: Object.freeze(['refactor', 'cleanup', 'dead-code']),
            complexity: 'low',
            changedFiles: Object.freeze([]),
            acceptanceCriteria: Object.freeze(['未使用代码已移除', '编译通过', '测试通过']),
            decisionNotes: Object.freeze([]),
            skills: Object.freeze([]),
            skillContents: Object.freeze([]),
            agent: 'refactor-cleaner',
            agentInvocation: Object.freeze({
              subagent_type: 'refactor-cleaner',
              description: '死代码清理',
              prompt:
                '检测并清理死代码。步骤: 1)运行 npx knip 检测未使用导出 2)按风险分类 3)只移除安全级别项目 4)记录到 DELETION_LOG',
              model: 'sonnet'
            })
          })
        );
      }
    }

    return Object.freeze(quests);
  }

  /**
   * 检测项目是否具备 E2E 测试能力（委托给共享函数）
   * @returns {boolean}
   * @private
   */
  _detectE2ECapability() {
    return detectE2ECapability(this.projectDir);
  }

  /**
   * 根据任务规模选择执行策略
   * @param {number} questCount
   * @returns {{ name: string, parallel: boolean }}
   * @private
   */
  _selectExecutionStrategy(questCount) {
    if (questCount > 8) {
      return { name: 'parallel-batch', parallel: true };
    }
    return { name: 'sequential', parallel: false };
  }

  /**
   * 将 Quest 分区为可并行执行的批次
   * @param {Object[]} questMap
   * @returns {Object[][]}
   * @private
   */
  _partitionQuests(questMap) {
    const batchSize = 3;
    const batches = [];
    for (let i = 0; i < questMap.length; i += batchSize) {
      batches.push(questMap.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 并行执行一批 Quest
   * @param {Object[]} batch
   * @param {Object} ctx
   * @returns {Promise<{ completed: string[], failed: Array<{ questId: string, error: string }> }>}
   * @private
   */
  async _executeBatch(batch, ctx) {
    const completed = [];
    const failed = [];
    const executionResults = [];
    const results = await Promise.allSettled(
      batch.map((quest) => this._executeSingleQuest(quest, ctx))
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value.success) {
        completed.push(r.value.questId);
        if (r.value.executionResult) {
          executionResults.push({ quest: batch[i], executionResult: r.value.executionResult });
        }
      } else {
        const errMsg =
          r.status === 'rejected'
            ? r.reason?.message || String(r.reason)
            : r.value.error || 'Unknown error';
        failed.push({ questId: batch[i].id, error: errMsg });
      }
    }
    return { completed, failed, executionResults };
  }

  /**
   * 执行单个 Quest（含重试逻辑）
   * @param {Object} quest
   * @param {Object} ctx
   * @returns {Promise<{ success: boolean, questId: string, error?: string }>}
   * @private
   */
  async _executeSingleQuest(quest, ctx) {
    const modelRoute = routeModel({ keywords: quest.keywords || [] });
    const questEngine = new FlowEngine(`quest-${quest.id}`, { maxRetries: 2 });
    questEngine.transition(FLOW_EVENTS.START, { questId: quest.id });

    this.questEngines.set(quest.id, questEngine);

    // P0-2: 预先路由获取真实 feedbackId
    let routingFeedbackId = null;
    try {
      if (!this._canonicalRouter) {
        this._canonicalRouter = new CanonicalRouter();
        await this._canonicalRouter.initialize();
      }
      const preRoute = await this._canonicalRouter.route(quest.description || quest.title || '', {
        scope: 'quest-execution'
      });
      routingFeedbackId = preRoute.feedbackId;
    } catch {
      // 路由失败不影响执行
    }

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const executeResult = await this._executeQuest(quest, modelRoute, questEngine, ctx);
        if (executeResult.success === false) {
          throw new Error(executeResult.executionResult?.error || 'Quest execution did not complete');
        }
        questEngine.transition(FLOW_EVENTS.EXECUTE_DONE);
        // P0-2: 使用真实的 feedbackId 记录成功反馈
        const agentName = quest.agent || 'general-purpose';
        await this._recordAgentFeedback(agentName, 'success', undefined, routingFeedbackId);
        return { success: true, questId: quest.id, executionResult: executeResult.executionResult };
      } catch (error) {
        lastError = error;
        logger.warn(`[Quest ${quest.id}] Attempt ${attempt + 1} failed: ${error.message}`);
      }
    }

    // P0-2: 使用真实的 feedbackId 记录失败反馈
    const failedAgent = quest.agent || 'general-purpose';
    await this._recordAgentFeedback(failedAgent, 'failure', lastError?.message, routingFeedbackId);

    return {
      success: false,
      questId: quest.id,
      error: lastError?.message || 'All retries exhausted'
    };
  }

  // --- 辅助方法 ---

  /**
   * 懒初始化 Agent 注册表
   * @returns {Promise<AgentRegistry>}
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
   * 持久化 Agent 执行结果到 MemoryManager（P2-1）
   * @param {string} agentName
   * @param {Object} result
   * @param {string} questId
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
   * 从任务中提取关键词（使用统一提取器：停用词过滤 + 同义词扩展 + CJK 词典分词）
   * @private
   */
  _extractKeywords(task) {
    return extractKeywords(task);
  }

  /**
   * P2-1: 动态路由 Agent（通过 resolveTeam 查找，失败时 fallback）
   * @param {string[]} capabilityKeywords - 能力关键词
   * @param {string} fallbackAgent - 默认 Agent 名称
   * @returns {Promise<string>} Agent 名称
   * @private
   */
  async _resolveDynamicAgent(capabilityKeywords, fallbackAgent) {
    try {
      const registry = await this._ensureAgentRegistry();
      const team = registry.resolveTeam({
        keywords: capabilityKeywords,
        maxSize: 1
      });
      return team.lead ? team.lead.name : fallbackAgent;
    } catch {
      return fallbackAgent;
    }
  }

  /**
   * P2-4: 记录 Agent 执行反馈到 CanonicalRouter
   * P0-2 修复: 使用 route() 返回的真实 feedbackId，而非合成 ID
   * @param {string} agentName - Agent 名称
   * @param {'success'|'failure'} outcome - 执行结果
   * @param {string} [reason] - 失败原因
   * @param {string} [feedbackId] - 来自 route() 的反馈 ID（优先使用）
   * @private
   */
  async _recordAgentFeedback(agentName, outcome, reason, feedbackId) {
    try {
      if (!this._canonicalRouter) {
        this._canonicalRouter = new CanonicalRouter();
        await this._canonicalRouter.initialize();
      }
      // P0-2: 如果有真实的 feedbackId 直接使用，否则通过路由获取
      if (!feedbackId) {
        const routeResult = await this._canonicalRouter.route(
          `${agentName} feedback for ${outcome}`,
          { scope: 'feedback' }
        );
        feedbackId = routeResult.feedbackId;
      }
      this._canonicalRouter.recordFeedback(feedbackId, { outcome, reason });
      logger.debug(`[PHASE 3] Agent 反馈已记录: ${agentName} → ${outcome} (id=${feedbackId})`);
    } catch (fbError) {
      logger.debug(`[PHASE 3] Agent 反馈记录跳过: ${fbError.message}`);
    }
  }
}
