import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { install, uninstall, checkStatus } from '../src/installer.js';

// Test directories
const testDir = path.join(os.tmpdir(), 'auto-test-' + Date.now());
const testClaudeDir = path.join(testDir, '.claude');
const testSourceDir = path.join(testDir, 'source');

// Mock ora spinner
vi.mock('ora', () => {
  return {
    default: () => ({
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      text: ''
    })
  };
});

// Mock chalk to avoid color codes in test output
vi.mock('chalk', () => ({
  default: {
    green: (s) => s,
    red: (s) => s,
    yellow: (s) => s,
    cyan: (s) => s,
    gray: (s) => s
  }
}));

// Mock utils to use test directories
vi.mock('../src/utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getClaudeDir: () => testClaudeDir,
    getSourceDir: () => testSourceDir,
    saveInstalledVersion: vi.fn(),
    getPackageVersion: () => '0.1.0',
    getInstalledVersion: () => null
  };
});

describe('installer.js', () => {
  beforeEach(async () => {
    await fs.ensureDir(testClaudeDir);
    await fs.ensureDir(testSourceDir);

    // commands: source='commands', target='commands/auto', pattern='*.md'
    await fs.ensureDir(path.join(testSourceDir, 'commands'));
    await fs.writeFile(path.join(testSourceDir, 'commands', 'auto.md'), '# Auto Command v2');

    // agents: source='agents', target='agents', pattern='*.md'
    await fs.ensureDir(path.join(testSourceDir, 'agents'));
    await fs.writeFile(path.join(testSourceDir, 'agents', 'test-agent.md'), '# Test Agent v2');

    // plugins: source='plugins', target='plugins', recursive=true
    await fs.ensureDir(path.join(testSourceDir, 'plugins', 'builtin'));
    await fs.writeFile(
      path.join(testSourceDir, 'plugins', 'builtin', 'test-plugin.md'),
      '# Test Plugin v2'
    );
  });

  afterEach(async () => {
    await fs.remove(testDir);
    vi.restoreAllMocks();
  });

  describe('checkStatus', () => {
    it('should return status for all components', async () => {
      const status = await checkStatus();

      expect(status).toHaveProperty('agents');
      expect(status).toHaveProperty('rules');
      expect(status).toHaveProperty('commands');
      expect(status).toHaveProperty('skills');
    });

    it('should have correct structure for each component', async () => {
      const status = await checkStatus();

      for (const [, value] of Object.entries(status)) {
        expect(value).toHaveProperty('installed');
        expect(value).toHaveProperty('path');
        expect(value).toHaveProperty('fileCount');
        expect(typeof value.installed).toBe('boolean');
        expect(typeof value.path).toBe('string');
        expect(typeof value.fileCount).toBe('number');
      }
    });
  });

  describe('install', () => {
    it('should handle empty component list', async () => {
      const result = await install([]);

      expect(result).toHaveProperty('installedFiles');
      expect(result).toHaveProperty('skippedFiles');
      expect(result.installedFiles).toEqual([]);
    });

    it('should handle invalid component names gracefully', async () => {
      const result = await install(['nonexistent-component']);

      expect(result.installedFiles).toEqual([]);
    });

    it('should install non-recursive files to target directory', async () => {
      const result = await install(['commands'], { backup: false });

      expect(result.installedFiles.length).toBeGreaterThan(0);
      const content = await fs.readFile(
        path.join(testClaudeDir, 'commands', 'auto', 'auto.md'),
        'utf-8'
      );
      expect(content).toContain('# Auto Command v2');
    });

    it('should skip existing files when force=false (non-recursive, commands)', async () => {
      const targetFile = path.join(testClaudeDir, 'commands', 'auto', 'auto.md');
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, '# Old Content');

      const result = await install(['commands'], { backup: false, force: false });

      expect(result.installedFiles).toEqual([]);
      expect(result.skippedFiles.length).toBeGreaterThan(0);

      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toBe('# Old Content');
    });

    it('should create backup when force=false and backup=true (non-recursive)', async () => {
      const targetFile = path.join(testClaudeDir, 'commands', 'auto', 'auto.md');
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, '# Old Content');

      const result = await install(['commands'], { backup: true, force: false });

      expect(result.installedFiles).toEqual([]);

      // 备份文件名格式：{filename}.backup.{timestamp}
      const dir = path.dirname(targetFile);
      const baseName = path.basename(targetFile);
      const dirFiles = await fs.readdir(dir);
      const backupFile = dirFiles.find((f) => f.startsWith(baseName + '.backup.'));
      expect(backupFile).toBeDefined();

      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toBe('# Old Content');

      const backupContent = await fs.readFile(path.join(dir, backupFile), 'utf-8');
      expect(backupContent).toBe('# Old Content');
    });

    it('should overwrite existing files when force=true (non-recursive)', async () => {
      const targetFile = path.join(testClaudeDir, 'commands', 'auto', 'auto.md');
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, '# Old Content');

      const result = await install(['commands'], { backup: false, force: true });

      expect(result.installedFiles.length).toBeGreaterThan(0);
      expect(result.skippedFiles).toEqual([]);

      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('# Auto Command v2');
    });

    it('should not create backup when force=true', async () => {
      const targetFile = path.join(testClaudeDir, 'commands', 'auto', 'auto.md');
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, '# Old Content');

      const result = await install(['commands'], { backup: true, force: true });

      expect(result.installedFiles.length).toBeGreaterThan(0);

      const backupExists = await fs.pathExists(`${targetFile}.backup`);
      expect(backupExists).toBe(false);

      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('# Auto Command v2');
    });
  });

  describe('uninstall', () => {
    it('should handle empty component list', async () => {
      const result = await uninstall([]);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });

    it('should handle invalid component names gracefully', async () => {
      const result = await uninstall(['nonexistent-component']);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
