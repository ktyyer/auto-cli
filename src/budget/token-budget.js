/**
 * Token 预算管理器
 *
 * 借鉴 Claude Code 的 Token Budget 机制：
 * - 全局预算池：设定总 Token 上限，各阶段按比例分配
 * - 实时追踪：每次消耗后更新剩余预算
 * - 阈值告警：接近上限时触发压缩/截断策略
 * - 阶段配额：不同 PHASE 有不同的 Token 配额
 *
 * 设计原则：
 * - 不可变更新
 * - 纯函数计算，副作用隔离到 Manager 层
 */

import { logger } from '../logger.js';

/**
 * 默认总预算（Token 数）
 */
export const DEFAULT_TOTAL_BUDGET = 200000;

/**
 * 阶段配额比例（总和 = 1.0）
 * @readonly
 */
export const PHASE_QUOTAS = Object.freeze({
  discover: 0.1, // PHASE 1: 扫描上下文
  reason: 0.25, // PHASE 2: 深度分析
  execute: 0.45, // PHASE 3: 代码执行（最大）
  verify: 0.1, // PHASE 4: 验证
  commit: 0.05, // PHASE 5: 提交
  learn: 0.05 // PHASE 6: 知识沉淀
});

/**
 * 告警阈值
 * @readonly
 */
export const ALERT_THRESHOLDS = Object.freeze({
  WARNING: 0.75, // 已用 75% 时警告
  CRITICAL: 0.9, // 已用 90% 时严重警告
  EXHAUSTED: 1.0 // 耗尽
});

/**
 * 预算状态
 * @readonly
 */
export const BUDGET_STATUS = Object.freeze({
  OK: 'ok',
  WARNING: 'warning',
  CRITICAL: 'critical',
  EXHAUSTED: 'exhausted'
});

/**
 * 创建预算快照（不可变）
 * @param {Object} [options]
 * @param {number} [options.totalBudget]
 * @param {Object} [options.phaseQuotas]
 * @returns {Object}
 */
export function createBudget(options = {}) {
  const total = options.totalBudget || DEFAULT_TOTAL_BUDGET;
  const quotas = options.phaseQuotas || PHASE_QUOTAS;

  const phaseAllocations = {};
  for (const [phase, ratio] of Object.entries(quotas)) {
    phaseAllocations[phase] = {
      allocated: Math.floor(total * ratio),
      consumed: 0
    };
  }

  return Object.freeze({
    totalBudget: total,
    totalConsumed: 0,
    phaseAllocations: Object.freeze(phaseAllocations),
    history: Object.freeze([]),
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

/**
 * 记录 Token 消耗（返回新预算快照）
 * @param {Object} budget - 当前预算
 * @param {string} phase - 阶段名
 * @param {number} tokens - 消耗的 Token 数
 * @param {string} [label] - 操作标签
 * @returns {Object} 新预算快照
 */
export function consumeTokens(budget, phase, tokens, label = '') {
  const allocation = budget.phaseAllocations[phase];
  if (!allocation) {
    throw new Error(`未知阶段: ${phase}`);
  }

  const newAllocations = { ...budget.phaseAllocations };
  newAllocations[phase] = {
    ...allocation,
    consumed: allocation.consumed + tokens
  };

  const newHistory = [
    ...budget.history,
    Object.freeze({
      phase,
      tokens,
      label,
      timestamp: Date.now()
    })
  ];

  return Object.freeze({
    ...budget,
    totalConsumed: budget.totalConsumed + tokens,
    phaseAllocations: Object.freeze(newAllocations),
    history: Object.freeze(newHistory),
    updatedAt: Date.now()
  });
}

/**
 * 获取当前预算状态
 * @param {Object} budget
 * @returns {string} BUDGET_STATUS
 */
export function getBudgetStatus(budget) {
  const ratio = budget.totalConsumed / budget.totalBudget;

  if (ratio >= ALERT_THRESHOLDS.EXHAUSTED) return BUDGET_STATUS.EXHAUSTED;
  if (ratio >= ALERT_THRESHOLDS.CRITICAL) return BUDGET_STATUS.CRITICAL;
  if (ratio >= ALERT_THRESHOLDS.WARNING) return BUDGET_STATUS.WARNING;
  return BUDGET_STATUS.OK;
}

/**
 * 获取阶段预算状态
 * @param {Object} budget
 * @param {string} phase
 * @returns {{ allocated: number, consumed: number, remaining: number, ratio: number, status: string }}
 */
export function getPhaseStatus(budget, phase) {
  const allocation = budget.phaseAllocations[phase];
  if (!allocation) return null;

  const remaining = allocation.allocated - allocation.consumed;
  const ratio = allocation.allocated > 0 ? allocation.consumed / allocation.allocated : 0;

  let status = BUDGET_STATUS.OK;
  if (ratio >= ALERT_THRESHOLDS.EXHAUSTED) status = BUDGET_STATUS.EXHAUSTED;
  else if (ratio >= ALERT_THRESHOLDS.CRITICAL) status = BUDGET_STATUS.CRITICAL;
  else if (ratio >= ALERT_THRESHOLDS.WARNING) status = BUDGET_STATUS.WARNING;

  return Object.freeze({
    allocated: allocation.allocated,
    consumed: allocation.consumed,
    remaining,
    ratio,
    status
  });
}

/**
 * 检查是否有足够预算执行操作
 * 支持动态借用：当阶段预算不足但总预算充足时，从已完成的阶段借用
 * @param {Object} budget
 * @param {string} phase
 * @param {number} estimatedTokens
 * @returns {boolean}
 */
export function canAfford(budget, phase, estimatedTokens) {
  const phaseStatus = getPhaseStatus(budget, phase);
  if (!phaseStatus) return false;

  const totalRemaining = budget.totalBudget - budget.totalConsumed;

  // 阶段预算够 且 总预算够
  if (phaseStatus.remaining >= estimatedTokens && totalRemaining >= estimatedTokens) {
    return true;
  }

  // 动态借用：阶段预算不够但总预算够（从已完成的阶段借用）
  if (phaseStatus.remaining < estimatedTokens && totalRemaining >= estimatedTokens) {
    return true;
  }

  return false;
}

/**
 * 动态调整预算配额
 * 当某阶段提前完成（消耗远低于配额），将剩余配额重新分配给后续阶段
 *
 * @param {Object} budget - 当前预算
 * @param {Object} params
 * @param {string} params.completedPhase - 已完成的阶段
 * @param {string[]} params.upcomingPhases - 后续阶段列表
 * @param {number} [params.redistributeRatio=0.5] - 重新分配比例（0-1）
 * @returns {Object} 新预算快照
 */
export function dynamicRebalance(budget, params = {}) {
  const { completedPhase, upcomingPhases = [], redistributeRatio = 0.5 } = params;

  const completed = budget.phaseAllocations[completedPhase];
  if (!completed) return budget;

  const surplus = completed.allocated - completed.consumed;
  if (surplus <= 0) return budget;

  // 可重新分配的额度
  const redistributable = Math.floor(surplus * redistributeRatio);
  if (redistributable <= 0 || upcomingPhases.length === 0) return budget;

  // 平均分配给后续阶段
  const perPhase = Math.floor(redistributable / upcomingPhases.length);

  const newAllocations = { ...budget.phaseAllocations };
  for (const phase of upcomingPhases) {
    if (newAllocations[phase]) {
      newAllocations[phase] = {
        ...newAllocations[phase],
        allocated: newAllocations[phase].allocated + perPhase
      };
    }
  }

  return Object.freeze({
    ...budget,
    phaseAllocations: Object.freeze(newAllocations),
    history: Object.freeze([
      ...budget.history,
      Object.freeze({
        phase: completedPhase,
        tokens: 0,
        label: `dynamic-rebalance: ${redistributable} tokens redistributed to [${upcomingPhases.join(', ')}]`,
        timestamp: Date.now()
      })
    ]),
    updatedAt: Date.now()
  });
}

/**
 * 获取预算摘要（用于日志/报告）
 * @param {Object} budget
 * @returns {string}
 */
export function getBudgetSummary(budget) {
  const status = getBudgetStatus(budget);
  const pct = Math.round((budget.totalConsumed / budget.totalBudget) * 100);

  const lines = [
    `Token 预算: ${budget.totalConsumed.toLocaleString()}/${budget.totalBudget.toLocaleString()} (${pct}%) [${status}]`
  ];

  for (const [phase, alloc] of Object.entries(budget.phaseAllocations)) {
    if (alloc.consumed > 0) {
      const phasePct = Math.round((alloc.consumed / alloc.allocated) * 100);
      lines.push(
        `  ${phase}: ${alloc.consumed.toLocaleString()}/${alloc.allocated.toLocaleString()} (${phasePct}%)`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Token 预算管理器（有状态包装）
 */
export class TokenBudgetManager {
  /**
   * @param {Object} [options]
   * @param {number} [options.totalBudget]
   * @param {Object} [options.phaseQuotas]
   */
  constructor(options = {}) {
    this._budget = createBudget(options);
  }

  /**
   * 记录消耗
   * @param {string} phase
   * @param {number} tokens
   * @param {string} [label]
   * @returns {{ budget: Object, status: string }}
   */
  consume(phase, tokens, label = '') {
    this._budget = consumeTokens(this._budget, phase, tokens, label);
    const status = getBudgetStatus(this._budget);

    if (status === BUDGET_STATUS.CRITICAL) {
      logger.warn(`Token 预算严重不足! ${getBudgetSummary(this._budget)}`);
    } else if (status === BUDGET_STATUS.WARNING) {
      logger.warn(`Token 预算告警: ${getBudgetSummary(this._budget)}`);
    }

    return { budget: this._budget, status };
  }

  /**
   * 检查是否可以执行
   * @param {string} phase
   * @param {number} estimatedTokens
   * @returns {boolean}
   */
  canAfford(phase, estimatedTokens) {
    return canAfford(this._budget, phase, estimatedTokens);
  }

  /**
   * 获取当前预算快照
   * @returns {Object}
   */
  getSnapshot() {
    return this._budget;
  }

  /**
   * 获取状态
   * @returns {string}
   */
  getStatus() {
    return getBudgetStatus(this._budget);
  }

  /**
   * 获取阶段状态
   * @param {string} phase
   * @returns {Object|null}
   */
  getPhaseStatus(phase) {
    return getPhaseStatus(this._budget, phase);
  }

  /**
   * 动态重新分配预算配额
   * @param {Object} params
   * @param {string} params.completedPhase - 已完成的阶段
   * @param {string[]} [params.upcomingPhases] - 后续阶段列表
   * @param {number} [params.redistributeRatio] - 重新分配比例
   * @returns {{ budget: Object, redistributed: number }}
   */
  rebalance(params = {}) {
    const before = this._budget;
    this._budget = dynamicRebalance(this._budget, params);

    const prevPhase = before.phaseAllocations[params.completedPhase];
    const curPhase = this._budget.phaseAllocations[params.completedPhase];
    const prevAlloc = prevPhase ? prevPhase.allocated : 0;
    const curAlloc = curPhase ? curPhase.allocated : 0;
    const redistributed = Math.max(0, prevAlloc - curAlloc);

    if (redistributed > 0) {
      logger.info(
        `Token 预算动态调整: 从 ${params.completedPhase} 重新分配 ${redistributed} tokens`
      );
    }

    return { budget: this._budget, redistributed };
  }

  /**
   * 获取摘要
   * @returns {string}
   */
  getSummary() {
    return getBudgetSummary(this._budget);
  }
}

export default TokenBudgetManager;
