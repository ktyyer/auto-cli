/**
 * Subagent Model Router — 子 Agent 模型路由器
 *
 * 为不同任务推荐不同模型层级：
 * - FAST (haiku): 探索、搜索、简单查询
 * - STANDARD (sonnet): 编码、测试、常规开发
 * - DEEP (opus): 架构决策、复杂推理、安全审计
 *
 * 路由规则：
 * - 根据 agent complexity 字段映射
 * - 根据任务关键词推断
 * - 支持手动覆盖
 */

import { COMPLEXITY_LEVELS } from './agent-types.js';

/**
 * 模型层级
 * @readonly
 */
export const MODEL_TIERS = Object.freeze({
  FAST: 'fast',
  STANDARD: 'standard',
  DEEP: 'deep'
});

/**
 * 模型层级 → 推荐模型 ID
 * @readonly
 */
export const MODEL_IDS = Object.freeze({
  [MODEL_TIERS.FAST]: 'haiku',
  [MODEL_TIERS.STANDARD]: 'sonnet',
  [MODEL_TIERS.DEEP]: 'opus'
});

/**
 * 复杂度 → 模型层级映射
 * @readonly
 */
export const COMPLEXITY_TO_TIER = Object.freeze({
  [COMPLEXITY_LEVELS.LOW]: MODEL_TIERS.FAST,
  [COMPLEXITY_LEVELS.MEDIUM]: MODEL_TIERS.STANDARD,
  [COMPLEXITY_LEVELS.HIGH]: MODEL_TIERS.DEEP
});

/**
 * 关键词 → 模型层级映射
 * @readonly
 */
export const KEYWORD_TIERS = Object.freeze({
  [MODEL_TIERS.FAST]: [
    'explore',
    'search',
    'find',
    'list',
    'glob',
    'grep',
    '搜索',
    '查找',
    '探索',
    '列出',
    '扫描'
  ],
  [MODEL_TIERS.STANDARD]: [
    'code',
    'test',
    'implement',
    'fix',
    'refactor',
    'build',
    '编码',
    '测试',
    '实现',
    '修复',
    '重构',
    '构建',
    '开发'
  ],
  [MODEL_TIERS.DEEP]: [
    'architect',
    'design',
    'security',
    'audit',
    'review',
    'analyze',
    '架构',
    '设计',
    '安全',
    '审计',
    '审查',
    '分析',
    '决策',
    '规划'
  ]
});

/**
 * 根据 Agent 清单路由模型
 * @param {Object} agent - Agent 清单（含 complexity 字段）
 * @returns {{ model: string, tier: string, reason: string }}
 */
export function routeByAgent(agent) {
  if (!agent || !agent.complexity) {
    return Object.freeze({
      model: MODEL_IDS[MODEL_TIERS.STANDARD],
      tier: MODEL_TIERS.STANDARD,
      reason: 'Agent 无 complexity 字段，使用默认 STANDARD'
    });
  }

  const tier = COMPLEXITY_TO_TIER[agent.complexity] || MODEL_TIERS.STANDARD;
  return Object.freeze({
    model: MODEL_IDS[tier],
    tier,
    reason: `Agent complexity=${agent.complexity} → ${tier}`
  });
}

/**
 * 根据任务关键词路由模型
 * @param {string[]} keywords
 * @returns {{ model: string, tier: string, reason: string, matchedKeywords: string[] }}
 */
export function routeByKeywords(keywords) {
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  const scores = {
    [MODEL_TIERS.FAST]: 0,
    [MODEL_TIERS.STANDARD]: 0,
    [MODEL_TIERS.DEEP]: 0
  };
  const matched = {
    [MODEL_TIERS.FAST]: [],
    [MODEL_TIERS.STANDARD]: [],
    [MODEL_TIERS.DEEP]: []
  };

  for (const [tier, tierKeywords] of Object.entries(KEYWORD_TIERS)) {
    for (const kw of lowerKeywords) {
      for (const tk of tierKeywords) {
        if (kw.includes(tk) || tk.includes(kw)) {
          scores[tier]++;
          matched[tier].push(tk);
        }
      }
    }
  }

  // 取最高分层级，平局时取更高层级（DEEP > STANDARD > FAST）
  const tierPriority = [MODEL_TIERS.DEEP, MODEL_TIERS.STANDARD, MODEL_TIERS.FAST];
  let bestTier = MODEL_TIERS.STANDARD;
  let bestScore = 0;

  for (const tier of tierPriority) {
    if (scores[tier] > bestScore) {
      bestScore = scores[tier];
      bestTier = tier;
    }
  }

  const matchedKeywords = matched[bestTier];

  return Object.freeze({
    model: MODEL_IDS[bestTier],
    tier: bestTier,
    reason:
      bestScore > 0
        ? `关键词匹配: [${matchedKeywords.join(', ')}] → ${bestTier}`
        : '无关键词匹配，使用默认 STANDARD',
    matchedKeywords
  });
}

/**
 * 综合路由（Agent + 关键词 + 手动覆盖）
 * @param {Object} params
 * @param {Object} [params.agent] - Agent 清单
 * @param {string[]} [params.keywords=[]] - 任务关键词
 * @param {string} [params.override] - 手动覆盖的层级
 * @returns {{ model: string, tier: string, reason: string }}
 */
export function routeModel({ agent, keywords = [], override } = {}) {
  // 手动覆盖优先
  if (override && MODEL_IDS[override]) {
    return Object.freeze({
      model: MODEL_IDS[override],
      tier: override,
      reason: `手动覆盖: ${override}`
    });
  }

  // Agent 路由
  const agentRoute = agent ? routeByAgent(agent) : null;

  // 关键词路由
  const keywordRoute = keywords.length > 0 ? routeByKeywords(keywords) : null;

  // 合并：取更高层级
  if (agentRoute && keywordRoute) {
    const tierOrder = [MODEL_TIERS.FAST, MODEL_TIERS.STANDARD, MODEL_TIERS.DEEP];
    const agentIdx = tierOrder.indexOf(agentRoute.tier);
    const kwIdx = tierOrder.indexOf(keywordRoute.tier);

    if (kwIdx > agentIdx) {
      return Object.freeze({
        model: keywordRoute.model,
        tier: keywordRoute.tier,
        reason: `${keywordRoute.reason}（覆盖 Agent 建议的 ${agentRoute.tier}）`
      });
    }
    return agentRoute;
  }

  if (agentRoute) return agentRoute;
  if (keywordRoute) return keywordRoute;

  return Object.freeze({
    model: MODEL_IDS[MODEL_TIERS.STANDARD],
    tier: MODEL_TIERS.STANDARD,
    reason: '无路由信息，使用默认 STANDARD'
  });
}
