/**
 * 技能发现和管理类
 *
 * 核心功能：
 * - 从 Vibe-Skills 同步技能目录
 * - 搜索和过滤技能
 * - 安装技能到项目
 * - 管理技能索引
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { execSync } from 'node:child_process';
import { logger } from '../logger.js';
import { SKILL_DOMAINS } from './skill-types.js';

const VIBE_SKILLS_REPO = 'https://github.com/foryourhealth111-pixel/Vibe-Skills';
const VIBE_SKILLS_DIR = path.join(os.homedir(), '.auto', 'vibe-skills');
const SKILLS_INDEX_FILE = path.join(os.homedir(), '.auto', 'skills', 'index.json');

export class SkillDiscovery {
  constructor() {
    this.vibeSkillsDir = VIBE_SKILLS_DIR;
    this.indexFile = SKILLS_INDEX_FILE;
    this.logger = logger;
  }

  /**
   * 确保目录结构存在
   * @private
   */
  async _ensureStructure() {
    await fs.ensureDir(path.join(os.homedir(), '.auto', 'skills'));
    await fs.ensureDir(this.vibeSkillsDir);
  }

  /**
   * 从 Vibe-Skills 同步技能目录
   * @param {Object} options - 同步选项
   * @param {boolean} options.force - 强制重新克隆
   * @param {boolean} options.verbose - 详细输出
   * @returns {Promise<Object>} 同步结果
   */
  async syncFromVibeSkills(options = {}) {
    const { force = false, verbose = false } = options;

    try {
      await this._ensureStructure();

      // 检查是否已存在
      const exists = await fs.pathExists(this.vibeSkillsDir);

      if (exists && !force) {
        // 拉取最新代码
        this.logger.info('更新 Vibe-Skills 仓库...');
        try {
          execSync('git pull', { cwd: this.vibeSkillsDir, stdio: verbose ? 'inherit' : 'pipe' });
        } catch {
          this.logger.warn('git pull 失败，尝试重新克隆...');
          await fs.remove(this.vibeSkillsDir);
          return await this.syncFromVibeSkills({ ...options, force: true });
        }
      } else {
        // 克隆仓库
        this.logger.info('克隆 Vibe-Skills 仓库...');
        try {
          execSync(`git clone --depth 1 ${VIBE_SKILLS_REPO} "${this.vibeSkillsDir}"`, {
            stdio: verbose ? 'inherit' : 'pipe'
          });
        } catch (error) {
          throw new Error(`克隆失败: ${error.message}`);
        }
      }

      // 解析技能并更新索引
      const skills = await this._parseSkills();
      await this._updateIndex(skills);

      this.logger.success(`技能同步完成，共 ${skills.length} 个技能`);
      return { success: true, count: skills.length, skills };
    } catch (error) {
      this.logger.error(`技能同步失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 解析技能目录
   * @private
   * @returns {Promise<Array>} 技能列表
   */
  async _parseSkills() {
    const skillsDir = path.join(this.vibeSkillsDir, 'bundled', 'skills');

    if (!(await fs.pathExists(skillsDir))) {
      this.logger.warn(`技能目录不存在: ${skillsDir}`);
      return [];
    }

    const skills = [];

    // 遍历技能目录
    const categories = await fs.readdir(skillsDir);

    for (const category of categories) {
      const categoryPath = path.join(skillsDir, category);

      if (!(await fs.stat(categoryPath)).isDirectory()) {
        continue;
      }

      // 读取分类下的技能
      const skillNames = await fs.readdir(categoryPath);

      for (const skillName of skillNames) {
        const skillPath = path.join(categoryPath, skillName);

        // 跳过非目录
        if (!(await fs.stat(skillPath)).isDirectory()) {
          continue;
        }

        // 查找 SKILL.md 或 README.md
        const skillFile = path.join(skillPath, 'SKILL.md') || path.join(skillPath, 'README.md');

        if (await fs.pathExists(skillFile)) {
          const skill = await this._parseSkillFile(skillFile, category, skillName);
          if (skill) {
            skills.push(skill);
          }
        }
      }
    }

    return skills;
  }

  /**
   * 解析单个技能文件
   * @private
   * @param {string} filePath - 技能文件路径
   * @param {string} category - 分类
   * @param {string} skillName - 技能名称
   * @returns {Promise<Object|null>} 技能元数据
   */
  async _parseSkillFile(filePath, category, skillName) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // 提取 YAML frontmatter
      let frontmatter = {};
      let description = '';

      if (lines[0] === '---') {
        const endIdx = lines.indexOf('---', 1);
        if (endIdx > 0) {
          const yamlLines = lines.slice(1, endIdx);
          frontmatter = this._parseYamlFrontmatter(yamlLines);
          description = lines
            .slice(endIdx + 1)
            .join('\n')
            .slice(0, 200)
            .trim();
        }
      } else {
        description = content.slice(0, 200).trim();
      }

      // 匹配领域
      const domain = this._matchDomain(skillName, description);

      return {
        name: skillName,
        description: frontmatter.description || description,
        tags: frontmatter.tags || [],
        domain: domain.id,
        version: frontmatter.version || '1.0.0',
        author: frontmatter.author || 'Vibe-Skills',
        rating: frontmatter.rating || 4.0,
        path: filePath,
        source: 'vibe-skills',
        category,
        installedAt: null,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.logger.warn(`解析技能失败 ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * 解析 YAML frontmatter
   * @private
   * @param {string[]} lines - YAML 行
   * @returns {Object} 解析结果
   */
  _parseYamlFrontmatter(lines) {
    const result = {};

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        // 处理数组格式
        if (value.startsWith('[') && value.endsWith(']')) {
          result[key] = value
            .slice(1, -1)
            .split(',')
            .map((v) => v.trim().replace(/['"]/g, ''));
        } else {
          result[key] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    }

    return result;
  }

  /**
   * 匹配技能领域
   * @private
   * @param {string} name - 技能名称
   * @param {string} description - 描述
   * @returns {Object} 领域对象
   */
  _matchDomain(name, description) {
    const text = `${name} ${description}`.toLowerCase();

    for (const domain of SKILL_DOMAINS) {
      if (domain.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
        return domain;
      }
    }

    return SKILL_DOMAINS[0]; // 默认第一个领域
  }

  /**
   * 更新技能索引
   * @private
   * @param {Array} skills - 技能列表
   */
  async _updateIndex(skills) {
    const index = {
      skills,
      total: skills.length,
      lastSync: new Date().toISOString(),
      version: '1.0.0'
    };

    await fs.writeJson(this.indexFile, index, { spaces: 2 });
  }

  /**
   * 加载技能索引
   * @returns {Promise<Object|null>} 索引对象
   */
  async loadIndex() {
    try {
      if (await fs.pathExists(this.indexFile)) {
        return await fs.readJson(this.indexFile);
      }
    } catch (error) {
      this.logger.warn(`加载索引失败: ${error.message}`);
    }
    return null;
  }

  /**
   * 搜索技能
   * @param {string} query - 搜索关键词
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} 技能列表
   */
  async searchSkills(query, filters = {}) {
    const index = await this.loadIndex();

    if (!index || !index.skills) {
      this.logger.warn('技能索引不存在，请先运行 sync');
      return [];
    }

    const lowerQuery = query.toLowerCase();

    let results = index.skills.filter((skill) => {
      return (
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery) ||
        skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    });

    // 应用过滤条件
    if (filters.domain) {
      results = results.filter((skill) => skill.domain === filters.domain);
    }

    if (filters.minRating) {
      results = results.filter((skill) => skill.rating >= filters.minRating);
    }

    // 按评分排序
    results.sort((a, b) => b.rating - a.rating);

    return results;
  }

  /**
   * 列出所有技能
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} 技能列表
   */
  async listSkills(filters = {}) {
    return await this.searchSkills('', filters);
  }

  /**
   * 安装技能到项目
   * @param {string} skillName - 技能名称
   * @param {string} projectDir - 项目目录
   * @returns {Promise<Object>} 安装结果
   */
  async installSkill(skillName, projectDir = process.cwd()) {
    try {
      const index = await this.loadIndex();

      if (!index) {
        return { success: false, error: '技能索引不存在，请先运行 sync' };
      }

      const skill = index.skills.find((s) => s.name === skillName);

      if (!skill) {
        return { success: false, error: `技能不存在: ${skillName}` };
      }

      const targetDir = path.join(projectDir, '.claude', 'skills');
      await fs.ensureDir(targetDir);

      // 复制技能目录
      const sourceDir = path.dirname(skill.path);
      const targetPath = path.join(targetDir, skillName);

      await fs.copy(sourceDir, targetPath, { overwrite: false });

      this.logger.success(`技能已安装: ${skillName}`);
      return { success: true, skill };
    } catch (error) {
      this.logger.error(`安装技能失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取技能统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    const index = await this.loadIndex();

    if (!index) {
      return {
        total: 0,
        byDomain: {},
        lastSync: null
      };
    }

    const byDomain = {};
    // 初始化所有领域计数为 0
    for (const domain of SKILL_DOMAINS) {
      byDomain[domain.id] = 0;
    }
    // 统计每个领域的技能数
    for (const skill of index.skills) {
      if (skill.domain && Object.prototype.hasOwnProperty.call(byDomain, skill.domain)) {
        byDomain[skill.domain]++;
      }
    }

    return {
      total: index.total,
      byDomain,
      lastSync: index.lastSync,
      version: index.version
    };
  }
}

export default SkillDiscovery;
