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

      // 格式化条目
      const entry = this._formatEntry(content.trim(), tags);

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
   * @returns {Promise<Array<{category: string, matches: string[]}>>}
   */
  async search(query) {
    await this.ensureStructure();
    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const cat of CATEGORIES) {
      const filePath = path.join(this.insightsDir, cat.file);
      const content = await fs.readFile(filePath, 'utf-8');

      // 按条目分割（以 ### 分隔）
      const entries = content.split(/^### /m).filter(Boolean);
      const matches = entries
        .filter((entry) => entry.toLowerCase().includes(lowerQuery))
        .map((entry) => '### ' + entry.trim());

      if (matches.length > 0) {
        results.push({
          category: cat.name,
          file: cat.file,
          matches
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
  _formatEntry(content, tags) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19);

    // 提取第一行作为标题（截取前 50 字符）
    const firstLine = content.split('\n')[0].replace(/^#+\s*/, '');
    const title = firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine;

    const tagStr = tags && tags.length > 0 ? `\n**标签**: ${tags.join(', ')}` : '';

    return [
      `### ${title}`,
      '',
      `**日期**: ${dateStr} ${timeStr}${tagStr}`,
      '',
      content,
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
}

export { KnowledgeSteward };
export default KnowledgeSteward;
