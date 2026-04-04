import { describe, it, expect } from 'vitest';
import {
  COMPRESSION_LEVELS,
  _COMPRESSION_NAMES,
  _STATUS_TO_LEVEL,
  COMPRESSION_DEFAULTS,
  selectCompressionLevel,
  createCompressionResult,
  truncateLargeOutputs,
  snipOldToolOutputs,
  microCompactHistory,
  collapseConsecutive,
  autoCompactRecommend,
  compressContext,
  ContextCompressor,
  createSessionSummary,
  createResumeDirective
} from '../src/budget/context-compressor.js';
import { CONTEXT_STATUS, ContextMonitor } from '../src/budget/context-monitor.js';

// ─── Helpers ───────────────────────────────────────────

function createTestSnapshot(overrides = {}) {
  return Object.freeze({
    contextLimit: 200000,
    currentTokens: overrides.currentTokens ?? 5000,
    history: Object.freeze(overrides.history ?? []),
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}

function createHistoryEntry(chars, label = '') {
  return Object.freeze({
    tokens: Math.ceil(chars / 4),
    chars,
    label,
    cumulativeTokens: 0,
    timestamp: Date.now()
  });
}

// ─── selectCompressionLevel ────────────────────────────

describe('selectCompressionLevel', () => {
  it('should map COMPRESS_SUGGESTED to TRUNCATE', () => {
    expect(selectCompressionLevel(CONTEXT_STATUS.COMPRESS_SUGGESTED)).toBe(
      COMPRESSION_LEVELS.TRUNCATE
    );
  });

  it('should map ISOLATE_SUGGESTED to SNIP', () => {
    expect(selectCompressionLevel(CONTEXT_STATUS.ISOLATE_SUGGESTED)).toBe(COMPRESSION_LEVELS.SNIP);
  });

  it('should map COMPRESS_REQUIRED to MICRO_COMPACT', () => {
    expect(selectCompressionLevel(CONTEXT_STATUS.COMPRESS_REQUIRED)).toBe(
      COMPRESSION_LEVELS.MICRO_COMPACT
    );
  });

  it('should map OVERFLOW to AUTO_COMPACT', () => {
    expect(selectCompressionLevel(CONTEXT_STATUS.OVERFLOW)).toBe(COMPRESSION_LEVELS.AUTO_COMPACT);
  });

  it('should return 0 for OK status', () => {
    expect(selectCompressionLevel(CONTEXT_STATUS.OK)).toBe(0);
  });

  it('should return 0 for unknown status', () => {
    expect(selectCompressionLevel('unknown_status')).toBe(0);
  });
});

// ─── createCompressionResult ───────────────────────────

describe('createCompressionResult', () => {
  it('should create a frozen result', () => {
    const result = createCompressionResult({
      applied: true,
      level: 1,
      strategyName: 'TRUNCATE',
      reducedTokens: 100,
      originalTokens: 5000,
      newTokens: 4900,
      strategiesApplied: ['TRUNCATE']
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.reducedTokens).toBe(100);
  });

  it('should default optional fields', () => {
    const result = createCompressionResult({});

    expect(result.applied).toBe(false);
    expect(result.level).toBe(0);
    expect(result.strategiesApplied).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ─── truncateLargeOutputs ──────────────────────────────

describe('truncateLargeOutputs', () => {
  it('should truncate entries above threshold', () => {
    const snapshot = createTestSnapshot({
      currentTokens: 10000,
      history: [createHistoryEntry(15000, 'tool output'), createHistoryEntry(500, 'small')]
    });

    const result = truncateLargeOutputs(snapshot, { truncateThreshold: 10000, truncateKeep: 2000 });

    expect(result.history[0].chars).toBe(2000);
    expect(result.history[0].label).toContain('[truncated]');
    expect(result.history[1].chars).toBe(500);
    expect(result.currentTokens).toBeLessThan(snapshot.currentTokens);
  });

  it('should not modify small entries', () => {
    const snapshot = createTestSnapshot({
      history: [createHistoryEntry(500, 'small')]
    });

    const result = truncateLargeOutputs(snapshot);

    expect(result.history[0].chars).toBe(500);
  });

  it('should return frozen snapshot', () => {
    const snapshot = createTestSnapshot();
    const result = truncateLargeOutputs(snapshot);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.history)).toBe(true);
  });

  it('should not mutate original snapshot', () => {
    const entry = createHistoryEntry(15000, 'big');
    const snapshot = createTestSnapshot({ history: [entry] });

    truncateLargeOutputs(snapshot, { truncateThreshold: 10000, truncateKeep: 2000 });

    expect(entry.chars).toBe(15000);
  });
});

// ─── snipOldToolOutputs ────────────────────────────────

describe('snipOldToolOutputs', () => {
  it('should remove old tool outputs beyond keepRecent', () => {
    const snapshot = createTestSnapshot({
      currentTokens: 5000,
      history: [
        createHistoryEntry(1000, 'Read file1'),
        createHistoryEntry(1000, 'Bash command1'),
        createHistoryEntry(1000, 'Read file2'),
        createHistoryEntry(1000, 'Grep pattern'),
        createHistoryEntry(1000, 'Read file3')
      ]
    });

    const result = snipOldToolOutputs(snapshot, {
      snipKeepRecent: 2,
      snipToolTypes: ['Read', 'Bash', 'Grep', 'Glob']
    });

    // Should keep only the last 2 tool outputs
    const toolEntries = result.history.filter((e) =>
      ['Read', 'Bash', 'Grep', 'Glob'].some((t) => e.label.includes(t))
    );
    expect(toolEntries.length).toBeLessThanOrEqual(2);
  });

  it('should keep non-tool entries untouched', () => {
    const snapshot = createTestSnapshot({
      history: [
        createHistoryEntry(1000, 'user message'),
        createHistoryEntry(1000, 'Read file1'),
        createHistoryEntry(1000, 'assistant reply')
      ]
    });

    const result = snipOldToolOutputs(snapshot, { snipKeepRecent: 0 });

    const nonToolEntries = result.history.filter(
      (e) => !['Read', 'Bash', 'Grep', 'Glob'].some((t) => e.label.includes(t))
    );
    expect(nonToolEntries.length).toBe(2);
  });

  it('should return frozen snapshot', () => {
    const result = snipOldToolOutputs(createTestSnapshot());
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ─── microCompactHistory ───────────────────────────────

describe('microCompactHistory', () => {
  it('should keep only last N entries', () => {
    const history = Array.from({ length: 20 }, (_, i) => createHistoryEntry(1000, `entry-${i}`));
    const snapshot = createTestSnapshot({ currentTokens: 20000, history });

    const result = microCompactHistory(snapshot, { microCompactKeepCount: 5 });

    expect(result.history.length).toBe(5);
    expect(result.history[0].label).toBe('entry-15');
    expect(result.history[4].label).toBe('entry-19');
  });

  it('should not modify if under keep count', () => {
    const history = [createHistoryEntry(100, 'a'), createHistoryEntry(100, 'b')];
    const snapshot = createTestSnapshot({ history });

    const result = microCompactHistory(snapshot, { microCompactKeepCount: 10 });

    expect(result.history.length).toBe(2);
  });

  it('should reduce currentTokens', () => {
    const history = Array.from({ length: 20 }, () => createHistoryEntry(1000));
    const snapshot = createTestSnapshot({ currentTokens: 20000, history });

    const result = microCompactHistory(snapshot, { microCompactKeepCount: 5 });

    expect(result.currentTokens).toBeLessThan(snapshot.currentTokens);
  });

  it('should return frozen snapshot', () => {
    const result = microCompactHistory(createTestSnapshot());
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ─── collapseConsecutive ──────────────────────────────

describe('collapseConsecutive', () => {
  it('should collapse consecutive same-label entries', () => {
    const snapshot = createTestSnapshot({
      currentTokens: 10000,
      history: [
        createHistoryEntry(1000, 'Read'),
        createHistoryEntry(1000, 'Read'),
        createHistoryEntry(1000, 'Read'),
        createHistoryEntry(1000, 'Bash'),
        createHistoryEntry(1000, 'Bash'),
        createHistoryEntry(1000, 'Bash')
      ]
    });

    const result = collapseConsecutive(snapshot, { collapseWindowSize: 3 });

    expect(result.history.length).toBeLessThan(snapshot.history.length);
    expect(result.history.some((e) => e.label.includes('[x3]'))).toBe(true);
  });

  it('should not collapse groups smaller than windowSize', () => {
    const snapshot = createTestSnapshot({
      history: [
        createHistoryEntry(1000, 'Read'),
        createHistoryEntry(1000, 'Read'),
        createHistoryEntry(1000, 'Bash')
      ]
    });

    const result = collapseConsecutive(snapshot, { collapseWindowSize: 3 });

    expect(result.history.length).toBe(3);
  });

  it('should not modify if history is too short', () => {
    const snapshot = createTestSnapshot({
      history: [createHistoryEntry(100, 'a')]
    });

    const result = collapseConsecutive(snapshot, { collapseWindowSize: 3 });

    expect(result.history.length).toBe(1);
  });

  it('should return frozen snapshot', () => {
    const result = collapseConsecutive(createTestSnapshot());
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ─── autoCompactRecommend ──────────────────────────────

describe('autoCompactRecommend', () => {
  it('should return start_new_session when ratio >= 0.9', () => {
    const snapshot = createTestSnapshot({
      currentTokens: 190000,
      contextLimit: 200000
    });

    const result = autoCompactRecommend(snapshot);

    expect(result.recommendation).not.toBeNull();
    expect(result.recommendation.action).toBe('start_new_session');
    expect(result.recommendation.ratio).toBe(0.95);
    expect(result.recommendation.message).toContain('溢出');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should return use_compact when ratio < 0.9', () => {
    const snapshot = createTestSnapshot({
      currentTokens: 150000,
      contextLimit: 200000
    });

    const result = autoCompactRecommend(snapshot);

    expect(result.recommendation).not.toBeNull();
    expect(result.recommendation.action).toBe('use_compact');
    expect(result.recommendation.message).toContain('不足');
  });

  it('should not mutate original snapshot', () => {
    const snapshot = createTestSnapshot({ currentTokens: 190000 });
    const originalTokens = snapshot.currentTokens;

    autoCompactRecommend(snapshot);

    expect(snapshot.currentTokens).toBe(originalTokens);
  });
});

// ─── compressContext ───────────────────────────────────

describe('compressContext', () => {
  it('should return no-op for OK status', () => {
    const snapshot = createTestSnapshot({ currentTokens: 5000 });
    const result = compressContext(snapshot, CONTEXT_STATUS.OK);

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('无需压缩');
  });

  it('should apply TRUNCATE for COMPRESS_SUGGESTED', () => {
    const snapshot = createTestSnapshot({
      currentTokens: 100000,
      history: [createHistoryEntry(50000, 'huge output')]
    });

    const result = compressContext(snapshot, CONTEXT_STATUS.COMPRESS_SUGGESTED, {
      truncateThreshold: 10000,
      truncateKeep: 2000
    });

    expect(result.strategiesApplied).toContain('TRUNCATE');
  });

  it('should apply multiple strategies for COMPRESS_REQUIRED', () => {
    const history = Array.from({ length: 30 }, (_, i) => createHistoryEntry(1000, `entry-${i}`));
    const snapshot = createTestSnapshot({ currentTokens: 100000, history });

    const result = compressContext(snapshot, CONTEXT_STATUS.COMPRESS_REQUIRED);

    expect(result.strategiesApplied).toContain('TRUNCATE');
    expect(result.strategiesApplied).toContain('SNIP');
    expect(result.strategiesApplied).toContain('MICRO_COMPACT');
  });

  it('should apply all strategies for OVERFLOW', () => {
    const history = Array.from({ length: 30 }, (_, i) => createHistoryEntry(1000, `entry-${i}`));
    const snapshot = createTestSnapshot({ currentTokens: 200000, history });

    const result = compressContext(snapshot, CONTEXT_STATUS.OVERFLOW);

    expect(result.strategiesApplied).toContain('TRUNCATE');
    expect(result.strategiesApplied).toContain('SNIP');
    expect(result.strategiesApplied).toContain('MICRO_COMPACT');
    expect(result.strategiesApplied).toContain('COLLAPSE');
    expect(result.strategiesApplied).toContain('AUTO_COMPACT');
    expect(result.recommendation).not.toBeNull();
    expect(result.recommendation.action).toBe('start_new_session');
  });

  it('should return frozen result', () => {
    const snapshot = createTestSnapshot({ currentTokens: 100000 });
    const result = compressContext(snapshot, CONTEXT_STATUS.COMPRESS_SUGGESTED);

    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ─── ContextCompressor class ──────────────────────────

describe('ContextCompressor', () => {
  it('should not compress when status is OK', () => {
    const compressor = new ContextCompressor();
    const monitor = new ContextMonitor({ contextLimit: 200000 });

    const result = compressor.compress(monitor);

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('上下文状态正常');
  });

  it('should compress and update monitor when status is not OK', () => {
    const compressor = new ContextCompressor();
    const monitor = new ContextMonitor({ contextLimit: 20000 });

    // Fill to trigger compression (100K chars = 25K tokens > 50% of 20K limit... wait that overflows)
    // Fill context to 60% of limit
    monitor.record(500000, 'huge tool output');

    const beforeTokens = monitor.getSummary().tokens;
    const result = compressor.compress(monitor);
    const afterTokens = monitor.getSummary().tokens;

    // Should have attempted compression
    expect(result.level).toBeGreaterThan(0);
    if (result.applied) {
      expect(afterTokens).toBeLessThan(beforeTokens);
    }
  });

  it('should merge custom config with defaults', () => {
    const compressor = new ContextCompressor({ truncateThreshold: 5000 });
    const config = compressor.getConfig();

    expect(config.truncateThreshold).toBe(5000);
    expect(config.truncateKeep).toBe(COMPRESSION_DEFAULTS.truncateKeep);
    expect(Object.isFrozen(config)).toBe(true);
  });
});

// ─── createSessionSummary ─────────────────────────────────

describe('createSessionSummary', () => {
  it('should create a 9-section summary with correct structure', () => {
    const state = {
      task: 'Fix authentication bug',
      userMessages: ['Fix the login issue', 'Also check the token refresh'],
      errors: [{ message: 'Token expired', fix: 'Added refresh logic' }],
      pendingTasks: ['Write E2E test'],
      currentWork: { file: 'auth.js', line: 42 }
    };

    const summary = createSessionSummary(state);

    expect(summary.type).toBe('session-summary');
    expect(summary.version).toBe(2);
    expect(summary.sections).toBeDefined();
    expect(summary.sections.primaryRequest).toBe('Fix authentication bug');
    expect(summary.sections.keyConcepts).toEqual([]);
    expect(summary.sections.filesAndCode).toEqual([]);
    expect(summary.sections.errorsAndFixes).toEqual([
      { error: 'Token expired', fix: 'Added refresh logic' }
    ]);
    expect(summary.sections.problemSolving).toEqual([]);
    expect(summary.sections.userMessages).toEqual([
      'Fix the login issue',
      'Also check the token refresh'
    ]);
    expect(summary.sections.pendingTasks).toEqual(['Write E2E test']);
    expect(summary.sections.currentWork).toEqual({ file: 'auth.js', line: 42 });
    expect(summary.sections.nextStep).toBe('');
  });

  it('should handle empty input gracefully', () => {
    const summary = createSessionSummary({});

    expect(summary.sections.primaryRequest).toBe('');
    expect(summary.sections.userMessages).toEqual([]);
    expect(summary.sections.errorsAndFixes).toEqual([]);
    expect(summary.sections.pendingTasks).toEqual([]);
    expect(summary.sections.currentWork).toEqual({});
  });

  it('should produce immutable output', () => {
    const summary = createSessionSummary({ task: 'test' });

    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.sections)).toBe(true);
    expect(Object.isFrozen(summary.sections.userMessages)).toBe(true);
  });

  it('should preserve all user messages', () => {
    const messages = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];
    const summary = createSessionSummary({ userMessages: messages });

    expect(summary.sections.userMessages).toEqual(messages);
    expect(summary.sections.userMessages.length).toBe(5);
  });
});

// ─── createResumeDirective ────────────────────────────────

describe('createResumeDirective', () => {
  it('should generate resume directive from valid summary', () => {
    const summary = createSessionSummary({
      task: 'Implement caching',
      pendingTasks: ['Add Redis', 'Write tests'],
      currentWork: { file: 'cache.js' }
    });

    const directive = createResumeDirective(summary);

    expect(directive).toContain('[会话续接]');
    expect(directive).toContain('Implement caching');
    expect(directive).toContain('Add Redis; Write tests');
    expect(directive).toContain('立即继续');
  });

  it('should return empty string for null input', () => {
    expect(createResumeDirective(null)).toBe('');
  });

  it('should return empty string for non-summary input', () => {
    expect(createResumeDirective({ type: 'other' })).toBe('');
  });

  it('should omit pending tasks section when empty', () => {
    const summary = createSessionSummary({ task: 'simple fix' });
    const directive = createResumeDirective(summary);

    expect(directive).not.toContain('待办');
  });
});
