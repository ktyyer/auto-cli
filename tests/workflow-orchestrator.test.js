/**
 * Workflow Orchestrator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowOrchestrator } from '../src/workflow/workflow-orchestrator.js';
import {
  createPhaseContext,
  updatePhaseContext,
  detectExecutionMode,
  EXECUTION_MODES,
  PHASE_NAMES
} from '../src/workflow/phase-context.js';

describe('WorkflowOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  describe('构造函数', () => {
    it('should initialize all core modules', () => {
      expect(orchestrator.flowEngine).toBeDefined();
      expect(orchestrator.memory).toBeDefined();
      expect(orchestrator.tokenBudget).toBeDefined();
      expect(orchestrator.contextMonitor).toBeDefined();
      expect(orchestrator.skillIndexer).toBeDefined();
    });

    it('should initialize with empty phase context', () => {
      expect(orchestrator.phaseContext).toBeDefined();
      expect(orchestrator.phaseContext.mode).toBe(EXECUTION_MODES.FULL);
      expect(orchestrator.phaseContext.currentPhase).toBe(0);
    });
  });

  describe('模式检测', () => {
    it('should detect micro mode for typo fix', () => {
      const mode = detectExecutionMode('fix typo in readme');
      expect(mode).toBe(EXECUTION_MODES.MICRO);
    });

    it('should detect micro mode for simple patterns', () => {
      const mode = detectExecutionMode('update readme');
      expect(mode).toBe(EXECUTION_MODES.MICRO);
    });

    it('should detect light mode for error handling', () => {
      const mode = detectExecutionMode('add error handling to auth.js');
      expect(mode).toBe(EXECUTION_MODES.LIGHT);
    });

    it('should detect full mode for architecture changes', () => {
      const mode = detectExecutionMode('refactor authentication system');
      expect(mode).toBe(EXECUTION_MODES.FULL);
    });

    it('should use explicit mode when provided', () => {
      const mode = detectExecutionMode('some task', { mode: 'light' });
      expect(mode).toBe(EXECUTION_MODES.LIGHT);
    });
  });

  describe('PHASE 上下文', () => {
    it('should create valid phase context', () => {
      const ctx = createPhaseContext({
        mode: 'full',
        task: 'test task',
        techStack: ['javascript']
      });

      expect(ctx.mode).toBe('full');
      expect(ctx.task).toBe('test task');
      expect(ctx.techStack).toContain('javascript');
      expect(Object.isFrozen(ctx)).toBe(true);
    });

    it('should update phase context immutably', () => {
      const ctx1 = createPhaseContext({ mode: 'full' });
      const ctx2 = updatePhaseContext(ctx1, { mode: 'light' });

      expect(ctx1.mode).toBe('full');
      expect(ctx2.mode).toBe('light');
      expect(Object.isFrozen(ctx2)).toBe(true);
    });

    it('should track completed quests', () => {
      const ctx = createPhaseContext({ completedQuests: ['q1'] });
      const ctx2 = updatePhaseContext(ctx, {
        completedQuests: [...ctx.completedQuests, 'q2']
      });

      expect(ctx.completedQuests).toHaveLength(1);
      expect(ctx2.completedQuests).toHaveLength(2);
    });
  });

  describe('run 方法', () => {
    it('should return result object with status', async () => {
      const result = await orchestrator.run('test task');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('mode');
      expect(['completed', 'failed']).toContain(result.status);
    });

    it('should set execution mode based on task', async () => {
      await orchestrator.run('fix typo in readme');
      expect(orchestrator.phaseContext.mode).toBe(EXECUTION_MODES.MICRO);
    });
  });

  describe('getFlowState', () => {
    it('should return current flow engine state', () => {
      const state = orchestrator.getFlowState();
      expect(state).toBeDefined();
    });
  });

  describe('getContext', () => {
    it('should return current phase context', () => {
      const ctx = orchestrator.getContext();
      expect(ctx).toBeDefined();
      expect(Object.isFrozen(ctx)).toBe(true);
    });
  });
});

describe('Phase Context - immutability', () => {
  it('should freeze context object', () => {
    const ctx = createPhaseContext();
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('should freeze nested objects', () => {
    const ctx = createPhaseContext({
      capabilities: { skills: 5 }
    });
    expect(Object.isFrozen(ctx.capabilities)).toBe(true);
  });

  it('should freeze arrays', () => {
    const ctx = createPhaseContext({
      techStack: ['js', 'ts']
    });
    expect(Object.isFrozen(ctx.techStack)).toBe(true);
  });
});

describe('detectExecutionMode', () => {
  const testCases = [
    { task: 'fix typo', expected: EXECUTION_MODES.MICRO },
    { task: 'Fix Typo In README', expected: EXECUTION_MODES.MICRO },
    { task: 'add error handling', expected: EXECUTION_MODES.LIGHT },
    { task: 'fix bug in login', expected: EXECUTION_MODES.LIGHT },
    { task: 'refactor authentication', expected: EXECUTION_MODES.FULL },
    { task: '架构重构', expected: EXECUTION_MODES.FULL }
  ];

  testCases.forEach(({ task, expected }) => {
    it(`should detect ${expected} for "${task}"`, () => {
      expect(detectExecutionMode(task)).toBe(expected);
    });
  });
});

describe('PHASE_NAMES', () => {
  it('should have all 6 phases defined', () => {
    expect(PHASE_NAMES[1]).toBe('discover');
    expect(PHASE_NAMES[2]).toBe('reason');
    expect(PHASE_NAMES[3]).toBe('execute');
    expect(PHASE_NAMES[4]).toBe('verify');
    expect(PHASE_NAMES[5]).toBe('commit');
    expect(PHASE_NAMES[6]).toBe('learn');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(PHASE_NAMES)).toBe(true);
  });
});

describe('WorkflowOrchestrator - PHASE Methods', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  describe('_runDiscover', () => {
    it('should run discover phase and update context', async () => {
      await orchestrator._runDiscover();
      expect(orchestrator.phaseContext.currentPhase).toBe(1);
      expect(orchestrator.phaseContext.capabilities).toBeDefined();
    });
  });

  describe('_runReason', () => {
    it('should run reason phase with quest map', async () => {
      orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
        questMap: [{ id: 'q1', keywords: ['test'] }]
      });
      await orchestrator._runReason();
      expect(orchestrator.phaseContext.currentPhase).toBe(2);
    });
  });

  describe('_runExecute', () => {
    it('should skip execute when no quest map', async () => {
      orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
        questMap: null
      });
      await orchestrator._runExecute();
      expect(orchestrator.phaseContext.completedQuests).toHaveLength(0);
    });

    it('should execute quests from quest map', async () => {
      orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
        questMap: [{ id: 'q1', keywords: ['test'], changedFiles: ['file.js'] }]
      });
      await orchestrator._runExecute();
      expect(orchestrator.phaseContext.completedQuests).toContain('q1');
    });
  });

  describe('_runVerify', () => {
    it('should run verify phase', async () => {
      await orchestrator._runVerify();
      expect(orchestrator.phaseContext.currentPhase).toBe(4);
    });
  });

  describe('_runCommit', () => {
    it('should run commit phase', async () => {
      orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
        changedFiles: ['a.js', 'b.js']
      });
      await orchestrator._runCommit();
      expect(orchestrator.phaseContext.currentPhase).toBe(5);
    });
  });

  describe('_runLearn', () => {
    it('should run learn phase and store insight', async () => {
      orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
        task: 'test task',
        mode: 'full'
      });
      await orchestrator._runLearn();
      expect(orchestrator.phaseContext.currentPhase).toBe(6);
      expect(orchestrator.phaseContext.insights.length).toBeGreaterThan(0);
    });
  });

  describe('_extractKeywords', () => {
    it('should extract keywords from task', () => {
      const keywords = orchestrator._extractKeywords('add error handling to auth module');
      expect(keywords).toContain('error');
      expect(keywords).toContain('handling');
    });

    it('should return empty array for short words', () => {
      const keywords = orchestrator._extractKeywords('hi');
      expect(keywords).toHaveLength(0);
    });
  });

  describe('_buildResult', () => {
    it('should build result with completed status', () => {
      const result = orchestrator._buildResult('completed');
      expect(result.status).toBe('completed');
      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('completedQuests');
    });

    it('should build result with failed status', () => {
      const error = new Error('test error');
      const result = orchestrator._buildResult('failed', error);
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });
});

describe('WorkflowOrchestrator - Error Handling', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should handle token budget exceeded', async () => {
    // Set very low budget
    orchestrator.tokenBudget = {
      canAfford: () => false
    };

    const result = await orchestrator.run('test task');
    expect(result.status).toBe('failed');
  });
});

describe('updatePhaseContext - edge cases', () => {
  it('should handle null input', () => {
    const ctx = updatePhaseContext(null, { mode: 'full' });
    expect(ctx).toBeDefined();
    expect(ctx.mode).toBe('full');
  });

  it('should handle undefined input', () => {
    const ctx = updatePhaseContext(undefined, { mode: 'light' });
    expect(ctx).toBeDefined();
    expect(ctx.mode).toBe('light');
  });

  it('should deep freeze capabilities object', () => {
    const ctx1 = createPhaseContext({ capabilities: { skills: 5 } });
    const ctx2 = updatePhaseContext(ctx1, {
      capabilities: { skills: 10, agents: 3 }
    });
    expect(Object.isFrozen(ctx2.capabilities)).toBe(true);
  });
});

describe('EXECUTION_MODES', () => {
  it('should have all modes defined', () => {
    expect(EXECUTION_MODES.MICRO).toBe('micro');
    expect(EXECUTION_MODES.LIGHT).toBe('light');
    expect(EXECUTION_MODES.FULL).toBe('full');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(EXECUTION_MODES)).toBe(true);
  });
});
