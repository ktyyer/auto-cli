import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { SkillIndexer } from '../src/skills/skill-indexer.js';

describe('SkillIndexer', () => {
  let tempDir;
  let indexer;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `skill-indexer-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    // 创建测试 Skill 文件
    await fs.writeFile(
      path.join(tempDir, 'test-skill.md'),
      `---
name: test-skill
description: A test skill for unit testing
tags: [test, unit, vitest]
---
# Test Skill
This is a test skill content.
`,
      'utf-8'
    );

    await fs.writeFile(
      path.join(tempDir, 'no-frontmatter.md'),
      `# No Frontmatter Skill
This skill has no frontmatter.
`,
      'utf-8'
    );

    // 创建目录型 Skill
    const subDir = path.join(tempDir, 'sub-skill');
    await fs.ensureDir(subDir);
    await fs.writeFile(
      path.join(subDir, 'SKILL.md'),
      `---
name: sub-skill
description: A directory-based skill
tags: [directory, nested]
---
# Sub Skill
Content in sub directory.
`,
      'utf-8'
    );

    indexer = new SkillIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('buildIndex', () => {
    it('should build index from skills directory', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      expect(result.totalSkills).toBe(3);
      expect(result.entries.length).toBe(3);
      expect(result.savingsPercent).toBeGreaterThanOrEqual(0);
    });

    it('should extract metadata from frontmatter', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      const testEntry = result.entries.find((e) => e.name === 'test-skill');
      expect(testEntry).toBeDefined();
      expect(testEntry.description).toBe('A test skill for unit testing');
      expect(testEntry.tags).toEqual(['test', 'unit', 'vitest']);
    });

    it('should handle files without frontmatter', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      const noFmEntry = result.entries.find((e) => e.relativePath === 'no-frontmatter.md');
      expect(noFmEntry).toBeDefined();
      expect(noFmEntry.description).toContain('No Frontmatter Skill');
    });

    it('should detect directory-based skills', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      const subEntry = result.entries.find((e) => e.name === 'sub-skill');
      expect(subEntry).toBeDefined();
      expect(subEntry.isDirectory).toBe(true);
      expect(subEntry.relativePath).toBe('sub-skill/SKILL.md');
    });

    it('should use cache when available', async () => {
      const first = await indexer.buildIndex();
      const second = await indexer.buildIndex();

      expect(first).toBe(second); // 同一引用（缓存命中）
    });

    it('should handle non-existent directory', async () => {
      const badIndexer = new SkillIndexer('/nonexistent/path');
      const result = await badIndexer.buildIndex();

      expect(result.totalSkills).toBe(0);
      expect(result.entries).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await indexer.buildIndex({ useCache: false });
    });

    it('should find skills by keyword', async () => {
      const results = await indexer.search(['test']);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name === 'test-skill')).toBe(true);
    });

    it('should find skills by tag', async () => {
      const results = await indexer.search(['directory']);

      expect(results.some((r) => r.name === 'sub-skill')).toBe(true);
    });

    it('should return empty for no matches', async () => {
      const results = await indexer.search(['xyznonexistent']);

      expect(results).toEqual([]);
    });

    it('should be case insensitive', async () => {
      const results = await indexer.search(['TEST']);

      expect(results.some((r) => r.name === 'test-skill')).toBe(true);
    });
  });

  describe('loadContent', () => {
    it('should load full skill content', async () => {
      const result = await indexer.loadContent('test-skill.md');

      expect(result).not.toBeNull();
      expect(result.content).toContain('Test Skill');
      expect(result.entry).toBeDefined();
      expect(result.entry.name).toBe('test-skill');
    });

    it('should return null for non-existent file', async () => {
      const result = await indexer.loadContent('nonexistent.md');

      expect(result).toBeNull();
    });
  });

  describe('getIndexSummary', () => {
    it('should generate human-readable summary', async () => {
      await indexer.buildIndex({ useCache: false });
      const summary = await indexer.getIndexSummary();

      expect(summary).toContain('Skills: 3');
      expect(summary).toContain('节省');
      expect(summary).toContain('test-skill');
    });
  });

  describe('clearCache', () => {
    it('should clear cache', async () => {
      await indexer.buildIndex();
      indexer.clearCache();

      // 再次构建应该不是缓存结果
      const result = await indexer.buildIndex({ useCache: false });
      expect(result.totalSkills).toBe(3);
    });
  });
});
