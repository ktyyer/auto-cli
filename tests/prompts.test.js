import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockPrompt } = vi.hoisted(() => ({
  mockPrompt: vi.fn()
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: mockPrompt,
    Separator: class Separator {
      constructor() {
        this.type = 'separator';
      }
    }
  }
}));

vi.mock('chalk', () => ({
  default: {
    cyan: Object.assign((s) => s, { bold: (s) => s }),
    white: Object.assign((s) => s, { bold: (s) => s }),
    gray: (s) => s,
    yellow: (s) => s,
    green: (s) => s
  }
}));

vi.mock('../src/utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getClaudeDir: () => '/home/test/.claude',
    getPackageVersion: () => '0.1.0',
    getInstalledVersion: vi.fn().mockResolvedValue(null)
  };
});

import {
  showBanner,
  promptConfirmation,
  promptUninstallConfirmation,
  promptMainMenu
} from '../src/prompts.js';

describe('prompts.js', () => {
  beforeEach(() => {
    mockPrompt.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('showBanner', () => {
    it('should print version and target directory', () => {
      showBanner();
      const calls = console.log.mock.calls.flat().join(' ');
      expect(calls).toContain('0.1.0');
      expect(calls).toContain('/home/test/.claude');
    });

    it('should call console.log multiple times for banner lines', () => {
      showBanner();
      expect(console.log.mock.calls.length).toBeGreaterThan(5);
    });
  });

  describe('promptConfirmation', () => {
    it('should return true when user confirms', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });
      const result = await promptConfirmation('Proceed?');
      expect(result).toBe(true);
    });

    it('should return false when user declines', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });
      const result = await promptConfirmation('Proceed?');
      expect(result).toBe(false);
    });

    it('should use default message when none provided', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });
      await promptConfirmation();
      const callArgs = mockPrompt.mock.calls[0][0];
      expect(callArgs[0].message).toContain('安装');
    });

    it('should default to true for confirmation', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });
      await promptConfirmation('Test?');
      const callArgs = mockPrompt.mock.calls[0][0];
      expect(callArgs[0].default).toBe(true);
    });
  });

  describe('promptUninstallConfirmation', () => {
    it('should return true when user confirms', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });
      const result = await promptUninstallConfirmation();
      expect(result).toBe(true);
    });

    it('should default to false for uninstall', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });
      await promptUninstallConfirmation();
      const callArgs = mockPrompt.mock.calls[0][0];
      expect(callArgs[0].default).toBe(false);
    });
  });

  describe('promptComponentSelection', () => {
    it('should return selected components', async () => {
      mockPrompt.mockResolvedValue({ selectedComponents: ['agents', 'commands'] });
      const { promptComponentSelection } = await import('../src/prompts.js');
      const result = await promptComponentSelection();
      expect(result).toEqual(['agents', 'commands']);
    });

    it('should return null when no components selected', async () => {
      mockPrompt.mockResolvedValue({ selectedComponents: [] });
      const { promptComponentSelection } = await import('../src/prompts.js');
      const result = await promptComponentSelection();
      expect(result).toBeNull();
    });

    it('should mark installed components in choices', async () => {
      const { getInstalledVersion } = await import('../src/utils.js');
      getInstalledVersion.mockResolvedValue({ components: ['agents'] });
      mockPrompt.mockResolvedValue({ selectedComponents: ['agents'] });
      const { promptComponentSelection } = await import('../src/prompts.js');
      await promptComponentSelection();
      const choices = mockPrompt.mock.calls[0][0][0].choices;
      const agentChoice = choices.find((c) => c.value === 'agents');
      expect(agentChoice.name).toContain('已安装');
    });
  });

  describe('promptMainMenu', () => {
    it('should return selected action', async () => {
      mockPrompt.mockResolvedValue({ action: 'install' });
      const result = await promptMainMenu();
      expect(result).toBe('install');
    });

    it('should include install, update, uninstall, docs, exit choices', async () => {
      mockPrompt.mockResolvedValue({ action: 'exit' });
      await promptMainMenu();
      const choices = mockPrompt.mock.calls[0][0][0].choices;
      const values = choices.filter((c) => c.value).map((c) => c.value);
      expect(values).toContain('install');
      expect(values).toContain('update');
      expect(values).toContain('uninstall');
      expect(values).toContain('docs');
      expect(values).toContain('exit');
    });

    it('should disable update and uninstall when not installed', async () => {
      mockPrompt.mockResolvedValue({ action: 'install' });
      await promptMainMenu();
      const choices = mockPrompt.mock.calls[0][0][0].choices;
      const updateChoice = choices.find((c) => c.value === 'update');
      const uninstallChoice = choices.find((c) => c.value === 'uninstall');
      expect(updateChoice.disabled).toBeTruthy();
      expect(uninstallChoice.disabled).toBeTruthy();
    });
  });
});
