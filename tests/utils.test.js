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
  DEFAULT_PORT
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
    it('should return path to aimax directory inside .claude', () => {
      const result = getAutoDir();
      const expected = path.join(os.homedir(), '.claude', 'aimax');
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
    it('should return path to .aimax-version file', () => {
      const result = getVersionFilePath();
      const expected = path.join(os.homedir(), '.claude', '.aimax-version');
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
        name: 'aimax 斜杠指令',
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

    it('should have plugins component with correct structure', () => {
      expect(COMPONENTS.plugins).toMatchObject({
        name: 'Plugins（插件）',
        source: 'plugins',
        target: 'plugins',
        pattern: '**/*',
        recursive: true
      });
    });

    it('should have templates component with correct structure', () => {
      expect(COMPONENTS.templates).toMatchObject({
        name: 'Templates（模板）',
        source: 'templates',
        target: 'templates',
        pattern: '**/*',
        recursive: true
      });
    });

    it('should have lib component with correct structure', () => {
      expect(COMPONENTS.lib).toMatchObject({
        name: 'Lib（核心库）',
        source: 'lib',
        target: 'lib',
        pattern: '**/*',
        recursive: true
      });
    });

    it('should have exactly 7 components', () => {
      expect(Object.keys(COMPONENTS)).toHaveLength(7);
    });
  });

  describe('DEFAULT_PORT', () => {
    it('should be 8099', () => {
      expect(DEFAULT_PORT).toBe(8099);
    });
  });

  describe('getInstalledVersion', () => {
    const testVersionFile = path.join(os.tmpdir(), '.aimax-test-version');

    beforeEach(async () => {
      // Mock getVersionFilePath temporarily
      vi.spyOn(fs, 'pathExists').mockImplementation(async (p) => {
        if (p.includes('.aimax-version')) {
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
        expect.stringContaining('.aimax-version'),
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
        expect.stringContaining('.aimax-version'),
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
});
