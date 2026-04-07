import { spawnSync } from 'child_process';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { install, uninstall, checkStatus } from '../src/installer.js';

// Test directories
const testDir = path.join(os.tmpdir(), 'auto-test-' + Date.now());
const testClaudeDir = path.join(testDir, '.claude');
const testSourceDir = path.join(testDir, 'source');

async function listRelativeFiles(baseDir) {
  const files = [];

  async function walk(currentDir, prefix = '') {
    const entries = await fs.readdir(currentDir);
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry);
      const relativePath = prefix ? path.join(prefix, entry) : entry;
      const stats = await fs.stat(entryPath);
      if (stats.isDirectory()) {
        await walk(entryPath, relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }

  if (await fs.pathExists(baseDir)) {
    await walk(baseDir);
  }

  return files.sort();
}

async function runSyncScript(testProjectDir, homeDir) {
  const packageJson = await fs.readJson(path.resolve(process.cwd(), 'package.json'));
  const syncScript = packageJson.scripts.sync;
  const match = syncScript.match(/^node -e "([\s\S]*)"$/);

  if (!match) {
    throw new Error('Unable to extract sync script from package.json');
  }

  const script = match[1].replace(/\\"/g, '"');
  const env = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir
  };

  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: testProjectDir,
    encoding: 'utf8',
    env
  });

  if (result.status !== 0) {
    throw new Error(
      `sync script failed\nstdout:\n${result.stdout ?? ''}\nstderr:\n${result.stderr ?? ''}`
    );
  }

  return result.stdout ?? '';
}

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

    // commands: source='commands', target='commands', recursive=true
    await fs.ensureDir(path.join(testSourceDir, 'commands', 'auto'));
    await fs.writeFile(path.join(testSourceDir, 'commands', 'auto.md'), '# Auto Command v2');
    await fs.writeFile(path.join(testSourceDir, 'commands', 'auto', 'route.md'), '# Auto Route v2');
    await fs.writeFile(
      path.join(testSourceDir, 'commands', 'auto', 'doctor.md'),
      '# /auto:doctor -- Test'
    );
    await fs.writeFile(
      path.join(testSourceDir, 'commands', 'auto', 'status.md'),
      '# /auto:status -- Test'
    );
    await fs.writeFile(
      path.join(testSourceDir, 'commands', 'auto', 'learn.md'),
      '# /auto:learn -- Test'
    );
    await fs.writeFile(
      path.join(testSourceDir, 'commands', 'auto', 'create-hook.md'),
      '# /auto:create-hook -- Test'
    );

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

    it('should install recursive command files to target directory', async () => {
      const result = await install(['commands'], { backup: false });

      expect(result.installedFiles.length).toBeGreaterThan(0);
      const rootContent = await fs.readFile(
        path.join(testClaudeDir, 'commands', 'auto.md'),
        'utf-8'
      );
      const nestedContent = await fs.readFile(
        path.join(testClaudeDir, 'commands', 'auto', 'route.md'),
        'utf-8'
      );
      expect(rootContent).toContain('# Auto Command v2');
      expect(nestedContent).toContain('# Auto Route v2');
    });

    it('should count nested command files in status', async () => {
      await install(['commands'], { backup: false });

      const status = await checkStatus();

      expect(status.commands.installed).toBe(true);
      expect(status.commands.fileCount).toBe(6);
    });

    it('should install only the canonical /auto command tree', async () => {
      await install(['commands'], { backup: false });

      const files = await listRelativeFiles(path.join(testClaudeDir, 'commands'));

      expect(files).toEqual([
        'auto.md',
        path.join('auto', 'create-hook.md'),
        path.join('auto', 'doctor.md'),
        path.join('auto', 'learn.md'),
        path.join('auto', 'route.md'),
        path.join('auto', 'status.md')
      ]);
    });

    it('should remove only auto-managed legacy command aliases during install', async () => {
      await fs.ensureDir(path.join(testClaudeDir, 'commands'));
      await fs.writeFile(
        path.join(testClaudeDir, 'commands', 'doctor.md'),
        '# /auto:doctor -- Test'
      );
      await fs.writeFile(
        path.join(testClaudeDir, 'commands', 'status.md'),
        '# /auto:status -- Test'
      );
      await fs.writeFile(
        path.join(testClaudeDir, 'commands', 'custom.md'),
        '# Custom Root Command'
      );
      await fs.writeFile(
        path.join(testClaudeDir, 'commands', 'learn.md'),
        '# User Learn Command Override'
      );
      await fs.ensureDir(path.join(testClaudeDir, 'commands', 'auto', 'auto'));
      await fs.writeFile(
        path.join(testClaudeDir, 'commands', 'auto', 'auto', 'doctor.md'),
        '# Legacy Nested Doctor'
      );

      await install(['commands'], { backup: false });

      const files = await listRelativeFiles(path.join(testClaudeDir, 'commands'));

      expect(files).toEqual([
        'auto.md',
        path.join('auto', 'create-hook.md'),
        path.join('auto', 'doctor.md'),
        path.join('auto', 'learn.md'),
        path.join('auto', 'route.md'),
        path.join('auto', 'status.md'),
        'custom.md',
        'learn.md'
      ]);
    });

    it('should keep user-defined shared command names during compatibility uninstall', async () => {
      await install(['commands'], { backup: false });
      await fs.writeFile(path.join(testClaudeDir, 'commands', 'custom.md'), '# Custom Command');
      await fs.writeFile(
        path.join(testClaudeDir, 'commands', 'doctor.md'),
        '# User Doctor Command Override'
      );
      await fs.ensureDir(path.join(testClaudeDir, 'commands', 'auto', 'auto'));
      await fs.writeFile(
        path.join(testClaudeDir, 'commands', 'auto', 'auto', 'doctor.md'),
        '# Legacy Nested Doctor'
      );

      const removedFiles = await uninstall(['commands']);
      const files = await listRelativeFiles(path.join(testClaudeDir, 'commands'));

      expect(files).toEqual(['custom.md', 'doctor.md']);
      expect(removedFiles).toEqual(
        expect.arrayContaining([
          path.join(testClaudeDir, 'commands', 'auto.md'),
          path.join(testClaudeDir, 'commands', 'auto', 'doctor.md'),
          path.join(testClaudeDir, 'commands', 'auto', 'auto')
        ])
      );
      expect(removedFiles).not.toContain(path.join(testClaudeDir, 'commands', 'doctor.md'));
      await expect(fs.pathExists(path.join(testClaudeDir, 'commands', 'auto'))).resolves.toBe(
        false
      );
    });

    it('should skip existing root command file when force=false and still install missing nested files', async () => {
      const targetFile = path.join(testClaudeDir, 'commands', 'auto.md');
      const nestedTargetFile = path.join(testClaudeDir, 'commands', 'auto', 'route.md');
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, '# Old Content');

      const result = await install(['commands'], { backup: false, force: false });

      expect(result.skippedFiles).toContain(targetFile);
      expect(result.installedFiles).toContain(nestedTargetFile);

      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toBe('# Old Content');
    });

    it('should create backup for existing root command file and still install missing nested files', async () => {
      const targetFile = path.join(testClaudeDir, 'commands', 'auto.md');
      const nestedTargetFile = path.join(testClaudeDir, 'commands', 'auto', 'route.md');
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, '# Old Content');

      const result = await install(['commands'], { backup: true, force: false });

      expect(result.installedFiles).toContain(nestedTargetFile);

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
      const targetFile = path.join(testClaudeDir, 'commands', 'auto.md');
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeFile(targetFile, '# Old Content');

      const result = await install(['commands'], { backup: false, force: true });

      expect(result.installedFiles.length).toBeGreaterThan(0);
      expect(result.skippedFiles).toEqual([]);

      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('# Auto Command v2');
    });

    it('should not create backup when force=true', async () => {
      const targetFile = path.join(testClaudeDir, 'commands', 'auto.md');
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

    it('should keep user-defined shared command names during compatibility uninstall', async () => {
      await install(['commands'], { backup: false });
      await fs.writeFile(path.join(testClaudeDir, 'commands', 'custom.md'), '# Custom Command');
      await fs.writeFile(
        path.join(testClaudeDir, 'commands', 'doctor.md'),
        '# User Doctor Command Override'
      );
      await fs.ensureDir(path.join(testClaudeDir, 'commands', 'auto', 'auto'));
      await fs.writeFile(
        path.join(testClaudeDir, 'commands', 'auto', 'auto', 'doctor.md'),
        '# Legacy Nested Doctor'
      );

      const removedFiles = await uninstall(['commands']);
      const files = await listRelativeFiles(path.join(testClaudeDir, 'commands'));

      expect(files).toEqual(['custom.md', 'doctor.md']);
      expect(removedFiles).toEqual(
        expect.arrayContaining([
          path.join(testClaudeDir, 'commands', 'auto.md'),
          path.join(testClaudeDir, 'commands', 'auto', 'doctor.md'),
          path.join(testClaudeDir, 'commands', 'auto', 'auto')
        ])
      );
      expect(removedFiles).not.toContain(path.join(testClaudeDir, 'commands', 'doctor.md'));
      await expect(fs.pathExists(path.join(testClaudeDir, 'commands', 'auto'))).resolves.toBe(
        false
      );
    });
  });

  describe('npm run sync', () => {
    it('should preserve project custom commands under the auto namespace', async () => {
      const syncProjectDir = path.join(testDir, 'sync-custom');
      const syncHomeDir = path.join(testDir, 'sync-custom-home');
      const localCommandsDir = path.join(syncProjectDir, '.claude', 'commands');

      await fs.ensureDir(path.join(syncProjectDir, 'commands', 'auto'));
      await fs.writeFile(path.join(syncProjectDir, 'commands', 'auto.md'), '# Auto Command v2');
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'route.md'),
        '# Auto Route v2'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'doctor.md'),
        '# /auto:doctor -- Test'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'status.md'),
        '# /auto:status -- Test'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'learn.md'),
        '# /auto:learn -- Test'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'create-hook.md'),
        '# /auto:create-hook -- Test'
      );

      await fs.ensureDir(path.join(syncHomeDir, '.claude', 'commands', 'auto'));
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto.md'),
        '# Auto Command v2'
      );
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'route.md'),
        '# Auto Route v2'
      );
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'doctor.md'),
        '# /auto:doctor -- Test'
      );
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'status.md'),
        '# /auto:status -- Test'
      );
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'learn.md'),
        '# /auto:learn -- Test'
      );
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'create-hook.md'),
        '# /auto:create-hook -- Test'
      );

      await fs.ensureDir(path.join(localCommandsDir, 'auto'));
      await fs.writeFile(
        path.join(localCommandsDir, 'auto', 'custom.md'),
        '# Custom Nested Command'
      );
      await fs.writeFile(path.join(localCommandsDir, 'custom.md'), '# Custom Root Command');
      await fs.writeFile(path.join(localCommandsDir, 'doctor.md'), '# Legacy Doctor');
      await fs.writeFile(path.join(localCommandsDir, 'auto.md'), '# Local Auto');
      await fs.writeFile(path.join(localCommandsDir, 'auto', 'doctor.md'), '# Local Doctor');

      const output = await runSyncScript(syncProjectDir, syncHomeDir);
      const files = await listRelativeFiles(localCommandsDir);

      expect(output).toContain(
        'Skipped local sync: global ~/.claude/commands already matches current repo.'
      );
      expect(files).toEqual([path.join('auto', 'custom.md'), 'custom.md', 'doctor.md']);
    });

    it('should sync locally when the global command tree is stale', async () => {
      const syncProjectDir = path.join(testDir, 'sync-stale-global');
      const syncHomeDir = path.join(testDir, 'sync-stale-global-home');
      const localCommandsDir = path.join(syncProjectDir, '.claude', 'commands');

      await fs.ensureDir(path.join(syncProjectDir, 'commands', 'auto'));
      await fs.writeFile(path.join(syncProjectDir, 'commands', 'auto.md'), '# Auto Command v2');
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'route.md'),
        '# Auto Route v2'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'doctor.md'),
        '# /auto:doctor -- Test'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'status.md'),
        '# /auto:status -- Test'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'learn.md'),
        '# /auto:learn -- Test'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'create-hook.md'),
        '# /auto:create-hook -- Test'
      );

      await fs.ensureDir(path.join(syncHomeDir, '.claude', 'commands', 'auto'));
      await fs.writeFile(path.join(syncHomeDir, '.claude', 'commands', 'auto.md'), '# Global Auto');
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'route.md'),
        '# Global Route'
      );
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'doctor.md'),
        '# Stale Global Doctor'
      );
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'status.md'),
        '# Global Status'
      );
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'learn.md'),
        '# Global Learn'
      );
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'create-hook.md'),
        '# Global Create Hook'
      );

      const output = await runSyncScript(syncProjectDir, syncHomeDir);
      const files = await listRelativeFiles(localCommandsDir);
      const doctorContent = await fs.readFile(
        path.join(localCommandsDir, 'auto', 'doctor.md'),
        'utf-8'
      );

      expect(output).toContain('Synced commands/ -> .claude/commands/');
      expect(files).toEqual([
        'auto.md',
        path.join('auto', 'create-hook.md'),
        path.join('auto', 'doctor.md'),
        path.join('auto', 'learn.md'),
        path.join('auto', 'route.md'),
        path.join('auto', 'status.md')
      ]);
      expect(doctorContent).toBe('# /auto:doctor -- Test');
    });

    it('should sync locally when the global command tree is incomplete', async () => {
      const syncProjectDir = path.join(testDir, 'sync-incomplete');
      const syncHomeDir = path.join(testDir, 'sync-incomplete-home');
      const localCommandsDir = path.join(syncProjectDir, '.claude', 'commands');

      await fs.ensureDir(path.join(syncProjectDir, 'commands', 'auto'));
      await fs.writeFile(path.join(syncProjectDir, 'commands', 'auto.md'), '# Auto Command v2');
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'route.md'),
        '# Auto Route v2'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'doctor.md'),
        '# /auto:doctor -- Test'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'status.md'),
        '# /auto:status -- Test'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'learn.md'),
        '# /auto:learn -- Test'
      );
      await fs.writeFile(
        path.join(syncProjectDir, 'commands', 'auto', 'create-hook.md'),
        '# /auto:create-hook -- Test'
      );

      await fs.ensureDir(path.join(syncHomeDir, '.claude', 'commands', 'auto'));
      await fs.writeFile(path.join(syncHomeDir, '.claude', 'commands', 'auto.md'), '# Global Auto');
      await fs.writeFile(
        path.join(syncHomeDir, '.claude', 'commands', 'auto', 'route.md'),
        '# Global Route'
      );

      await fs.ensureDir(path.join(localCommandsDir, 'auto'));
      await fs.writeFile(path.join(localCommandsDir, 'doctor.md'), '# Legacy Doctor');

      const output = await runSyncScript(syncProjectDir, syncHomeDir);
      const files = await listRelativeFiles(localCommandsDir);

      expect(output).toContain('Synced commands/ -> .claude/commands/');
      expect(files).toEqual([
        'auto.md',
        path.join('auto', 'create-hook.md'),
        path.join('auto', 'doctor.md'),
        path.join('auto', 'learn.md'),
        path.join('auto', 'route.md'),
        path.join('auto', 'status.md'),
        'doctor.md'
      ]);
    });
  });

  describe('install-auto-cli.bat', () => {
    const itIfWindows = process.platform === 'win32' ? it : it.skip;

    itIfWindows(
      'should remove only deterministic legacy /auto paths when auto is unavailable during reinstall',
      async () => {
        const sandboxDir = path.join(testDir, 'batch-installer');
        const scriptDir = path.join(sandboxDir, 'script');
        const fakeBinDir = path.join(sandboxDir, 'fake-bin');
        const npmPrefix = path.join(sandboxDir, 'npm-prefix');
        const npmRoot = path.join(sandboxDir, 'npm-root');
        const userProfileDir = path.join(sandboxDir, 'user-profile');
        const commandsDir = path.join(userProfileDir, '.claude', 'commands');
        const logFile = path.join(sandboxDir, 'npm-calls.log');
        const legacyCheckFile = path.join(sandboxDir, 'legacy-check.json');
        const packagePath = path.join(scriptDir, 'auto-cli-9.9.9.tgz');
        const batchScriptPath = path.join(scriptDir, 'install-auto-cli.bat');
        const fakeNpmScriptPath = path.join(sandboxDir, 'fake-npm.js');
        const customRootCommand = path.join(commandsDir, 'custom.md');
        const customNestedCommand = path.join(commandsDir, 'auto', 'custom.md');
        const sharedDoctorCommand = path.join(commandsDir, 'doctor.md');
        const legacyPaths = [
          path.join(commandsDir, 'auto', 'auto.md'),
          path.join(commandsDir, 'auto', 'auto')
        ];
        const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
        const pathKey =
          Object.keys(process.env).find((envKey) => envKey.toLowerCase() === 'path') ?? 'Path';
        const isolatedPath = `${fakeBinDir};${path.join(systemRoot, 'System32')}`;

        await fs.ensureDir(scriptDir);
        await fs.ensureDir(fakeBinDir);
        await fs.ensureDir(npmPrefix);
        await fs.ensureDir(path.join(npmRoot, 'auto-cli'));
        await fs.ensureDir(path.dirname(customNestedCommand));
        await fs.ensureDir(path.join(commandsDir, 'auto', 'auto'));

        await fs.copy(path.resolve(process.cwd(), 'install-auto-cli.bat'), batchScriptPath);
        await fs.writeFile(packagePath, 'dummy tgz');
        await fs.writeFile(customRootCommand, '# Custom Root Command');
        await fs.writeFile(customNestedCommand, '# Custom Nested Command');
        await fs.writeFile(sharedDoctorCommand, '# User Doctor Command Override');
        await fs.writeFile(legacyPaths[0], '# Legacy Auto');
        await fs.writeFile(path.join(legacyPaths[1], 'doctor.md'), '# Legacy Nested Doctor');

        await fs.writeFile(
          fakeNpmScriptPath,
          [
            "const fs = require('fs');",
            "const path = require('path');",
            '',
            'const args = process.argv.slice(2);',
            'const logFile = process.env.FAKE_NPM_LOG;',
            '',
            'function logCall() {',
            "  fs.appendFileSync(logFile, `${args.join(' ')}\\n`);",
            '}',
            '',
            'logCall();',
            '',
            "if (args[0] === 'prefix' && args[1] === '-g') {",
            '  process.stdout.write(`${process.env.FAKE_NPM_PREFIX}\\n`);',
            '  process.exit(0);',
            '}',
            '',
            "if (args[0] === 'root' && args[1] === '-g') {",
            '  process.stdout.write(`${process.env.FAKE_NPM_ROOT}\\n`);',
            '  process.exit(0);',
            '}',
            '',
            "if (args[0] === 'uninstall' && args[1] === '-g' && args[2] === 'auto-cli') {",
            '  process.exit(0);',
            '}',
            '',
            "if (args[0] === 'install' && args[1] === '-g') {",
            "  const commandsDir = path.join(process.env.USERPROFILE, '.claude', 'commands');",
            '  const legacyRelativePaths = [',
            "    path.join('auto', 'auto.md'),",
            "    path.join('auto', 'auto')",
            '  ];',
            '  const remainingLegacyPaths = legacyRelativePaths',
            '    .map((relativePath) => path.join(commandsDir, relativePath))',
            '    .filter((targetPath) => fs.existsSync(targetPath));',
            '  fs.writeFileSync(',
            '    process.env.LEGACY_CHECK_FILE,',
            '    JSON.stringify(',
            '      {',
            '        allRemoved: remainingLegacyPaths.length === 0,',
            '        remainingLegacyPaths',
            '      },',
            '      null,',
            '      2',
            '    )',
            '  );',
            "  const autoCmdPath = path.join(process.env.FAKE_NPM_PREFIX, 'auto.cmd');",
            '  fs.mkdirSync(path.dirname(autoCmdPath), { recursive: true });',
            '  fs.writeFileSync(',
            '    autoCmdPath,',
            '    [',
            "      '@echo off',",
            '      \'if "%1"=="install" exit /b 0\',',
            '      \'if "%1"=="--version" (\',',
            "      '  echo 9.9.9',",
            "      '  exit /b 0',",
            "      ')',",
            "      'exit /b 0',",
            "      ''",
            "    ].join('\\r\\n')",
            '  );',
            '  process.exit(0);',
            '}',
            '',
            'process.exit(1);',
            ''
          ].join('\n')
        );

        await fs.writeFile(
          path.join(fakeBinDir, 'npm.cmd'),
          ['@echo off', '"%FAKE_NODE%" "%FAKE_NPM_SCRIPT%" %*', 'exit /b %ERRORLEVEL%', ''].join(
            '\r\n'
          )
        );

        const env = {
          ...process.env,
          USERPROFILE: userProfileDir,
          FAKE_NODE: process.execPath,
          FAKE_NPM_SCRIPT: fakeNpmScriptPath,
          FAKE_NPM_PREFIX: npmPrefix,
          FAKE_NPM_ROOT: npmRoot,
          FAKE_NPM_LOG: logFile,
          LEGACY_CHECK_FILE: legacyCheckFile,
          SystemRoot: systemRoot,
          ComSpec: process.env.ComSpec ?? path.join(systemRoot, 'System32', 'cmd.exe'),
          [pathKey]: isolatedPath
        };

        const result = spawnSync(env.ComSpec, ['/d', '/s', '/c', batchScriptPath], {
          encoding: 'utf8',
          env,
          windowsHide: true
        });

        const stdout = result.stdout ?? '';
        const stderr = result.stderr ?? '';

        if (result.status !== 0) {
          throw new Error(`install-auto-cli.bat failed\nstdout:\n${stdout}\nstderr:\n${stderr}`);
        }

        expect(stdout).toContain(
          'Existing auto-cli package found, but auto command is unavailable.'
        );
        expect(stdout).toContain('Removing deterministic legacy /auto namespace paths directly...');

        const legacyCheck = await fs.readJson(legacyCheckFile);
        const npmCallLog = await fs.readFile(logFile, 'utf-8');

        expect(legacyCheck).toEqual({
          allRemoved: true,
          remainingLegacyPaths: []
        });
        expect(npmCallLog).toContain('uninstall -g auto-cli');
        expect(npmCallLog).toContain('install -g');

        for (const legacyPath of legacyPaths) {
          await expect(fs.pathExists(legacyPath)).resolves.toBe(false);
        }

        await expect(fs.pathExists(sharedDoctorCommand)).resolves.toBe(true);
      }
    );
  });
});
