/**
 * Denial Tracker -- 拒绝追踪与优雅降级
 *
 * 追踪工具/agent 调度被拒绝的频率，触发条件时自动切换提示模式：
 * - 连续拒绝阈值: 3 次连续拒绝 → 降级
 * - 累计拒绝阈值: 20 次总拒绝 → 降级
 *
 * 降级模式:
 * - CONSERVATIVE: 保守模式，减少并行度，优先简单操作
 * - MINIMAL: 最小模式，只允许核心操作，禁止探索
 *
 * 不可变模式: 所有操作返回新对象
 * 纯函数: 无副作用，状态由调用方持有
 */

import { logger } from '../logger.js';

/**
 * 提示模式枚举
 * @readonly
 */
export const PROMPT_MODES = Object.freeze({
  NORMAL: 'normal',
  CONSERVATIVE: 'conservative',
  MINIMAL: 'minimal'
});

/**
 * 降级触发条件
 * @readonly
 */
export const DEGRADATION_TRIGGERS = Object.freeze({
  CONSECUTIVE_DENIALS: 'consecutive_denials',
  TOTAL_DENIALS: 'total_denials',
  MANUAL: 'manual'
});

/**
 * 默认降级阈值
 * @readonly
 */
export const DEFAULT_DENIAL_THRESHOLDS = Object.freeze({
  /** 连续拒绝触发降级的次数 */
  consecutiveLimit: 3,
  /** 累计拒绝触发降级的总次数 */
  totalLimit: 20
});

/**
 * 创建拒绝追踪状态（不可变）
 * @param {Object} [options]
 * @param {number} [options.consecutiveLimit=3]
 * @param {number} [options.totalLimit=20]
 * @returns {Object}
 */
export function createDenialState(options = {}) {
  return Object.freeze({
    consecutiveDenials: 0,
    totalDenials: 0,
    totalApprovals: 0,
    promptMode: PROMPT_MODES.NORMAL,
    degradationTrigger: null,
    consecutiveLimit: options.consecutiveLimit ?? DEFAULT_DENIAL_THRESHOLDS.consecutiveLimit,
    totalLimit: options.totalLimit ?? DEFAULT_DENIAL_THRESHOLDS.totalLimit,
    history: Object.freeze([]),
    _createdAt: Date.now(),
    _updatedAt: Date.now()
  });
}

/**
 * 记录一次拒绝（返回新状态）
 * @param {Object} state - 当前拒绝追踪状态
 * @param {Object} [detail] - 拒绝详情
 * @param {string} [detail.toolName] - 被拒绝的工具/agent 名称
 * @param {string} [detail.reason] - 拒绝原因
 * @returns {Object} 新状态
 */
export function recordDenial(state, detail = {}) {
  const newConsecutive = state.consecutiveDenials + 1;
  const newTotal = state.totalDenials + 1;

  const newHistory = [
    ...state.history,
    Object.freeze({
      type: 'denial',
      toolName: detail.toolName ?? 'unknown',
      reason: detail.reason ?? '',
      timestamp: Date.now()
    })
  ].slice(-50);

  let newMode = state.promptMode;
  let trigger = state.degradationTrigger;

  if (newConsecutive >= state.consecutiveLimit && state.promptMode === PROMPT_MODES.NORMAL) {
    newMode = PROMPT_MODES.CONSERVATIVE;
    trigger = DEGRADATION_TRIGGERS.CONSECUTIVE_DENIALS;
    logger.warn(`拒绝追踪: 连续拒绝 ${newConsecutive} 次，切换到 CONSERVATIVE 模式`);
  } else if (newTotal >= state.totalLimit && state.promptMode !== PROMPT_MODES.MINIMAL) {
    newMode = PROMPT_MODES.MINIMAL;
    trigger = DEGRADATION_TRIGGERS.TOTAL_DENIALS;
    logger.warn(`拒绝追踪: 累计拒绝 ${newTotal} 次，切换到 MINIMAL 模式`);
  }

  return Object.freeze({
    ...state,
    consecutiveDenials: newConsecutive,
    totalDenials: newTotal,
    promptMode: newMode,
    degradationTrigger: trigger,
    history: Object.freeze(newHistory),
    _updatedAt: Date.now()
  });
}

/**
 * 记录一次批准（重置连续计数，返回新状态）
 * @param {Object} state
 * @param {Object} [detail]
 * @param {string} [detail.toolName]
 * @returns {Object} 新状态
 */
export function recordApproval(state, detail = {}) {
  const newHistory = [
    ...state.history,
    Object.freeze({
      type: 'approval',
      toolName: detail.toolName ?? 'unknown',
      timestamp: Date.now()
    })
  ].slice(-50);

  return Object.freeze({
    ...state,
    consecutiveDenials: 0,
    totalApprovals: state.totalApprovals + 1,
    history: Object.freeze(newHistory),
    _updatedAt: Date.now()
  });
}

/**
 * 手动降级（返回新状态）
 * @param {Object} state
 * @param {string} [mode=PROMPT_MODES.CONSERVATIVE]
 * @returns {Object} 新状态
 */
export function manualDegrade(state, mode = PROMPT_MODES.CONSERVATIVE) {
  const validModes = [PROMPT_MODES.CONSERVATIVE, PROMPT_MODES.MINIMAL];
  const targetMode = validModes.includes(mode) ? mode : PROMPT_MODES.CONSERVATIVE;

  logger.info(`拒绝追踪: 手动降级到 ${targetMode} 模式`);

  return Object.freeze({
    ...state,
    promptMode: targetMode,
    degradationTrigger: DEGRADATION_TRIGGERS.MANUAL,
    _updatedAt: Date.now()
  });
}

/**
 * 重置为正常模式（返回新状态）
 * @param {Object} state
 * @returns {Object} 新状态
 */
export function resetToNormal(state) {
  logger.info('拒绝追踪: 重置为 NORMAL 模式');

  return Object.freeze({
    ...state,
    consecutiveDenials: 0,
    promptMode: PROMPT_MODES.NORMAL,
    degradationTrigger: null,
    _updatedAt: Date.now()
  });
}

/**
 * 检查当前是否处于降级模式
 * @param {Object} state
 * @returns {boolean}
 */
export function isDegraded(state) {
  return state.promptMode !== PROMPT_MODES.NORMAL;
}

/**
 * 获取当前允许的操作级别（用于过滤工具/agent）
 * @param {Object} state
 * @returns {{ allowExploratory: boolean, allowParallel: boolean, maxComplexity: string }}
 */
export function getAllowedLevel(state) {
  if (state.promptMode === PROMPT_MODES.MINIMAL) {
    return Object.freeze({
      allowExploratory: false,
      allowParallel: false,
      maxComplexity: 'simple'
    });
  }
  if (state.promptMode === PROMPT_MODES.CONSERVATIVE) {
    return Object.freeze({
      allowExploratory: false,
      allowParallel: true,
      maxComplexity: 'moderate'
    });
  }
  return Object.freeze({
    allowExploratory: true,
    allowParallel: true,
    maxComplexity: 'complex'
  });
}

/**
 * 获取拒绝追踪摘要
 * @param {Object} state
 * @returns {Object}
 */
export function getDenialSummary(state) {
  return Object.freeze({
    promptMode: state.promptMode,
    isDegraded: isDegraded(state),
    consecutiveDenials: state.consecutiveDenials,
    totalDenials: state.totalDenials,
    totalApprovals: state.totalApprovals,
    degradationTrigger: state.degradationTrigger,
    consecutiveLimit: state.consecutiveLimit,
    totalLimit: state.totalLimit,
    consecutiveProgress: `${state.consecutiveDenials}/${state.consecutiveLimit}`,
    totalProgress: `${state.totalDenials}/${state.totalLimit}`
  });
}
