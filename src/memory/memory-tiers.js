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
