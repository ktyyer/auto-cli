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
import { autoDream as runAutoDream } from './auto-dream.js';
import {
  MEMORY_TIERS,
  TIER_PRIORITY,
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
      const store = await this._loadStore(getProjectMemoryDir(this.projectDir));
      if (store[key]) {
        delete store[key];
        await this._saveStore(getProjectMemoryDir(this.projectDir), store);
        deleted = true;
      }
    }

    if (!tier || tier === MEMORY_TIERS.GLOBAL) {
      const store = await this._loadStore(getGlobalMemoryDir());
      if (store[key]) {
        delete store[key];
        await this._saveStore(getGlobalMemoryDir(), store);
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
   * @param {string} query
   * @returns {Promise<Object[]>}
   */
  async search(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];
    const seen = new Set();

    const allEntries = await this._getAllEntries();

    for (const entry of allEntries) {
      if (seen.has(entry.key)) continue;
      if (isExpired(entry)) continue;

      const searchText = `${entry.key} ${JSON.stringify(entry.value)}`.toLowerCase();
      if (searchText.includes(lowerQuery)) {
        results.push(entry);
        seen.add(entry.key);
      }
    }

    return results;
  }

  /**
   * 清理过期条目
   * @param {Object} [options]
   * @param {boolean} [options.runDream=false] - 是否运行 AutoDream
   * @param {Object} [options.dreamOptions] - AutoDream 配置
   * @param {Object} [options.knowledgeSteward] - KnowledgeSteward 实例，传递给 AutoDream 持久化洞察
   * @returns {Promise<number>} 清理的条目数
   */
  async cleanup(options = {}) {
    let cleaned = 0;

    // Session 层
    for (const [key, entry] of this._session) {
      if (isExpired(entry)) {
        this._session.delete(key);
        cleaned++;
      }
    }

    // Project 层
    cleaned += await this._cleanupStore(getProjectMemoryDir(this.projectDir));

    // Global 层
    cleaned += await this._cleanupStore(getGlobalMemoryDir());

    if (cleaned > 0) {
      logger.info(`记忆清理: 移除 ${cleaned} 个过期条目`);
    }

    // 可选: AutoDream
    if (options.runDream) {
      try {
        const dreamOpts = {
          ...options.dreamOptions,
          knowledgeSteward:
            options.knowledgeSteward || options.dreamOptions?.knowledgeSteward || null
        };
        const dreamResult = await runAutoDream(this, dreamOpts);
        if (dreamResult.executed) {
          logger.info(`AutoDream 完成: ${dreamResult.stats.prunedCount} 个条目已清理`);
        }
      } catch (error) {
        logger.warn(`AutoDream 执行失败: ${error.message}`);
      }
    }

    return cleaned;
  }

  /**
   * 获取统计信息
   * @returns {Promise<Object>}
   */
  async getStats() {
    const projectStore = await this._loadStore(getProjectMemoryDir(this.projectDir));
    const globalStore = await this._loadStore(getGlobalMemoryDir());

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

    const store = await this._loadStore(dir);
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

    const store = await this._loadStore(dir);
    store[entry.key] = entry;
    await this._saveStore(dir, store);
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
    const projectStore = await this._loadStore(getProjectMemoryDir(this.projectDir));
    for (const entry of Object.values(projectStore)) {
      entries.push(entry);
    }

    // Global
    const globalStore = await this._loadStore(getGlobalMemoryDir());
    for (const entry of Object.values(globalStore)) {
      entries.push(entry);
    }

    return entries;
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
   * @private
   */
  async _cleanupStore(dir) {
    const store = await this._loadStore(dir);
    let cleaned = 0;

    for (const [key, entry] of Object.entries(store)) {
      if (isExpired(entry)) {
        delete store[key];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this._saveStore(dir, store);
    }

    return cleaned;
  }
}

export default MemoryManager;
