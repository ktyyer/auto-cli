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
import { updatePhaseContext, EXECUTION_MODES } from './phase-context.js';
import { logger } from '../logger.js';
import fs from 'fs-extra';
import path from 'node:path';

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

    // P0-1: 生成 Quest Map
    const questMap = this._generateQuestMap(ctx.task, {
      agentRecommendation,
      matchedSkills,
      skillContents,
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

    const questMap = ctx.questMap;
    if (!questMap || questMap.length === 0) {
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
      }
    } else {
      // 串行执行（原有逻辑）
      for (const quest of questMap) {
        const result = await this._executeSingleQuest(quest, ctx);
        if (result.success) {
          completedQuests.push(result.questId);
        } else {
          failedQuests.push({ questId: result.questId, error: result.error });
        }
      }
    }

    this.flowEngine.transition(FLOW_EVENTS.EXECUTE_DONE);

    ctx = updatePhaseContext(ctx, {
      completedQuests,
      failedQuests
    });

    logger.info(`[PHASE 3] 完成，成功: ${completedQuests.length}, 失败: ${failedQuests.length}`);

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

    // 创建单 Quest 并执行
    const microQuest = Object.freeze({
      id: 'micro-1',
      title: ctx.task.slice(0, 80),
      description: ctx.task,
      keywords: Object.freeze(this._extractKeywords(ctx.task)),
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
      await this._executeQuest(microQuest, modelRoute, questEngine, ctx);
      questEngine.transition(FLOW_EVENTS.EXECUTE_DONE);

      ctx = updatePhaseContext(ctx, {
        completedQuests: [microQuest.id],
        failedQuests: [],
        questMap: [microQuest]
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
  async _executeQuest(quest, modelRoute, _questEngine, _phaseContext) {
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

    // 记录合成消息到累加器（上限 50 条）
    if (this.messageAccumulator && this.messageAccumulator.length < 50) {
      this.messageAccumulator.push({
        role: 'quest-plan',
        content: JSON.stringify(executionPlan)
      });
    }

    // P2-1: 持久化 Agent 执行结果
    const leadName = team.lead ? team.lead.name : 'unknown';
    await this._persistAgentResult(leadName, { success: true }, quest.id);

    return { success: true, executionPlan, agentInvocation };
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
  _generateQuestMap(task, { agentRecommendation, matchedSkills, skillContents, modelRoute, mode }) {
    const keywords = this._extractKeywords(task);
    const skillNames = matchedSkills.map((s) => s.name);
    const skillData = skillContents || [];

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
          agent: analysisAgent.name,
          agentInvocation: Object.freeze({
            subagent_type: analysisAgent.name,
            description: `分析设计: ${task.slice(0, 50)}`,
            prompt: `分析以下任务并生成设计方案:\n\n任务: ${task}\n\n关键词: ${keywords.join(', ')}\n\n请输出: 1)现状分析 2)设计方案 3)影响文件 4)风险评估`,
            model: modelRoute?.tier === 'FAST' ? 'haiku' : 'sonnet'
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
        agent: implAgent,
        agentInvocation: Object.freeze({
          subagent_type: implAgent || 'general-purpose',
          description: `核心实现: ${task.slice(0, 50)}`,
          prompt: `实现以下任务:\n\n${task}\n\n验收标准:\n- 功能实现完成\n- 编译通过\n- 测试通过\n${skillData.length > 0 ? `\n参考技能:\n${skillData.map((s) => `--- ${s.name} ---\n${s.content?.slice(0, 500) || ''}`).join('\n\n')}` : ''}`,
          model: modelRoute?.tier === 'DEEP' ? 'opus' : 'sonnet'
        })
      })
    );

    // Quest 3: 代码审查
    if (mode === EXECUTION_MODES.FULL) {
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
          skills: Object.freeze([]),
          skillContents: Object.freeze([]),
          agent: 'code-reviewer',
          agentInvocation: Object.freeze({
            subagent_type: 'code-reviewer',
            description: '代码审查',
            prompt:
              '审查最近变更的代码。检查: 1)代码质量 2)命名规范 3)错误处理 4)安全隐患 5)性能问题。输出格式: Critical/Warning/Suggestion 分级。',
            model: 'sonnet'
          })
        })
      );

      // Quest 4: 对抗性验证
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
          agent: 'verification',
          agentInvocation: Object.freeze({
            subagent_type: 'verification',
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
    }

    return Object.freeze(quests);
  }

  /**
   * 检测项目是否具备 E2E 测试能力
   * @returns {boolean}
   * @private
   */
  _detectE2ECapability() {
    try {
      const pkgPath = path.join(this.projectDir, 'package.json');
      if (!fs.pathExistsSync(pkgPath)) return false;
      const pkg = fs.readJsonSync(pkgPath);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !!(deps['@playwright/test'] || deps['playwright']);
    } catch {
      return false;
    }
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
    const results = await Promise.allSettled(
      batch.map((quest) => this._executeSingleQuest(quest, ctx))
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value.success) {
        completed.push(r.value.questId);
      } else {
        const errMsg =
          r.status === 'rejected'
            ? r.reason?.message || String(r.reason)
            : r.value.error || 'Unknown error';
        failed.push({ questId: batch[i].id, error: errMsg });
      }
    }
    return { completed, failed };
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

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this._executeQuest(quest, modelRoute, questEngine, ctx);
        questEngine.transition(FLOW_EVENTS.EXECUTE_DONE);
        return { success: true, questId: quest.id };
      } catch (error) {
        lastError = error;
        logger.warn(`[Quest ${quest.id}] Attempt ${attempt + 1} failed: ${error.message}`);
      }
    }

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
   * 从任务中提取关键词
   * @private
   */
  _extractKeywords(task) {
    if (!task) return [];
    const englishTerms = (task.match(/[a-z][a-z0-9._-]+/gi) || []).filter((t) => t.length > 2);
    const chineseTerms = task.match(/[\u4e00-\u9fff]{2,}/g) || [];
    return [...new Set([...englishTerms, ...chineseTerms])];
  }
}
