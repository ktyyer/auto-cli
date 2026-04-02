/**
 * Context Window Monitor — 上下文窗口监控器
 *
 * 与 token-budget.js 互补：
 * - token-budget: 管 API 调用成本（花了多少钱）
 * - context-monitor: 管上下文窗口占用（还能塞多少内容）
 *
 * 核心功能：
 * - 追踪当前上下文估算 token 数（字符数 / 4）
 * - 阈值告警（50%/75%/90%）
 * - 建议动作：50% 压缩，75% subagent 隔离，90% 强制压缩
 */

import { logger } from '../logger.js';

/**
 * 默认上下文窗口上限（token）
 */
export const DEFAULT_CONTEXT_LIMIT = 200000;

/**
 * 上下文阈值
 * @readonly
 */
export const CONTEXT_THRESHOLDS = Object.freeze({
  COMPRESS_SUGGEST: 0.5,
  ISOLATE_SUGGEST: 0.75,
  COMPRESS_REQUIRE: 0.9,
  OVERFLOW: 1.0
});

/**
 * 上下文状态
 * @readonly
 */
export const CONTEXT_STATUS = Object.freeze({
  OK: 'ok',
  COMPRESS_SUGGESTED: 'compress_suggested',
  ISOLATE_SUGGESTED: 'isolate_suggested',
  COMPRESS_REQUIRED: 'compress_required',
  OVERFLOW: 'overflow'
});

/**
 * 状态对应的建议动作
 * @readonly
 */
export const CONTEXT_ACTIONS = Object.freeze({
  [CONTEXT_STATUS.OK]: null,
  [CONTEXT_STATUS.COMPRESS_SUGGESTED]: '建议执行上下文压缩，移除已完成任务的详细输出',
  [CONTEXT_STATUS.ISOLATE_SUGGESTED]: '建议使用 subagent 隔离探索任务，保护主上下文',
  [CONTEXT_STATUS.COMPRESS_REQUIRED]: '上下文即将耗尽，必须立即压缩或开启新会话',
  [CONTEXT_STATUS.OVERFLOW]: '上下文已溢出，请开启新会话'
});

/**
 * 估算字符数对应的 token 数（简单除以 4）
 * @param {number} chars
 * @returns {number}
 */
export function estimateTokens(chars) {
  return Math.ceil(chars / 4);
}

/**
 * 创建上下文快照（不可变）
 * @param {Object} [options]
 * @param {number} [options.contextLimit]
 * @returns {Object}
 */
export function createContextSnapshot(options = {}) {
  return Object.freeze({
    contextLimit: options.contextLimit || DEFAULT_CONTEXT_LIMIT,
    currentTokens: 0,
    history: Object.freeze([]),
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

/**
 * 记录上下文使用（返回新快照）
 * @param {Object} snapshot
 * @param {number} chars - 字符数
 * @param {string} [label]
 * @returns {Object}
 */
export function recordUsage(snapshot, chars, label = '') {
  const tokens = estimateTokens(chars);
  const newTokens = snapshot.currentTokens + tokens;

  const newHistory = [
    ...snapshot.history,
    Object.freeze({
      tokens,
      chars,
      label,
      cumulativeTokens: newTokens,
      timestamp: Date.now()
    })
  ];

  return Object.freeze({
    ...snapshot,
    currentTokens: newTokens,
    history: Object.freeze(newHistory),
    updatedAt: Date.now()
  });
}

/**
 * 获取当前上下文状态
 * @param {Object} snapshot
 * @returns {string} CONTEXT_STATUS
 */
export function getContextStatus(snapshot) {
  const ratio = snapshot.currentTokens / snapshot.contextLimit;

  if (ratio >= CONTEXT_THRESHOLDS.OVERFLOW) return CONTEXT_STATUS.OVERFLOW;
  if (ratio >= CONTEXT_THRESHOLDS.COMPRESS_REQUIRE) return CONTEXT_STATUS.COMPRESS_REQUIRED;
  if (ratio >= CONTEXT_THRESHOLDS.ISOLATE_SUGGEST) return CONTEXT_STATUS.ISOLATE_SUGGESTED;
  if (ratio >= CONTEXT_THRESHOLDS.COMPRESS_SUGGEST) return CONTEXT_STATUS.COMPRESS_SUGGESTED;
  return CONTEXT_STATUS.OK;
}

/**
 * 获取建议动作
 * @param {Object} snapshot
 * @returns {string|null}
 */
export function getSuggestedAction(snapshot) {
  const status = getContextStatus(snapshot);
  return CONTEXT_ACTIONS[status];
}

/**
 * 获取上下文摘要
 * @param {Object} snapshot
 * @returns {{ tokens: number, limit: number, remaining: number, ratio: number, status: string, action: string|null }}
 */
export function getContextSummary(snapshot) {
  const remaining = snapshot.contextLimit - snapshot.currentTokens;
  const ratio = snapshot.currentTokens / snapshot.contextLimit;
  const status = getContextStatus(snapshot);

  return Object.freeze({
    tokens: snapshot.currentTokens,
    limit: snapshot.contextLimit,
    remaining: Math.max(0, remaining),
    ratio: Math.round(ratio * 100) / 100,
    status,
    action: CONTEXT_ACTIONS[status]
  });
}

/**
 * 模拟压缩（减少当前 token 数）
 * @param {Object} snapshot
 * @param {number} reducedTokens - 压缩掉的 token 数
 * @returns {Object}
 */
export function applyCompaction(snapshot, reducedTokens) {
  const newTokens = Math.max(0, snapshot.currentTokens - reducedTokens);

  return Object.freeze({
    ...snapshot,
    currentTokens: newTokens,
    updatedAt: Date.now()
  });
}

/**
 * Context Window Monitor（有状态包装）
 */
export class ContextMonitor {
  constructor(options = {}) {
    this._snapshot = createContextSnapshot(options);
  }

  record(chars, label = '') {
    this._snapshot = recordUsage(this._snapshot, chars, label);
    const status = getContextStatus(this._snapshot);

    if (status === CONTEXT_STATUS.COMPRESS_REQUIRED) {
      logger.warn(`上下文窗口严重不足! ${this.getSummary().ratio * 100}% 已用`);
    } else if (status === CONTEXT_STATUS.ISOLATE_SUGGESTED) {
      logger.warn(`上下文窗口告警: 建议使用 subagent 隔离`);
    }

    return { snapshot: this._snapshot, status };
  }

  getStatus() {
    return getContextStatus(this._snapshot);
  }

  getSummary() {
    return getContextSummary(this._snapshot);
  }

  getAction() {
    return getSuggestedAction(this._snapshot);
  }

  compact(reducedTokens) {
    this._snapshot = applyCompaction(this._snapshot, reducedTokens);
    return this._snapshot;
  }

  getSnapshot() {
    return this._snapshot;
  }
}

export default ContextMonitor;
