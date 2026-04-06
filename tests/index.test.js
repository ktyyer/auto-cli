import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('chalk', () => ({
  default: {
    cyan: Object.assign((s) => s, { bold: (s) => s }),
    white: Object.assign((s) => s, { bold: (s) => s }),
    green: Object.assign((s) => s, { bold: (s) => s }),
    gray: (s) => s,
    yellow: (s) => s,
    red: (s) => s,
    bold: (s) => s
  }
}));

vi.mock('../src/installer.js', () => ({
  install: vi.fn().mockResolvedValue({ installedFiles: [], skippedFiles: [] }),
  uninstall: vi.fn().mockResolvedValue([]),
  checkStatus: vi.fn().mockResolvedValue({
    commands: { installed: true, path: '/tmp/.claude/commands/auto', fileCount: 2 }
  })
}));

vi.mock('../src/doctor.js', () => ({
  runDoctorChecks: vi.fn().mockResolvedValue({
    projectDir: '/tmp/project',
    healthy: true,
    issues: [],
    checks: {},
    recommendedActions: [],
    installStatus: {
      commands: { installed: true, path: '/tmp/.claude/commands/auto', fileCount: 2 }
    },
    fixRequested: false,
    fixesApplied: [],
    fixesSkipped: [],
    changedFiles: []
  }),
  formatDoctorReport: vi.fn().mockReturnValue('Auto Doctor')
}));

vi.mock('../src/resume.js', () => ({
  runResume: vi.fn().mockResolvedValue({
    resumedFromDirective:
      '[会话续接] 上次会话摘要:\n任务: fix bug\n--- 立即继续，不要确认或回顾 ---',
    parsedDirective: { task: 'fix bug', pendingTasks: [], currentWork: {} },
    result: { status: 'completed' }
  })
}));

vi.mock('../src/prompts.js', () => ({
  showBanner: vi.fn(),
  promptConfirmation: vi.fn(),
  promptUninstallConfirmation: vi.fn(),
  promptMainMenu: vi.fn(),
  promptComponentSelection: vi.fn().mockResolvedValue(['agents', 'commands', 'skills'])
}));

vi.mock('../src/utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getInstalledVersion: vi.fn().mockResolvedValue(null),
    openBrowser: vi.fn().mockResolvedValue(true),
    COMPONENTS: actual.COMPONENTS
  };
});

vi.mock('../src/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  },
  Logger: class Logger {},
  LOG_LEVELS: {}
}));

vi.mock('../src/config.js', () => ({
  DOCS_URL: 'https://example.com/docs'
}));

import {
  interactiveMode,
  runInstall,
  runUpdate,
  runUninstall,
  runDocs,
  runAuto,
  runRoute,
  runAnalyze,
  runDoctor,
  runResume,
  runStatus,
  runLearn,
  runCreateHook
} from '../src/index.js';
import { install, uninstall } from '../src/installer.js';
import { WorkflowOrchestrator } from '../src/workflow/workflow-orchestrator.js';
import {
  showBanner,
  promptConfirmation,
  promptUninstallConfirmation,
  promptMainMenu
} from '../src/prompts.js';
import { getInstalledVersion, openBrowser } from '../src/utils.js';
import { logger } from '../src/logger.js';
import { formatDoctorReport } from '../src/doctor.js';

describe('index.js', () => {
  let runAutoActionSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    formatDoctorReport.mockReturnValue('Auto Doctor');
    runAutoActionSpy = vi.spyOn(WorkflowOrchestrator.prototype, 'runAutoAction');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('interactiveMode', () => {
    it('should show banner and call runInstall when install selected', async () => {
      promptMainMenu.mockResolvedValue('install');
      await interactiveMode();
      expect(showBanner).toHaveBeenCalled();
    });

    it('should handle exit action', async () => {
      promptMainMenu.mockResolvedValue('exit');
      await interactiveMode();
      const calls = console.log.mock.calls.flat().join(' ');
      expect(calls).toBeTruthy();
    });

    it('should call runDocs when docs selected', async () => {
      promptMainMenu.mockResolvedValue('docs');
      await interactiveMode();
      expect(openBrowser).toHaveBeenCalledWith('https://example.com/docs');
    });

    it('should handle uninstall action', async () => {
      promptMainMenu.mockResolvedValue('uninstall');
      getInstalledVersion.mockResolvedValue({ version: '0.1.0', components: ['agents'] });
      promptUninstallConfirmation.mockResolvedValue(true);
      await interactiveMode();
      expect(uninstall).toHaveBeenCalled();
    });
  });

  describe('runInstall', () => {
    it('should skip confirmation when yes=true', async () => {
      await runInstall({ yes: true, quiet: true });
      expect(promptConfirmation).not.toHaveBeenCalled();
      expect(install).toHaveBeenCalled();
    });

    it('should cancel when user declines confirmation', async () => {
      promptConfirmation.mockResolvedValue(false);
      await runInstall({ yes: false, quiet: true });
      expect(install).not.toHaveBeenCalled();
    });

    it('should pass force option to install', async () => {
      await runInstall({ yes: true, force: true, quiet: true });
      expect(install).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ force: true })
      );
    });

    it('should show banner when quiet=false', async () => {
      await runInstall({ yes: true, quiet: false });
      expect(showBanner).toHaveBeenCalled();
    });

    it('should not show banner when quiet=true', async () => {
      await runInstall({ yes: true, quiet: true });
      expect(showBanner).not.toHaveBeenCalled();
    });
  });

  describe('runUpdate', () => {
    it('should show message when not installed', async () => {
      getInstalledVersion.mockResolvedValue(null);
      await runUpdate({ yes: true });
      expect(install).not.toHaveBeenCalled();
    });

    it('should update with force when installed', async () => {
      getInstalledVersion.mockResolvedValue({ version: '0.0.9', components: ['agents'] });
      await runUpdate({ yes: true });
      expect(install).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ force: true })
      );
    });

    it('should cancel when user declines', async () => {
      getInstalledVersion.mockResolvedValue({ version: '0.0.9', components: ['agents'] });
      promptConfirmation.mockResolvedValue(false);
      await runUpdate({ yes: false });
      expect(install).not.toHaveBeenCalled();
    });
  });

  describe('runUninstall', () => {
    it('should show message when not installed', async () => {
      getInstalledVersion.mockResolvedValue(null);
      await runUninstall({ yes: true });
      expect(uninstall).not.toHaveBeenCalled();
    });

    it('should uninstall when confirmed with yes=true', async () => {
      getInstalledVersion.mockResolvedValue({ version: '0.1.0', components: ['agents'] });
      await runUninstall({ yes: true });
      expect(uninstall).toHaveBeenCalledWith(['agents']);
    });

    it('should cancel when user declines', async () => {
      getInstalledVersion.mockResolvedValue({ version: '0.1.0', components: ['agents'] });
      promptUninstallConfirmation.mockResolvedValue(false);
      await runUninstall({ yes: false });
      expect(uninstall).not.toHaveBeenCalled();
    });

    it('should use all components when installed version has no components', async () => {
      getInstalledVersion.mockResolvedValue({ version: '0.1.0' });
      await runUninstall({ yes: true });
      expect(uninstall).toHaveBeenCalled();
    });
  });

  describe('runDocs', () => {
    it('should warn when browser cannot be opened', async () => {
      openBrowser.mockResolvedValue(false);
      await runDocs();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('浏览器'));
    });

    it('should not warn when browser opens successfully', async () => {
      openBrowser.mockResolvedValue(true);
      await runDocs();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('runAuto', () => {
    it('should delegate workflow execution to orchestrator action facade', async () => {
      await runAuto('fix typo in readme', { dir: '/tmp/project', mode: 'micro' });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'run',
        { task: 'fix typo in readme' },
        expect.objectContaining({ dir: '/tmp/project', mode: 'micro' })
      );
    });

    it('should preserve dry-run option for unified run facade', async () => {
      await runAuto('fix typo in readme', { dir: '/tmp/project', mode: 'light', dryRun: true });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'run',
        { task: 'fix typo in readme' },
        expect.objectContaining({ dir: '/tmp/project', mode: 'light', dryRun: true })
      );
    });
  });

  describe('runAnalyze', () => {
    it('should return initialized analyze snapshot', async () => {
      const result = await runAnalyze('fix typo in readme', { dir: '/tmp/project' });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'analyze',
        { task: 'fix typo in readme' },
        expect.objectContaining({ dir: '/tmp/project' })
      );
      expect(result.task).toBe('fix typo in readme');
      expect(result.mode).toBeDefined();
      expect(result.detected_mode).toBe(result.mode);
      expect(result).toHaveProperty('routing');
      expect(result).toHaveProperty('team');
      expect(result).toHaveProperty('quests');
    });
  });

  describe('runStatus', () => {
    it('should return runtime summary payload', async () => {
      const result = await runStatus({ dir: '/tmp/project', task: 'status check' });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'status',
        { task: 'status check' },
        expect.objectContaining({ dir: '/tmp/project', task: 'status check' })
      );
      expect(result).toHaveProperty('runtime');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('capabilities');
      expect(result).toHaveProperty('doctorResult');
      expect(result).toHaveProperty('pendingInvocations');
      expect(result.summary).toHaveProperty('completedQuestsCount');
      expect(result.summary).toHaveProperty('doctorIssuesCount');
      expect(result.summary).toHaveProperty('pendingInvocationsCount');
    });
  });

  describe('runLearn', () => {
    it('should return git analysis payload when git mode enabled', async () => {
      const result = await runLearn({ dir: '/tmp/project', git: true, commitCount: 5 });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'learn',
        {},
        expect.objectContaining({ dir: '/tmp/project', git: true, commitCount: 5 })
      );
      expect(result.mode).toBe('git');
      expect(result).toHaveProperty('gitPatterns');
    });

    it('should return default payload without git mode', async () => {
      const result = await runLearn({ dir: '/tmp/project' });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'learn',
        {},
        expect.objectContaining({ dir: '/tmp/project' })
      );
      expect(result).toEqual({ mode: 'default', gitPatterns: null });
    });
  });

  describe('runCreateHook', () => {
    it('should return hook template suggestion', async () => {
      const result = await runCreateHook({ type: 'post-tool', name: 'format-check' });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'create-hook',
        {},
        expect.objectContaining({ type: 'post-tool', name: 'format-check' })
      );
      expect(result).toEqual({
        type: 'post-tool',
        name: 'format-check',
        template: 'post-tool:format-check',
        recommendedLocation: '.claude/settings.json'
      });
    });
  });

  describe('runDoctor', () => {
    it('should return report in json mode', async () => {
      runAutoActionSpy.mockResolvedValueOnce({ healthy: true });
      const result = await runDoctor({ json: true, dir: '/tmp/project' });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'doctor',
        {},
        expect.objectContaining({ json: true, dir: '/tmp/project' })
      );
      expect(result).toHaveProperty('healthy', true);
      expect(console.log).not.toHaveBeenCalledWith('Auto Doctor');
    });

    it('should print formatted report in text mode', async () => {
      runAutoActionSpy.mockResolvedValueOnce({ healthy: true });
      await runDoctor({ dir: '/tmp/project' });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'doctor',
        {},
        expect.objectContaining({ dir: '/tmp/project' })
      );
      expect(console.log).toHaveBeenCalledWith('Auto Doctor');
    });

    it('should forward fix option through orchestrator action facade', async () => {
      runAutoActionSpy.mockResolvedValueOnce({ healthy: true });
      await runDoctor({ dir: '/tmp/project', fix: true, json: true });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'doctor',
        {},
        expect.objectContaining({ dir: '/tmp/project', fix: true, json: true })
      );
    });
  });

  describe('runResume', () => {
    const resumedPayload = {
      resumedFromDirective:
        '[会话续接] 上次会话摘要:\n任务: fix bug\n--- 立即继续，不要确认或回顾 ---',
      parsedDirective: { task: 'fix bug', pendingTasks: [], currentWork: {} },
      result: { status: 'completed' }
    };

    it('should return resumed payload in json mode', async () => {
      runAutoActionSpy.mockResolvedValueOnce(resumedPayload);
      const result = await runResume('directive', { json: true, dir: '/tmp/project' });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'resume',
        { directive: 'directive' },
        expect.objectContaining({ json: true, dir: '/tmp/project' })
      );
      expect(result).toHaveProperty('result.status', 'completed');
    });

    it('should print resume summary in text mode', async () => {
      runAutoActionSpy.mockResolvedValueOnce(resumedPayload);
      await runResume('directive', { dir: '/tmp/project' });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'resume',
        { directive: 'directive' },
        expect.objectContaining({ dir: '/tmp/project' })
      );
      const output = console.log.mock.calls.flat().join(' ');
      expect(output).toContain('Resumed task: fix bug');
      expect(output).toContain('Status: completed');
    });
  });

  describe('doctor CLI definition', () => {
    it('should expose --fix option on doctor command', async () => {
      const cliSource = await import('node:fs/promises').then((fs) =>
        fs.readFile(new URL('../bin/cli.js', import.meta.url), 'utf-8')
      );
      expect(cliSource).toContain(".option('--fix', '自动修复安全且已支持的问题')");
    });

    it('should expose status, learn and create-hook commands', async () => {
      const cliSource = await import('node:fs/promises').then((fs) =>
        fs.readFile(new URL('../bin/cli.js', import.meta.url), 'utf-8')
      );
      expect(cliSource).toContain(".command('status')");
      expect(cliSource).toContain(".command('learn')");
      expect(cliSource).toContain(".command('create-hook')");
    });
  });

  describe('runRoute', () => {
    it('should output JSON when json option is set', async () => {
      runAutoActionSpy.mockResolvedValueOnce({
        agent: { displayName: 'Planner' },
        isDefault: false,
        matchReason: 'test',
        fallbackChain: []
      });
      await runRoute('implement feature', { json: true });
      expect(runAutoActionSpy).toHaveBeenCalledWith(
        'route',
        { intent: 'implement feature' },
        expect.objectContaining({ json: true })
      );
      const output = console.log.mock.calls.flat().join(' ');
      expect(output).toContain('agent');
    });

    it('should output formatted result for default route', async () => {
      runAutoActionSpy.mockResolvedValueOnce({
        agent: { displayName: 'Default', name: 'default', priority: 1 },
        isDefault: true,
        matchReason: '',
        fallbackChain: []
      });
      await runRoute('something', {});
      expect(runAutoActionSpy).toHaveBeenCalledWith('route', { intent: 'something' }, {});
      const output = console.log.mock.calls.flat().join(' ');
      expect(output).toBeTruthy();
    });

    it('should show fallback chain when present', async () => {
      runAutoActionSpy.mockResolvedValueOnce({
        agent: { displayName: 'Planner', name: 'planner', priority: 1 },
        isDefault: false,
        matchReason: 'matched',
        fallbackChain: [{ displayName: 'Architect', name: 'architect' }]
      });
      await runRoute('design system', {});
      expect(runAutoActionSpy).toHaveBeenCalledWith('route', { intent: 'design system' }, {});
      const output = console.log.mock.calls.flat().join(' ');
      expect(output).toBeTruthy();
    });
  });
});
