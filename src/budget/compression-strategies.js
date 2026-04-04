/**
 * Compression Strategies -- 多级压缩策略链
 *
 * 5 级压缩策略，从轻到重:
 * 1. TRUNCATE -- 截断过大输出 (>10KB 的工具结果截断到 2KB)
 * 2. SNIP -- 移除旧的高频工具输出 (Read/Bash/Grep 的旧结果)
 * 3. MICRO_COMPACT -- 定向清理，保留最近的 N 条完整消息
 * 4. COLLAPSE -- 合并重复对话内容为摘要
 * 5. AUTO_COMPACT -- 最后手段，返回摘要提示
 *
 * 注册式: 策略可动态注册和移除
 * 不可变模式: 所有操作返回新快照
 */

import { logger } from '../logger.js';
import { estimateTokens } from './context-monitor.js';

/**
 * 压缩策略级别（数值越大越激进）
 * @readonly
 */
export const COMPRESSION_LEVELS = Object.freeze({
  TRUNCATE: 1,
  SNIP: 2,
  MICRO_COMPACT: 3,
  COLLAPSE: 4,
  AUTO_COMPACT: 5,
  REACTIVE_COMPACT: 6
});

/**
 * 压缩策略名称映射
 * @readonly
 */
export const COMPRESSION_NAMES = Object.freeze({
  [COMPRESSION_LEVELS.TRUNCATE]: 'TRUNCATE',
  [COMPRESSION_LEVELS.SNIP]: 'SNIP',
  [COMPRESSION_LEVELS.MICRO_COMPACT]: 'MICRO_COMPACT',
  [COMPRESSION_LEVELS.COLLAPSE]: 'COLLAPSE',
  [COMPRESSION_LEVELS.AUTO_COMPACT]: 'AUTO_COMPACT',
  [COMPRESSION_LEVELS.REACTIVE_COMPACT]: 'REACTIVE_COMPACT'
});

/**
 * 策略默认配置
 * @readonly
 */
export const STRATEGY_DEFAULTS = Object.freeze({
  /** TRUNCATE: 超过此大小的工具结果被截断（字符数） */
  truncateThreshold: 10000,
  /** TRUNCATE: 截断后保留的字符数 */
  truncateKeep: 2000,
  /** SNIP: 视为"旧"的条目数（保留最近 N 条） */
  snipKeepRecent: 5,
  /** SNIP: 要移除的工具类型 */
  snipToolTypes: Object.freeze(['Read', 'Bash', 'Grep', 'Glob']),
  /** MICRO_COMPACT: 保留的完整消息数 */
  microCompactKeepCount: 10,
  /** COLLAPSE: 合并窗口大小 */
  collapseWindowSize: 3,
  /** REACTIVE_COMPACT: 触发的上下文使用率阈值 */
  reactiveCompactThreshold: 0.95,
  /** REACTIVE_COMPACT: 工具输出持久化目录 */
  reactiveCompactSpillDir: '.auto/spill',
  /** MICRO_COMPACT: 工具输出感知 -- 是否持久化被移除的工具输出到磁盘 */
  microCompactPersistToolOutput: true,
  /** MICRO_COMPACT: 工具输出持久化目录 */
  microCompactSpillDir: '.auto/spill'
});

/**
 * 创建压缩结果（不可变）
 * @param {Object} params
 * @returns {Object}
 */
export function createCompressionResult(params = {}) {
  return Object.freeze({
    applied: params.applied ?? false,
    level: params.level ?? 0,
    strategyName: params.strategyName ?? '',
    reducedTokens: params.reducedTokens ?? 0,
    details: Object.freeze(params.details ?? {}),
    snapshot: params.snapshot ?? null,
    recommendation: params.recommendation ?? null
  });
}

// ============================================================
// Strategy 1: TRUNCATE
// ============================================================

/**
 * TRUNCATE 策略: 截断过大输出
 * @param {Object} snapshot
 * @param {Object} [config]
 * @returns {{ shouldApply: boolean, reason: string }}
 */
export function truncateShouldApply(snapshot, config = {}) {
  const threshold = config.truncateThreshold ?? STRATEGY_DEFAULTS.truncateThreshold;
  const hasLargeEntries = snapshot.history.some((h) => h.chars >= threshold);
  return {
    shouldApply: hasLargeEntries,
    reason: hasLargeEntries ? '存在超大规模工具输出' : ''
  };
}

/**
 * TRUNCATE 执行
 * @param {Object} snapshot
 * @param {Object} [config]
 * @returns {Object} 新快照
 */
export function truncateExecute(snapshot, config = {}) {
  const threshold = config.truncateThreshold ?? STRATEGY_DEFAULTS.truncateThreshold;
  const keep = config.truncateKeep ?? STRATEGY_DEFAULTS.truncateKeep;

  let reducedTokens = 0;
  const newHistory = snapshot.history.map((h) => {
    if (h.chars >= threshold) {
      const originalTokens = estimateTokens(h.chars);
      const newTokens = estimateTokens(keep);
      reducedTokens += originalTokens - newTokens;

      return Object.freeze({
        ...h,
        chars: keep,
        tokens: newTokens,
        truncated: true,
        originalChars: h.chars
      });
    }
    return h;
  });

  const newTokens = snapshot.currentTokens - reducedTokens;

  return Object.freeze({
    ...snapshot,
    currentTokens: Math.max(0, newTokens),
    history: Object.freeze(newHistory),
    updatedAt: Date.now()
  });
}

// ============================================================
// Strategy 2: SNIP
// ============================================================

/**
 * SNIP 策略: 移除旧的高频工具输出
 * @param {Object} snapshot
 * @param {Object} [config]
 * @returns {{ shouldApply: boolean, reason: string }}
 */
export function snipShouldApply(snapshot, config = {}) {
  const toolTypes = config.snipToolTypes ?? STRATEGY_DEFAULTS.snipToolTypes;
  const keepRecent = config.snipKeepRecent ?? STRATEGY_DEFAULTS.snipKeepRecent;

  const recentSet = new Set(snapshot.history.slice(-keepRecent));
  const oldToolEntries = snapshot.history.filter((h) => {
    const isTool = toolTypes.some((t) => h.label && h.label.includes(t));
    const isOld = !recentSet.has(h);
    return isTool && isOld;
  });

  return {
    shouldApply: oldToolEntries.length > 0,
    reason: oldToolEntries.length > 0 ? `${oldToolEntries.length} 条旧工具输出可移除` : ''
  };
}

/**
 * SNIP 执行
 * @param {Object} snapshot
 * @param {Object} [config]
 * @returns {Object} 新快照
 */
export function snipExecute(snapshot, config = {}) {
  const toolTypes = config.snipToolTypes ?? STRATEGY_DEFAULTS.snipToolTypes;
  const keepRecent = config.snipKeepRecent ?? STRATEGY_DEFAULTS.snipKeepRecent;

  const recentSet = new Set(snapshot.history.slice(-keepRecent));

  let reducedTokens = 0;
  const newHistory = snapshot.history.filter((h) => {
    const isTool = toolTypes.some((t) => h.label && h.label.includes(t));
    if (isTool && !recentSet.has(h)) {
      reducedTokens += h.tokens;
      return false;
    }
    return true;
  });

  const newTokens = snapshot.currentTokens - reducedTokens;

  return Object.freeze({
    ...snapshot,
    currentTokens: Math.max(0, newTokens),
    history: Object.freeze(newHistory),
    updatedAt: Date.now()
  });
}

// ============================================================
// Strategy 3: MICRO_COMPACT
// ============================================================

/**
 * MICRO_COMPACT 策略: 定向清理
 * @param {Object} snapshot
 * @param {Object} [config]
 * @returns {{ shouldApply: boolean, reason: string }}
 */
export function microCompactShouldApply(snapshot, config = {}) {
  const keepCount = config.microCompactKeepCount ?? STRATEGY_DEFAULTS.microCompactKeepCount;
  return {
    shouldApply: snapshot.history.length > keepCount * 2,
    reason:
      snapshot.history.length > keepCount * 2
        ? `历史记录 ${snapshot.history.length} 条，超过阈值 ${keepCount * 2}`
        : ''
  };
}

/**
 * MICRO_COMPACT 执行（增强版 -- 工具输出感知持久化到磁盘）
 * @param {Object} snapshot
 * @param {Object} [config]
 * @returns {Object} 新快照
 */
export function microCompactExecute(snapshot, config = {}) {
  const keepCount = config.microCompactKeepCount ?? STRATEGY_DEFAULTS.microCompactKeepCount;
  const persistToolOutput =
    config.microCompactPersistToolOutput ?? STRATEGY_DEFAULTS.microCompactPersistToolOutput;
  const spillDir = config.microCompactSpillDir ?? STRATEGY_DEFAULTS.microCompactSpillDir;

  // 保留最近 N 条完整消息
  const kept = snapshot.history.slice(-keepCount);
  const removed = snapshot.history.slice(0, -keepCount);

  // 工具输出感知：识别被移除的工具输出条目
  const toolOutputTypes = ['Bash', 'Read', 'Grep', 'Glob', 'Write'];
  const removedToolOutputs = persistToolOutput
    ? removed.filter((h) => toolOutputTypes.some((t) => h.label && h.label.includes(t)))
    : [];

  // 异步持久化到磁盘（非阻塞，失败不影响压缩）
  if (removedToolOutputs.length > 0) {
    _spillToolOutputs(spillDir, removedToolOutputs).catch((err) => {
      logger.debug(`工具输出持久化失败（不影响压缩）: ${err.message}`);
    });
  }

  const reducedTokens = removed.reduce((sum, h) => sum + h.tokens, 0);
  const newTokens = snapshot.currentTokens - reducedTokens;

  return Object.freeze({
    ...snapshot,
    currentTokens: Math.max(0, newTokens),
    history: Object.freeze(kept),
    updatedAt: Date.now()
  });
}

/**
 * 将被移除的工具输出持久化到磁盘（异步，非阻塞）
 * @param {string} spillDir - 持久化目录
 * @param {Object[]} entries - 被移除的工具输出条目
 * @returns {Promise<void>}
 * @private
 */
async function _spillToolOutputs(spillDir, entries) {
  const fs = await import('fs-extra');
  const path = await import('node:path');

  await fs.ensureDir(spillDir);

  const timestamp = Date.now();
  const fileName = `micro-spill-${timestamp}.json`;
  const filePath = path.join(spillDir, fileName);

  const spillData = Object.freeze({
    timestamp,
    count: entries.length,
    entries: Object.freeze(
      entries.map((e) =>
        Object.freeze({
          label: e.label,
          tokens: e.tokens,
          chars: e.chars,
          timestamp: e.timestamp
        })
      )
    )
  });

  await fs.writeJson(filePath, spillData, { spaces: 2 });
  logger.debug(`工具输出已持久化: ${filePath} (${entries.length} 条)`);
}

// ============================================================
// Strategy 4: COLLAPSE
// ============================================================

/**
 * COLLAPSE 策略: 合并重复内容
 * @param {Object} snapshot
 * @returns {{ shouldApply: boolean, reason: string }}
 */
export function collapseShouldApply(snapshot) {
  let duplicateGroups = 0;
  for (let i = 0; i < snapshot.history.length - 1; i++) {
    if (snapshot.history[i].label === snapshot.history[i + 1].label) {
      duplicateGroups++;
    }
  }
  return {
    shouldApply: duplicateGroups >= 3,
    reason: duplicateGroups >= 3 ? `${duplicateGroups} 组连续重复标签` : ''
  };
}

/**
 * COLLAPSE 执行
 * @param {Object} snapshot
 * @param {Object} [config]
 * @returns {Object} 新快照
 */
export function collapseExecute(snapshot, config = {}) {
  const windowSize = config.collapseWindowSize ?? STRATEGY_DEFAULTS.collapseWindowSize;

  const collapsed = [];
  let reducedTokens = 0;
  let i = 0;

  while (i < snapshot.history.length) {
    // 寻找连续相同标签的窗口
    let j = i + 1;
    while (
      j < snapshot.history.length &&
      j - i < windowSize &&
      snapshot.history[j].label === snapshot.history[i].label
    ) {
      j++;
    }

    if (j - i >= 2) {
      // 合并为单条
      const group = snapshot.history.slice(i, j);
      const totalTokens = group.reduce((sum, h) => sum + h.tokens, 0);
      const collapsedTokens = Math.ceil(totalTokens * 0.3); // 保留 30%
      reducedTokens += totalTokens - collapsedTokens;

      collapsed.push(
        Object.freeze({
          ...group[group.length - 1], // 保留最后一条的时间戳
          tokens: collapsedTokens,
          chars: Math.ceil(collapsedTokens * 4),
          label: `${group[0].label} (x${group.length} collapsed)`,
          collapsed: true,
          originalCount: group.length
        })
      );
      i = j;
    } else {
      collapsed.push(snapshot.history[i]);
      i++;
    }
  }

  const newTokens = snapshot.currentTokens - reducedTokens;

  return Object.freeze({
    ...snapshot,
    currentTokens: Math.max(0, newTokens),
    history: Object.freeze(collapsed),
    updatedAt: Date.now()
  });
}

// ============================================================
// Strategy 5: AUTO_COMPACT
// ============================================================

/**
 * AUTO_COMPACT 策略: 最后手段
 * @param {Object} snapshot
 * @returns {{ shouldApply: boolean, reason: string }}
 */
export function autoCompactShouldApply(snapshot) {
  const ratio = snapshot.currentTokens / snapshot.contextLimit;
  return {
    shouldApply: ratio >= 0.9,
    reason: ratio >= 0.9 ? `上下文使用率 ${Math.round(ratio * 100)}%，需要 LLM 级压缩` : ''
  };
}

/**
 * AUTO_COMPACT 执行（返回建议，不执行实际 LLM 调用）
 * @param {Object} snapshot
 * @returns {Object} 新快照 + 建议
 */
export function autoCompactExecute(snapshot) {
  const recommendation = [
    '[AUTO_COMPACT 建议执行以下操作]',
    `1. 当前上下文: ${snapshot.currentTokens} / ${snapshot.contextLimit} tokens`,
    `2. 建议开启新的 Claude Code 会话`,
    `3. 或使用 /compact 命令触发 LLM 级压缩`,
    `4. 历史记录: ${snapshot.history.length} 条，可考虑清除最早的 ${Math.floor(snapshot.history.length * 0.5)} 条`
  ].join('\n');

  logger.warn(recommendation);

  return Object.freeze({
    ...snapshot,
    updatedAt: Date.now()
  });
}

// ============================================================
// Strategy Registry
// ============================================================

/**
 * 内置策略定义
 * @type {Map<number, {shouldApply: Function, execute: Function, name: string}>}
 */
const builtInStrategies = new Map([
  [
    COMPRESSION_LEVELS.TRUNCATE,
    {
      level: COMPRESSION_LEVELS.TRUNCATE,
      name: COMPRESSION_NAMES[COMPRESSION_LEVELS.TRUNCATE],
      shouldApply: truncateShouldApply,
      execute: truncateExecute
    }
  ],
  [
    COMPRESSION_LEVELS.SNIP,
    {
      level: COMPRESSION_LEVELS.SNIP,
      name: COMPRESSION_NAMES[COMPRESSION_LEVELS.SNIP],
      shouldApply: snipShouldApply,
      execute: snipExecute
    }
  ],
  [
    COMPRESSION_LEVELS.MICRO_COMPACT,
    {
      level: COMPRESSION_LEVELS.MICRO_COMPACT,
      name: COMPRESSION_NAMES[COMPRESSION_LEVELS.MICRO_COMPACT],
      shouldApply: microCompactShouldApply,
      execute: microCompactExecute
    }
  ],
  [
    COMPRESSION_LEVELS.COLLAPSE,
    {
      level: COMPRESSION_LEVELS.COLLAPSE,
      name: COMPRESSION_NAMES[COMPRESSION_LEVELS.COLLAPSE],
      shouldApply: collapseShouldApply,
      execute: collapseExecute
    }
  ],
  [
    COMPRESSION_LEVELS.AUTO_COMPACT,
    {
      level: COMPRESSION_LEVELS.AUTO_COMPACT,
      name: COMPRESSION_NAMES[COMPRESSION_LEVELS.AUTO_COMPACT],
      shouldApply: autoCompactShouldApply,
      execute: autoCompactExecute
    }
  ]
]);

/**
 * 策略注册表
 */
export class StrategyRegistry {
  constructor() {
    this._strategies = new Map(builtInStrategies);
  }

  /**
   * 注册策略
   * @param {number} level
   * @param {Object} strategy
   * @param {Function} strategy.shouldApply
   * @param {Function} strategy.execute
   * @param {string} strategy.name
   * @returns {boolean}
   */
  register(level, strategy) {
    if (!strategy.shouldApply || !strategy.execute || !strategy.name) {
      logger.error('策略必须包含 shouldApply, execute, name');
      return false;
    }
    this._strategies.set(level, { ...strategy, level });
    logger.debug(`压缩策略已注册: ${strategy.name} (level ${level})`);
    return true;
  }

  /**
   * 注销策略
   * @param {number} level
   * @returns {boolean}
   */
  unregister(level) {
    return this._strategies.delete(level);
  }

  /**
   * 获取策略
   * @param {number} level
   * @returns {Object|undefined}
   */
  getStrategy(level) {
    return this._strategies.get(level);
  }

  /**
   * 获取所有策略（按 level 排序）
   * @returns {Object[]}
   */
  getAllStrategies() {
    return Array.from(this._strategies.values()).sort((a, b) => a.level - b.level);
  }

  /**
   * 执行压缩链: 按级别从轻到重尝试每个策略
   * @param {Object} snapshot
   * @param {Object} [config]
   * @returns {Object} 压缩结果
   */
  executeChain(snapshot, config = {}) {
    let currentSnapshot = snapshot;
    let totalReduced = 0;
    const appliedStrategies = [];

    for (const strategy of this.getAllStrategies()) {
      const check = strategy.shouldApply(currentSnapshot, config);
      if (!check.shouldApply) continue;

      const beforeTokens = currentSnapshot.currentTokens;
      currentSnapshot = strategy.execute(currentSnapshot, config);
      const reduced = beforeTokens - currentSnapshot.currentTokens;

      if (reduced > 0) {
        totalReduced += reduced;
        appliedStrategies.push({
          name: strategy.name,
          level: strategy.level,
          reducedTokens: reduced
        });
        logger.debug(`压缩策略 ${strategy.name}: 减少 ${reduced} tokens`);
      }

      // 如果已压缩足够（降到 50% 以下），停止
      if (currentSnapshot.currentTokens < currentSnapshot.contextLimit * 0.5) {
        break;
      }
    }

    return createCompressionResult({
      applied: appliedStrategies.length > 0,
      level:
        appliedStrategies.length > 0 ? appliedStrategies[appliedStrategies.length - 1].level : 0,
      strategyName: appliedStrategies.map((s) => s.name).join(' -> ') || '',
      reducedTokens: totalReduced,
      details: Object.freeze({
        strategiesApplied: Object.freeze(appliedStrategies)
      }),
      snapshot: currentSnapshot
    });
  }
}

export default StrategyRegistry;
