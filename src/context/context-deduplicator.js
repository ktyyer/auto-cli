/**
 * 上下文去重引擎
 *
 * 核心功能：
 * - 基于内容哈希检测重复的上下文片段
 * - 跨策略类型的去重（同一内容被多个策略收集）
 * - 相似度检测（内容高度重叠的片段合并）
 * - 提供 dedup 报告统计去重效果
 */

import crypto from 'node:crypto';
import { logger } from '../logger.js';

/**
 * @typedef {Object} DedupResult
 * @property {Array<DedupSection>} sections - 去重后的上下文段落
 * @property {number} originalCount - 原始段落数量
 * @property {number} dedupedCount - 去重后段落数量
 * @property {number} savedTokens - 节省的 Token 估算
 * @property {Array<DedupReport>} report - 去重报告
 */

/**
 * @typedef {Object} DedupSection
 * @property {string} type - 策略类型
 * @property {string} content - 内容
 * @property {boolean} required - 是否必需
 * @property {string} [filePath] - 文件路径（type='file' 时）
 * @property {string[]} mergedFrom - 合并来源的类型列表
 */

/**
 * @typedef {Object} DedupReport
 * @property {string} kept - 保留的段落类型
 * @property {string[]} duplicates - 被去重的段落类型列表
 * @property {string} reason - 去重原因
 */

/**
 * 上下文去重引擎类
 */
export class ContextDeduplicator {
  /**
   * @param {Object} [options] - 配置选项
   * @param {number} [options.similarityThreshold=0.85] - 相似度阈值（0-1）
   * @param {boolean} [options.enableSimilarityCheck=false] - 是否启用相似度检测（计算量较大）
   */
  constructor(options = {}) {
    this.similarityThreshold = options.similarityThreshold ?? 0.85;
    this.enableSimilarityCheck = options.enableSimilarityCheck ?? false;
  }

  /**
   * 对上下文段落执行去重
   * @param {Array<{type: string, content: string, required: boolean, filePath?: string}>} sections
   * @returns {DedupResult}
   */
  dedup(sections) {
    if (!sections || sections.length === 0) {
      return {
        sections: [],
        originalCount: 0,
        dedupedCount: 0,
        savedTokens: 0,
        report: []
      };
    }

    const originalCount = sections.length;
    const report = [];
    const seen = new Map(); // contentHash -> index in result
    const result = [];

    // 第一轮：精确去重（基于内容哈希）
    for (const section of sections) {
      if (!section.content) {
        // 无内容的段落直接保留（可能是占位符）
        result.push({
          ...section,
          mergedFrom: [section.type]
        });
        continue;
      }

      const hash = this._computeHash(section.content);

      if (seen.has(hash)) {
        // 精确重复：合并到已有段落
        const existingIndex = seen.get(hash);
        const existing = result[existingIndex];

        if (!existing.mergedFrom.includes(section.type)) {
          existing.mergedFrom.push(section.type);
        }

        // 记录报告
        report.push({
          kept: existing.type,
          duplicates: [section.type],
          reason: 'exact_hash_match'
        });

        logger.debug(`去重: ${section.type} 与 ${existing.type} 内容完全相同`);
      } else {
        seen.set(hash, result.length);
        result.push({
          ...section,
          mergedFrom: [section.type]
        });
      }
    }

    // 第二轮：相似度去重（可选，计算量较大）
    if (this.enableSimilarityCheck && result.length > 1) {
      this._similarityDedup(result, report);
    }

    // 计算节省的 Token
    const savedTokens = this._estimateSavedTokens(sections, result);

    return {
      sections: result,
      originalCount,
      dedupedCount: result.length,
      savedTokens,
      report
    };
  }

  /**
   * 计算内容哈希
   * @param {string} content - 内容字符串
   * @returns {string} SHA-256 哈希值（前 16 位）
   * @private
   */
  _computeHash(content) {
    // 标准化内容：去除空白差异
    const normalized = content.trim().replace(/\s+/g, ' ').toLowerCase();

    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  /**
   * 基于相似度的去重
   * @param {Array<DedupSection>} result - 当前结果数组（会被就地修改）
   * @param {Array<DedupReport>} report - 报告数组（会被追加）
   * @private
   */
  _similarityDedup(result, report) {
    const toRemove = new Set();

    for (let i = 0; i < result.length; i++) {
      if (toRemove.has(i)) continue;

      for (let j = i + 1; j < result.length; j++) {
        if (toRemove.has(j)) continue;

        const similarity = this._computeSimilarity(result[i].content, result[j].content);

        if (similarity >= this.similarityThreshold) {
          // 保留 required=true 的那个，或者保留第一个
          const keepIndex = result[j].required && !result[i].required ? j : i;
          const removeIndex = keepIndex === i ? j : i;

          result[keepIndex].mergedFrom.push(...result[removeIndex].mergedFrom);

          report.push({
            kept: result[keepIndex].type,
            duplicates: [result[removeIndex].type],
            reason: `similarity_${(similarity * 100).toFixed(0)}%`
          });

          toRemove.add(removeIndex);
          logger.debug(
            `相似去重: ${result[removeIndex].type} 与 ${result[keepIndex].type} 相似度 ${similarity}`
          );
        }
      }
    }

    // 从后往前删除，避免索引偏移
    const sortedIndices = Array.from(toRemove).sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      result.splice(idx, 1);
    }
  }

  /**
   * 计算两个字符串的相似度（基于 Jaccard 系数）
   * @param {string} a - 字符串 A
   * @param {string} b - 字符串 B
   * @returns {number} 相似度 0-1
   * @private
   */
  _computeSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;

    // 使用 word-level shingles
    const shinglesA = this._toShingles(a, 3);
    const shinglesB = this._toShingles(b, 3);

    if (shinglesA.size === 0 && shinglesB.size === 0) return 1;
    if (shinglesA.size === 0 || shinglesB.size === 0) return 0;

    let intersection = 0;
    for (const s of shinglesA) {
      if (shinglesB.has(s)) intersection++;
    }

    const union = shinglesA.size + shinglesB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * 将字符串转换为 shingle 集合
   * @param {string} text - 文本
   * @param {number} size - shingle 大小（词数）
   * @returns {Set<string>}
   * @private
   */
  _toShingles(text, size) {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const shingles = new Set();

    for (let i = 0; i <= words.length - size; i++) {
      shingles.add(words.slice(i, i + size).join(' '));
    }

    return shingles;
  }

  /**
   * 估算去重节省的 Token 数量
   * @param {Array} original - 原始段落
   * @param {Array} deduped - 去重后段落
   * @returns {number}
   * @private
   */
  _estimateSavedTokens(original, deduped) {
    const originalChars = original.reduce((sum, s) => sum + (s.content ? s.content.length : 0), 0);
    const dedupedChars = deduped.reduce((sum, s) => sum + (s.content ? s.content.length : 0), 0);
    return Math.ceil((originalChars - dedupedChars) / 4);
  }

  /**
   * 获取去重统计信息
   * @param {DedupResult} result - 去重结果
   * @returns {Object} 统计信息
   */
  getStats(result) {
    return {
      originalCount: result.originalCount,
      dedupedCount: result.dedupedCount,
      duplicateRate:
        result.originalCount > 0
          ? (((result.originalCount - result.dedupedCount) / result.originalCount) * 100).toFixed(
              1
            ) + '%'
          : '0%',
      savedTokens: result.savedTokens,
      reportCount: result.report.length
    };
  }
}

export default ContextDeduplicator;
