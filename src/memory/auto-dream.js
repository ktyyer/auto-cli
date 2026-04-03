/**
 * AutoDream -- 自动记忆整理系统
 *
 * 参考 Claude Code 的 AutoDream 系统:
 * 三重门控触发 + 四阶段执行:
 * 1. Orient -- 评估当前记忆状态
 * 2. Gather -- 收集近期条目
 * 3. Consolidate -- 合并重复条目，升级高价值条目
 * 4. Prune -- 清理过期条目，保持 MEMORY.md < 200 行
 *
 * 不可变模式: 所有操作返回新对象
 * 纯函数: 不修改 MemoryManager 内部状态
 */

import { logger } from '../logger.js';
import { MEMORY_TIERS, TIER_PRIORITY, promoteEntry, isExpired } from './memory-tiers.js';

/**
 * 将 consolidation 操作转化为知识洞察
 * @param {Object[]} consolidationActions - consolidate 阶段的操作列表
 * @param {Object} orientResult - orient 阶段结果
 * @returns {Object[]} 知识洞察列表
 * @private
 */
function extractInsights(consolidationActions, orientResult) {
  const insights = [];

  for (const action of consolidationActions) {
    if (action.type === 'promote') {
      insights.push({
        category: 'pattern',
        content: `记忆条目 "${action.key}" 被频繁访问 (${action.accessCount} 次)，已自动从 project 晋升到 global 层级。这类高频知识值得在项目初期就设为 global。`,
        tags: ['auto-dream', 'promote', 'high-frequency']
      });
    }

    if (action.type === 'merge') {
      insights.push({
        category: 'trap',
        content: `发现重复记忆条目: ${action.removed.join(', ')} 与 "${action.keeper}" 内容相同，已合并到 ${action.tier} 层级。重复写入会浪费记忆空间，建议写入前先查询是否已存在。`,
        tags: ['auto-dream', 'merge', 'duplicate']
      });
    }
  }

  return Object.freeze(insights);
}

/**
 * 触发条件默认值
 * @readonly
 */
export const DREAM_GATE_DEFAULTS = Object.freeze({
  /** 距上次执行的最小间隔（毫秒），默认 24 小时 */
  minIntervalMs: 24 * 60 * 60 * 1000,
  /** 累计最小会话数 */
  minSessionCount: 5,
  /** 是否要求无并发任务 */
  requireIdle: true
});

/**
 * 执行阶段
 * @readonly
 */
export const DREAM_PHASES = Object.freeze({
  ORIENT: 'orient',
  GATHER: 'gather',
  CONSOLIDATE: 'consolidate',
  PRUNE: 'prune'
});

/**
 * 创建 DreamResult（不可变）
 * @param {Object} params
 * @returns {Object}
 */
export function createDreamResult(params = {}) {
  return Object.freeze({
    executed: params.executed ?? false,
    reason: params.reason ?? '',
    phases: Object.freeze(params.phases ?? []),
    orient: Object.freeze(params.orient ?? {}),
    gathered: Object.freeze(params.gathered ?? []),
    consolidated: Object.freeze(params.consolidated ?? []),
    pruned: Object.freeze(params.pruned ?? []),
    stats: Object.freeze(params.stats ?? {}),
    executedAt: params.executed ? Date.now() : null
  });
}

/**
 * 检查三重门控是否通过
 * @param {Object} params
 * @param {number} [params.lastDreamTime] - 上次执行时间戳
 * @param {number} [params.sessionCount] - 当前会话计数
 * @param {boolean} [params.isIdle] - 是否无并发任务
 * @param {Object} [params.gateConfig] - 自定义门控配置
 * @returns {{ allowed: boolean, reason: string }}
 */
export function checkDreamGate({
  lastDreamTime,
  sessionCount = 0,
  isIdle = true,
  gateConfig = {}
}) {
  const config = { ...DREAM_GATE_DEFAULTS, ...gateConfig };

  // Gate 1: 时间间隔
  if (lastDreamTime) {
    const elapsed = Date.now() - lastDreamTime;
    if (elapsed < config.minIntervalMs) {
      const remainingMs = config.minIntervalMs - elapsed;
      return {
        allowed: false,
        reason: `距上次执行仅 ${Math.round(elapsed / 3600000)}h，需等待 ${Math.ceil(remainingMs / 3600000)}h`
      };
    }
  }

  // Gate 2: 累计会话数
  if (sessionCount < config.minSessionCount) {
    return {
      allowed: false,
      reason: `累计仅 ${sessionCount} 次会话，需 ${config.minSessionCount} 次`
    };
  }

  // Gate 3: 并发任务
  if (config.requireIdle && !isIdle) {
    return {
      allowed: false,
      reason: '存在并发任务，跳过 AutoDream'
    };
  }

  return { allowed: true, reason: '所有门控通过' };
}

/**
 * Phase 1: Orient -- 评估当前记忆状态
 * @param {Object} memoryManager - MemoryManager 实例
 * @returns {Promise<Object>}
 */
export async function orient(memoryManager) {
  const stats = await memoryManager.getStats();

  // 读取所有层级的条目用于分析
  const allEntries = await memoryManager._getAllEntries();

  // 按层级统计
  const byTier = {
    session: allEntries.filter((e) => e.tier === MEMORY_TIERS.SESSION),
    project: allEntries.filter((e) => e.tier === MEMORY_TIERS.PROJECT),
    global: allEntries.filter((e) => e.tier === MEMORY_TIERS.GLOBAL)
  };

  // 过期统计
  const expiredCount = allEntries.filter((e) => isExpired(e)).length;

  // 高频条目
  const hotEntries = allEntries
    .filter((e) => e.accessCount >= 3)
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, 20);

  // 重复检测（相同 value 的条目）
  const duplicates = findDuplicates(allEntries);

  return Object.freeze({
    totalEntries: allEntries.length,
    stats,
    byTier: Object.freeze({
      session: byTier.session.length,
      project: byTier.project.length,
      global: byTier.global.length
    }),
    expiredCount,
    hotEntries: Object.freeze(hotEntries),
    duplicateGroups: Object.freeze(duplicates),
    needsConsolidation: duplicates.length > 0 || expiredCount > 0,
    needsPruning: allEntries.length > 100 || expiredCount > allEntries.length * 0.2
  });
}

/**
 * Phase 2: Gather -- 收集近期条目
 * @param {Object} orientResult - Orient 阶段结果
 * @param {Object} memoryManager - MemoryManager 实例
 * @param {Object} [options]
 * @param {number} [options.maxAge=7*24*60*60*1000] - 最大条目年龄（毫秒）
 * @param {number} [options.maxEntries=50] - 最大收集数量
 * @returns {Promise<Object[]>}
 */
export async function gather(orientResult, memoryManager, options = {}) {
  const maxAge = options.maxAge ?? 7 * 24 * 60 * 60 * 1000;
  const maxEntries = options.maxEntries ?? 50;
  const now = Date.now();

  const allEntries = await memoryManager._getAllEntries();

  const recent = allEntries
    .filter((entry) => {
      // 排除已过期的
      if (isExpired(entry)) return false;
      // 时间过滤
      return now - entry.updatedAt <= maxAge;
    })
    .sort((a, b) => {
      // 按 accessCount * 0.6 + recency * 0.4 排序
      const scoreA = a.accessCount * 0.6 + (1 - (now - a.updatedAt) / maxAge) * 0.4;
      const scoreB = b.accessCount * 0.6 + (1 - (now - b.updatedAt) / maxAge) * 0.4;
      return scoreB - scoreA;
    })
    .slice(0, maxEntries);

  return Object.freeze(recent.map((e) => Object.freeze({ ...e })));
}

/**
 * Phase 3: Consolidate -- 合并重复条目，升级高价值条目
 * @param {Object[]} gatheredEntries - Gather 阶段收集的条目
 * @param {Object} orientResult - Orient 阶段结果
 * @param {Object} memoryManager - MemoryManager 实例
 * @returns {Promise<Object[]>}
 */
export async function consolidate(gatheredEntries, orientResult, memoryManager) {
  const actions = [];

  // 1. 合并重复条目
  for (const group of orientResult.duplicateGroups) {
    if (group.length < 2) continue;

    // 保留最高层级的条目，删除其他
    const sorted = [...group].sort(
      (a, b) => (TIER_PRIORITY[b.tier] || 0) - (TIER_PRIORITY[a.tier] || 0)
    );
    const keeper = sorted[0];
    const dupes = sorted.slice(1);

    actions.push(
      Object.freeze({
        type: 'merge',
        action: 'keep_highest_tier',
        keeper: keeper.key,
        removed: Object.freeze(dupes.map((d) => d.key)),
        tier: keeper.tier
      })
    );

    // 执行删除
    for (const dup of dupes) {
      await memoryManager.delete(dup.key, dup.tier);
    }
  }

  // 2. 升级高价值条目（高频访问的 project 条目 -> global）
  const hotCandidates = gatheredEntries.filter(
    (e) => e.tier === MEMORY_TIERS.PROJECT && e.accessCount >= 5 && !isExpired(e)
  );

  for (const entry of hotCandidates.slice(0, 10)) {
    const promoted = promoteEntry(entry, MEMORY_TIERS.GLOBAL);
    if (promoted !== entry) {
      await memoryManager._putToTier(promoted);
      await memoryManager.delete(entry.key, entry.tier);

      actions.push(
        Object.freeze({
          type: 'promote',
          action: 'project_to_global',
          key: entry.key,
          accessCount: entry.accessCount
        })
      );
    }
  }

  return Object.freeze(actions);
}

/**
 * Phase 4: Prune -- 清理过期条目
 * @param {Object} memoryManager - MemoryManager 实例
 * @returns {Promise<Object>}
 */
export async function prune(memoryManager) {
  // 委托给 MemoryManager 的 cleanup 方法
  const cleanedCount = await memoryManager.cleanup();

  return Object.freeze({
    prunedCount: cleanedCount,
    prunedKeys: Object.freeze([])
  });
}

/**
 * 执行完整的 AutoDream 流程
 * @param {Object} memoryManager - MemoryManager 实例
 * @param {Object} [options]
 * @param {number} [options.lastDreamTime] - 上次执行时间
 * @param {number} [options.sessionCount] - 当前会话计数
 * @param {boolean} [options.isIdle] - 是否无并发任务
 * @param {Object} [options.gateConfig] - 门控配置
 * @param {Object} [options.gatherOptions] - Gather 阶段配置
 * @param {boolean} [options.dryRun=false] - 是否只分析不执行
 * @param {Object} [options.knowledgeSteward] - KnowledgeSteward 实例，用于持久化洞察
 * @returns {Promise<Object>} DreamResult
 */
export async function autoDream(memoryManager, options = {}) {
  const {
    lastDreamTime,
    sessionCount = 0,
    isIdle = true,
    gateConfig = {},
    gatherOptions = {},
    dryRun = false,
    knowledgeSteward = null
  } = options;

  // 检查门控
  const gate = checkDreamGate({ lastDreamTime, sessionCount, isIdle, gateConfig });
  if (!gate.allowed) {
    logger.debug(`AutoDream 跳过: ${gate.reason}`);
    return createDreamResult({ executed: false, reason: gate.reason });
  }

  logger.info('AutoDream 开始执行...');
  const phases = [];

  try {
    // Phase 1: Orient
    const orientResult = await orient(memoryManager);
    phases.push(DREAM_PHASES.ORIENT);
    logger.debug(
      `AutoDream Orient: ${orientResult.totalEntries} 条目, ${orientResult.expiredCount} 过期`
    );

    // Phase 2: Gather
    const gatheredEntries = await gather(orientResult, memoryManager, gatherOptions);
    phases.push(DREAM_PHASES.GATHER);
    logger.debug(`AutoDream Gather: 收集 ${gatheredEntries.length} 条近期条目`);

    // Phase 3: Consolidate (skip in dry run)
    let consolidationActions = [];
    if (!dryRun) {
      consolidationActions = await consolidate(gatheredEntries, orientResult, memoryManager);
    }
    phases.push(DREAM_PHASES.CONSOLIDATE);
    if (consolidationActions.length > 0) {
      logger.info(`AutoDream Consolidate: ${consolidationActions.length} 个操作`);
    }

    // Phase 4: Prune (skip in dry run)
    let pruneResult = { prunedCount: 0, prunedKeys: [] };
    if (!dryRun) {
      pruneResult = await prune(memoryManager);
    }
    phases.push(DREAM_PHASES.PRUNE);
    if (pruneResult.prunedCount > 0) {
      logger.info(`AutoDream Prune: 清理 ${pruneResult.prunedCount} 个过期条目`);
    }

    // Phase 5: 持久化洞察到 KnowledgeSteward
    let knowledgeSaved = 0;
    if (knowledgeSteward && consolidationActions.length > 0 && !dryRun) {
      const insights = extractInsights(consolidationActions, orientResult);
      for (const insight of insights) {
        try {
          await knowledgeSteward.save({
            content: insight.content,
            category: insight.category,
            tags: insight.tags,
            gitCommit: false // 批量结束后统一 commit
          });
          knowledgeSaved++;
        } catch (error) {
          logger.warn(`AutoDream 洞察持久化失败: ${error.message}`);
        }
      }
      if (knowledgeSaved > 0) {
        logger.info(`AutoDream Knowledge: ${knowledgeSaved} 条洞察已保存到知识库`);
      }
    }

    logger.info('AutoDream 执行完成');

    return createDreamResult({
      executed: true,
      reason: 'success',
      phases,
      orient: orientResult,
      gathered: gatheredEntries,
      consolidated: consolidationActions,
      pruned: [pruneResult],
      stats: Object.freeze({
        totalEntries: orientResult.totalEntries,
        gatheredCount: gatheredEntries.length,
        consolidationActions: consolidationActions.length,
        prunedCount: pruneResult.prunedCount
      })
    });
  } catch (error) {
    logger.error(`AutoDream 执行失败: ${error.message}`);
    return createDreamResult({
      executed: false,
      reason: `error: ${error.message}`,
      phases
    });
  }
}

/**
 * 查找重复条目组
 * @param {Object[]} entries
 * @returns {Array<Object[]>}
 * @private
 */
function findDuplicates(entries) {
  const valueMap = new Map();

  for (const entry of entries) {
    const valueKey = JSON.stringify(entry.value);
    if (!valueMap.has(valueKey)) {
      valueMap.set(valueKey, []);
    }
    valueMap.get(valueKey).push(entry);
  }

  return Array.from(valueMap.values()).filter((group) => group.length >= 2);
}

export default autoDream;
