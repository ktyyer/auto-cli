/**
 * ContextDeduplicator 模块单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextDeduplicator } from '../src/context/context-deduplicator.js';

describe('ContextDeduplicator', () => {
  let deduplicator;

  beforeEach(() => {
    deduplicator = new ContextDeduplicator();
  });

  describe('基础功能', () => {
    it('应该处理空输入', () => {
      const result = deduplicator.dedup([]);

      expect(result.sections).toHaveLength(0);
      expect(result.originalCount).toBe(0);
      expect(result.dedupedCount).toBe(0);
      expect(result.savedTokens).toBe(0);
    });

    it('应该处理 null 输入', () => {
      const result = deduplicator.dedup(null);

      expect(result.sections).toHaveLength(0);
      expect(result.originalCount).toBe(0);
    });

    it('应该保留无重复的段落', () => {
      const sections = [
        { type: 'claude-md', content: 'Project rules', required: true },
        { type: 'repo-map', content: 'Source map info', required: false },
        { type: 'insights', content: 'Pattern insights', required: false }
      ];

      const result = deduplicator.dedup(sections);

      expect(result.dedupedCount).toBe(3);
      expect(result.savedTokens).toBe(0);
      expect(result.report).toHaveLength(0);
    });

    it('应该去除完全相同的内容', () => {
      const duplicateContent = 'This is the same content for testing dedup';
      const sections = [
        { type: 'claude-md', content: duplicateContent, required: true },
        { type: 'session-knowledge', content: duplicateContent, required: false }
      ];

      const result = deduplicator.dedup(sections);

      expect(result.dedupedCount).toBe(1);
      expect(result.savedTokens).toBeGreaterThan(0);
      expect(result.report).toHaveLength(1);
      expect(result.report[0].reason).toBe('exact_hash_match');
      expect(result.report[0].kept).toBe('claude-md');
      expect(result.report[0].duplicates).toContain('session-knowledge');
    });

    it('应该保留合并来源信息', () => {
      const duplicateContent = 'Shared content';
      const sections = [
        { type: 'a', content: duplicateContent, required: true },
        { type: 'b', content: duplicateContent, required: false }
      ];

      const result = deduplicator.dedup(sections);

      expect(result.sections[0].mergedFrom).toContain('a');
      expect(result.sections[0].mergedFrom).toContain('b');
    });
  });

  describe('多段去重', () => {
    it('应该处理多个重复对', () => {
      const sections = [
        { type: 'a', content: 'Content A', required: true },
        { type: 'b', content: 'Content B', required: false },
        { type: 'c', content: 'Content A', required: false },
        { type: 'd', content: 'Content B', required: false }
      ];

      const result = deduplicator.dedup(sections);

      expect(result.dedupedCount).toBe(2);
      expect(result.report).toHaveLength(2);
    });

    it('应该处理空内容的段落', () => {
      const sections = [
        { type: 'a', content: '', required: true },
        { type: 'b', content: 'Real content', required: false }
      ];

      const result = deduplicator.dedup(sections);

      // 空内容也应该被保留
      expect(result.dedupedCount).toBe(2);
    });
  });

  describe('相似度检测', () => {
    it('应该在启用时检测高相似度内容', () => {
      const simDedup = new ContextDeduplicator({
        enableSimilarityCheck: true,
        similarityThreshold: 0.6
      });

      const sections = [
        {
          type: 'a',
          content:
            'The project uses ES Modules for all source files and follows strict module boundaries',
          required: true
        },
        {
          type: 'b',
          content:
            'The project uses ES Modules for all source files and follows strict module boundaries with additional rules',
          required: false
        }
      ];

      const result = simDedup.dedup(sections);

      // 相似度足够高时应该去重
      expect(result.dedupedCount).toBeLessThanOrEqual(2);
    });

    it('不应该在禁用时执行相似度检测', () => {
      const noSimDedup = new ContextDeduplicator({
        enableSimilarityCheck: false
      });

      const sections = [
        {
          type: 'a',
          content: 'Very similar content about the project structure',
          required: true
        },
        {
          type: 'b',
          content: 'Very similar content about the project structure and more',
          required: false
        }
      ];

      const result = noSimDedup.dedup(sections);

      // 禁用相似度检测时，不同内容不应被去重
      expect(result.dedupedCount).toBe(2);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      const sections = [
        { type: 'a', content: 'Content A', required: true },
        { type: 'b', content: 'Content A', required: false }
      ];

      const result = deduplicator.dedup(sections);
      const stats = deduplicator.getStats(result);

      expect(stats.originalCount).toBe(2);
      expect(stats.dedupedCount).toBe(1);
      expect(stats.duplicateRate).toBe('50.0%');
      expect(stats.savedTokens).toBeGreaterThan(0);
    });
  });
});
