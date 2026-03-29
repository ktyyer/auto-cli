/**
 * 技能目录类
 * 从本地 skills/ 目录扫描并索引技能
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import fsExtra from 'fs-extra';
import { logger } from '../logger.js';
import { parseSkillManifest, SkillSource } from './skill-types.js';

/**
 * 技能目录类
 * 负责扫描、索引、搜索和过滤技能
 */
export class SkillCatalog {
  constructor(options = {}) {
    this.skillsDir = options.skillsDir || path.join(process.cwd(), 'skills');
    this.index = new Map(); // name -> SkillManifest
    this.tagsIndex = new Map(); // tag -> Set<skillName>
    this.domainIndex = new Map(); // domainId -> Set<skillName>
    this.lastScanTime = null;
  }

  /**
   * 扫描技能目录并构建索引
   * @returns {Promise<number>} 扫描到的技能数量
   */
  async scan() {
    try {
      logger.info(`扫描技能目录: ${this.skillsDir}`);

      // 检查目录是否存在
      const exists = await fsExtra.pathExists(this.skillsDir);
      if (!exists) {
        logger.warn(`技能目录不存在: ${this.skillsDir}`);
        return 0;
      }

      // 递归扫描所有 SKILL.md 文件
      const skillFiles = await this._findSkillFiles(this.skillsDir);
      logger.info(`找到 ${skillFiles.length} 个技能文件`);

      // 解析每个技能
      let successCount = 0;
      for (const skillFile of skillFiles) {
        try {
          const content = await fs.readFile(skillFile, 'utf-8');
          const relativePath = path.relative(this.skillsDir, skillFile);
          const manifest = parseSkillManifest(content, relativePath, SkillSource.BUILTIN);

          // 添加到索引
          this._addToIndex(manifest);
          successCount++;
        } catch (error) {
          logger.warn(`解析技能失败: ${skillFile} - ${error.message}`);
        }
      }

      this.lastScanTime = new Date();
      logger.success(`成功索引 ${successCount}/${skillFiles.length} 个技能`);

      return successCount;
    } catch (error) {
      logger.error(`扫描技能目录失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 递归查找所有 SKILL.md 文件
   * @private
   */
  async _findSkillFiles(dir) {
    const skillFiles = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // 递归子目录
        const subFiles = await this._findSkillFiles(fullPath);
        skillFiles.push(...subFiles);
      } else if (entry.name === 'SKILL.md') {
        // 找到技能文件
        skillFiles.push(fullPath);
      }
    }

    return skillFiles;
  }

  /**
   * 将技能添加到索引
   * @private
   */
  _addToIndex(manifest) {
    // 主索引
    this.index.set(manifest.name, manifest);

    // 标签索引
    for (const tag of manifest.tags) {
      if (!this.tagsIndex.has(tag)) {
        this.tagsIndex.set(tag, new Set());
      }
      this.tagsIndex.get(tag).add(manifest.name);
    }

    // 域索引
    if (!this.domainIndex.has(manifest.domain)) {
      this.domainIndex.set(manifest.domain, new Set());
    }
    this.domainIndex.get(manifest.domain).add(manifest.name);
  }

  /**
   * 列出所有技能
   * @returns {SkillManifest[]}
   */
  list() {
    return Array.from(this.index.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  }

  /**
   * 按域列出技能
   * @param {string} domainId - 域 ID
   * @returns {SkillManifest[]}
   */
  listByDomain(domainId) {
    const skillNames = this.domainIndex.get(domainId) || new Set();
    return Array.from(skillNames)
      .map((name) => this.index.get(name))
      .filter(Boolean)
      .sort((a, b) => b.rating - a.rating);
  }

  /**
   * 搜索技能
   * @param {string} query - 搜索关键词
   * @returns {SkillManifest[]}
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const manifest of this.index.values()) {
      // 匹配名称
      if (manifest.name.toLowerCase().includes(lowerQuery)) {
        results.push(manifest);
        continue;
      }

      // 匹配显示名
      if (manifest.displayName.toLowerCase().includes(lowerQuery)) {
        results.push(manifest);
        continue;
      }

      // 匹配描述
      if (manifest.description.toLowerCase().includes(lowerQuery)) {
        results.push(manifest);
        continue;
      }

      // 匹配标签
      if (manifest.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
        results.push(manifest);
        continue;
      }
    }

    // 按评分排序
    return results.sort((a, b) => b.rating - a.rating);
  }

  /**
   * 按标签过滤
   * @param {string[]} tags - 标签列表
   * @returns {SkillManifest[]}
   */
  filterByTags(tags) {
    const skillNames = new Set();

    for (const tag of tags) {
      const tagged = this.tagsIndex.get(tag) || new Set();
      for (const name of tagged) {
        skillNames.add(name);
      }
    }

    return Array.from(skillNames)
      .map((name) => this.index.get(name))
      .filter(Boolean)
      .sort((a, b) => b.rating - a.rating);
  }

  /**
   * 获取技能清单
   * @param {string} name - 技能名称
   * @returns {SkillManifest|undefined}
   */
  get(name) {
    return this.index.get(name);
  }

  /**
   * 检查技能是否存在
   * @param {string} name - 技能名称
   * @returns {boolean}
   */
  has(name) {
    return this.index.has(name);
  }

  /**
   * 获取所有标签
   * @returns {string[]}
   */
  getAllTags() {
    return Array.from(this.tagsIndex.keys()).sort();
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      totalSkills: this.index.size,
      totalTags: this.tagsIndex.size,
      totalDomains: this.domainIndex.size,
      lastScanTime: this.lastScanTime
    };
  }

  /**
   * 清空索引
   */
  clear() {
    this.index.clear();
    this.tagsIndex.clear();
    this.domainIndex.clear();
    this.lastScanTime = null;
  }
}
