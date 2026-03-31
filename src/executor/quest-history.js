/**
 * Quest 历史追踪器
 *
 * 核心功能：
 * - 管理 .auto/cache/quest-history/ 目录
 * - 每次生成 Quest Map 前检查是否有相同需求的记录
 * - 存储 Quest Map 历史 + diff 对比
 * - 需求文件未变时提示用户是否复用历史
 *
 * @module QuestHistory
 */
import path from 'path';
import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import { execSync } from 'child_process';
import { logger } from '../logger.js';

/**
 * 历史记录条目
 * @typedef {Object} HistoryEntry
 * @property {string} id - 唯一 ID（基于需求 hash）
 * @property {string} demand - 需求摘要
 * @property {string} demandHash - 需求内容 hash
 * @property {string} questMapPath - Quest Map 文件路径
 * @property {number} createdAt - 创建时间戳
 * @property {string} headHash - 当时的 git head
 * @property {string[]} questIds - Quest ID 列表
 */

/**
 * 搜索结果
 * @typedef {Object} SearchResult
 * @property {HistoryEntry|null} exactMatch - 完全匹配（需求 hash 相同）
 * @property {HistoryEntry[]} similarMatches - 相似匹配（关键词重叠）
 */

export class QuestHistory {
  /**
   * @param {string} [projectDir] - 项目根目录
   */
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.historyDir = path.join(this.projectDir, '.auto', 'cache', 'quest-history');
    this.manifestPath = path.join(this.historyDir, 'manifest.json');
    this.logger = logger;
  }

  /**
   * 确保历史目录存在
   * @returns {Promise<string>}
   * @private
   */
  async _ensureDir() {
    await fs.ensureDir(this.historyDir);
    return this.historyDir;
  }

  /**
   * 加载历史清单
   * @returns {Promise<HistoryEntry[]>}
   * @private
   */
  async _loadManifest() {
    if (!(await fs.pathExists(this.manifestPath))) {
      return [];
    }

    try {
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      const manifest = JSON.parse(content);
      return Array.isArray(manifest.entries) ? manifest.entries : [];
    } catch {
      return [];
    }
  }

  /**
   * 保存历史清单
   * @param {HistoryEntry[]} entries
   * @returns {Promise<void>}
   * @private
   */
  async _saveManifest(entries) {
    const manifest = {
      version: '1.0.0',
      updatedAt: Date.now(),
      entries
    };
    await fs.writeJson(this.manifestPath, manifest, { spaces: 2 });
  }

  /**
   * 计算需求的 hash
   * @param {string} demand - 需求内容
   * @returns {string}
   * @private
   */
  _hashDemand(demand) {
    return createHash('sha256').update(demand).digest('hex').slice(0, 16);
  }

  /**
   * 获取当前 git head hash
   * @returns {string}
   * @private
   */
  _getHeadHash() {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.projectDir,
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();
    } catch {
      return '';
    }
  }

  /**
   * 添加历史记录
   * @param {string} demand - 需求内容
   * @param {string} questMapContent - Quest Map 内容
   * @param {string[]} questIds - Quest ID 列表
   * @returns {Promise<HistoryEntry>}
   */
  async add(demand, questMapContent, questIds) {
    await this._ensureDir();

    const demandHash = this._hashDemand(demand);
    const headHash = this._getHeadHash();
    const id = `quest-${demandHash}-${Date.now()}`;

    // 保存 Quest Map 到单独文件
    const mapFileName = `${id}.md`;
    const mapFilePath = path.join(this.historyDir, mapFileName);
    await fs.writeFile(mapFilePath, questMapContent, 'utf-8');

    const entry = {
      id,
      demand: demand.slice(0, 200), // 截取摘要
      demandHash,
      questMapPath: mapFilePath,
      createdAt: Date.now(),
      headHash,
      questIds
    };

    // 更新清单
    const entries = await this._loadManifest();
    entries.unshift(entry); // 最新在前

    // 保留最近 50 条
    const trimmed = entries.slice(0, 50);
    await this._saveManifest(trimmed);

    this.logger.info(`Quest 历史已添加: ${id}`);
    return entry;
  }

  /**
   * 搜索是否有相似/相同的历史
   * @param {string} demand - 当前需求
   * @returns {Promise<SearchResult>}
   */
  async search(demand) {
    await this._ensureDir();

    const entries = await this._loadManifest();
    const demandHash = this._hashDemand(demand);
    const demandKeywords = demand.toLowerCase().split(/\s+/);

    let exactMatch = null;
    const similarMatches = [];

    for (const entry of entries) {
      // 完全匹配（hash 相同）
      if (entry.demandHash === demandHash) {
        exactMatch = entry;
      }

      // 相似匹配（关键词重叠）
      const entryKeywords = entry.demand.toLowerCase().split(/\s+/);
      const overlap = demandKeywords.filter((kw) =>
        entryKeywords.some((ek) => ek.includes(kw) || kw.includes(ek))
      );

      if (overlap.length >= 2) {
        similarMatches.push(entry);
      }
    }

    return { exactMatch, similarMatches: similarMatches.slice(0, 5) };
  }

  /**
   * 获取历史记录详情
   * @param {string} id - 记录 ID
   * @returns {Promise<{entry: HistoryEntry, content: string} | null>}
   */
  async getById(id) {
    const entries = await this._loadManifest();
    const entry = entries.find((e) => e.id === id);

    if (!entry) {
      return null;
    }

    const content = await fs.readFile(entry.questMapPath, 'utf-8');
    return { entry, content };
  }

  /**
   * 比较两个 Quest Map 的差异
   * @param {string} id1 - 第一个记录 ID
   * @param {string} id2 - 第二个记录 ID
   * @returns {Promise<{diff: string, summary: string} | null>}
   */
  async diff(id1, id2) {
    const [record1, record2] = await Promise.all([this.getById(id1), this.getById(id2)]);

    if (!record1 || !record2) {
      return null;
    }

    // 简单 diff：比较 Quest 数量和 ID 列表
    const quests1 = record1.entry.questIds.join(', ');
    const quests2 = record2.entry.questIds.join(', ');

    const lines = [];
    lines.push('## Quest Map Diff');
    lines.push('');
    lines.push(`### 记录 1: ${record1.entry.id}`);
    lines.push(`- 创建时间: ${new Date(record1.entry.createdAt).toISOString()}`);
    lines.push(`- Quest IDs: ${quests1}`);
    lines.push('');
    lines.push(`### 记录 2: ${record2.entry.id}`);
    lines.push(`- 创建时间: ${new Date(record2.entry.createdAt).toISOString()}`);
    lines.push(`- Quest IDs: ${quests2}`);
    lines.push('');
    lines.push('### 对比');
    lines.push(`- Quest ID 差异: ${quests1 === quests2 ? '相同' : '不同'}`);
    lines.push(
      `- Quest 数量差异: ${record1.entry.questIds.length} vs ${record2.entry.questIds.length}`
    );

    return {
      diff: lines.join('\n'),
      summary: `记录 1 有 ${record1.entry.questIds.length} 个 Quest，记录 2 有 ${record2.entry.questIds.length} 个 Quest`
    };
  }

  /**
   * 列出最近的历史记录
   * @param {number} [limit=10] - 返回数量
   * @returns {Promise<HistoryEntry[]>}
   */
  async list(limit = 10) {
    const entries = await this._loadManifest();
    return entries.slice(0, limit);
  }

  /**
   * 清理过期历史（超过 30 天的）
   * @returns {Promise<number>} 清理的数量
   */
  async prune() {
    const entries = await this._loadManifest();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const toKeep = [];
    let prunedCount = 0;

    for (const entry of entries) {
      if (entry.createdAt > thirtyDaysAgo) {
        toKeep.push(entry);
      } else {
        // 删除 Quest Map 文件
        try {
          await fs.remove(entry.questMapPath);
          prunedCount++;
        } catch {
          // 文件可能已删除，忽略
        }
      }
    }

    if (prunedCount > 0) {
      await this._saveManifest(toKeep);
      this.logger.info(`清理了 ${prunedCount} 条过期历史`);
    }

    return prunedCount;
  }
}

export default QuestHistory;
