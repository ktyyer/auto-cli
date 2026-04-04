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

  describe('_computeFileHashes', () => {
    it('should compute hashes for all skill files', async () => {
      const hashes = await indexer._computeFileHashes();

      expect(hashes.length).toBe(3); // test-skill, no-frontmatter, sub-skill/SKILL.md
      for (const entry of hashes) {
        expect(entry.relativePath).toBeDefined();
        expect(entry.hash).toBeDefined();
        expect(entry.mtime).toBeGreaterThan(0);
      }
    });

    it('should produce consistent hashes', async () => {
      const hashes1 = await indexer._computeFileHashes();
      const hashes2 = await indexer._computeFileHashes();

      // Same file content = same hash
      for (const h1 of hashes1) {
        const h2 = hashes2.find((e) => e.relativePath === h1.relativePath);
        expect(h2).toBeDefined();
        expect(h2.hash).toBe(h1.hash);
      }
    });

    it('should detect file content change', async () => {
      const originalHashes = await indexer._computeFileHashes();

      // Modify a file
      await fs.writeFile(
        path.join(tempDir, 'test-skill.md'),
        '---\nname: test-skill\n---\n# Modified Content\n',
        'utf-8'
      );

      const newHashes = await indexer._computeFileHashes();

      const originalTestHash = originalHashes.find((h) => h.relativePath === 'test-skill.md');
      const newTestHash = newHashes.find((h) => h.relativePath === 'test-skill.md');

      expect(originalTestHash.hash).not.toBe(newTestHash.hash);
    });

    it('should detect file count change', async () => {
      const originalHashes = await indexer._computeFileHashes();
      expect(originalHashes.length).toBe(3);

      // Add a new file
      await fs.writeFile(
        path.join(tempDir, 'new-skill.md'),
        '---\nname: new\n---\n# New\n',
        'utf-8'
      );

      const newHashes = await indexer._computeFileHashes();
      expect(newHashes.length).toBe(4);
    });

    it('should return empty for non-existent directory', async () => {
      const badIndexer = new SkillIndexer('/nonexistent/path');
      const hashes = await badIndexer._computeFileHashes();
      expect(hashes).toEqual([]);
    });
  });

  describe('_hashesEqual', () => {
    it('should return true for identical hashes', () => {
      const hashes = [
        { relativePath: 'a.md', hash: 'abc123' },
        { relativePath: 'b.md', hash: 'def456' }
      ];

      expect(indexer._hashesEqual(hashes, hashes)).toBe(true);
    });

    it('should return false for different count', () => {
      const a = [{ relativePath: 'a.md', hash: 'abc' }];
      const b = [
        { relativePath: 'a.md', hash: 'abc' },
        { relativePath: 'b.md', hash: 'def' }
      ];

      expect(indexer._hashesEqual(a, b)).toBe(false);
    });

    it('should return false for different hash values', () => {
      const a = [{ relativePath: 'a.md', hash: 'abc' }];
      const b = [{ relativePath: 'a.md', hash: 'xyz' }];

      expect(indexer._hashesEqual(a, b)).toBe(false);
    });

    it('should return false for missing file', () => {
      const a = [{ relativePath: 'a.md', hash: 'abc' }];
      const b = [{ relativePath: 'b.md', hash: 'abc' }];

      expect(indexer._hashesEqual(a, b)).toBe(false);
    });

    it('should return true for empty arrays', () => {
      expect(indexer._hashesEqual([], [])).toBe(true);
    });
  });

  describe('cache invalidation on file change', () => {
    it('should invalidate cache when file content changes', async () => {
      // First build
      const first = await indexer.buildIndex({ useCache: false });
      expect(first.file_hashes).toBeDefined();
      expect(first.file_hashes.files.length).toBe(3);

      // Build again - should use cache
      const cached = await indexer.buildIndex();
      expect(cached).toBe(first); // Same reference = cache hit

      // Modify a file
      await fs.writeFile(
        path.join(tempDir, 'test-skill.md'),
        '---\nname: changed\n---\n# Changed\n',
        'utf-8'
      );

      // Build again - cache should be invalidated
      const rebuilt = await indexer.buildIndex();
      expect(rebuilt).not.toBe(first); // Different reference = cache miss
      expect(rebuilt.entries.find((e) => e.name === 'changed')).toBeDefined();
    });

    it('should include file_hashes in index result', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      expect(result.file_hashes).toBeDefined();
      expect(result.file_hashes.head_hash).toBeDefined();
      expect(result.file_hashes.created_at).toBeGreaterThan(0);
      expect(result.file_hashes.files.length).toBe(3);
    });
  });
});
