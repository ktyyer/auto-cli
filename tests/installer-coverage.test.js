import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

// Hoisted mock references (only vi.fn(), no imports)
const { mockSaveInstalledVersion, mockGetInstalledVersion } = vi.hoisted(() => ({
  mockSaveInstalledVersion: vi.fn(),
  mockGetInstalledVersion: vi.fn().mockResolvedValue(null)
}));

// Test directories - computed after imports
const testDir = path.join(os.tmpdir(), 'auto-cov-' + Date.now());
const testClaudeDir = path.join(testDir, '.claude');
const testSourceDir = path.join(testDir, 'source');

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: ''
  })
}));

vi.mock('chalk', () => ({
  default: {
    green: (s) => s,
    red: (s) => s,
    yellow: (s) => s,
    cyan: (s) => s,
    gray: (s) => s
  }
}));

vi.mock('../src/utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getClaudeDir: () => testClaudeDir,
    getSourceDir: () => testSourceDir,
    saveInstalledVersion: mockSaveInstalledVersion,
    getPackageVersion: () => '0.1.0',
    getInstalledVersion: mockGetInstalledVersion
  };
});

import { install, uninstall, checkStatus } from '../src/installer.js';

describe('installer.js coverage boost', () => {
  beforeEach(async () => {
    mockSaveInstalledVersion.mockReset();
    mockGetInstalledVersion.mockReset().mockResolvedValue(null);
    await fs.ensureDir(testClaudeDir);
    await fs.ensureDir(testSourceDir);

    // Setup source files for all components
    await fs.ensureDir(path.join(testSourceDir, 'commands'));
    await fs.writeFile(path.join(testSourceDir, 'commands', 'test.md'), '# CMD');
    await fs.ensureDir(path.join(testSourceDir, 'agents'));
    await fs.writeFile(path.join(testSourceDir, 'agents', 'agent.md'), '# AGENT');
    await fs.ensureDir(path.join(testSourceDir, 'rules'));
    await fs.writeFile(path.join(testSourceDir, 'rules', 'rule.md'), '# RULE');
    await fs.ensureDir(path.join(testSourceDir, 'skills', 'sub'));
    await fs.writeFile(path.join(testSourceDir, 'skills', 'sub', 'skill.md'), '# SKILL');
    await fs.ensureDir(path.join(testSourceDir, 'plugins', 'builtin'));
    await fs.writeFile(path.join(testSourceDir, 'plugins', 'builtin', 'plugin.md'), '# PLUGIN');
    await fs.ensureDir(path.join(testSourceDir, 'templates'));
    await fs.writeFile(path.join(testSourceDir, 'templates', 'tpl.yml'), 'tpl: true');
  });

  afterEach(async () => {
    await fs.remove(testDir);
    vi.restoreAllMocks();
  });

  describe('install - recursive with backup and skip', () => {
    it('should handle multi-component install', async () => {
      const result = await install(['agents', 'rules'], { backup: false });

      expect(result.installedFiles.length).toBeGreaterThanOrEqual(2);
      expect(mockSaveInstalledVersion).toHaveBeenCalledWith(
        '0.1.0',
        ['agents', 'rules'],
        expect.any(Array)
      );
    });
  });

  describe('uninstall - with installedFiles record', () => {
    it('should remove only recorded files', async () => {
      // Create installed files
      const fileA = path.join(testClaudeDir, 'agents', 'agent.md');
      const fileB = path.join(testClaudeDir, 'agents', 'extra.md');
      await fs.ensureDir(path.dirname(fileA));
      await fs.writeFile(fileA, '# A');
      await fs.writeFile(fileB, '# B (user file, not in record)');

      // Create version file to be removed
      const versionFile = path.join(testClaudeDir, '.auto-version');
      await fs.writeJson(versionFile, { version: '0.1.0' });

      // Mock: return recorded files
      mockGetInstalledVersion.mockResolvedValue({
        version: '0.1.0',
        installedFiles: [fileA]
      });

      const removed = await uninstall(['agents']);

      // Only recorded file removed
      expect(removed).toContain(fileA);
      expect(removed).not.toContain(fileB);

      // User file still exists
      expect(await fs.pathExists(fileB)).toBe(true);

      // Version file removed
      expect(await fs.pathExists(versionFile)).toBe(false);
    });
  });

  describe('uninstall - compatibility mode (no installedFiles)', () => {
    it('should delete commands/auto directory entirely in compat mode', async () => {
      const cmdFile = path.join(testClaudeDir, 'commands', 'auto', 'test.md');
      await fs.ensureDir(path.dirname(cmdFile));
      await fs.writeFile(cmdFile, '# CMD');

      const versionFile = path.join(testClaudeDir, '.auto-version');
      await fs.writeJson(versionFile, { version: '0.1.0' });

      // No installedFiles → triggers compat mode
      mockGetInstalledVersion.mockResolvedValue({
        version: '0.1.0',
        installedFiles: []
      });

      const removed = await uninstall(['commands']);

      // commands/auto dir was removed
      expect(await fs.pathExists(path.join(testClaudeDir, 'commands', 'auto'))).toBe(false);
      expect(removed.length).toBeGreaterThan(0);

      // Version file removed
      expect(await fs.pathExists(versionFile)).toBe(false);
    });

    it('should delete shared dir files one-by-one in compat mode', async () => {
      const agentFile = path.join(testClaudeDir, 'agents', 'agent.md');
      await fs.ensureDir(path.dirname(agentFile));
      await fs.writeFile(agentFile, '# AGENT');

      const versionFile = path.join(testClaudeDir, '.auto-version');
      await fs.writeJson(versionFile, { version: '0.1.0' });

      mockGetInstalledVersion.mockResolvedValue({
        version: '0.1.0',
        installedFiles: []
      });

      const removed = await uninstall(['agents']);

      // Agent file removed
      expect(await fs.pathExists(agentFile)).toBe(false);
      expect(removed.length).toBeGreaterThan(0);
    });
  });

  describe('checkStatus - installed components', () => {
    it('should report installed=true when files exist', async () => {
      // Install agents first
      await install(['agents'], { backup: false });

      const status = await checkStatus();

      expect(status.agents.installed).toBe(true);
      expect(status.agents.fileCount).toBeGreaterThan(0);
      expect(status.commands.installed).toBe(false);
    });
  });

  describe('install - edge cases', () => {
    it('should skip non-matching file extensions', async () => {
      // Add a non-.md file in commands source
      await fs.writeFile(path.join(testSourceDir, 'commands', 'ignore.txt'), 'text');

      const result = await install(['commands'], { backup: false });

      // Only .md file installed, .txt ignored
      const installed = result.installedFiles;
      expect(installed.some((f) => f.endsWith('test.md'))).toBe(true);
      expect(installed.some((f) => f.endsWith('ignore.txt'))).toBe(false);
    });
  });

  describe('uninstall - handles remove failure gracefully', () => {
    it('should continue when individual file removal fails', async () => {
      // Create a file and a non-existent path
      const goodFile = path.join(testClaudeDir, 'agents', 'good.md');
      await fs.ensureDir(path.dirname(goodFile));
      await fs.writeFile(goodFile, '# GOOD');

      const badFile = path.join(testClaudeDir, 'agents', 'nonexistent.md');

      mockGetInstalledVersion.mockResolvedValue({
        version: '0.1.0',
        installedFiles: [badFile, goodFile]
      });

      const versionFile = path.join(testClaudeDir, '.auto-version');
      await fs.writeJson(versionFile, { version: '0.1.0' });

      // Should not throw even though badFile doesn't exist
      const removed = await uninstall(['agents']);
      expect(removed).toContain(goodFile);
    });
  });
});
