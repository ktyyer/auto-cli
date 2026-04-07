import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCheckStatus, mockInstall, mockRunDoctorCheck } = vi.hoisted(() => ({
  mockCheckStatus: vi.fn(),
  mockInstall: vi.fn(),
  mockRunDoctorCheck: vi.fn()
}));

vi.mock('../src/installer.js', () => ({
  checkStatus: mockCheckStatus,
  install: mockInstall
}));

vi.mock('../src/workflow/workflow-orchestrator.js', () => ({
  WorkflowOrchestrator: class {
    constructor({ projectDir }) {
      this.projectDir = projectDir;
      this.phaseDiscover = {
        runDoctorCheck: mockRunDoctorCheck
      };
    }
  }
}));

import { runDoctorChecks, formatDoctorReport } from '../src/doctor.js';

describe('doctor.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunDoctorCheck.mockResolvedValue({
      healthy: true,
      issues: [],
      checks: { hooksConfigured: true },
      recommendedActions: [],
      fixesApplied: [],
      fixesSkipped: [],
      changedFiles: []
    });
    mockCheckStatus.mockResolvedValue({
      commands: { installed: true, path: '/tmp/.claude/commands', fileCount: 6 },
      agents: { installed: true, path: '/tmp/.claude/agents', fileCount: 5 }
    });
    mockInstall.mockResolvedValue({ installedFiles: [], skippedFiles: [] });
  });

  it('should return combined doctor report in read-only mode', async () => {
    const result = await runDoctorChecks({ dir: '/tmp/project' });

    expect(mockRunDoctorCheck).toHaveBeenCalledWith({ fix: false, source: 'cli' });
    expect(mockInstall).not.toHaveBeenCalled();
    expect(result.fixRequested).toBe(false);
    expect(result.installStatus.commands.installed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('should install missing components when fix mode is enabled', async () => {
    mockCheckStatus
      .mockResolvedValueOnce({
        commands: { installed: false, path: '/tmp/.claude/commands', fileCount: 0 },
        agents: { installed: true, path: '/tmp/.claude/agents', fileCount: 5 }
      })
      .mockResolvedValueOnce({
        commands: { installed: true, path: '/tmp/.claude/commands', fileCount: 6 },
        agents: { installed: true, path: '/tmp/.claude/agents', fileCount: 5 }
      });

    const result = await runDoctorChecks({ dir: '/tmp/project', fix: true });

    expect(mockRunDoctorCheck).toHaveBeenCalledWith({ fix: true, source: 'cli' });
    expect(mockInstall).toHaveBeenCalledWith(['commands'], { backup: false, force: false });
    expect(result.fixRequested).toBe(true);
    expect(result.fixesApplied).toEqual([
      expect.objectContaining({
        action: 'install-missing-components',
        components: ['commands']
      })
    ]);
    expect(result.issues).toEqual([]);
  });

  it('should expose missing components as issues when fix is not requested', async () => {
    mockCheckStatus.mockResolvedValue({
      commands: { installed: false, path: '/tmp/.claude/commands/auto', fileCount: 0 }
    });

    const result = await runDoctorChecks({ dir: '/tmp/project', fix: false });

    expect(mockInstall).not.toHaveBeenCalled();
    expect(result.issues).toEqual([expect.objectContaining({ component: 'commands' })]);
    expect(result.recommendedActions).toEqual([
      expect.objectContaining({ action: 'install-component', component: 'commands' })
    ]);
  });

  it('should collect skipped fixes when component installation fails', async () => {
    mockCheckStatus.mockResolvedValue({
      commands: { installed: false, path: '/tmp/.claude/commands/auto', fileCount: 0 }
    });
    mockInstall.mockRejectedValue(new Error('permission denied'));

    const result = await runDoctorChecks({ dir: '/tmp/project', fix: true });

    expect(result.fixesApplied).toEqual([]);
    expect(result.fixesSkipped).toEqual([
      expect.objectContaining({
        action: 'install-missing-components',
        reason: 'permission denied'
      })
    ]);
    expect(result.issues).toEqual([expect.objectContaining({ component: 'commands' })]);
  });

  it('should render fix details in formatted report', () => {
    const output = formatDoctorReport({
      projectDir: '/tmp/project',
      healthy: true,
      issues: [],
      installStatus: {
        commands: { installed: true, fileCount: 2 }
      },
      recommendedActions: [],
      fixesApplied: [
        { action: 'generate-repo-map', reason: 'cli 自动生成 REPO_MAP.md' },
        { action: 'install-missing-components', components: ['commands', 'agents'] }
      ],
      fixesSkipped: [{ action: 'generate-hooks-config', reason: 'already exists' }],
      changedFiles: ['D:/tmp/project/REPO_MAP.md']
    });

    expect(output).toContain('已应用修复');
    expect(output).toContain('generate-repo-map');
    expect(output).toContain('install-missing-components: commands, agents');
    expect(output).toContain('跳过的修复');
    expect(output).toContain('修复变更文件');
  });
});
