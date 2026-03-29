/**
 * 上下文预算管理器
 *
 * 核心功能：
 * - 根据 Token 预算裁剪上下文段落
 * - 优先保留 required=true 的段落
 * - 支持按策略类型设置优先级
 * - 提供预算使用报告
 */

import { logger } from '../logger.js';

/**
 * @typedef {Object} BudgetConfig
 * @property {number} maxTokens - 最大 Token 预算
 * @property {Object} [typePriorities] - 策略类型的优先级覆盖
 */

/**
 * @typedef {Object} BudgetResult
 * @property {Array<BudgetSection>} sections - 预算内的段落
 * @property {number} totalTokens - 实际使用的 Token 数
 * @property {number} budgetTokens - 预算 Token 数
 * @property {number} utilization - 预算利用率 (0-1)
 * @property {Array<TrimmedSection>} trimmed - 被裁剪的段落
 */

/**
 * @typedef {Object} BudgetSection
 * @property {string} type - 策略类型
 * @property {string} content - 内容
 * @property {boolean} required - 是否必需
 * @property {string} [filePath] - 文件路径
 * @property {number} tokenCount - 该段落的 Token 数
 * @property {string[]} [mergedFrom] - 合并来源
 */

/**
 * @typedef {Object} TrimmedSection
 * @property {string} type - 策略类型
 * @property {number} originalTokens - 原始 Token 数
 * @property {string} reason - 裁剪原因
 */

/**
 * 默认策略类型优先级（数值越高优先级越高）
 */
const DEFAULT_TYPE_PRIORITIES = Object.freeze({
  'claude-md': 100, // 项目规则，最重要
  'session-knowledge': 90, // 会话知识
  'pattern-cards': 80, // 模式卡片
  dependencies: 70, // 依赖信息
  'repo-map': 60, // 仓库地图
  insights: 50, // 洞察摘要
  skills: 40, // 技能上下文
  file: 30 // 附加文件
});

/**
 * 上下文预算管理器类
 */
export class ContextBudgetManager {
  /**
   * @param {BudgetConfig} config - 预算配置
   */
  constructor(config = {}) {
    this.maxTokens = config.maxTokens ?? 4000;
    this.typePriorities = {
      ...DEFAULT_TYPE_PRIORITIES,
      ...(config.typePriorities || {})
    };
  }

  /**
   * 根据预算裁剪上下文段落
   * @param {Array<{type: string, content: string, required: boolean, filePath?: string, mergedFrom?: string[]}>} sections
   * @returns {BudgetResult}
   */
  allocate(sections) {
    if (!sections || sections.length === 0) {
      return {
        sections: [],
        totalTokens: 0,
        budgetTokens: this.maxTokens,
        utilization: 0,
        trimmed: []
      };
    }

    // 计算每个段落的 Token 数
    const withTokens = sections.map((section) => ({
      ...section,
      tokenCount: this._estimateTokens(section.content)
    }));

    // 分为必需和非必需两组
    const required = withTokens.filter((s) => s.required);
    const optional = withTokens.filter((s) => !s.required);

    // 必需段落优先入选
    const result = [];
    let usedTokens = 0;
    const trimmed = [];

    for (const section of required) {
      if (usedTokens + section.tokenCount <= this.maxTokens) {
        result.push(section);
        usedTokens += section.tokenCount;
      } else {
        // 必需段落超预算：截断内容
        const available = this.maxTokens - usedTokens;
        if (available >= 50) {
          // 至少保留 50 tokens 的空间
          const truncated = this._truncateContent(section.content, available);
          result.push({
            ...section,
            content: truncated,
            tokenCount: available
          });
          usedTokens += available;
          trimmed.push({
            type: section.type,
            originalTokens: section.tokenCount,
            reason: 'budget_exceeded_truncated'
          });
        } else {
          trimmed.push({
            type: section.type,
            originalTokens: section.tokenCount,
            reason: 'budget_exceeded_dropped'
          });
        }
      }
    }

    // 按优先级排序非必需段落
    const sortedOptional = optional.sort((a, b) => {
      const priorityA = this.typePriorities[a.type] ?? 0;
      const priorityB = this.typePriorities[b.type] ?? 0;
      return priorityB - priorityA;
    });

    // 填充非必需段落直到预算耗尽
    for (const section of sortedOptional) {
      if (usedTokens + section.tokenCount <= this.maxTokens) {
        result.push(section);
        usedTokens += section.tokenCount;
      } else {
        trimmed.push({
          type: section.type,
          originalTokens: section.tokenCount,
          reason: 'budget_full'
        });
      }
    }

    return {
      sections: result,
      totalTokens: usedTokens,
      budgetTokens: this.maxTokens,
      utilization: this.maxTokens > 0 ? usedTokens / this.maxTokens : 0,
      trimmed
    };
  }

  /**
   * 估算 Token 数量（4 字符 = 1 Token）
   * @param {string} content - 内容
   * @returns {number}
   * @private
   */
  _estimateTokens(content) {
    if (!content) return 0;
    return Math.ceil(content.length / 4);
  }

  /**
   * 截断内容到指定 Token 预算
   * @param {string} content - 原始内容
   * @param {number} maxTokens - 最大 Token 数
   * @returns {string} 截断后的内容
   * @private
   */
  _truncateContent(content, maxTokens) {
    const maxChars = maxTokens * 4;
    if (!content || content.length <= maxChars) return content;

    // 尝试在段落边界截断
    const truncated = content.slice(0, maxChars);
    const lastNewline = truncated.lastIndexOf('\n');

    if (lastNewline > maxChars * 0.8) {
      return truncated.slice(0, lastNewline) + '\n... (truncated)';
    }

    return truncated + '... (truncated)';
  }

  /**
   * 根据预设获取推荐预算配置
   * @param {Object} preset - 上下文预设
   * @returns {BudgetConfig}
   */
  static fromPreset(preset) {
    return {
      maxTokens: preset.maxTokenEstimate ?? 4000,
      typePriorities: DEFAULT_TYPE_PRIORITIES
    };
  }

  /**
   * 获取预算使用报告
   * @param {BudgetResult} result - 预算分配结果
   * @returns {string} 文本报告
   */
  getReport(result) {
    const lines = [
      `上下文预算报告:`,
      `  预算: ${result.totalTokens}/${result.budgetTokens} tokens (${(result.utilization * 100).toFixed(1)}%)`,
      `  保留段落: ${result.sections.length}`,
      `  裁剪段落: ${result.trimmed.length}`
    ];

    if (result.trimmed.length > 0) {
      lines.push('  裁剪详情:');
      for (const t of result.trimmed) {
        lines.push(`    - ${t.type}: ${t.originalTokens} tokens (${t.reason})`);
      }
    }

    return lines.join('\n');
  }
}

export default ContextBudgetManager;
