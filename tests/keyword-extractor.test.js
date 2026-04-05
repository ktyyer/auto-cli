import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  computeRelevance,
  SYNONYM_MAP,
  EN_STOPWORDS,
  ZH_STOPWORDS
} from '../src/router/keyword-extractor.js';

describe('keyword-extractor', () => {
  describe('extractKeywords', () => {
    it('should extract English keywords', () => {
      const keywords = extractKeywords('refactor authentication system');
      expect(keywords).toContain('refactor');
      expect(keywords).toContain('authentication');
    });

    it('should extract Chinese keywords with dictionary segmentation', () => {
      const keywords = extractKeywords('添加安全认证功能');
      expect(keywords).toContain('安全');
      expect(keywords).toContain('认证');
      expect(keywords).toContain('功能');
    });

    it('should filter English stopwords', () => {
      const keywords = extractKeywords('fix the bug in the system', { expandSynonyms: false });
      expect(keywords).not.toContain('the');
      expect(keywords).toContain('fix');
      expect(keywords).toContain('bug');
    });

    it('should filter Chinese stopwords', () => {
      const keywords = extractKeywords('修复这个问题的方法', { expandSynonyms: false });
      expect(keywords).not.toContain('这个');
      expect(keywords).toContain('修复');
    });

    it('should expand synonyms for "重构"', () => {
      const keywords = extractKeywords('重构代码');
      expect(keywords).toContain('refactor');
      expect(keywords).toContain('重构');
      expect(keywords).toContain('清理');
    });

    it('should expand synonyms for "fix"', () => {
      const keywords = extractKeywords('fix the build error');
      expect(keywords).toContain('fix');
      expect(keywords).toContain('修复');
      expect(keywords).toContain('debug');
    });

    it('should expand synonyms for "java"', () => {
      const keywords = extractKeywords('create java spring project');
      expect(keywords).toContain('java');
      expect(keywords).toContain('spring');
      expect(keywords).toContain('mybatis');
    });

    it('should return empty for null input', () => {
      expect(extractKeywords(null)).toEqual([]);
    });

    it('should return empty for empty string', () => {
      expect(extractKeywords('')).toEqual([]);
    });

    it('should skip synonym expansion when disabled', () => {
      const keywords = extractKeywords('重构代码', { expandSynonyms: false });
      expect(keywords).toContain('重构');
      expect(keywords).not.toContain('refactor');
    });

    it('should skip CJK segmentation when disabled', () => {
      const keywords = extractKeywords('添加安全认证', {
        includeCJKSegment: false,
        expandSynonyms: false
      });
      // Falls back to raw 2-char runs
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('should handle mixed Chinese and English', () => {
      const keywords = extractKeywords('修复React组件的TypeScript类型错误');
      expect(keywords).toContain('修复');
      expect(keywords).toContain('React');
      expect(keywords).toContain('TypeScript');
    });

    it('should deduplicate results', () => {
      const keywords = extractKeywords('test test test');
      const testCount = keywords.filter((k) => k === 'test').length;
      expect(testCount).toBe(1);
    });
  });

  describe('computeRelevance', () => {
    it('should return 0 for empty keywords', () => {
      expect(computeRelevance([], 'some text')).toBe(0);
    });

    it('should return 0 for empty search text', () => {
      expect(computeRelevance(['test'], '')).toBe(0);
    });

    it('should score exact match highest', () => {
      const score = computeRelevance(['test-skill'], 'test-skill');
      expect(score).toBeGreaterThanOrEqual(10);
    });

    it('should score prefix match higher than substring', () => {
      const prefixScore = computeRelevance(['test'], 'test-skill');
      const substringScore = computeRelevance(['skill'], 'test-skill');
      expect(prefixScore).toBeGreaterThan(substringScore);
    });

    it('should accumulate scores for multiple matches', () => {
      const score = computeRelevance(['test', 'skill'], 'test-skill');
      expect(score).toBeGreaterThan(computeRelevance(['test'], 'test-skill'));
    });
  });

  describe('SYNONYM_MAP', () => {
    it('should have entries for common tech terms', () => {
      expect(SYNONYM_MAP['java']).toBeDefined();
      expect(SYNONYM_MAP['fix']).toBeDefined();
      expect(SYNONYM_MAP['重构']).toBeDefined();
      expect(SYNONYM_MAP['测试']).toBeDefined();
      expect(SYNONYM_MAP['安全']).toBeDefined();
    });

    it('should have non-empty synonym arrays', () => {
      for (const [, synonyms] of Object.entries(SYNONYM_MAP)) {
        expect(Array.isArray(synonyms)).toBe(true);
        expect(synonyms.length).toBeGreaterThan(0);
      }
    });
  });

  describe('EN_STOPWORDS', () => {
    it('should contain common English stopwords', () => {
      expect(EN_STOPWORDS.has('the')).toBe(true);
      expect(EN_STOPWORDS.has('is')).toBe(true);
      expect(EN_STOPWORDS.has('and')).toBe(true);
    });
  });

  describe('ZH_STOPWORDS', () => {
    it('should contain common Chinese stopwords', () => {
      expect(ZH_STOPWORDS.has('的')).toBe(true);
      expect(ZH_STOPWORDS.has('了')).toBe(true);
      expect(ZH_STOPWORDS.has('是')).toBe(true);
    });
  });
});
