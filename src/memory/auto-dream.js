/**
 * Auto Dream — 自动记忆整理器
 *
 * 四阶段自动整理（Orient → Gather → Consolidate → Prune）：
 * 1. Orient — 评估当前记忆状态（统计）
 * 2. Gather — 收集近期活跃条目
 * 3. Consolidate — 合并重复 + 晋升高价值条目
 * 4. Prune — 清理过期条目
 *
 * 三重门控触发：
 * - 最小间隔（默认 5 分钟）
 * - 最小 session 数（默认 3 次）
 * - 需要空闲状态
 *
 * 设计原则：
 * - 纯函数处理数据逻辑
 * - 异步函数通过 MemoryManager 公共 API 操作
 * - 不可变模式：所有操作返回新对象
 */

import { logger } from '../logger.js';
import {
  MEMORY_TIERS,
  TIER_PRIORITY,
  shouldPromote,
  isExpired,
  promoteEntry
} from './memory-tiers.js';

/**
 * Dream 执行阶段
 * @readonly
 */
export const DREAM_PHASES = Object.freeze({
  ORIENT: 'orient',
  GATHER: 'gather',
  CONSOLIDATE: 'consolidate',
  PRUNE: 'prune'
});

/**
 * 默认门控配置
 * @readonly
 */
export const DREAM_GATE_DEFAULTS = Object.freeze({
  minIntervalMs: 5 * 60 * 1000, // 5 分钟
  minSessionCount: 3,
  requireIdle: true
});

/**
 * 检查 Dream 门控
 *
 * @param {Object} params
 * @param {number|null} params.lastDreamTime - 上次执行时间戳
 * @param {number} params.sessionCount - 当前 session 计数
 * @param {boolean} params.isIdle - 是否空闲
 * @param {Object} [params.gateConfig] - 门控配置
 * @returns {{ allowed: boolean, reason: string }}
 */
export function checkDreamGate({ lastDreamTime, sessionCount, isIdle, gateConfig = {} }) {
  const config = { ...DREAM_GATE_DEFAULTS, ...gateConfig };

  if (config.requireIdle && !isIdle) {
    return { allowed: false, reason: '非空闲状态' };
  }

  if (sessionCount < config.minSessionCount) {
    return {
      allowed: false,
      reason: `session 计数不足 (${sessionCount}/${config.minSessionCount})`
    };
  }

  if (lastDreamTime !== null) {
    const elapsed = Date.now() - lastDreamTime;
    if (elapsed < config.minIntervalMs) {
      return {
        allowed: false,
        reason: `间隔不足 (${Math.round(elapsed / 1000)}s/${Math.round(config.minIntervalMs / 1000)}s)`
      };
    }
  }

  return { allowed: true, reason: '门控通过' };
}

/**
 * 计算条目价值分数
 * 公式：accessCount * 0.6 + recency * 0.4
 * recency = 1 - (ageInHours / maxAgeInHours)，范围 [0, 1]
 *
 * @param {Object} entry - 记忆条目
 * @param {number} [maxAgeHours=168] - 最大年龄（默认 7 天）
 * @returns {number} 分数
 */
export function scoreEntry(entry, maxAgeHours = 168) {
  const ageHours = (Date.now() - entry.updatedAt) / (1000 * 60 * 60);
  const recency = Math.max(0, 1 - ageHours / maxAgeHours);

  return entry.accessCount * 0.6 + recency * 0.4;
}

/**
 * 查找可合并的重复条目组
 * 按 JSON.stringify(value) 分组
 *
 * @param {Object[]} entries
 * @returns {Object[][]} 每组包含 2+ 个相同 value 的条目
 */
export function selectMergeGroups(entries) {
  const valueMap = new Map();

  for (const entry of entries) {
    const key = JSON.stringify(entry.value);
    if (!valueMap.has(key)) {
      valueMap.set(key, []);
    }
    valueMap.get(key).push(entry);
  }

  return [...valueMap.values()].filter((group) => group.length >= 2);
}

/**
 * 查找可晋升的候选条目
 * 条件：shouldPromote 返回 true
 *
 * @param {Object[]} entries
 * @returns {Object[]}
 */
export function selectPromotionCandidates(entries) {
  return entries.filter((entry) => shouldPromote(entry));
}

/**
 * 阶段 1：Orient — 评估记忆状态
 *
 * @param {import('./memory-manager.js').MemoryManager} memoryManager
 * @returns {Promise<Object>} 统计信息
 */
export async function orient(memoryManager) {
  const stats = await memoryManager.getStats();

  return Object.freeze({
    stats,
    timestamp: Date.now()
  });
}

/**
 * 阶段 2：Gather — 收集近期活跃条目
 *
 * @param {import('./memory-manager.js').MemoryManager} memoryManager
 * @param {Object} [options]
 * @param {number} [options.maxAgeHours=168] - 最大年龄
 * @param {number} [options.maxEntries=50] - 最大条目数
 * @returns {Promise<Object[]>} 按分数排序的条目
 */
export async function gather(memoryManager, options = {}) {
  const maxAgeHours = options.maxAgeHours ?? 168;
  const maxEntries = options.maxEntries ?? 50;

  // 使用 search('') 获取所有条目
  const allEntries = await memoryManager.search('');

  // 过滤过期条目，按分数排序
  const scored = allEntries
    .filter((entry) => !isExpired(entry))
    .map((entry) => ({ entry, score: scoreEntry(entry, maxAgeHours) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxEntries)
    .map(({ entry }) => entry);

  return scored;
}

/**
 * 阶段 3：Consolidate — 合并重复 + 晋升高价值
 *
 * @param {import('./memory-manager.js').MemoryManager} memoryManager
 * @param {Object[]} gatheredEntries - Gather 阶段收集的条目
 * @param {Object} [orientResult] - Orient 阶段结果
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false] - 只分析不执行
 * @returns {Promise<{ merged: number, promoted: number, actions: Object[] }>}
 */
export async function consolidate(memoryManager, gatheredEntries, orientResult, options = {}) {
  const dryRun = options.dryRun ?? false;
  const actions = [];
  let merged = 0;
  let promoted = 0;

  // 合并重复
  const mergeGroups = selectMergeGroups(gatheredEntries);

  for (const group of mergeGroups) {
    // 保留最高层级（优先级最高）的条目
    const keeper = group.reduce((best, entry) =>
      TIER_PRIORITY[entry.tier] > TIER_PRIORITY[best.tier] ? entry : best
    );

    for (const entry of group) {
      if (entry.key !== keeper.key) {
        actions.push({
          type: 'merge',
          key: entry.key,
          fromTier: entry.tier,
          targetKey: keeper.key
        });

        if (!dryRun) {
          await memoryManager.delete(entry.key, entry.tier);
        }
        merged++;
      }
    }
  }

  // 晋升高价值条目
  const promotionCandidates = selectPromotionCandidates(gatheredEntries);

  for (const entry of promotionCandidates) {
    const currentPriority = TIER_PRIORITY[entry.tier];
    const targetTier =
      currentPriority < TIER_PRIORITY[MEMORY_TIERS.PROJECT]
        ? MEMORY_TIERS.PROJECT
        : MEMORY_TIERS.GLOBAL;

    actions.push({
      type: 'promote',
      key: entry.key,
      fromTier: entry.tier,
      toTier: targetTier
    });

    if (!dryRun) {
      const promotedEntry = promoteEntry(entry, targetTier);
      await memoryManager.set(entry.key, promotedEntry.value, {
        tier: targetTier,
        tags: entry.tags,
        ttl: promotedEntry.ttl
      });
      await memoryManager.delete(entry.key, entry.tier);
    }
    promoted++;
  }

  return Object.freeze({ merged, promoted, actions });
}

/**
 * 阶段 4：Prune — 清理过期条目
 *
 * @param {import('./memory-manager.js').MemoryManager} memoryManager
 * @returns {Promise<number>} 清理的条目数
 */
export async function prune(memoryManager) {
  return memoryManager.cleanup();
}

/**
 * 两轮记忆提取策略
 *
 * 借鉴 Claude Code 的 memory-extraction 模式：
 * - Turn 1: 并行读取所有现有记忆（只读）
 * - Turn 2: 并行写入/编辑记忆条目
 * - 限制：仅从最近对话中提取，不调查源码，不验证声明
 *
 * 适合提取的记忆类型：
 * - 用户偏好（编码风格、工具选择、命名规范）
 * - 项目模式（架构决策、目录约定、依赖选择）
 * - 错误修正（反复出现的错误及已验证的修复）
 * - 工作流笔记（部署步骤、测试流程、环境特性）
 *
 * @param {import('./memory-manager.js').MemoryManager} memoryManager
 * @param {Object[]} messages - 最近的消息列表
 * @param {Object} [options]
 * @param {number} [options.maxMessages=20] - 最多处理的消息数
 * @param {number} [options.maxExtractions=5] - 最多提取的记忆数
 * @returns {Promise<{ turn1Reads: number, turn2Writes: number, extracted: Object[] }>}
 */
export async function twoTurnExtract(memoryManager, messages, options = {}) {
  const maxMessages = options.maxMessages ?? 20;
  const maxExtractions = options.maxExtractions ?? 5;

  const recentMessages = messages.slice(-maxMessages);
  const extracted = [];

  // Turn 1: 并行读取 — 收集现有记忆状态
  const [allEntries, stats] = await Promise.all([
    memoryManager.search(''),
    memoryManager.getStats()
  ]);

  logger.debug(`[TwoTurnExtract] Turn 1: 读取 ${allEntries.length} 条记忆, ${stats.total} 总计`);

  // 从消息中提取候选记忆
  const candidates = extractMemoryCandidates(recentMessages)
    .filter((candidate) => {
      // 去重：检查是否已有相似记忆
      return !allEntries.some(
        (existing) =>
          existing.key === candidate.key ||
          JSON.stringify(existing.value) === JSON.stringify(candidate.value)
      );
    })
    .slice(0, maxExtractions);

  // Turn 2: 并行写入 — 批量持久化
  const writePromises = candidates.map((candidate) =>
    memoryManager.set(candidate.key, candidate.value, {
      tier: candidate.tier ?? 'session',
      tags: candidate.tags ?? ['extracted']
    })
  );

  const results = await Promise.all(writePromises);

  for (let i = 0; i < results.length; i++) {
    extracted.push({
      key: candidates[i].key,
      value: candidates[i].value,
      confidence: candidates[i].confidence ?? 'medium'
    });
  }

  logger.debug(`[TwoTurnExtract] Turn 2: 写入 ${results.length} 条记忆 (去重后)`);

  return Object.freeze({
    turn1Reads: allEntries.length,
    turn2Writes: results.length,
    extracted: Object.freeze(extracted)
  });
}

/**
 * 从消息中提取记忆候选
 *
 * @param {Object[]} messages
 * @returns {Object[]} 候选记忆列表
 */
function extractMemoryCandidates(messages) {
  const candidates = [];

  for (const msg of messages) {
    const text = typeof msg === 'string' ? msg : (msg.content ?? '');

    // 用户偏好提取
    const prefMatch = text.match(/(?:我喜欢|我用|偏好|习惯|不用|不要)\s*(.+)/);
    if (prefMatch) {
      candidates.push({
        key: `pref_${Date.now()}_${candidates.length}`,
        value: { statement: prefMatch[0], type: 'user_preference' },
        tags: ['preference'],
        confidence: 'high'
      });
    }

    // 错误修正提取
    const fixMatch = text.match(/(?:修复|解决|原因|是因为|根因|fix|root cause)[:：]\s*(.+)/i);
    if (fixMatch) {
      candidates.push({
        key: `fix_${Date.now()}_${candidates.length}`,
        value: { statement: fixMatch[0], type: 'error_correction' },
        tags: ['fix', 'correction'],
        confidence: 'high'
      });
    }

    // 项目模式提取
    const patternMatch = text.match(
      /(?:架构|约定|规范|模式|规则|约定|convention|pattern)[:：]\s*(.+)/i
    );
    if (patternMatch) {
      candidates.push({
        key: `pattern_${Date.now()}_${candidates.length}`,
        value: { statement: patternMatch[0], type: 'project_pattern' },
        tags: ['pattern', 'convention'],
        confidence: 'medium'
      });
    }
  }

  return candidates;
}

/**
 * 完整 Dream 协调器
 *
 * @param {import('./memory-manager.js').MemoryManager} memoryManager
 * @param {Object} [options]
 * @param {number|null} [options.lastDreamTime] - 上次执行时间
 * @param {number} [options.sessionCount] - session 计数
 * @param {boolean} [options.isIdle=true] - 是否空闲
 * @param {Object} [options.gateConfig] - 门控配置
 * @param {boolean} [options.dryRun=false] - 只分析不执行
 * @returns {Promise<Object>} DreamResult
 */
export async function autoDream(memoryManager, options = {}) {
  // 门控检查
  const gate = checkDreamGate({
    lastDreamTime: options.lastDreamTime ?? null,
    sessionCount: options.sessionCount ?? 0,
    isIdle: options.isIdle ?? true,
    gateConfig: options.gateConfig
  });

  if (!gate.allowed) {
    return createDreamResult({
      executed: false,
      reason: gate.reason,
      stats: { orient: null, merged: 0, promoted: 0, pruned: 0 }
    });
  }

  // Orient
  const orientResult = await orient(memoryManager);
  logger.debug(`[AutoDream] Orient: ${orientResult.stats.total} 条记忆`);

  // Gather
  const gathered = await gather(memoryManager);
  logger.debug(`[AutoDream] Gather: ${gathered.length} 条活跃记忆`);

  // Consolidate
  const consolidationResult = await consolidate(memoryManager, gathered, orientResult, {
    dryRun: options.dryRun
  });
  logger.debug(
    `[AutoDream] Consolidate: ${consolidationResult.merged} 合并, ${consolidationResult.promoted} 晋升`
  );

  // Prune
  const pruned = await prune(memoryManager);
  logger.debug(`[AutoDream] Prune: ${pruned} 条过期清理`);

  return createDreamResult({
    executed: true,
    reason: '整理完成',
    stats: {
      orient: orientResult.stats,
      gathered: gathered.length,
      merged: consolidationResult.merged,
      promoted: consolidationResult.promoted,
      pruned,
      actions: consolidationResult.actions
    }
  });
}

/**
 * 创建不可变 Dream 结果
 * @param {Object} params
 * @returns {Object}
 */
export function createDreamResult(params) {
  return Object.freeze({
    executed: params.executed ?? false,
    reason: params.reason ?? '',
    stats: Object.freeze(params.stats ?? {})
  });
}

/**
 * Auto Dream Scheduler（有状态包装类）
 */
export class AutoDreamScheduler {
  /**
   * @param {Object} [options]
   * @param {Object} [options.gateConfig] - 门控配置
   */
  constructor(options = {}) {
    this._lastDreamTime = null;
    this._sessionCount = 0;
    this._gateConfig = Object.freeze({ ...DREAM_GATE_DEFAULTS, ...options.gateConfig });
  }

  /**
   * 检查是否应该执行（不实际执行）
   * @returns {{ allowed: boolean, reason: string }}
   */
  shouldRun() {
    return checkDreamGate({
      lastDreamTime: this._lastDreamTime,
      sessionCount: this._sessionCount,
      isIdle: true,
      gateConfig: this._gateConfig
    });
  }

  /**
   * 增加 session 计数（每次工作流执行后调用）
   */
  incrementSession() {
    this._sessionCount++;
  }

  /**
   * 执行自动整理
   * @param {import('./memory-manager.js').MemoryManager} memoryManager
   * @param {Object} [options]
   * @param {boolean} [options.dryRun=false]
   * @returns {Promise<Object>} DreamResult
   */
  async run(memoryManager, options = {}) {
    const result = await autoDream(memoryManager, {
      ...options,
      lastDreamTime: this._lastDreamTime,
      sessionCount: this._sessionCount,
      isIdle: true,
      gateConfig: this._gateConfig
    });

    if (result.executed) {
      this._lastDreamTime = Date.now();
    }

    return result;
  }

  /**
   * 获取上次执行时间
   * @returns {number|null}
   */
  getLastDreamTime() {
    return this._lastDreamTime;
  }

  /**
   * 获取 session 计数
   * @returns {number}
   */
  getSessionCount() {
    return this._sessionCount;
  }
}

export default AutoDreamScheduler;
