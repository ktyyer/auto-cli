/**
 * Skill 按需加载索引器
 *
 * 核心功能：
 * - 扫描 skills 目录，提取每个 Skill 的 frontmatter 元数据（名称、描述、标签）
 * - 生成轻量级索引，PHASE 1 只需加载索引而非全量 Read
 * - 按需加载完整 Skill 内容（关键词匹配后才 Read 完整文件）
 *
 * 灵感来源：
 * - linux.do 最佳实践: "Token Budget -- 只加载需要的能力"
 * - awesome-claude-code: "Lazy Loading Skills"
 *
 * 预期效果：PHASE 1 Token 消耗减少 30-50%
 */

import path from 'node:path';
import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import { execSync } from 'child_process';
import { logger } from '../logger.js';

/**
 * Skill 索引条目
 * @typedef {Object} SkillIndexEntry
 * @property {string} name - Skill 名称
 * @property {string} description - Skill 简短描述
 * @property {string[]} tags - 标签列表
 * @property {string} filePath - Skill 文件绝对路径
 * @property {string} relativePath - 相对于 skills 目录的路径
 * @property {number} fileSize - 文件大小（字节）
 * @property {boolean} isDirectory - 是否为目录型 Skill
 */

/**
 * Skill 索引结果
 * @typedef {Object} SkillIndexResult
 * @property {number} totalSkills - Skill 总数
 * @property {number} indexSize - 索引大小（字节，估算）
 * @property {number} fullContentSize - 全量内容大小（字节，估算）
 * @property {number} savingsPercent - 节省百分比
 * @property {SkillIndexEntry[]} entries - 索引条目列表
 * @property {string} head_hash - 当前 git head hash
 * @property {FileHashCache} file_hashes - 文件 hash 缓存
 */

/**
 * 文件 Hash 缓存条目
 * @typedef {Object} FileHashEntry
 * @property {string} relativePath - 相对路径
 * @property {string} hash - 文件内容 hash
 * @property {number} mtime - 文件修改时间
 */

/**
 * 文件 Hash 缓存
 * @typedef {Object} FileHashCache
 * @property {string} head_hash - 缓存生成时的 head commit hash
 * @property {number} created_at - 缓存创建时间戳
 * @property {FileHashEntry[]} files - 文件 hash 列表
 */

/**
 * Frontmatter 提取正则
 */
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---/;

/**
 * Skill 文件匹配模式
 */
const SKILL_FILE_PATTERNS = ['.md'];
const SKILL_DIR_INDICATOR = 'SKILL.md';

export class SkillIndexer {
  /**
   * @param {string} skillsDir - Skills 根目录路径
   */
  constructor(skillsDir) {
    this.skillsDir = skillsDir;
    this.logger = logger;
    this._cache = null;
    this._cacheTimestamp = 0;
    this._cacheTTL = 24 * 60 * 60 * 1000; // 24 小时
  }

  /**
   * 构建索引（扫描目录 + 提取 frontmatter）
   * @param {Object} [options] - 选项
   * @param {boolean} [options.useCache=true] - 是否使用缓存
   * @returns {Promise<SkillIndexResult>}
   */
  async buildIndex(options = {}) {
    const useCache = options.useCache ?? true;

    // 检查缓存 + 文件变更检测
    if (useCache && this._cache && Date.now() - this._cacheTimestamp < this._cacheTTL) {
      // 检查文件是否有变更
      const currentHashes = await this._computeFileHashes();
      const cachedHashes = this._cache.file_hashes?.files || [];

      if (this._hashesEqual(currentHashes, cachedHashes)) {
        this.logger.debug('Skill 索引使用缓存（文件无变更）');
        return this._cache;
      }
      this.logger.debug('Skill 索引缓存失效（检测到文件变更）');
    }

    if (!(await fs.pathExists(this.skillsDir))) {
      this.logger.warn(`Skills 目录不存在: ${this.skillsDir}`);
      return {
        totalSkills: 0,
        indexSize: 0,
        fullContentSize: 0,
        savingsPercent: 0,
        entries: []
      };
    }

    const entries = [];
    let fullContentSize = 0;

    // 扫描顶层 .md 文件（单文件 Skill）
    const topLevelFiles = await fs.readdir(this.skillsDir);
    for (const file of topLevelFiles) {
      const filePath = path.join(this.skillsDir, file);
      const stat = await fs.stat(filePath);

      if (stat.isFile() && SKILL_FILE_PATTERNS.some((p) => file.endsWith(p))) {
        fullContentSize += stat.size;
        const entry = await this._extractMetadata(filePath, file);
        if (entry) {
          entries.push(entry);
        }
      }
    }

    // 扫描子目录（目录型 Skill，含 SKILL.md）
    for (const dir of topLevelFiles) {
      const dirPath = path.join(this.skillsDir, dir);
      const stat = await fs.stat(dirPath);

      if (stat.isDirectory()) {
        const skillFile = path.join(dirPath, SKILL_DIR_INDICATOR);
        if (await fs.pathExists(skillFile)) {
          const fileStat = await fs.stat(skillFile);
          fullContentSize += fileStat.size;
          const entry = await this._extractMetadata(skillFile, `${dir}/SKILL.md`);
          if (entry) {
            entry.isDirectory = true;
            entries.push(entry);
          }
        }
      }
    }

    // 计算索引大小（估算：每个条目约 200 字节）
    const indexSize = entries.length * 200;
    const savingsPercent =
      fullContentSize > 0
        ? Math.max(0, Math.round(((fullContentSize - indexSize) / fullContentSize) * 100))
        : 0;

    // 获取当前 git head hash
    let headHash = '';
    try {
      headHash = execSync('git rev-parse HEAD', {
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();
    } catch {
      // 不在 git 仓库中，使用空字符串
    }

    // 计算当前文件 hashes
    const fileHashes = await this._computeFileHashes();

    const result = {
      totalSkills: entries.length,
      indexSize,
      fullContentSize,
      savingsPercent,
      entries,
      head_hash: headHash,
      file_hashes: {
        head_hash: headHash,
        created_at: Date.now(),
        files: fileHashes
      }
    };

    // 更新缓存
    this._cache = result;
    this._cacheTimestamp = Date.now();

    this.logger.info(
      `Skill 索引构建完成: ${entries.length} 个 Skill, ` +
        `节省 ${savingsPercent}% Token (索引 ${indexSize}B vs 全量 ${fullContentSize}B)`
    );

    return result;
  }

  /**
   * 按关键词搜索 Skill（只搜索索引，不加载完整内容）
   * @param {string[]} keywords - 关键词列表
   * @returns {Promise<SkillIndexEntry[]>}
   */
  async search(keywords) {
    const index = await this.buildIndex();
    const lowerKeywords = keywords.map((k) => k.toLowerCase());

    return index.entries.filter((entry) => {
      const searchText = `${entry.name} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase();
      return lowerKeywords.some((kw) => searchText.includes(kw));
    });
  }

  /**
   * 按需加载 Skill 完整内容
   * @param {string} relativePath - 相对路径
   * @returns {Promise<{content: string, entry: SkillIndexEntry}|null>}
   */
  async loadContent(relativePath) {
    const filePath = path.join(this.skillsDir, relativePath);

    if (!(await fs.pathExists(filePath))) {
      this.logger.warn(`Skill 文件不存在: ${filePath}`);
      return null;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const index = await this.buildIndex();
    const entry = index.entries.find((e) => e.relativePath === relativePath);

    return { content, entry: entry || null };
  }

  /**
   * 获取索引摘要（用于 PHASE 1 输出）
   * @returns {Promise<string>}
   */
  async getIndexSummary() {
    const index = await this.buildIndex();

    if (index.entries.length === 0) {
      return 'Skills: 0 个（目录不存在或为空）';
    }

    const lines = [
      `Skills: ${index.entries.length} 个 (索引模式, 节省 ${index.savingsPercent}% Token)`
    ];

    for (const entry of index.entries) {
      const tagStr = entry.tags.length > 0 ? ` [${entry.tags.join(',')}]` : '';
      lines.push(`  - ${entry.name}: ${entry.description.slice(0, 60)}${tagStr}`);
    }

    return lines.join('\n');
  }

  /**
   * 从 Skill 文件提取元数据
   * @param {string} filePath - 文件绝对路径
   * @param {string} relativePath - 相对路径
   * @returns {Promise<SkillIndexEntry|null>}
   * @private
   */
  async _extractMetadata(filePath, relativePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stat = await fs.stat(filePath);

      // 提取 frontmatter
      const match = content.match(FRONTMATTER_REGEX);
      let name = path.basename(relativePath, '.md');
      let description = '';
      let tags = [];

      if (match && match[1]) {
        const frontmatter = match[1];
        // 解析 name
        const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
        if (nameMatch) {
          name = nameMatch[1].trim();
        }
        // 解析 description
        const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
        if (descMatch) {
          description = descMatch[1].trim();
        }
        // 解析 tags
        const tagsMatch = frontmatter.match(/^tags:\s*\[(.+)\]/m);
        if (tagsMatch) {
          tags = tagsMatch[1]
            .split(',')
            .map((t) => t.trim().replace(/['"]/g, ''))
            .filter(Boolean);
        }
      }

      // 如果没有 frontmatter，从内容第一行提取标题
      if (!description) {
        const firstLine = content.split('\n').find((line) => line.trim().startsWith('#'));
        if (firstLine) {
          description = firstLine
            .replace(/^#+\s*/, '')
            .trim()
            .slice(0, 100);
        }
      }

      return {
        name,
        description,
        tags,
        filePath,
        relativePath,
        fileSize: stat.size,
        isDirectory: false
      };
    } catch (error) {
      this.logger.warn(`提取 Skill 元数据失败 ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * 计算所有 Skill 文件的 hash
   * @returns {Promise<FileHashEntry[]>}
   * @private
   */
  async _computeFileHashes() {
    const hashes = [];

    if (!(await fs.pathExists(this.skillsDir))) {
      return hashes;
    }

    const computeFileHash = async (filePath, relativePath) => {
      try {
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = createHash('sha256').update(content).digest('hex');

        return {
          relativePath,
          hash,
          mtime: stat.mtimeMs
        };
      } catch {
        return null;
      }
    };

    // 扫描顶层文件
    const topLevelFiles = await fs.readdir(this.skillsDir);
    for (const file of topLevelFiles) {
      const filePath = path.join(this.skillsDir, file);
      const stat = await fs.stat(filePath);

      if (stat.isFile() && SKILL_FILE_PATTERNS.some((p) => file.endsWith(p))) {
        const entry = await computeFileHash(filePath, file);
        if (entry) hashes.push(entry);
      }
    }

    // 扫描子目录
    for (const dir of topLevelFiles) {
      const dirPath = path.join(this.skillsDir, dir);
      const stat = await fs.stat(dirPath);

      if (stat.isDirectory()) {
        const skillFile = path.join(dirPath, SKILL_DIR_INDICATOR);
        if (await fs.pathExists(skillFile)) {
          const entry = await computeFileHash(skillFile, `${dir}/SKILL.md`);
          if (entry) hashes.push(entry);
        }
      }
    }

    return hashes;
  }

  /**
   * 比较两组 hash 是否有差异
   * @param {FileHashEntry[]} current
   * @param {FileHashEntry[]} cached
   * @returns {boolean}
   * @private
   */
  _hashesEqual(current, cached) {
    if (current.length !== cached.length) {
      return false;
    }

    const cachedMap = new Map(cached.map((e) => [e.relativePath, e.hash]));
    for (const entry of current) {
      if (cachedMap.get(entry.relativePath) !== entry.hash) {
        return false;
      }
    }

    return true;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this._cache = null;
    this._cacheTimestamp = 0;
  }
}

export default SkillIndexer;
