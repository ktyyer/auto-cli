import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import {
  getClaudeDir,
  getAutoDir,
  getCustomDir,
  getVersionFilePath,
  getInstalledVersion,
  saveInstalledVersion,
  getPackageVersion,
  COMPONENTS,
  compressContext,
  CONTEXT_COMPRESSION
} from '../src/utils.js';

describe('utils.js', () => {
  describe('getClaudeDir', () => {
    it('should return path to .claude directory in home folder', () => {
      const result = getClaudeDir();
      const expected = path.join(os.homedir(), '.claude');
      expect(result).toBe(expected);
    });
  });

  describe('getAutoDir', () => {
    it('should return path to auto directory inside .claude', () => {
      const result = getAutoDir();
      const expected = path.join(os.homedir(), '.claude', 'auto');
      expect(result).toBe(expected);
    });
  });

  describe('getCustomDir', () => {
    it('should return path to custom directory inside .claude', () => {
      const result = getCustomDir();
      const expected = path.join(os.homedir(), '.claude', 'custom');
      expect(result).toBe(expected);
    });
  });

  describe('getVersionFilePath', () => {
    it('should return path to .auto-version file', () => {
      const result = getVersionFilePath();
      const expected = path.join(os.homedir(), '.claude', '.auto-version');
      expect(result).toBe(expected);
    });
  });

  describe('getPackageVersion', () => {
    it('should return version string from package.json', () => {
      const result = getPackageVersion();
      const expectedVersion = fs.readJsonSync(path.join(process.cwd(), 'package.json')).version;
      expect(result).toBe(expectedVersion);
    });
  });

  describe('COMPONENTS', () => {
    it('should have agents component with correct structure', () => {
      expect(COMPONENTS.agents).toMatchObject({
        name: 'Agents（代理）',
        source: 'agents',
        target: 'agents',
        pattern: '*.md'
      });
    });

    it('should have rules component with correct structure', () => {
      expect(COMPONENTS.rules).toMatchObject({
        name: 'Rules（规则）',
        source: 'rules',
        target: 'rules',
        pattern: '*.md'
      });
    });

    it('should have commands component with correct structure', () => {
      expect(COMPONENTS.commands).toMatchObject({
        name: 'auto 斜杠指令',
        source: 'commands',
        target: 'commands/auto',
        pattern: '*.md'
      });
    });

    it('should have skills component with correct structure', () => {
      expect(COMPONENTS.skills).toMatchObject({
        name: 'Skills（技能）',
        source: 'skills',
        target: 'skills',
        pattern: '**/*',
        recursive: true
      });
    });

    it('should have hooks component with correct structure', () => {
      expect(COMPONENTS.hooks).toMatchObject({
        name: 'Hooks（自动化门禁）',
        source: 'hooks',
        target: 'hooks',
        pattern: '*.json'
      });
    });

    it('should have exactly 5 components', () => {
      expect(Object.keys(COMPONENTS)).toHaveLength(5);
    });
  });

  describe('getInstalledVersion', () => {
    const testVersionFile = path.join(os.tmpdir(), '.auto-test-version');

    beforeEach(async () => {
      // Mock getVersionFilePath temporarily
      vi.spyOn(fs, 'pathExists').mockImplementation(async (p) => {
        if (p.includes('.auto-version')) {
          return fs.pathExists(testVersionFile);
        }
        return fs.pathExists(p);
      });
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      await fs.remove(testVersionFile);
    });

    it('should return null if version file does not exist', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);
      const result = await getInstalledVersion();
      expect(result).toBeNull();
    });

    it('should return version info if file exists', async () => {
      const versionInfo = {
        version: '1.0.0',
        components: ['agents', 'rules'],
        installedAt: '2024-01-01T00:00:00.000Z'
      };

      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);
      vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(versionInfo));

      const result = await getInstalledVersion();
      expect(result).toEqual(versionInfo);
    });

    it('should return null on parse error', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);
      vi.spyOn(fs, 'readFile').mockResolvedValue('invalid json');

      const result = await getInstalledVersion();
      expect(result).toBeNull();
    });
  });

  describe('saveInstalledVersion', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should save version info to file', async () => {
      const writeJsonMock = vi.spyOn(fs, 'writeJson').mockResolvedValue();

      await saveInstalledVersion('1.0.0', ['agents', 'rules']);

      expect(writeJsonMock).toHaveBeenCalledWith(
        expect.stringContaining('.auto-version'),
        expect.objectContaining({
          version: '1.0.0',
          components: ['agents', 'rules'],
          installedFiles: [],
          installedAt: expect.any(String)
        }),
        { spaces: 2 }
      );
    });

    it('should save installed files list for precise uninstall', async () => {
      const writeJsonMock = vi.spyOn(fs, 'writeJson').mockResolvedValue();

      const installedFiles = [
        '/Users/test/.claude/skills/test-skill.md',
        '/Users/test/.claude/agents/test-agent.md'
      ];

      await saveInstalledVersion('1.0.0', ['skills', 'agents'], installedFiles);

      expect(writeJsonMock).toHaveBeenCalledWith(
        expect.stringContaining('.auto-version'),
        expect.objectContaining({
          version: '1.0.0',
          components: ['skills', 'agents'],
          installedFiles: installedFiles,
          installedAt: expect.any(String)
        }),
        { spaces: 2 }
      );
    });
  });

  describe('compressContext', () => {
    it('should not compress when below threshold', () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`
      }));

      const result = compressContext(messages);

      expect(result.compressed).toBe(false);
      expect(result.keptCount).toBe(10);
      expect(result.removedCount).toBe(0);
      expect(result.summary).toBe('');
    });

    it('should compress when above threshold', () => {
      const messages = Array.from({ length: 40 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}: regular content here`
      }));

      const result = compressContext(messages, { threshold: 30, maxEntries: 10 });

      expect(result.compressed).toBe(true);
      expect(result.keptCount).toBeLessThanOrEqual(10);
      expect(result.removedCount).toBeGreaterThan(0);
      expect(result.summary).toContain('上下文压缩');
    });

    it('should prioritize messages with key indicators', () => {
      const messages = [
        { role: 'user', content: 'Regular message 1' },
        {
          role: 'user',
          content: 'IMPORTANT: This is a key decision about architecture'
        },
        { role: 'assistant', content: 'Regular response' },
        ...Array.from({ length: 35 }, (_, i) => ({
          role: 'user',
          content: `Filler message ${i}`
        }))
      ];

      const result = compressContext(messages, { threshold: 30, maxEntries: 10 });

      expect(result.compressed).toBe(true);
      // 关键信息应被保留
      const keptContents = (result.keptMessages || []).map((m) => m.content);
      expect(keptContents.some((c) => c.includes('IMPORTANT'))).toBe(true);
    });

    it('should keep recent messages', () => {
      const messages = Array.from({ length: 40 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`
      }));

      const result = compressContext(messages, { threshold: 30, maxEntries: 10 });

      expect(result.compressed).toBe(true);
      const keptContents = (result.keptMessages || []).map((m) => m.content);
      // 最后 10 条应该被保留
      expect(keptContents.some((c) => c.includes('Message 39'))).toBe(true);
    });

    it('should handle empty messages', () => {
      const result = compressContext([]);

      expect(result.compressed).toBe(false);
      expect(result.keptCount).toBe(0);
      expect(result.removedCount).toBe(0);
    });

    it('should handle null/undefined input', () => {
      const result = compressContext(null);

      expect(result.compressed).toBe(false);
      expect(result.keptCount).toBe(0);
    });

    it('should deduplicate messages', () => {
      const duplicateContent = 'Duplicate message content here';
      const messages = Array.from({ length: 35 }, () => ({
        role: 'user',
        content: duplicateContent
      }));

      const result = compressContext(messages, { threshold: 30, maxEntries: 10 });

      expect(result.compressed).toBe(true);
      // 去重后应该只有 1 条
      expect(result.keptCount).toBe(1);
    });

    it('should use default threshold from config', () => {
      expect(CONTEXT_COMPRESSION.MESSAGE_THRESHOLD).toBe(30);
      expect(CONTEXT_COMPRESSION.MAX_COMPRESSED_ENTRIES).toBe(10);
      expect(CONTEXT_COMPRESSION.KEY_INDICATORS.length).toBeGreaterThan(0);
    });
  });
});
