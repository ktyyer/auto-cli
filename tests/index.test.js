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
  uninstall: vi.fn().mockResolvedValue([])
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
  logger: { warn: vi.fn() },
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
  runRoute
} from '../src/index.js';
import { install, uninstall } from '../src/installer.js';
import {
  showBanner,
  promptConfirmation,
  promptUninstallConfirmation,
  promptMainMenu
} from '../src/prompts.js';
import { getInstalledVersion, openBrowser } from '../src/utils.js';
import { logger } from '../src/logger.js';

describe('index.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('runRoute', () => {
    const mockRoute = vi.fn();
    const mockInitialize = vi.fn();
    const mockDiagnose = vi.fn().mockResolvedValue({ agentCount: 5, initialized: true });

    beforeEach(() => {
      vi.doMock('../src/router/canonical-router.js', () => ({
        CanonicalRouter: class {
          constructor() {}
          initialize = mockInitialize.mockResolvedValue(undefined);
          route = mockRoute;
          diagnose = mockDiagnose;
        }
      }));
      vi.doMock('../src/router/agent-registry.js', () => ({
        AgentRegistry: class {}
      }));
    });

    it('should output JSON when json option is set', async () => {
      mockRoute.mockResolvedValue({
        agent: { displayName: 'Planner' },
        isDefault: false,
        matchReason: 'test',
        fallbackChain: []
      });
      await runRoute('implement feature', { json: true });
      const output = console.log.mock.calls.flat().join(' ');
      expect(output).toContain('agent');
    });

    it('should output formatted result for default route', async () => {
      mockRoute.mockResolvedValue({
        agent: { displayName: 'Default', name: 'default', priority: 1 },
        isDefault: true,
        matchReason: '',
        fallbackChain: []
      });
      await runRoute('something', {});
      const output = console.log.mock.calls.flat().join(' ');
      expect(output).toBeTruthy();
    });

    it('should show fallback chain when present', async () => {
      mockRoute.mockResolvedValue({
        agent: { displayName: 'Planner', name: 'planner', priority: 1 },
        isDefault: false,
        matchReason: 'matched',
        fallbackChain: [{ displayName: 'Architect', name: 'architect' }]
      });
      await runRoute('design system', {});
      const output = console.log.mock.calls.flat().join(' ');
      expect(output).toBeTruthy();
    });
  });
});
