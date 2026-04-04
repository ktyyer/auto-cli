/**
 * 三层记忆管理器
 *
 * 统一管理 session/project/global 三层记忆：
 * - get/set/delete 自动路由到对应层级
 * - 自动晋升：session 热点条目 → project
 * - 自动淘汰：过期条目定期清理
 * - 跨层搜索：按 key/tag 搜索所有层级
 */

import path from 'node:path';
import fs from 'fs-extra';
import { logger } from '../logger.js';
import {
  MEMORY_TIERS,
  createMemoryEntry,
  touchEntry,
  updateEntryValue,
  promoteEntry,
  isExpired,
  shouldPromote,
  getProjectMemoryDir,
  getGlobalMemoryDir
} from './memory-tiers.js';

const STORE_FILE = 'store.json';

export class MemoryManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.projectDir] - 项目根目录
   */
  constructor(options = {}) {
    this.projectDir = options.projectDir || process.cwd();
    this._session = new Map();
    this._projectCache = null;
    this._globalCache = null;
  }

  /**
   * 写入记忆条目
   * @param {string} key
   * @param {*} value
   * @param {Object} [options]
   * @param {string} [options.tier='session']
   * @param {string[]} [options.tags=[]]
   * @param {number} [options.ttl]
   * @returns {Promise<Object>} 写入的条目
   */
  async set(key, value, options = {}) {
    const tier = options.tier || MEMORY_TIERS.SESSION;
    const existing = await this._getFromTier(key, tier);

    let entry;
    if (existing) {
      entry = updateEntryValue(existing, value);
    } else {
      entry = createMemoryEntry({
        key,
        value,
        tier,
        tags: options.tags,
        ttl: options.ttl
      });
    }

    await this._putToTier(entry);
    logger.debug(`记忆写入: ${key} → ${tier}`);
    return entry;
  }

  /**
   * 读取记忆条目（自动跨层查找，优先高层级）
   * @param {string} key
   * @returns {Promise<*>} 值，不存在返回 undefined
   */
  async get(key) {
    // 按优先级从高到低查找：global → project → session
    const tiers = [MEMORY_TIERS.GLOBAL, MEMORY_TIERS.PROJECT, MEMORY_TIERS.SESSION];

    for (const tier of tiers) {
      const entry = await this._getFromTier(key, tier);
      if (entry && !isExpired(entry)) {
        // 更新访问计数
        const touched = touchEntry(entry);
        await this._putToTier(touched);

        // 检查是否需要晋升
        if (shouldPromote(touched)) {
          const promoted = promoteEntry(touched, MEMORY_TIERS.PROJECT);
          await this._putToTier(promoted);
          // 从 session 中移除
          this._session.delete(key);
          logger.debug(`记忆晋升: ${key} session → project`);
        }

        return touched.value;
      }
    }

    return undefined;
  }

  /**
   * 删除记忆条目
   * @param {string} key
   * @param {string} [tier] - 指定层级，不指定则删除所有层级
   * @returns {Promise<boolean>}
   */
  async delete(key, tier) {
    let deleted = false;

    if (!tier || tier === MEMORY_TIERS.SESSION) {
      if (this._session.has(key)) {
        this._session.delete(key);
        deleted = true;
      }
    }

    if (!tier || tier === MEMORY_TIERS.PROJECT) {
      const dir = getProjectMemoryDir(this.projectDir);
      const store = await this._getCachedStore(MEMORY_TIERS.PROJECT, dir);
      if (store[key]) {
        delete store[key];
        await this._saveStore(dir, store);
        this._invalidateCache(MEMORY_TIERS.PROJECT);
        deleted = true;
      }
    }

    if (!tier || tier === MEMORY_TIERS.GLOBAL) {
      const dir = getGlobalMemoryDir();
      const store = await this._getCachedStore(MEMORY_TIERS.GLOBAL, dir);
      if (store[key]) {
        delete store[key];
        await this._saveStore(dir, store);
        this._invalidateCache(MEMORY_TIERS.GLOBAL);
        deleted = true;
      }
    }

    return deleted;
  }

  /**
   * 按标签搜索（跨所有层级）
   * @param {string[]} tags
   * @returns {Promise<Object[]>} 匹配的条目列表
   */
  async searchByTags(tags) {
    const lowerTags = tags.map((t) => t.toLowerCase());
    const results = [];
    const seen = new Set();

    // 收集所有条目
    const allEntries = await this._getAllEntries();

    for (const entry of allEntries) {
      if (seen.has(entry.key)) continue;
      if (isExpired(entry)) continue;

      const entryTags = entry.tags.map((t) => t.toLowerCase());
      if (lowerTags.some((t) => entryTags.includes(t))) {
        results.push(entry);
        seen.add(entry.key);
      }
    }

    return results;
  }

  /**
   * 按关键词搜索（搜索 key 和 value）
   * 支持多词匹配和 TF-IDF 排序的语义搜索
   * @param {string} query
   * @param {Object} [options]
   * @param {boolean} [options.semantic=false] - 启用语义排序（TF-IDF）
   * @param {number} [options.limit=20] - 最大结果数
   * @returns {Promise<Object[]>}
   */
  async search(query, options = {}) {
    const lowerQuery = query.toLowerCase();
    const queryTerms = lowerQuery.split(/[\s,;，；]+/).filter((t) => t.length > 1);
    const results = [];
    const seen = new Set();

    const allEntries = await this._getAllEntries();
    const enableSemantic = options.semantic ?? false;
    const limit = options.limit ?? 20;

    // 构建 IDF（逆文档频率）
    const docCount = allEntries.filter((e) => !isExpired(e)).length;
    const docFreq = {};

    if (enableSemantic && queryTerms.length > 0) {
      for (const entry of allEntries) {
        if (isExpired(entry)) continue;
        const text =
          `${entry.key} ${(entry.tags || []).join(' ')} ${JSON.stringify(entry.value)}`.toLowerCase();
        const seen_terms = new Set();
        for (const term of queryTerms) {
          if (text.includes(term) && !seen_terms.has(term)) {
            seen_terms.add(term);
            docFreq[term] = (docFreq[term] || 0) + 1;
          }
        }
      }
    }

    for (const entry of allEntries) {
      if (seen.has(entry.key)) continue;
      if (isExpired(entry)) continue;

      const searchText =
        `${entry.key} ${(entry.tags || []).join(' ')} ${JSON.stringify(entry.value)}`.toLowerCase();

      // 基础匹配：包含查询词
      const matchedTerms = queryTerms.filter((t) => searchText.includes(t));

      if (searchText.includes(lowerQuery) || matchedTerms.length > 0) {
        if (enableSemantic && queryTerms.length > 0) {
          // TF-IDF 评分
          let score = 0;
          for (const term of matchedTerms) {
            const tf = matchedTerms.length / queryTerms.length;
            const idf = Math.log((docCount + 1) / ((docFreq[term] || 0) + 1)) + 1;
            score += tf * idf;
          }
          results.push({ entry, score });
        } else {
          results.push({ entry, score: matchedTerms.length });
        }
        seen.add(entry.key);
      }
    }

    // 按评分排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit).map((r) => r.entry);
  }

  /**
   * 清理过期条目
   * @returns {Promise<number>} 清理的条目数
   */
  async cleanup() {
    let cleaned = 0;

    // Session 层
    for (const [key, entry] of this._session) {
      if (isExpired(entry)) {
        this._session.delete(key);
        cleaned++;
      }
    }

    // Project 层
    cleaned += await this._cleanupStore(getProjectMemoryDir(this.projectDir), MEMORY_TIERS.PROJECT);

    // Global 层
    cleaned += await this._cleanupStore(getGlobalMemoryDir(), MEMORY_TIERS.GLOBAL);

    if (cleaned > 0) {
      logger.info(`记忆清理: 移除 ${cleaned} 个过期条目`);
    }

    return cleaned;
  }

  /**
   * 获取统计信息
   * @returns {Promise<Object>}
   */
  async getStats() {
    const projectDir = getProjectMemoryDir(this.projectDir);
    const globalDir = getGlobalMemoryDir();
    const projectStore = await this._getCachedStore(MEMORY_TIERS.PROJECT, projectDir);
    const globalStore = await this._getCachedStore(MEMORY_TIERS.GLOBAL, globalDir);

    return {
      session: this._session.size,
      project: Object.keys(projectStore).length,
      global: Object.keys(globalStore).length,
      total: this._session.size + Object.keys(projectStore).length + Object.keys(globalStore).length
    };
  }

  /**
   * 从指定层级获取条目
   * @private
   */
  async _getFromTier(key, tier) {
    if (tier === MEMORY_TIERS.SESSION) {
      return this._session.get(key) || null;
    }

    const dir =
      tier === MEMORY_TIERS.PROJECT ? getProjectMemoryDir(this.projectDir) : getGlobalMemoryDir();

    const store = await this._getCachedStore(tier, dir);
    return store[key] || null;
  }

  /**
   * 写入到指定层级
   * @private
   */
  async _putToTier(entry) {
    if (entry.tier === MEMORY_TIERS.SESSION) {
      this._session.set(entry.key, entry);
      return;
    }

    const dir =
      entry.tier === MEMORY_TIERS.PROJECT
        ? getProjectMemoryDir(this.projectDir)
        : getGlobalMemoryDir();

    const store = await this._getCachedStore(entry.tier, dir);
    store[entry.key] = entry;
    await this._saveStore(dir, store);
    // Invalidate cache so next read picks up the new data
    this._invalidateCache(entry.tier);
  }

  /**
   * 获取所有层级的条目
   * @private
   */
  async _getAllEntries() {
    const entries = [];

    // Session
    for (const entry of this._session.values()) {
      entries.push(entry);
    }

    // Project
    const projectDir = getProjectMemoryDir(this.projectDir);
    const projectStore = await this._getCachedStore(MEMORY_TIERS.PROJECT, projectDir);
    for (const entry of Object.values(projectStore)) {
      entries.push(entry);
    }

    // Global
    const globalDir = getGlobalMemoryDir();
    const globalStore = await this._getCachedStore(MEMORY_TIERS.GLOBAL, globalDir);
    for (const entry of Object.values(globalStore)) {
      entries.push(entry);
    }

    return entries;
  }

  /**
   * 获取缓存的存储（避免重复磁盘读取）
   * @param {string} tier - 层级
   * @param {string} dir - 存储目录
   * @returns {Promise<Object>}
   * @private
   */
  async _getCachedStore(tier, dir) {
    const cacheKey = tier === MEMORY_TIERS.PROJECT ? '_projectCache' : '_globalCache';
    if (this[cacheKey] === null) {
      this[cacheKey] = await this._loadStore(dir);
    }
    return this[cacheKey];
  }

  /**
   * 使缓存失效（写入后调用）
   * @param {string} tier - 层级
   * @private
   */
  _invalidateCache(tier) {
    if (tier === MEMORY_TIERS.PROJECT) {
      this._projectCache = null;
    } else if (tier === MEMORY_TIERS.GLOBAL) {
      this._globalCache = null;
    }
  }

  /**
   * 加载持久化存储
   * @private
   */
  async _loadStore(dir) {
    const filePath = path.join(dir, STORE_FILE);
    try {
      if (await fs.pathExists(filePath)) {
        return await fs.readJson(filePath);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        logger.error(`记忆存储文件损坏: ${filePath}, error: ${err.message}`);
      } else {
        logger.warn(`记忆存储加载失败: ${err.message}`);
      }
    }
    return {};
  }

  /**
   * 保存持久化存储
   * @private
   */
  async _saveStore(dir, store) {
    await fs.ensureDir(dir);
    const filePath = path.join(dir, STORE_FILE);
    await fs.writeJson(filePath, store, { spaces: 2 });
  }

  /**
   * 清理指定存储中的过期条目
   * @param {string} dir
   * @param {string} [tier] - 层级，用于缓存
   * @private
   */
  async _cleanupStore(dir, tier) {
    const store = await this._getCachedStore(tier, dir);
    let cleaned = 0;

    for (const [key, entry] of Object.entries(store)) {
      if (isExpired(entry)) {
        delete store[key];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this._saveStore(dir, store);
      this._invalidateCache(tier);
    }

    return cleaned;
  }
}

export default MemoryManager;
