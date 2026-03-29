/**
 * 自动上下文注入器
 *
 * 核心功能：
 * - 在 Loop INTAKE 阶段自动收集项目上下文
 * - 智能选择上下文预设模板
 * - 压缩上下文以节省 Token
 * - 支持自定义上下文模板注册
 *
 * 基于 linux.do 社区最佳实践：
 * - "自动上下文注入" 提升上下文管理效率
 * - "Trellis 方案" 结构化支撑 AI 编码
 */

import path from 'node:path';
import fs from 'fs-extra';
import { logger } from '../logger.js';
import { ContextDeduplicator } from './context-deduplicator.js';
import { ContextBudgetManager } from './context-budget.js';

/**
 * 上下文预设模板
 * 每个预设定义了在特定场景下应收集的上下文类型和优先级
 */
export const CONTEXT_PRESETS = Object.freeze({
  /**
   * 探索模式 - 用于项目首次接触或大规模变更
   * 来源: linux.do "Explore first, then plan, then code"
   */
  EXPLORE: {
    id: 'explore',
    name: '探索模式',
    description: '全面收集项目上下文，适用于首次接触或大规模变更',
    priority: 'high',
    collectStrategies: [
      { type: 'repo-map', required: true },
      { type: 'claude-md', required: true },
      { type: 'session-knowledge', required: false },
      { type: 'pattern-cards', required: false },
      { type: 'insights', required: false },
      { type: 'dependencies', required: true },
      { type: 'skills', required: false }
    ],
    maxTokenEstimate: 4000
  },

  /**
   * 实现模式 - 用于具体功能开发
   */
  IMPLEMENT: {
    id: 'implement',
    name: '实现模式',
    description: '聚焦于目标文件和直接依赖，适用于功能开发',
    priority: 'medium',
    collectStrategies: [
      { type: 'claude-md', required: true },
      { type: 'repo-map', required: false },
      { type: 'session-knowledge', required: true },
      { type: 'pattern-cards', required: true },
      { type: 'dependencies', required: true },
      { type: 'skills', required: true }
    ],
    maxTokenEstimate: 2500
  },

  /**
   * 修复模式 - 用于 Bug 修复
   */
  FIX: {
    id: 'fix',
    name: '修复模式',
    description: '最小化上下文，聚焦于问题定位',
    priority: 'low',
    collectStrategies: [
      { type: 'session-knowledge', required: true },
      { type: 'insights', required: true },
      { type: 'claude-md', required: false },
      { type: 'skills', required: false }
    ],
    maxTokenEstimate: 1500
  },

  /**
   * 审查模式 - 用于代码审查
   */
  REVIEW: {
    id: 'review',
    name: '审查模式',
    description: '收集编码规范和模式信息，适用于代码审查',
    priority: 'medium',
    collectStrategies: [
      { type: 'claude-md', required: true },
      { type: 'pattern-cards', required: true },
      { type: 'insights', required: true },
      { type: 'repo-map', required: false },
      { type: 'skills', required: false }
    ],
    maxTokenEstimate: 2000
  }
});

/**
 * 根据任务关键词推荐上下文预设
 * @param {string} taskDescription - 任务描述
 * @returns {Object} 推荐的预设对象
 */
export function recommendPreset(taskDescription) {
  if (!taskDescription || typeof taskDescription !== 'string') {
    return CONTEXT_PRESETS.EXPLORE;
  }

  const lower = taskDescription.toLowerCase();

  // 修复模式关键词
  const fixKeywords = ['fix', 'bug', '修复', '错误', '报错', '异常', 'debug', '排错', '排查'];
  if (fixKeywords.some((kw) => lower.includes(kw))) {
    return CONTEXT_PRESETS.FIX;
  }

  // 审查模式关键词
  const reviewKeywords = ['review', '审查', '检查', 'reviewer', '审计', 'lint'];
  if (reviewKeywords.some((kw) => lower.includes(kw))) {
    return CONTEXT_PRESETS.REVIEW;
  }

  // 探索模式关键词
  const exploreKeywords = [
    'explore',
    '探索',
    '分析',
    'analyze',
    '重构',
    'refactor',
    '架构',
    'architecture'
  ];
  if (exploreKeywords.some((kw) => lower.includes(kw))) {
    return CONTEXT_PRESETS.EXPLORE;
  }

  // 默认为实现模式
  return CONTEXT_PRESETS.IMPLEMENT;
}

/**
 * 自动上下文注入器类
 */
export class ContextInjector {
  /**
   * @param {string} [projectDir] - 项目根目录
   */
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.cache = new Map();
    this.deduplicator = new ContextDeduplicator();
    this.budgetManager = null; // 在 collect 时根据 preset 初始化
    this.skillCatalog = null; // 懒加载
  }

  /**
   * 根据任务自动收集上下文
   * @param {string} taskDescription - 任务描述
   * @param {Object} [options] - 选项
   * @param {string} [options.preset] - 强制使用的预设 ID
   * @param {string[]} [options.additionalFiles] - 额外要包含的文件路径
   * @returns {Promise<ContextResult>} 收集的上下文结果
   */
  async collect(taskDescription, options = {}) {
    const preset = options.preset
      ? CONTEXT_PRESETS[options.preset.toUpperCase()] || recommendPreset(taskDescription)
      : recommendPreset(taskDescription);

    logger.info(`使用上下文预设: ${preset.name}`);

    const sections = [];

    for (const strategy of preset.collectStrategies) {
      try {
        const content = await this._collectByStrategy(strategy.type, taskDescription);
        if (content) {
          sections.push({
            type: strategy.type,
            content,
            required: strategy.required
          });
        }
      } catch (error) {
        if (strategy.required) {
          logger.warn(`必需的上下文源 ${strategy.type} 收集失败: ${error.message}`);
        }
      }
    }

    // 附加额外文件
    if (options.additionalFiles && options.additionalFiles.length > 0) {
      for (const filePath of options.additionalFiles) {
        const content = await this._readFileIfExists(filePath);
        if (content) {
          sections.push({
            type: 'file',
            content,
            required: false,
            filePath
          });
        }
      }
    }

    // 1. 去重
    const dedupResult = this.deduplicator.dedup(sections);
    logger.debug(
      `去重: ${dedupResult.originalCount} -> ${dedupResult.dedupedCount} 段落, 节省 ${dedupResult.savedTokens} tokens`
    );

    // 2. 预算管理
    this.budgetManager = new ContextBudgetManager(ContextBudgetManager.fromPreset(preset));
    const budgetResult = this.budgetManager.allocate(dedupResult.sections);

    if (budgetResult.trimmed.length > 0) {
      logger.debug(
        `预算裁剪: ${budgetResult.trimmed.length} 段落被裁剪 (${budgetResult.totalTokens}/${budgetResult.budgetTokens} tokens)`
      );
    }

    const totalTokens = budgetResult.totalTokens;

    return {
      preset: preset.id,
      presetName: preset.name,
      sections: budgetResult.sections,
      totalTokens,
      collectedAt: new Date().toISOString(),
      projectDir: this.projectDir,
      optimization: {
        dedup: {
          originalCount: dedupResult.originalCount,
          dedupedCount: dedupResult.dedupedCount,
          savedTokens: dedupResult.savedTokens,
          report: dedupResult.report
        },
        budget: {
          budgetTokens: budgetResult.budgetTokens,
          utilization: budgetResult.utilization,
          trimmed: budgetResult.trimmed
        }
      }
    };
  }

  /**
   * 按策略收集上下文
   * @param {string} type - 策略类型
   * @param {string} [taskDescription] - 任务描述
   * @returns {Promise<string|null>} 收集的内容
   * @private
   */
  async _collectByStrategy(type, taskDescription = '') {
    // 检查缓存
    if (this.cache.has(type)) {
      return this.cache.get(type);
    }

    let content = null;

    switch (type) {
      case 'repo-map': {
        const mapPath = path.join(this.projectDir, 'REPO_MAP.md');
        content = await this._readFileIfExists(mapPath);
        break;
      }
      case 'claude-md': {
        const claudePath = path.join(this.projectDir, 'CLAUDE.md');
        content = await this._readFileIfExists(claudePath);
        break;
      }
      case 'session-knowledge': {
        const sessionPath = path.join(this.projectDir, '.auto', 'session-knowledge.md');
        content = await this._readFileIfExists(sessionPath);
        break;
      }
      case 'pattern-cards': {
        const cardsPath = path.join(this.projectDir, '.auto', 'cache', 'pattern-cards.json');
        const raw = await this._readFileIfExists(cardsPath);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            content = this._summarizePatternCards(parsed);
          } catch {
            content = raw;
          }
        }
        break;
      }
      case 'insights': {
        const insightsDir = path.join(this.projectDir, '.auto', 'insights');
        content = await this._collectInsights(insightsDir);
        break;
      }
      case 'dependencies': {
        const pkgPath = path.join(this.projectDir, 'package.json');
        const raw = await this._readFileIfExists(pkgPath);
        if (raw) {
          try {
            const pkg = JSON.parse(raw);
            const deps = Object.keys(pkg.dependencies || {});
            const devDeps = Object.keys(pkg.devDependencies || {});
            content = `dependencies: ${deps.join(', ') || 'none'}\ndevDependencies: ${devDeps.join(', ') || 'none'}`;
          } catch {
            content = null;
          }
        }
        break;
      }
      case 'skills': {
        content = await this._collectSkills(taskDescription);
        break;
      }
      default:
        break;
    }

    // 缓存结果
    if (content) {
      this.cache.set(type, content);
    }

    return content;
  }

  /**
   * 读取文件（如不存在返回 null）
   * @param {string} filePath - 文件路径
   * @returns {Promise<string|null>} 文件内容
   * @private
   */
  async _readFileIfExists(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        return await fs.readFile(filePath, 'utf-8');
      }
    } catch {
      // 文件不存在或不可读
    }
    return null;
  }

  /**
   * 收集 insights 目录下的摘要
   * @param {string} insightsDir - insights 目录路径
   * @returns {Promise<string|null>} 摘要内容
   * @private
   */
  async _collectInsights(insightsDir) {
    try {
      if (!(await fs.pathExists(insightsDir))) {
        return null;
      }

      const files = await fs.readdir(insightsDir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));

      if (mdFiles.length === 0) {
        return null;
      }

      const summaries = [];

      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(insightsDir, file), 'utf-8');
        // 提取标题行（### 开头）
        const titles = content
          .split('\n')
          .filter((line) => line.startsWith('### '))
          .map((line) => line.replace(/^###\s+/, '').trim());

        if (titles.length > 0) {
          summaries.push(`${file}: ${titles.join(', ')}`);
        }
      }

      return summaries.length > 0 ? summaries.join('\n') : null;
    } catch {
      return null;
    }
  }

  /**
   * 总结模式卡片为文本
   * @param {Object} cardsData - 模式卡片数据
   * @returns {string} 文本摘要
   * @private
   */
  _summarizePatternCards(cardsData) {
    if (!cardsData || typeof cardsData !== 'object') {
      return '';
    }

    const cards = cardsData.cards || cardsData;
    if (typeof cards !== 'object') {
      return JSON.stringify(cards).slice(0, 500);
    }

    const lines = [];
    for (const [fileName, card] of Object.entries(cards)) {
      const info = [];
      if (card.package) info.push(`package: ${card.package}`);
      if (card.method_pattern) info.push(`methods: ${card.method_pattern}`);
      if (card.return_pattern) info.push(`returns: ${card.return_pattern}`);
      if (card.key_imports && Array.isArray(card.key_imports)) {
        info.push(`imports: ${card.key_imports.length} items`);
      }
      lines.push(`${fileName} { ${info.join(', ')} }`);
    }

    return lines.join('\n');
  }

  /**
   * 按需加载与任务相关的技能上下文
   * @param {string} taskDescription - 任务描述
   * @returns {Promise<string|null>} 相关技能的摘要
   * @private
   */
  async _collectSkills(taskDescription) {
    if (!taskDescription || typeof taskDescription !== 'string') {
      return null;
    }

    try {
      // 懒加载 SkillCatalog（避免在构造函数中产生 I/O）
      if (!this.skillCatalog) {
        const { SkillCatalog } = await import('../skills/skill-catalog.js');
        this.skillCatalog = new SkillCatalog();
        await this.skillCatalog.scan();
      }

      // 搜索相关技能
      const results = this.skillCatalog.search(taskDescription);

      if (results.length === 0) {
        return null;
      }

      // 只返回 Top 3 相关技能的摘要
      const topSkills = results.slice(0, 3);
      const summaries = topSkills.map((skill) => {
        const parts = [`${skill.displayName} (${skill.name})`];
        parts.push(`  域: ${skill.domain}`);
        if (skill.tags.length > 0) {
          parts.push(`  标签: ${skill.tags.join(', ')}`);
        }
        parts.push(`  ${skill.description}`);
        return parts.join('\n');
      });

      return `相关技能 (${topSkills.length}/${results.length}):\n${summaries.join('\n\n')}`;
    } catch (error) {
      logger.debug(`技能上下文收集跳过: ${error.message}`);
      return null;
    }
  }

  /**
   * 估算 Token 数量（粗略：4 字符 = 1 Token）
   * @param {Array} sections - 上下文段落
   * @returns {number} 估算的 Token 数量
   * @private
   */
  _estimateTokens(sections) {
    const totalChars = sections.reduce((sum, s) => sum + (s.content ? s.content.length : 0), 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * 获取可用的预设列表
   * @returns {Array<Object>} 预设列表
   */
  listPresets() {
    return Object.values(CONTEXT_PRESETS).map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      priority: preset.priority,
      strategyCount: preset.collectStrategies.length,
      maxTokenEstimate: preset.maxTokenEstimate
    }));
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
    this.skillCatalog = null;
  }
}

/**
 * @typedef {Object} ContextResult
 * @property {string} preset - 使用的预设 ID
 * @property {string} presetName - 预设名称
 * @property {Array<{type: string, content: string, required: boolean}>} sections - 上下文段落
 * @property {number} totalTokens - 估算的总 Token 数量
 * @property {string} collectedAt - 收集时间
 * @property {string} projectDir - 项目目录
 * @property {Object} [optimization] - 优化信息
 * @property {Object} [optimization.dedup] - 去重统计
 * @property {number} [optimization.dedup.originalCount] - 原始段落数
 * @property {number} [optimization.dedup.dedupedCount] - 去重后段落数
 * @property {number} [optimization.dedup.savedTokens] - 节省的 Token 数
 * @property {Object} [optimization.budget] - 预算统计
 * @property {number} [optimization.budget.budgetTokens] - 预算 Token 数
 * @property {number} [optimization.budget.utilization] - 预算利用率
 */

export default ContextInjector;
