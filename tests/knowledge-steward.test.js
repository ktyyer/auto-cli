import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { KnowledgeSteward } from '../src/knowledge/knowledge-steward.js';
import { CATEGORIES, classifyContent, getCategoryByName } from '../src/knowledge/categories.js';

describe('categories', () => {
  describe('CATEGORIES', () => {
    it('should define 4 categories', () => {
      expect(CATEGORIES).toHaveLength(4);
    });

    it('should have required fields for each category', () => {
      for (const cat of CATEGORIES) {
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('file');
        expect(cat).toHaveProperty('keywords');
        expect(cat).toHaveProperty('description');
        expect(cat.file).toMatch(/\.md$/);
        expect(Array.isArray(cat.keywords)).toBe(true);
        expect(cat.keywords.length).toBeGreaterThan(0);
      }
    });

    it('should have unique names and files', () => {
      const names = CATEGORIES.map((c) => c.name);
      const files = CATEGORIES.map((c) => c.file);
      expect(new Set(names).size).toBe(names.length);
      expect(new Set(files).size).toBe(files.length);
    });
  });

  describe('classifyContent', () => {
    it('should classify prompt-related content', () => {
      const result = classifyContent('这个 prompt 模板非常有效');
      expect(result.name).toBe('prompt');
    });

    it('should classify trap-related content', () => {
      const result = classifyContent('踩坑：async await 没加 try-catch');
      expect(result.name).toBe('trap');
    });

    it('should classify pattern-related content', () => {
      const result = classifyContent('使用了观察者模式来解耦模块');
      expect(result.name).toBe('pattern');
    });

    it('should classify decision-related content', () => {
      const result = classifyContent('技术选型：为什么选择 Vitest 而不是 Jest');
      expect(result.name).toBe('decision');
    });

    it('should respect explicit category hint', () => {
      const result = classifyContent('随便什么内容', 'prompt');
      expect(result.name).toBe('prompt');
    });

    it('should respect category hint by file name', () => {
      const result = classifyContent('随便什么内容', 'traps.md');
      expect(result.name).toBe('trap');
    });

    it('should default to decision when no keywords match', () => {
      const result = classifyContent('hello world xyz abc');
      expect(result.name).toBe('decision');
    });
  });

  describe('getCategoryByName', () => {
    it('should return category by name', () => {
      const cat = getCategoryByName('prompt');
      expect(cat).toBeDefined();
      expect(cat.file).toBe('prompts.md');
    });

    it('should return category by file name', () => {
      const cat = getCategoryByName('traps.md');
      expect(cat).toBeDefined();
      expect(cat.name).toBe('trap');
    });

    it('should return undefined for unknown name', () => {
      const cat = getCategoryByName('nonexistent');
      expect(cat).toBeUndefined();
    });
  });
});

describe('KnowledgeSteward', () => {
  let tempDir;
  let steward;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `knowledge-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    steward = new KnowledgeSteward(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('ensureStructure', () => {
    it('should create insights directory with all category files', async () => {
      const dir = await steward.ensureStructure();

      expect(dir).toBe(path.join(tempDir, '.auto', 'insights'));
      for (const cat of CATEGORIES) {
        const filePath = path.join(dir, cat.file);
        const exists = await fs.pathExists(filePath);
        expect(exists).toBe(true);
      }
    });

    it('should not overwrite existing files', async () => {
      await steward.ensureStructure();
      const filePath = path.join(tempDir, '.auto', 'insights', 'prompts.md');
      await fs.appendFile(filePath, 'existing content', 'utf-8');

      await steward.ensureStructure();
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('existing content');
    });
  });

  describe('save', () => {
    it('should save content and create file structure', async () => {
      const result = await steward.save({
        content: '这个 prompt 模板让输出质量翻倍',
        gitCommit: false
      });

      expect(result.success).toBe(true);
      expect(result.categoryName).toBe('prompt');
      expect(result.filePath).toMatch(/prompts\.md$/);

      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('这个 prompt 模板让输出质量翻倍');
    });

    it('should reject empty content', async () => {
      const result = await steward.save({
        content: '',
        gitCommit: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('不能为空');
    });

    it('should save with explicit category', async () => {
      const result = await steward.save({
        content: '一些普通文本',
        category: 'trap',
        gitCommit: false
      });

      expect(result.success).toBe(true);
      expect(result.categoryName).toBe('trap');
      expect(result.filePath).toMatch(/traps\.md$/);
    });

    it('should save with tags', async () => {
      const result = await steward.save({
        content: 'React Hooks 的踩坑经验',
        tags: ['react', 'hooks', 'performance'],
        gitCommit: false
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toContain('react, hooks, performance');
    });

    it('should append multiple entries to same file', async () => {
      await steward.save({
        content: '第一个 prompt 模板',
        gitCommit: false
      });
      await steward.save({
        content: '第二个 prompt 模板',
        gitCommit: false
      });

      const filePath = path.join(tempDir, '.auto', 'insights', 'prompts.md');
      const content = await fs.readFile(filePath, 'utf-8');
      const entryCount = (content.match(/^### /gm) || []).length;
      expect(entryCount).toBe(2);
    });

    it('should include date in entry', async () => {
      const result = await steward.save({
        content: '测试日期格式',
        gitCommit: false
      });

      const content = await fs.readFile(result.filePath, 'utf-8');
      const today = new Date().toISOString().slice(0, 10);
      expect(content).toContain(today);
    });
  });

  describe('list', () => {
    it('should return stats for all categories', async () => {
      await steward.save({
        content: '第一个 prompt',
        gitCommit: false
      });
      await steward.save({
        content: '第二个 prompt',
        gitCommit: false
      });
      await steward.save({
        content: '一个踩坑 bug',
        gitCommit: false
      });

      const stats = await steward.list();

      expect(stats).toHaveLength(4);
      const promptStats = stats.find((s) => s.category === 'prompt');
      expect(promptStats.count).toBe(2);

      const trapStats = stats.find((s) => s.category === 'trap');
      expect(trapStats.count).toBe(1);
    });

    it('should return zero counts for empty files', async () => {
      const stats = await steward.list();

      for (const stat of stats) {
        expect(stat.count).toBe(0);
      }
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await steward.save({
        content: 'React useEffect 清理函数的坑',
        gitCommit: false
      });
      await steward.save({
        content: '这个 prompt 让 AI 生成更好的代码',
        gitCommit: false
      });
    });

    it('should find entries by keyword', async () => {
      const results = await steward.search('react');

      expect(results.length).toBeGreaterThan(0);
      const trapResult = results.find((r) => r.category === 'trap');
      expect(trapResult).toBeDefined();
      expect(trapResult.matches.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', async () => {
      const results = await steward.search('zzzznonexistent');

      expect(results).toHaveLength(0);
    });

    it('should be case insensitive', async () => {
      const results = await steward.search('PROMPT');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect limit option', async () => {
      for (let i = 0; i < 5; i++) {
        await steward.save({
          content: `React hook 使用模式 ${i}`,
          gitCommit: false
        });
      }

      const results = await steward.search('react', { limit: 2 });
      // limit 是每分类上限
      for (const item of results) {
        expect(item.matches.length).toBeLessThanOrEqual(2);
      }
    });

    it('should not filter when maxAgeDays is 0', async () => {
      const normalResults = await steward.search('react');
      const allResults = await steward.search('react', { maxAgeDays: 0 });
      expect(allResults.length).toBeGreaterThanOrEqual(normalResults.length);
    });

    it('should include file field in search results', async () => {
      const results = await steward.search('react');
      for (const item of results) {
        expect(item).toHaveProperty('file');
        expect(item.file).toMatch(/\.md$/);
      }
    });
  });

  describe('feedback', () => {
    it('should record feedback and compute quality score', async () => {
      await steward.recordFeedback({ source: 'skill', key: 'test-skill', successful: true });
      await steward.recordFeedback({ source: 'skill', key: 'test-skill', successful: true });
      await steward.recordFeedback({ source: 'skill', key: 'test-skill', successful: false });

      const score = await steward.getQualityScore('skill', 'test-skill');
      expect(score).toBeCloseTo(2 / 3, 1);
    });

    it('should return 0.5 for unknown entries', async () => {
      const score = await steward.getQualityScore('skill', 'nonexistent');
      expect(score).toBe(0.5);
    });

    it('should detect low quality entries', async () => {
      // Record enough hits with low success rate
      for (let i = 0; i < 4; i++) {
        await steward.recordFeedback({ source: 'skill', key: 'bad-skill', successful: false });
      }
      await steward.recordFeedback({ source: 'skill', key: 'bad-skill', successful: true });

      const lowQuality = await steward.getLowQualityEntries(0.3, 3);
      expect(lowQuality.length).toBeGreaterThan(0);
      expect(lowQuality[0].key).toBe('bad-skill');
      expect(lowQuality[0].score).toBeLessThan(0.3);
    });

    it('should not flag entries with too few hits', async () => {
      await steward.recordFeedback({ source: 'skill', key: 'new-skill', successful: false });

      const lowQuality = await steward.getLowQualityEntries(0.3, 3);
      expect(lowQuality.find((e) => e.key === 'new-skill')).toBeUndefined();
    });

    it('should ignore feedback without source or key', async () => {
      await steward.recordFeedback({ source: '', key: '', successful: true });
      // Should not throw
    });
  });
});
