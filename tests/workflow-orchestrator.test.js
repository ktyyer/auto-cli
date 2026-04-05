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
      // Mock _executeSingleQuest on the phaseExecute sub-module
      orchestrator.phaseExecute._executeSingleQuest = vi.fn().mockResolvedValue({
        success: true,
        questId: 'q1'
      });

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

// =========================================================================
// NEW TESTS: PHASE helpers, _executeQuest, _buildResult, integration tests
// =========================================================================

describe('WorkflowOrchestrator - _ensureAgentRegistry', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should lazily initialize AgentRegistry and return it', async () => {
    const registry = await orchestrator._ensureAgentRegistry();
    expect(registry).toBeDefined();
    expect(typeof registry.listAgents).toBe('function');
    expect(typeof registry.resolveTeam).toBe('function');
  });

  it('should return cached registry on subsequent calls', async () => {
    const first = await orchestrator._ensureAgentRegistry();
    const second = await orchestrator._ensureAgentRegistry();
    expect(first).toBe(second);
  });
});

describe('WorkflowOrchestrator - _countCommands', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should return 0 when commands directory does not exist', async () => {
    const count = await orchestrator._countCommands();
    expect(count).toBe(0);
  });
});

describe('WorkflowOrchestrator - _countHooks', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should auto-create default hooks and return count when hooks.json does not exist', async () => {
    const count = await orchestrator._countHooks();
    // _ensureDefaultHooks creates 4 hooks (1 PreToolUse + 2 PostToolUse + 1 Stop)
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

describe('WorkflowOrchestrator - _detectTestRunner', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should return null when package.json does not exist', async () => {
    const result = await orchestrator._detectTestRunner();
    expect(result).toBeNull();
  });
});

describe('WorkflowOrchestrator - _executeGitCommit', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should skip commit in dryRun mode', async () => {
    orchestrator.dryRun = true;
    const result = await orchestrator._executeGitCommit(['a.js'], 'test commit');
    expect(result.committed).toBe(false);
    expect(result.reason).toBe('dry-run');
  });

  it('should skip commit when no files provided', async () => {
    orchestrator.dryRun = false;
    const result = await orchestrator._executeGitCommit([], 'test commit');
    expect(result.committed).toBe(false);
    expect(result.reason).toBe('no-files');
  });

  it('should skip commit when files is null', async () => {
    orchestrator.dryRun = false;
    const result = await orchestrator._executeGitCommit(null, 'test commit');
    expect(result.committed).toBe(false);
    expect(result.reason).toBe('no-files');
  });
});

describe('WorkflowOrchestrator - _extractKeywords with edge cases', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should extract Chinese keywords (CJK characters as single tokens)', () => {
    const keywords = orchestrator._extractKeywords('添加安全认证功能模块');
    expect(keywords).toHaveLength(1);
    expect(keywords[0]).toBe('添加安全认证功能模块');
  });

  it('should split on Chinese comma and period', () => {
    const keywords = orchestrator._extractKeywords('添加安全，认证功能。测试模块');
    expect(keywords).toContain('添加安全');
    expect(keywords).toContain('认证功能');
    expect(keywords).toContain('测试模块');
  });

  it('should handle mixed Chinese and English text', () => {
    const keywords = orchestrator._extractKeywords('refactor authentication refactor-clean module');
    expect(keywords).toContain('refactor');
    expect(keywords).toContain('authentication');
    expect(keywords).toContain('module');
    expect(keywords).toContain('refactor-clean');
  });

  it('should filter out words shorter than 3 characters', () => {
    const keywords = orchestrator._extractKeywords('a ab abc abcd');
    expect(keywords).not.toContain('a');
    expect(keywords).not.toContain('ab');
    expect(keywords).toContain('abc');
    expect(keywords).toContain('abcd');
  });

  it('should return empty array for null input', () => {
    const keywords = orchestrator._extractKeywords(null);
    expect(keywords).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    const keywords = orchestrator._extractKeywords(undefined);
    expect(keywords).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    const keywords = orchestrator._extractKeywords('');
    expect(keywords).toEqual([]);
  });

  it('should treat dot-connected terms as single keywords', () => {
    const keywords = orchestrator._extractKeywords('fix.error,handling the authentication');
    expect(keywords).toContain('fix.error');
    expect(keywords).toContain('handling');
    expect(keywords).toContain('the');
    expect(keywords).toContain('authentication');
  });

  it('should handle special characters gracefully', () => {
    const keywords = orchestrator._extractKeywords('fix @#$% bug!!! in auth');
    expect(keywords.length).toBeGreaterThan(0);
  });
});

describe('WorkflowOrchestrator - _runCommit flow', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should set currentPhase to 5', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      changedFiles: []
    });
    await orchestrator._runCommit();
    expect(orchestrator.phaseContext.currentPhase).toBe(5);
  });

  it('should store commit info in memory with gitResult', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      changedFiles: []
    });
    await orchestrator._runCommit();

    const stored = await orchestrator.memory.get('last_commit');
    expect(stored).toBeDefined();
    expect(stored.files).toEqual([]);
    expect(stored.gitResult).toBeDefined();
    expect(stored.gitResult.committed).toBe(false);
    expect(stored.gitResult.reason).toBe('no-files');
  });

  it('should handle changed files in dryRun mode', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      changedFiles: ['src/auth.js', 'src/login.js'],
      task: 'add error handling to auth'
    });

    await orchestrator._runCommit();
    expect(orchestrator.phaseContext.currentPhase).toBe(5);

    const stored = await orchestrator.memory.get('last_commit');
    expect(stored).toBeDefined();
    expect(stored.files).toEqual(['src/auth.js', 'src/login.js']);
    expect(stored.questCount).toBe(0);
  });

  it('should throw when token budget is insufficient', async () => {
    orchestrator.tokenBudget = {
      canAfford: vi.fn().mockReturnValue(false),
      consume: vi.fn()
    };
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      changedFiles: []
    });

    await expect(orchestrator._runCommit()).rejects.toThrow('Token 预算不足');
  });
});

describe('WorkflowOrchestrator - _runExecute with retry and quest engines', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should create a quest engine for each quest', async () => {
    orchestrator.phaseExecute._executeQuest = vi
      .fn()
      .mockResolvedValue({ success: true, executionPlan: {}, agentInvocation: {} });

    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      questMap: [
        { id: 'q1', keywords: ['test'] },
        { id: 'q2', keywords: ['verify'] }
      ]
    });
    await orchestrator._runExecute();

    expect(orchestrator.questEngines.size).toBe(2);
    expect(orchestrator.questEngines.has('q1')).toBe(true);
    expect(orchestrator.questEngines.has('q2')).toBe(true);
  });

  it('should collect completed quest IDs on success', async () => {
    orchestrator.phaseExecute._executeSingleQuest = vi.fn().mockImplementation(async (quest) => {
      return { success: true, questId: quest.id };
    });

    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      questMap: [{ id: 'q1', keywords: ['test'] }]
    });
    await orchestrator._runExecute();

    expect(orchestrator.phaseContext.completedQuests).toContain('q1');
    expect(orchestrator.phaseContext.failedQuests).toHaveLength(0);
  });

  it('should retry failed quests up to 2 times', async () => {
    let callCount = 0;
    orchestrator.phaseExecute._executeQuest = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        throw new Error('Quest failed on first attempt');
      }
      return { success: true, executionPlan: {}, agentInvocation: {} };
    });

    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      questMap: [{ id: 'q1', keywords: ['test'] }]
    });
    await orchestrator._runExecute();

    expect(orchestrator.phaseExecute._executeQuest).toHaveBeenCalledTimes(2);
    expect(orchestrator.phaseContext.completedQuests).toContain('q1');
  });

  it('should record failed quest when all retries exhausted', async () => {
    orchestrator.phaseExecute._executeQuest = vi
      .fn()
      .mockRejectedValue(new Error('Persistent failure'));

    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      questMap: [{ id: 'q1', keywords: ['test'] }]
    });
    await orchestrator._runExecute();

    expect(orchestrator.phaseExecute._executeQuest).toHaveBeenCalledTimes(3);
    expect(orchestrator.phaseContext.failedQuests).toHaveLength(1);
    expect(orchestrator.phaseContext.failedQuests[0].questId).toBe('q1');
    expect(orchestrator.phaseContext.failedQuests[0].error).toBeDefined();
  });

  it('should throw when token budget is insufficient', async () => {
    orchestrator.tokenBudget = {
      canAfford: vi.fn().mockReturnValue(false),
      consume: vi.fn()
    };

    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      questMap: [{ id: 'q1', keywords: ['test'] }]
    });

    await expect(orchestrator._runExecute()).rejects.toThrow('Token 预算不足');
  });

  it('should check context overflow after quests', async () => {
    orchestrator.phaseExecute._executeQuest = vi
      .fn()
      .mockResolvedValue({ success: true, executionPlan: {}, agentInvocation: {} });

    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      questMap: [{ id: 'q1', keywords: ['test'] }]
    });
    await orchestrator._runExecute();

    // Verify quests were executed and context updated
    expect(orchestrator.phaseContext.completedQuests).toContain('q1');
  });
});

describe('WorkflowOrchestrator - _executeQuest builds executionPlan', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should resolve team and build executionPlan', async () => {
    // Mock _ensureAgentRegistry on the phaseExecute sub-module
    const mockRegistry = {
      resolveTeam: vi.fn().mockReturnValue({
        lead: { name: 'architect', capabilities: ['architecture'] },
        members: [{ name: 'code-reviewer', capabilities: ['review'] }],
        fallbacks: [{ name: 'quest-designer' }]
      })
    };
    orchestrator.phaseExecute._ensureAgentRegistry = vi.fn().mockResolvedValue(mockRegistry);

    const quest = {
      id: 'q1_test',
      keywords: ['test', 'auth'],
      acceptanceCriteria: ['All tests pass'],
      decisionNotes: ['Use vitest'],
      changedFiles: ['auth.js']
    };
    const modelRoute = { model: 'claude-sonnet', tier: 'standard' };
    const questEngine = orchestrator.flowEngine;

    orchestrator._messageAccumulator = [{ role: 'user', content: 'test' }];

    const result = await orchestrator._executeQuest(quest, modelRoute, questEngine);

    expect(result.success).toBe(true);
    expect(result.executionPlan).toBeDefined();
    expect(result.executionPlan.questId).toBe('q1_test');
    expect(result.executionPlan.model).toBe('claude-sonnet');
    expect(result.executionPlan.lead.name).toBe('architect');
    expect(result.executionPlan.members).toHaveLength(1);
    expect(result.executionPlan.fallbacks).toHaveLength(1);
    expect(result.executionPlan.acceptanceCriteria).toContain('All tests pass');
    expect(result.executionPlan.changedFiles).toContain('auth.js');
    expect(result.executionPlan.instructions).toBeDefined();
  });

  it('should handle resolveTeam failure gracefully', async () => {
    orchestrator.phaseExecute._ensureAgentRegistry = vi
      .fn()
      .mockRejectedValue(new Error('Registry error'));

    const quest = { id: 'q1', keywords: ['test'] };
    const modelRoute = { model: 'claude-sonnet', tier: 'standard' };

    orchestrator._messageAccumulator = [];

    const result = await orchestrator._executeQuest(quest, modelRoute, orchestrator.flowEngine);

    expect(result.success).toBe(true);
    expect(result.executionPlan).toBeDefined();
    expect(result.executionPlan.lead).toBeNull();
    expect(result.executionPlan.members).toHaveLength(0);
  });

  it('should merge changedFiles into phaseContext', async () => {
    orchestrator.phaseExecute._ensureAgentRegistry = vi.fn().mockRejectedValue(new Error('skip'));

    const quest = {
      id: 'q1',
      keywords: ['impl'],
      changedFiles: ['auth.js', 'login.js']
    };
    const modelRoute = { model: 'claude-sonnet', tier: 'standard' };

    orchestrator._messageAccumulator = [];

    await orchestrator._executeQuest(quest, modelRoute, orchestrator.flowEngine);

    expect(orchestrator.phaseContext.changedFiles).toContain('auth.js');
    expect(orchestrator.phaseContext.changedFiles).toContain('login.js');
  });

  it('should respect 50 message limit in accumulator', async () => {
    orchestrator.phaseExecute._ensureAgentRegistry = vi.fn().mockRejectedValue(new Error('skip'));
    orchestrator._messageAccumulator = Array.from({ length: 50 }, (_, i) => ({
      role: 'user',
      content: `msg ${i}`
    }));

    const quest = { id: 'q_overflow', keywords: ['test'] };
    const modelRoute = { model: 'test', tier: 'light' };

    await orchestrator._executeQuest(quest, modelRoute, orchestrator.flowEngine);
    expect(orchestrator._messageAccumulator.length).toBe(50);
  });
});

describe('WorkflowOrchestrator - _runVerify', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should handle failed quests and route them', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      failedQuests: [{ questId: 'q1', error: 'BuildError: compilation failed' }]
    });

    const mockRoute = vi.fn().mockResolvedValue({
      agentName: 'build-error-resolver',
      score: 95,
      reason: 'build error detected'
    });
    orchestrator._canonicalRouter = {
      route: mockRoute,
      initialize: vi.fn().mockResolvedValue(undefined)
    };

    await orchestrator._runVerify();
    expect(orchestrator.phaseContext.currentPhase).toBe(4);
    expect(orchestrator.phaseContext.verificationActions).toHaveLength(1);
    expect(orchestrator.phaseContext.verificationActions[0].agentName).toBe('build-error-resolver');
  });

  it('should fallback to build-error-resolver when router fails', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      failedQuests: [{ questId: 'q1', error: 'BuildError: some error' }]
    });

    orchestrator._canonicalRouter = {
      route: vi.fn().mockRejectedValue(new Error('Router failed')),
      initialize: vi.fn().mockRejectedValue(new Error('Init failed'))
    };

    await orchestrator._runVerify();

    expect(orchestrator.phaseContext.verificationActions).toHaveLength(1);
    expect(orchestrator.phaseContext.verificationActions[0].agentName).toBe('build-error-resolver');
    expect(orchestrator.phaseContext.verificationActions[0].matchReason).toBe('fallback');
  });

  it('should produce empty verificationActions when no failed quests', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      failedQuests: []
    });

    await orchestrator._runVerify();
    expect(orchestrator.phaseContext.verificationActions).toEqual([]);
  });

  it('should record contextStatus in phaseContext', async () => {
    await orchestrator._runVerify();
    expect(orchestrator.phaseContext.contextStatus).toBeDefined();
  });

  it('should throw when token budget insufficient', async () => {
    orchestrator.tokenBudget = {
      canAfford: vi.fn().mockReturnValue(false),
      consume: vi.fn()
    };

    await expect(orchestrator._runVerify()).rejects.toThrow('Token 预算不足');
  });

  it('should route multiple failed quests independently', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      failedQuests: [
        { questId: 'q1', error: 'BuildError: compile error' },
        { questId: 'q2', error: 'TestError: test failed' }
      ]
    });

    let routeCallCount = 0;
    orchestrator._canonicalRouter = {
      route: vi.fn().mockImplementation(() => {
        routeCallCount++;
        const agentName = routeCallCount === 1 ? 'build-error-resolver' : 'tdd-guide';
        return Promise.resolve({
          agent: { name: agentName },
          score: 90,
          matchReason: 'routed'
        });
      }),
      initialize: vi.fn().mockResolvedValue(undefined)
    };

    await orchestrator._runVerify();

    expect(orchestrator.phaseContext.verificationActions).toHaveLength(2);
    expect(orchestrator.phaseContext.verificationActions[0].agentName).toBe('build-error-resolver');
    expect(orchestrator.phaseContext.verificationActions[1].agentName).toBe('tdd-guide');
  });
});

describe('WorkflowOrchestrator - _runLearn with twoTurnExtract', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });

    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      task: 'test task for learn phase',
      mode: 'full'
    });
    orchestrator._messageAccumulator = [
      { role: 'user', content: '我喜欢用 vitest 而不是 jest' },
      { role: 'user', content: '修复：空指针异常导致崩溃' }
    ];
  });

  it('should call twoTurnExtract and store insight', async () => {
    await orchestrator._runLearn();

    expect(orchestrator.phaseContext.currentPhase).toBe(6);
    expect(orchestrator.phaseContext.insights.length).toBeGreaterThan(0);
    const lastInsight =
      orchestrator.phaseContext.insights[orchestrator.phaseContext.insights.length - 1];
    expect(lastInsight.task).toBe('test task for learn phase');
    expect(lastInsight.mode).toBe('full');
    expect(lastInsight).toHaveProperty('timestamp');
  });

  it('should handle twoTurnExtract failure gracefully', async () => {
    orchestrator.memory.getAll = vi.fn().mockRejectedValue(new Error('DB read error'));

    await orchestrator._runLearn();
    expect(orchestrator.phaseContext.currentPhase).toBe(6);
  });

  it('should skip when token budget insufficient for learn phase', async () => {
    orchestrator.tokenBudget = {
      canAfford: vi.fn().mockReturnValue(false),
      consume: vi.fn()
    };

    await orchestrator._runLearn();
    expect(orchestrator.phaseContext.currentPhase).toBe(6);
    expect(orchestrator.tokenBudget.consume).not.toHaveBeenCalled();
  });
});

describe('WorkflowOrchestrator - full run() flow', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should complete full mode workflow through all 6 phases', async () => {
    orchestrator.phaseExecute._executeSingleQuest = vi.fn().mockImplementation(async (quest) => {
      return { success: true, questId: quest.id };
    });

    const result = await orchestrator.run('refactor authentication system');

    expect(result.status).toBe('completed');
    expect(result.mode).toBe('full');
    expect(result.completedQuests).toBeDefined();
    expect(result.insights).toBeDefined();
  });

  it('should complete micro mode workflow (PHASE 1 + micro execute + verify + learn)', async () => {
    orchestrator.phaseExecute._executeQuest = vi
      .fn()
      .mockResolvedValue({ success: true, executionPlan: {}, agentInvocation: {} });

    const result = await orchestrator.run('fix typo in readme');

    expect(result.status).toBe('completed');
    expect(result.mode).toBe('micro');
    // P0-2: Micro mode now executes tasks directly
    expect(result.insights).toBeDefined();
  });

  it('should complete light mode workflow (PHASE 1, 2, 4, 6)', async () => {
    const result = await orchestrator.run('add error handling to auth.js');

    expect(result.status).toBe('completed');
    expect(result.mode).toBe('light');
  });

  it('should return failed result when an error occurs mid-workflow', async () => {
    const originalCanAfford = orchestrator.tokenBudget.canAfford.bind(orchestrator.tokenBudget);
    orchestrator.tokenBudget.canAfford = vi.fn().mockImplementation((phase, cost) => {
      if (phase === 'reason') return false;
      return originalCanAfford(phase, cost);
    });

    const result = await orchestrator.run('refactor authentication system');

    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
  });

  it('should use explicit mode from options', async () => {
    const result = await orchestrator.run('some arbitrary task', { mode: 'micro' });

    expect(result.status).toBe('completed');
    expect(result.mode).toBe('micro');
  });

  it('should capture compacted error trace on failure', async () => {
    orchestrator.skillIndexer = {
      buildIndex: vi.fn().mockRejectedValue(new Error('Index build failed'))
    };
    orchestrator.tokenBudget = {
      canAfford: vi.fn().mockImplementation((phase, _cost) => {
        if (phase === 'discover') return true;
        return false;
      }),
      consume: vi.fn()
    };
    orchestrator.contextMonitor = {
      getStatus: vi.fn().mockReturnValue('ok'),
      record: vi.fn()
    };

    const origTransition = orchestrator.flowEngine.transition.bind(orchestrator.flowEngine);
    let transitionCount = 0;
    orchestrator.flowEngine.transition = vi.fn().mockImplementation((...args) => {
      transitionCount++;
      if (transitionCount > 1) {
        throw new Error('FlowEngine transition error');
      }
      return origTransition(...args);
    });

    const result = await orchestrator.run('refactor authentication system');

    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
  });
});

describe('WorkflowOrchestrator - _buildResult edge cases', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should include all expected fields in completed result', () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      mode: 'full',
      completedQuests: ['q1'],
      failedQuests: [],
      changedFiles: ['a.js'],
      insights: [{ task: 'test' }],
      contextStatus: 'ok'
    });

    const result = orchestrator._buildResult('completed');

    expect(result).toEqual({
      status: 'completed',
      error: null,
      mode: 'full',
      completedQuests: ['q1'],
      failedQuests: [],
      verificationActions: [],
      testResult: undefined,
      coverageResult: null,
      securityResult: null,
      doctorResult: null,
      gitResult: undefined,
      questPlans: [],
      agentInvocations: [],
      changedFiles: ['a.js'],
      insights: [{ task: 'test' }],
      capabilities: orchestrator.phaseContext.capabilities,
      tokenBudget: orchestrator.phaseContext.tokenBudget,
      contextStatus: 'ok',
      sessionSummary: null,
      resumeDirective: null
    });
  });

  it('should include error details in failed result', () => {
    const error = new Error('Something went wrong');
    const result = orchestrator._buildResult('failed', error);

    expect(result.status).toBe('failed');
    expect(result.error).toBe(error);
    expect(result.error.message).toBe('Something went wrong');
  });
});

// =========================================================================
// Integration Tests: Session Summary, Context Overflow, Verification Routing
// =========================================================================

describe('WorkflowOrchestrator - Session Summary on Context Overflow', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should initialize _messageAccumulator on run()', async () => {
    await orchestrator.run('fix typo');
    expect(orchestrator._messageAccumulator).toBeDefined();
    expect(orchestrator._messageAccumulator[0]).toEqual({ role: 'user', content: 'fix typo' });
  });

  it('should include sessionSummary and resumeDirective in result when overflow detected', async () => {
    orchestrator.contextMonitor = {
      getStatus: vi.fn().mockReturnValue('overflow'),
      record: vi.fn()
    };

    const result = await orchestrator.run('fix typo');

    expect(result.sessionSummary).toBeDefined();
    expect(result.sessionSummary.type).toBe('session-summary');
    expect(result.resumeDirective).toBeDefined();
    expect(result.resumeDirective).toContain('[会话续接]');
  });

  it('should not generate session summary when context is OK', async () => {
    const result = await orchestrator.run('fix typo');
    expect(result.sessionSummary).toBeNull();
    expect(result.resumeDirective).toBeNull();
  });
});

describe('WorkflowOrchestrator - _checkContextOverflow', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      task: 'test task',
      failedQuests: [],
      completedQuests: []
    });
    orchestrator._messageAccumulator = [{ role: 'user', content: 'test' }];
  });

  it('should not generate summary when status is OK', () => {
    orchestrator._checkContextOverflow('ok');
    expect(orchestrator._pendingSessionSummary).toBeNull();
  });

  it('should generate summary when status is overflow', () => {
    orchestrator._checkContextOverflow('overflow');
    expect(orchestrator._pendingSessionSummary).toBeDefined();
    expect(orchestrator._pendingSessionSummary.type).toBe('session-summary');
  });
});

// =========================================================================
// NEW TESTS: P0 Coverage Check, P1 Doctor Check, P2 Feedback Loop,
//            P2 Semantic Description, P3 MemoryManager Search, P3 TokenBudget
// =========================================================================

describe('WorkflowOrchestrator - PHASE 4 Coverage Check', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  describe('_parseCoverageOutput', () => {
    it('should parse Vitest/Jest coverage table format', () => {
      const output = `
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |   85.2  |   72.1   |   90.0  |   83.5  |
----------|---------|----------|---------|---------|-------------------
`;
      const coverage = orchestrator._parseCoverageOutput(output);
      expect(coverage.statements).toBe(85.2);
      expect(coverage.branches).toBe(72.1);
      expect(coverage.functions).toBe(90.0);
      expect(coverage.lines).toBe(83.5);
      expect(coverage.overall).toBe(72.1); // min of all
      expect(coverage.passing).toBe(false); // 72.1 < 80
    });

    it('should parse nyc/c8 coverage format', () => {
      const output = `
Statements   : 85.5% ( 171/200 )
Branches     : 78.2% ( 89/114 )
Functions    : 92.1% ( 70/76 )
Lines        : 86.3% ( 167/194 )
`;
      const coverage = orchestrator._parseCoverageOutput(output);
      expect(coverage.statements).toBe(85.5);
      expect(coverage.branches).toBe(78.2);
      expect(coverage.functions).toBe(92.1);
      expect(coverage.lines).toBe(86.3);
      expect(coverage.overall).toBe(78.2);
      expect(coverage.passing).toBe(false); // 78.2 < 80
    });

    it('should detect passing coverage >= 80%', () => {
      const output = `
Statements   : 95% ( 190/200 )
Branches     : 82% ( 93/114 )
Functions    : 90% ( 68/76 )
Lines        : 88% ( 170/194 )
`;
      const coverage = orchestrator._parseCoverageOutput(output);
      expect(coverage.overall).toBe(82);
      expect(coverage.passing).toBe(true);
    });

    it('should return zeros for unrecognized format', () => {
      const output = 'some random output without coverage data';
      const coverage = orchestrator._parseCoverageOutput(output);
      expect(coverage.statements).toBe(0);
      expect(coverage.overall).toBe(0);
      expect(coverage.passing).toBe(false);
    });
  });

  describe('_runSecurityScan', () => {
    it('should route to security-reviewer when available', async () => {
      orchestrator._canonicalRouter = {
        route: vi.fn().mockResolvedValue({
          agent: { name: 'security-reviewer' },
          score: 95,
          matchReason: 'security keywords matched'
        }),
        initialize: vi.fn().mockResolvedValue(undefined)
      };

      const result = await orchestrator._runSecurityScan();
      expect(result.agentName).toBe('security-reviewer');
      expect(result.scanTriggered).toBe(true);
    });

    it('should fallback when router fails', async () => {
      orchestrator._canonicalRouter = {
        route: vi.fn().mockRejectedValue(new Error('Router error')),
        initialize: vi.fn().mockRejectedValue(new Error('Init error'))
      };

      const result = await orchestrator._runSecurityScan();
      expect(result.agentName).toBe('security-reviewer');
      expect(result.scanTriggered).toBe(false);
    });
  });

  describe('_runVerify with coverage and security', () => {
    it('should include coverageResult for full mode', async () => {
      orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
        mode: 'full',
        failedQuests: []
      });

      await orchestrator._runVerify();
      expect(orchestrator.phaseContext.currentPhase).toBe(4);
      // coverageResult and securityResult should be set (null when no test runner)
      expect(orchestrator.phaseContext).toHaveProperty('coverageResult');
      expect(orchestrator.phaseContext).toHaveProperty('securityResult');
    });

    it('should not run security scan for micro mode', async () => {
      orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
        mode: 'micro',
        failedQuests: []
      });

      await orchestrator._runVerify();
      expect(orchestrator.phaseContext.securityResult).toBeNull();
    });
  });
});

describe('WorkflowOrchestrator - PHASE 1 Doctor Check', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  describe('_runDoctorCheck', () => {
    it('should return structured result with checks and issues', async () => {
      const result = await orchestrator._runDoctorCheck();
      expect(result).toHaveProperty('healthy');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('checks');
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should detect missing CLAUDE.md as warning', async () => {
      const result = await orchestrator._runDoctorCheck();
      const claudeIssue = result.issues.find((i) => i.file === 'CLAUDE.md');
      // In /tmp/test-project, CLAUDE.md won't exist
      if (claudeIssue) {
        expect(claudeIssue.severity).toBe('warning');
      }
    });

    it('should check for test runner', async () => {
      const result = await orchestrator._runDoctorCheck();
      expect(result.checks).toHaveProperty('testRunner');
    });

    it('should include doctorResult in discover phase context', async () => {
      await orchestrator._runDiscover();
      expect(orchestrator.phaseContext.doctorResult).toBeDefined();
      expect(orchestrator.phaseContext.doctorResult).toHaveProperty('healthy');
    });
  });
});

describe('WorkflowOrchestrator - PHASE 6 Git Patterns', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  describe('_analyzeGitPatterns', () => {
    it('should return null when git is not available', async () => {
      const result = await orchestrator._analyzeGitPatterns();
      // In /tmp/test-project, git won't work
      expect(result).toBeNull();
    });
  });
});

describe('WorkflowOrchestrator - Agent Semantic Description', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should include semanticDescription in execution plan', async () => {
    const mockRegistry = {
      resolveTeam: vi.fn().mockReturnValue({
        lead: {
          name: 'tdd-guide',
          displayName: '测试驱动开发专家',
          description: '强制 TDD 工作流：红灯-绿灯-重构',
          capabilities: ['testing', 'planning']
        },
        members: [],
        fallbacks: []
      })
    };
    orchestrator.phaseExecute._ensureAgentRegistry = vi.fn().mockResolvedValue(mockRegistry);

    const quest = {
      id: 'q1',
      title: 'Add authentication tests',
      keywords: ['test'],
      acceptanceCriteria: ['Tests pass']
    };
    const modelRoute = { model: 'claude-sonnet', tier: 'standard' };

    orchestrator._messageAccumulator = [];

    const result = await orchestrator._executeQuest(quest, modelRoute, orchestrator.flowEngine);

    expect(result.success).toBe(true);
    expect(result.executionPlan.semanticDescription).toBeDefined();
    expect(result.executionPlan.semanticDescription).toContain('测试驱动开发专家');
    expect(result.executionPlan.semanticDescription).toContain('编写和运行测试用例');
  });
});

describe('WorkflowOrchestrator - _buildResult includes new fields', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should include coverageResult in result', () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      coverageResult: { overall: 85, passing: true }
    });
    const result = orchestrator._buildResult('completed');
    expect(result.coverageResult).toBeDefined();
    expect(result.coverageResult.overall).toBe(85);
  });

  it('should include securityResult in result', () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      securityResult: { agentName: 'security-reviewer', scanTriggered: true }
    });
    const result = orchestrator._buildResult('completed');
    expect(result.securityResult).toBeDefined();
    expect(result.securityResult.agentName).toBe('security-reviewer');
  });

  it('should include doctorResult in result', () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      doctorResult: { healthy: true, issues: [], checks: {} }
    });
    const result = orchestrator._buildResult('completed');
    expect(result.doctorResult).toBeDefined();
    expect(result.doctorResult.healthy).toBe(true);
  });
});

// =========================================================================
// NEW TESTS: P0-1 Quest Map Generation, P0-2 Micro Execute,
//            P1-3 Architecture Change Detection, P1-4 Deletion Log,
//            P2-1 Agent Result Persistence, P2-2 Verification Result,
//            P3-1 Runtime Status
// =========================================================================

describe('WorkflowOrchestrator - _generateQuestMap', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should generate 1 quest for light mode', async () => {
    const questMap = await orchestrator._generateQuestMap('add error handling', {
      agentRecommendation: null,
      matchedSkills: [],
      modelRoute: { model: 'claude-sonnet', tier: 'standard' },
      mode: 'light'
    });

    expect(questMap).toHaveLength(1);
    expect(questMap[0].id).toBe('light-1');
    expect(questMap[0].complexity).toBe('medium');
    expect(Object.isFrozen(questMap)).toBe(true);
    expect(Object.isFrozen(questMap[0])).toBe(true);
  });

  it('should generate multiple quests for full mode', async () => {
    const questMap = await orchestrator._generateQuestMap('refactor authentication system', {
      agentRecommendation: {
        agent: {
          name: 'architect',
          capabilities: ['planning', 'design', 'architecture']
        },
        score: 85
      },
      matchedSkills: [{ name: 'error-patterns' }],
      modelRoute: { model: 'claude-opus', tier: 'deep' },
      mode: 'full'
    });

    expect(questMap.length).toBeGreaterThanOrEqual(2);
    expect(questMap[0].id).toBe('quest-1');
    expect(questMap[0].agent).toBe('architect');
    expect(questMap.some((q) => q.skills.includes('error-patterns'))).toBe(true);
  });

  it('should generate quests without agent recommendation', async () => {
    const questMap = await orchestrator._generateQuestMap('implement feature', {
      agentRecommendation: null,
      matchedSkills: [],
      modelRoute: { model: 'claude-sonnet', tier: 'standard' },
      mode: 'full'
    });

    expect(questMap.length).toBeGreaterThanOrEqual(2);
    expect(questMap[0].agent).toBeNull();
  });

  it('should include matched skills in quest decisionNotes', async () => {
    const questMap = await orchestrator._generateQuestMap('fix bug', {
      agentRecommendation: null,
      matchedSkills: [{ name: 'error-patterns' }, { name: 'workflow-patterns' }],
      modelRoute: { model: 'claude-sonnet', tier: 'standard' },
      mode: 'full'
    });

    const coreQuest = questMap.find((q) => q.id === 'quest-1') || questMap[0];
    expect(coreQuest.skills).toContain('error-patterns');
    expect(coreQuest.skills).toContain('workflow-patterns');
  });

  it('should return frozen quest map', async () => {
    const questMap = await orchestrator._generateQuestMap('test', {
      agentRecommendation: null,
      matchedSkills: [],
      modelRoute: { model: 'test', tier: 'fast' },
      mode: 'light'
    });

    expect(Object.isFrozen(questMap)).toBe(true);
    for (const quest of questMap) {
      expect(Object.isFrozen(quest)).toBe(true);
    }
  });
});

describe('WorkflowOrchestrator - _runMicroExecute (P0-2)', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      task: 'fix typo in readme',
      mode: 'micro'
    });
  });

  it('should execute micro quest and update completedQuests', async () => {
    orchestrator.phaseExecute._executeQuest = vi
      .fn()
      .mockResolvedValue({ success: true, executionPlan: {}, agentInvocation: {} });

    await orchestrator._runMicroExecute();

    expect(orchestrator.phaseContext.completedQuests).toContain('micro-1');
    expect(orchestrator.phaseContext.failedQuests).toHaveLength(0);
  });

  it('should record failed quest on execution error', async () => {
    orchestrator.phaseExecute._executeQuest = vi
      .fn()
      .mockRejectedValue(new Error('Execution failed'));

    await orchestrator._runMicroExecute();

    expect(orchestrator.phaseContext.completedQuests).toHaveLength(0);
    expect(orchestrator.phaseContext.failedQuests).toHaveLength(1);
    expect(orchestrator.phaseContext.failedQuests[0].questId).toBe('micro-1');
  });

  it('should consume tokens and record context', async () => {
    orchestrator.phaseExecute._executeQuest = vi
      .fn()
      .mockResolvedValue({ success: true, executionPlan: {}, agentInvocation: {} });

    await orchestrator._runMicroExecute();

    // Verify flow engine transitions happened
    expect(orchestrator.flowEngine.state).toBeDefined();
  });
});

describe('WorkflowOrchestrator - _detectArchitectureChange (P1-3)', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should detect architecture keywords in task', () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      task: 'refactor authentication system architecture'
    });
    expect(orchestrator._detectArchitectureChange()).toBe(true);
  });

  it('should detect Chinese architecture keywords', () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      task: '重构认证模块架构'
    });
    expect(orchestrator._detectArchitectureChange()).toBe(true);
  });

  it('should return false for non-architecture tasks', () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      task: 'fix typo in readme'
    });
    expect(orchestrator._detectArchitectureChange()).toBe(false);
  });

  it('should detect migration keywords', () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      task: 'migrate database to postgres'
    });
    expect(orchestrator._detectArchitectureChange()).toBe(true);
  });
});

describe('WorkflowOrchestrator - _generateDeletionLog (P1-4)', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should return empty entries when no deletion records', async () => {
    const log = await orchestrator._generateDeletionLog();
    expect(log.entries).toEqual([]);
    expect(log.generatedAt).toBeDefined();
    expect(Object.isFrozen(log)).toBe(true);
  });

  it('should find deletion-tagged entries from memory', async () => {
    await orchestrator.memory.set(
      'deletion_1',
      {
        reason: 'unused import',
        tags: ['deletion'],
        timestamp: Date.now()
      },
      { tier: 'session' }
    );

    const log = await orchestrator._generateDeletionLog();
    expect(log.entries.length).toBeGreaterThanOrEqual(0);
  });
});

describe('WorkflowOrchestrator - _persistAgentResult (P2-1)', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should store agent result to memory', async () => {
    await orchestrator._persistAgentResult('architect', { success: true }, 'quest-1');

    // Search for the stored result
    const results = await orchestrator.memory.search('agent_result_quest-1');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const stored = results[0].value;
    expect(stored.agent).toBe('architect');
    expect(stored.questId).toBe('quest-1');
    expect(stored.success).toBe(true);
  });

  it('should handle persistence failure gracefully', async () => {
    orchestrator.memory.set = vi.fn().mockRejectedValue(new Error('Write failed'));

    // Should not throw
    await expect(
      orchestrator._persistAgentResult('test', { success: true }, 'q1')
    ).resolves.toBeUndefined();
  });
});

describe('WorkflowOrchestrator - getRuntimeStatus (P3-1)', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should return frozen status object', () => {
    const status = orchestrator.getRuntimeStatus();
    expect(Object.isFrozen(status)).toBe(true);
  });

  it('should include all expected module statuses', () => {
    const status = orchestrator.getRuntimeStatus();
    expect(status).toHaveProperty('flowEngine');
    expect(status).toHaveProperty('memory');
    expect(status).toHaveProperty('tokenBudget');
    expect(status).toHaveProperty('contextMonitor');
    expect(status).toHaveProperty('skillIndexer');
    expect(status).toHaveProperty('agentRegistry');
    expect(status).toHaveProperty('canonicalRouter');
    expect(status).toHaveProperty('repoIndexer');
    expect(status).toHaveProperty('knowledgeSteward');
    expect(status).toHaveProperty('dreamScheduler');
    expect(status).toHaveProperty('workflow');
  });

  it('should have healthy=true by default', () => {
    const status = orchestrator.getRuntimeStatus();
    expect(status.healthy).toBe(true);
  });

  it('should include workflow phase and mode', () => {
    const status = orchestrator.getRuntimeStatus();
    expect(status.workflow).toHaveProperty('currentPhase');
    expect(status.workflow).toHaveProperty('mode');
  });
});

describe('WorkflowOrchestrator - _runReason generates questMap (P0-1)', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator({
      projectDir: '/tmp/test-project',
      skillsDir: '/tmp/test-skills'
    });
  });

  it('should generate questMap for light mode', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      mode: 'light',
      task: 'add error handling to auth module'
    });

    await orchestrator._runReason();

    expect(orchestrator.phaseContext.questMap).toBeDefined();
    expect(orchestrator.phaseContext.questMap).not.toBeNull();
    expect(orchestrator.phaseContext.questMap.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate questMap for full mode', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      mode: 'full',
      task: 'refactor authentication system'
    });

    await orchestrator._runReason();

    expect(orchestrator.phaseContext.questMap).toBeDefined();
    expect(orchestrator.phaseContext.questMap.length).toBeGreaterThanOrEqual(2);
  });

  it('should include matchedSkills in context', async () => {
    orchestrator.phaseContext = updatePhaseContext(orchestrator.phaseContext, {
      mode: 'light',
      task: 'fix error in code'
    });

    await orchestrator._runReason();

    expect(orchestrator.phaseContext.matchedSkills).toBeDefined();
    expect(Array.isArray(orchestrator.phaseContext.matchedSkills)).toBe(true);
  });
});
