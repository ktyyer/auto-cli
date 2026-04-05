/**
 * 知识管家 - 一句话保存灵感、踩坑经验、架构决策
 *
 * 核心功能：
 * - 智能分类：根据内容关键词自动路由到对应知识文件
 * - Markdown 追加：以结构化格式追加到对应 .md 文件
 * - Git 自动提交：保存后自动 git commit
 */
import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import { createHash } from 'node:crypto';
import { logger } from '../logger.js';
import { classifyContent, CATEGORIES } from './categories.js';

/**
 * @typedef {Object} SaveOptions
 * @property {string} content - 要保存的内容
 * @property {string} [category] - 指定分类（可选，自动推断时忽略）
 * @property {string[]} [tags] - 标签列表
 * @property {boolean} [gitCommit=true] - 是否自动 git commit
 * @property {string} [projectDir] - 项目根目录（默认 process.cwd()）
 */

/**
 * @typedef {Object} SaveResult
 * @property {boolean} success - 是否成功
 * @property {string} filePath - 写入的文件路径
 * @property {string} categoryName - 分类名称
 * @property {string} [gitHash] - Git commit hash（如果提交了）
 * @property {string} [error] - 错误信息（如果失败）
 */

class KnowledgeSteward {
  /**
   * @param {string} [projectDir] - 项目根目录
   */
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.insightsDir = path.join(this.projectDir, '.auto', 'insights');
    this._feedbackFile = path.join(this.projectDir, '.auto', 'insights', '.feedback.json');
    /** @type {Map<string, {hits: number, successes: number, lastUsed: number}>} */
    this._feedbackCache = null;
  }

  /**
   * 确保知识目录结构存在
   * @returns {Promise<string>} insights 目录路径
   */
  async ensureStructure() {
    await fs.ensureDir(this.insightsDir);

    // 为每个分类创建空文件（如果不存在）
    for (const cat of CATEGORIES) {
      const filePath = path.join(this.insightsDir, cat.file);
      if (!(await fs.pathExists(filePath))) {
        const header = this._buildFileHeader(cat);
        await fs.writeFile(filePath, header, 'utf-8');
      }
    }

    return this.insightsDir;
  }

  /**
   * 保存知识条目
   * @param {SaveOptions} options
   * @returns {Promise<SaveResult>}
   */
  async save({ content, category, tags, gitCommit = true }) {
    if (!content || !content.trim()) {
      return {
        success: false,
        filePath: '',
        categoryName: '',
        error: '内容不能为空'
      };
    }

    try {
      // 确保目录存在
      await this.ensureStructure();

      // 分类
      const matchedCategory = classifyContent(content, category);

      // P4-10: 去重检查（基于内容 hash，避免重复保存相同经验）
      const contentHash = createHash('sha256').update(content.trim()).digest('hex').slice(0, 16);
      const catFile = path.join(this.insightsDir, matchedCategory.file);
      if (await fs.pathExists(catFile)) {
        const existingContent = await fs.readFile(catFile, 'utf-8');
        if (existingContent.includes(contentHash)) {
          logger.info(`知识已存在（hash=${contentHash}），跳过重复保存`);
          return {
            success: true,
            filePath: catFile,
            categoryName: matchedCategory.name,
            skipped: true,
            reason: 'duplicate'
          };
        }
      }

      // 格式化条目（附加 hash 用于后续去重）
      const entry = this._formatEntry(content.trim(), tags, contentHash);

      // 追加到文件
      const filePath = path.join(this.insightsDir, matchedCategory.file);
      await fs.appendFile(filePath, '\n' + entry, 'utf-8');

      logger.info(`知识已保存到 ${matchedCategory.file}`);

      // Git 提交
      let gitHash = '';
      if (gitCommit) {
        gitHash = await this._gitCommit(filePath, matchedCategory.name);
      }

      return {
        success: true,
        filePath,
        categoryName: matchedCategory.name,
        gitHash
      };
    } catch (error) {
      logger.error(`保存失败: ${error.message}`);
      return {
        success: false,
        filePath: '',
        categoryName: '',
        error: error.message
      };
    }
  }

  /**
   * 列出所有知识条目（简要统计）
   * @returns {Promise<Array<{category: string, file: string, count: number}>>}
   */
  async list() {
    await this.ensureStructure();
    const results = [];

    for (const cat of CATEGORIES) {
      const filePath = path.join(this.insightsDir, cat.file);
      const content = await fs.readFile(filePath, 'utf-8');
      // 统计条目数（以 ### 开头的行）
      const count = (content.match(/^### /gm) || []).length;
      results.push({
        category: cat.name,
        file: cat.file,
        count,
        description: cat.description
      });
    }

    return results;
  }

  /**
   * 搜索知识条目
   * @param {string} query - 搜索关键词
   * @param {Object} [options] - 选项
   * @param {number} [options.limit=20] - 每个分类最多返回条目数
   * @param {number} [options.maxAgeDays=180] - 只返回近 N 天的条目（0=不限）
   * @returns {Promise<Array<{category: string, file: string, matches: string[]}>>}
   */
  async search(query, options = {}) {
    const { limit = 20, maxAgeDays = 180 } = options;
    await this.ensureStructure();
    const lowerQuery = query.toLowerCase();
    const results = [];
    const cutoffTime = maxAgeDays > 0 ? Date.now() - maxAgeDays * 24 * 60 * 60 * 1000 : 0;

    for (const cat of CATEGORIES) {
      const filePath = path.join(this.insightsDir, cat.file);
      const content = await fs.readFile(filePath, 'utf-8');

      // 按条目分割（以 ### 分隔）
      const entries = content.split(/^### /m).filter(Boolean);
      let matches = entries
        .filter((entry) => entry.toLowerCase().includes(lowerQuery))
        .map((entry) => '### ' + entry.trim());

      // 时间过滤：移除过期条目
      if (cutoffTime > 0) {
        matches = matches.filter((match) => {
          const dateMatch = match.match(/\*\*日期\*\*: (\d{4}-\d{2}-\d{2})/);
          if (!dateMatch) return true; // 无日期的保留
          const entryDate = new Date(dateMatch[1]).getTime();
          return entryDate >= cutoffTime;
        });
      }

      // 数量限制
      if (matches.length > 0) {
        results.push({
          category: cat.name,
          file: cat.file,
          matches: matches.slice(0, limit)
        });
      }
    }

    return results;
  }

  /**
   * 构建 Markdown 文件头
   * @param {import('./categories.js').Category} category
   * @returns {string}
   * @private
   */
  _buildFileHeader(category) {
    return `# ${category.description}\n\n> 由 knowledge-steward 自动维护\n\n`;
  }

  /**
   * 格式化单个知识条目
   * @param {string} content
   * @param {string[]} [tags]
   * @returns {string}
   * @private
   */
  _formatEntry(content, tags, contentHash = '') {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19);

    // 提取第一行作为标题（截取前 50 字符）
    const firstLine = content.split('\n')[0].replace(/^#+\s*/, '');
    const title = firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine;

    const tagStr = tags && tags.length > 0 ? `\n**标签**: ${tags.join(', ')}` : '';
    const hashStr = contentHash ? `\n**hash**: ${contentHash}` : '';

    // 防止 content 中的 ### 子标题与条目分隔符冲突，降级为 ####
    const safeContent = content.replace(/^### /gm, '#### ');

    return [
      `### ${title}`,
      '',
      `**日期**: ${dateStr} ${timeStr}${tagStr}${hashStr}`,
      '',
      safeContent,
      '',
      '---',
      ''
    ].join('\n');
  }

  /**
   * 执行 git commit
   * @param {string} filePath - 要提交的文件路径
   * @param {string} categoryName - 分类名称（用于 commit message）
   * @returns {Promise<string>} commit hash
   * @private
   */
  async _gitCommit(filePath, categoryName) {
    try {
      const relativePath = path.relative(this.projectDir, filePath);

      // 检查是否在 git 仓库中
      try {
        execSync('git rev-parse --is-inside-work-tree', {
          cwd: this.projectDir,
          stdio: 'pipe'
        });
      } catch {
        logger.debug('不在 git 仓库中，跳过自动提交');
        return '';
      }

      // git add
      execSync(`git add "${relativePath}"`, {
        cwd: this.projectDir,
        stdio: 'pipe'
      });

      // 提取简短主题（取内容第一行前 30 字符）
      const topic = categoryName || 'insight';

      // git commit
      execSync(`git commit -m "docs: save ${topic} insight [knowledge-steward]"`, {
        cwd: this.projectDir,
        stdio: 'pipe'
      });

      // 获取 commit hash
      const hash = execSync('git rev-parse --short HEAD', {
        cwd: this.projectDir,
        encoding: 'utf-8'
      }).trim();

      logger.info(`Git 提交成功: ${hash}`);
      return hash;
    } catch (error) {
      logger.warn(`Git 提交跳过: ${error.message}`);
      return '';
    }
  }

  // ─── 反馈回路 ────────────────────────────────────

  /**
   * 记录知识使用反馈（PHASE 4 验证阶段调用）
   *
   * @param {Object} feedback - 反馈数据
   * @param {string} feedback.source - 来源标识（'insight' 或 'skill'）
   * @param {string} feedback.key - 知识条目标识（hash 或 skill name）
   * @param {boolean} feedback.successful - 知识是否帮助完成任务
   * @returns {Promise<void>}
   */
  async recordFeedback({ source, key, successful }) {
    if (!source || !key) return;

    const feedbackData = await this._loadFeedback();
    const entryKey = `${source}:${key}`;

    const entry = feedbackData[entryKey] || { hits: 0, successes: 0, lastUsed: 0 };
    entry.hits += 1;
    if (successful) entry.successes += 1;
    entry.lastUsed = Date.now();
    feedbackData[entryKey] = entry;

    await this._saveFeedback(feedbackData);
    logger.debug(`[KnowledgeSteward] 反馈已记录: ${entryKey} success=${successful}`);
  }

  /**
   * 获取知识的质量分数（用于排序和淘汰决策）
   *
   * @param {string} source - 来源标识
   * @param {string} key - 知识条目标识
   * @returns {Promise<number>} 质量分数 0-1（无数据时返回 0.5 中性值）
   */
  async getQualityScore(source, key) {
    const feedbackData = await this._loadFeedback();
    const entryKey = `${source}:${key}`;
    const entry = feedbackData[entryKey];

    if (!entry || entry.hits === 0) return 0.5;

    return entry.successes / entry.hits;
  }

  /**
   * 获取低质量知识条目（用于 PHASE 6 清理决策）
   *
   * @param {number} [threshold=0.3] - 质量分数低于此值的视为低质量
   * @param {number} [minHits=3] - 至少被使用这么多次才评估（避免样本不足）
   * @returns {Promise<Array<{source: string, key: string, score: number, hits: number}>>}
   */
  async getLowQualityEntries(threshold = 0.3, minHits = 3) {
    const feedbackData = await this._loadFeedback();
    const results = [];

    for (const [entryKey, entry] of Object.entries(feedbackData)) {
      if (entry.hits < minHits) continue;
      const score = entry.successes / entry.hits;
      if (score < threshold) {
        const [source, ...keyParts] = entryKey.split(':');
        results.push({
          source,
          key: keyParts.join(':'),
          score,
          hits: entry.hits,
          lastUsed: entry.lastUsed
        });
      }
    }

    return results.sort((a, b) => a.score - b.score);
  }

  /**
   * 加载反馈数据
   * @returns {Promise<Object>}
   * @private
   */
  async _loadFeedback() {
    if (this._feedbackCache) return this._feedbackCache;

    try {
      await this.ensureStructure();
      if (await fs.pathExists(this._feedbackFile)) {
        const raw = await fs.readFile(this._feedbackFile, 'utf-8');
        this._feedbackCache = JSON.parse(raw);
        return this._feedbackCache;
      }
    } catch (error) {
      logger.debug(`[KnowledgeSteward] 反馈数据加载失败: ${error.message}`);
    }

    this._feedbackCache = {};
    return this._feedbackCache;
  }

  /**
   * 保存反馈数据
   * @param {Object} data
   * @private
   */
  async _saveFeedback(data) {
    this._feedbackCache = data;
    try {
      await this.ensureStructure();
      await fs.writeFile(this._feedbackFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      logger.debug(`[KnowledgeSteward] 反馈数据保存失败: ${error.message}`);
    }
  }
}

export { KnowledgeSteward };
export default KnowledgeSteward;
