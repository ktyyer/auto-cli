/**
 * 三层记忆系统 - 层级定义与条目结构
 *
 * 借鉴 Claude Code 的三层记忆架构：
 * - Session: 内存 Map，当前会话有效，最快访问
 * - Project: 项目级持久化（.auto/memory/），跨会话保留
 * - Global: 全局持久化（~/.auto/memory/），跨项目共享
 *
 * 核心设计：
 * - 热度驱动晋升：session 条目被多次访问后自动晋升到 project
 * - TTL 淘汰：超时条目自动降级或清除
 * - 不可变更新：所有操作返回新对象
 */

import path from 'node:path';
import os from 'node:os';

/**
 * 记忆层级枚举
 * @readonly
 */
export const MEMORY_TIERS = Object.freeze({
  SESSION: 'session',
  PROJECT: 'project',
  GLOBAL: 'global'
});

/**
 * 层级优先级（数字越大优先级越高）
 * @readonly
 */
export const TIER_PRIORITY = Object.freeze({
  [MEMORY_TIERS.SESSION]: 1,
  [MEMORY_TIERS.PROJECT]: 2,
  [MEMORY_TIERS.GLOBAL]: 3
});

/**
 * 默认 TTL（毫秒）
 * @readonly
 */
export const DEFAULT_TTL = Object.freeze({
  [MEMORY_TIERS.SESSION]: 2 * 60 * 60 * 1000, // 2 小时
  [MEMORY_TIERS.PROJECT]: 7 * 24 * 60 * 60 * 1000, // 7 天
  [MEMORY_TIERS.GLOBAL]: 30 * 24 * 60 * 60 * 1000 // 30 天
});

/**
 * 晋升阈值：session 条目被访问 N 次后晋升到 project
 */
export const PROMOTE_THRESHOLD = 3;

/**
 * 创建记忆条目（不可变）
 * @param {Object} params
 * @param {string} params.key - 唯一键
 * @param {*} params.value - 值
 * @param {string} [params.tier='session'] - 所属层级
 * @param {string[]} [params.tags=[]] - 标签
 * @param {number} [params.ttl] - 自定义 TTL（毫秒）
 * @returns {Object} 冻结的记忆条目
 */
export function createMemoryEntry({ key, value, tier = MEMORY_TIERS.SESSION, tags = [], ttl }) {
  const now = Date.now();
  return Object.freeze({
    key,
    value,
    tier,
    tags: Object.freeze([...tags]),
    createdAt: now,
    updatedAt: now,
    accessCount: 0,
    lastAccessedAt: now,
    ttl: ttl ?? DEFAULT_TTL[tier],
    version: 1
  });
}

/**
 * 标记条目被访问（返回新对象）
 * @param {Object} entry
 * @returns {Object}
 */
export function touchEntry(entry) {
  return Object.freeze({
    ...entry,
    accessCount: entry.accessCount + 1,
    lastAccessedAt: Date.now()
  });
}

/**
 * 更新条目值（返回新对象）
 * @param {Object} entry
 * @param {*} newValue
 * @returns {Object}
 */
export function updateEntryValue(entry, newValue) {
  return Object.freeze({
    ...entry,
    value: newValue,
    updatedAt: Date.now(),
    version: entry.version + 1
  });
}

/**
 * 晋升条目到更高层级（返回新对象）
 * @param {Object} entry
 * @param {string} targetTier
 * @returns {Object}
 */
export function promoteEntry(entry, targetTier) {
  if (TIER_PRIORITY[targetTier] <= TIER_PRIORITY[entry.tier]) {
    return entry; // 不能降级
  }
  return Object.freeze({
    ...entry,
    tier: targetTier,
    ttl: DEFAULT_TTL[targetTier],
    updatedAt: Date.now()
  });
}

/**
 * 检查条目是否过期
 * @param {Object} entry
 * @returns {boolean}
 */
export function isExpired(entry) {
  return Date.now() - entry.updatedAt > entry.ttl;
}

/**
 * 检查条目是否应该晋升
 * @param {Object} entry
 * @returns {boolean}
 */
export function shouldPromote(entry) {
  return entry.tier === MEMORY_TIERS.SESSION && entry.accessCount >= PROMOTE_THRESHOLD;
}

/**
 * 获取项目级存储路径
 * @param {string} [projectDir]
 * @returns {string}
 */
export function getProjectMemoryDir(projectDir = process.cwd()) {
  return path.join(projectDir, '.auto', 'memory');
}

/**
 * 获取全局存储路径
 * @returns {string}
 */
export function getGlobalMemoryDir() {
  return path.join(os.homedir(), '.auto', 'memory');
}

// ============================================================
// 加载分层（叠加在存储分层之上）
// ============================================================

/**
 * 加载层级枚举 -- 控制记忆条目在上下文中的加载策略
 *
 * INDEX:      常驻加载，仅保留摘要（<=150字/条），用于快速定位
 * TOPIC:      按需加载，当用户话题匹配时加载完整内容
 * TRANSCRIPT: 永不加载到上下文，仅支持 grep 检索
 *
 * @readonly
 */
export const LOAD_TIERS = Object.freeze({
  INDEX: 'index',
  TOPIC: 'topic',
  TRANSCRIPT: 'transcript'
});

/**
 * 加载层级对应的上下文预算占比上限
 * @readonly
 */
export const LOAD_TIER_BUDGET_RATIO = Object.freeze({
  [LOAD_TIERS.INDEX]: 0.1,
  [LOAD_TIERS.TOPIC]: 0.3,
  [LOAD_TIERS.TRANSCRIPT]: 0.0
});

/**
 * 加载层级对应的最大条目字符数
 * @readonly
 */
export const LOAD_TIER_MAX_CHARS = Object.freeze({
  [LOAD_TIERS.INDEX]: 150,
  [LOAD_TIERS.TOPIC]: 2000,
  [LOAD_TIERS.TRANSCRIPT]: Infinity
});

/**
 * 为记忆条目创建加载视图（根据加载层级截断内容）
 * @param {Object} entry - 记忆条目（来自 createMemoryEntry）
 * @param {string} loadTier - LOAD_TIERS 中的值
 * @returns {Object} 带加载视图的新条目（不可变）
 */
export function createLoadView(entry, loadTier = LOAD_TIERS.TOPIC) {
  const maxChars = LOAD_TIER_MAX_CHARS[loadTier];
  const valueStr = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
  const truncated = valueStr.length > maxChars;
  const viewValue = truncated ? valueStr.slice(0, maxChars) + '...' : valueStr;

  return Object.freeze({
    ...entry,
    loadTier,
    loadView: Object.freeze({
      value: viewValue,
      truncated,
      originalLength: valueStr.length,
      viewLength: viewValue.length
    })
  });
}

/**
 * 创建索引摘要行（用于 INDEX 层级输出）
 * 单行格式: "key: value 前 150 字 [tags]"
 * @param {Object} entry
 * @returns {string}
 */
export function toIndexLine(entry) {
  const valueStr = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
  const summary = valueStr.length > 150 ? valueStr.slice(0, 147) + '...' : valueStr;
  const tagStr = entry.tags && entry.tags.length > 0 ? ` [${entry.tags.join(',')}]` : '';
  const tierLabel = entry.tier ? `(${entry.tier})` : '';
  return `${entry.key}: ${summary.replace(/\n/g, ' ')}${tagStr} ${tierLabel}`;
}

/**
 * 根据 Topic 关键词匹配过滤条目
 * @param {Object[]} entries - 记忆条目数组
 * @param {string[]} keywords - 话题关键词
 * @returns {Object[]} 匹配的条目（包含 INDEX 层级 + 匹配的 TOPIC 层级）
 */
export function filterByTopic(entries, keywords = []) {
  if (keywords.length === 0) {
    return entries.filter((e) => e.loadTier === LOAD_TIERS.INDEX);
  }

  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  return entries.filter((entry) => {
    if (entry.loadTier === LOAD_TIERS.INDEX) return true;
    if (entry.loadTier === LOAD_TIERS.TOPIC) {
      const searchText = [
        entry.key,
        typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value),
        ...(entry.tags || [])
      ]
        .join(' ')
        .toLowerCase();
      return lowerKeywords.some((kw) => searchText.includes(kw));
    }
    return false;
  });
}

/**
 * 估算加载一批条目的总字符数
 * @param {Object[]} entries
 * @returns {number}
 */
export function estimateLoadSize(entries) {
  return entries.reduce((sum, entry) => {
    if (entry.loadView) {
      return sum + entry.loadView.viewLength;
    }
    const valueStr = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
    return sum + valueStr.length;
  }, 0);
}
