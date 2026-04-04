import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONTEXT_LIMIT,
  CONTEXT_THRESHOLDS,
  CONTEXT_STATUS,
  CONTEXT_ACTIONS,
  estimateTokens,
  createContextSnapshot,
  recordUsage,
  getContextStatus,
  getSuggestedAction,
  getContextSummary,
  applyCompaction,
  ContextMonitor
} from '../src/budget/context-monitor.js';

describe('estimateTokens', () => {
  it('should estimate ~3 chars per token (default conservative)', () => {
    expect(estimateTokens(300)).toBe(100);
    expect(estimateTokens(301)).toBe(101); // ceil
  });

  it('should handle zero', () => {
    expect(estimateTokens(0)).toBe(0);
  });
});

describe('createContextSnapshot', () => {
  it('should create with defaults', () => {
    const snap = createContextSnapshot();

    expect(snap.contextLimit).toBe(DEFAULT_CONTEXT_LIMIT);
    expect(snap.currentTokens).toBe(0);
    expect(snap.history).toHaveLength(0);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('should accept custom limit', () => {
    const snap = createContextSnapshot({ contextLimit: 100000 });
    expect(snap.contextLimit).toBe(100000);
  });
});

describe('recordUsage', () => {
  it('should track token usage immutably', () => {
    const snap = createContextSnapshot({ contextLimit: 100000 });
    const updated = recordUsage(snap, 4000, 'tool output');

    expect(updated.currentTokens).toBe(1334); // ceil(4000/3)
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0].label).toBe('tool output');
    expect(updated.history[0].chars).toBe(4000);

    // Original unchanged
    expect(snap.currentTokens).toBe(0);
  });

  it('should accumulate usage', () => {
    let snap = createContextSnapshot({ contextLimit: 100000 });
    snap = recordUsage(snap, 4000);
    snap = recordUsage(snap, 8000);

    expect(snap.currentTokens).toBe(4001); // ceil(4000/3) + ceil(8000/3) = 1334 + 2667
    expect(snap.history).toHaveLength(2);
  });
});

describe('getContextStatus', () => {
  it('should return OK for low usage', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 40000);
    expect(getContextStatus(snap)).toBe(CONTEXT_STATUS.OK); // 10k/100k = 10%
  });

  it('should return COMPRESS_SUGGESTED at 50%', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 200000);
    expect(getContextStatus(snap)).toBe(CONTEXT_STATUS.COMPRESS_SUGGESTED); // 50k/100k
  });

  it('should return ISOLATE_SUGGESTED at 75%', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 225000);
    expect(getContextStatus(snap)).toBe(CONTEXT_STATUS.ISOLATE_SUGGESTED); // 75k/100k
  });

  it('should return COMPRESS_REQUIRED at 90%', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 270000);
    expect(getContextStatus(snap)).toBe(CONTEXT_STATUS.COMPRESS_REQUIRED); // 90k/100k
  });

  it('should return OVERFLOW at 100%', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 400000);
    expect(getContextStatus(snap)).toBe(CONTEXT_STATUS.OVERFLOW); // 100k/100k
  });
});

describe('getSuggestedAction', () => {
  it('should return null for OK status', () => {
    const snap = createContextSnapshot({ contextLimit: 100000 });
    expect(getSuggestedAction(snap)).toBeNull();
  });

  it('should return compress suggestion at 50%', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 200000);
    const action = getSuggestedAction(snap);
    expect(action).toContain('压缩');
  });

  it('should return isolate suggestion at 75%', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 225000);
    const action = getSuggestedAction(snap);
    expect(action).toContain('subagent');
  });
});

describe('getContextSummary', () => {
  it('should return complete summary', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 30000);
    const summary = getContextSummary(snap);

    expect(summary.tokens).toBe(10000);
    expect(summary.limit).toBe(100000);
    expect(summary.remaining).toBe(90000);
    expect(summary.ratio).toBe(0.1);
    expect(summary.status).toBe(CONTEXT_STATUS.OK);
    expect(summary.action).toBeNull();
    expect(Object.isFrozen(summary)).toBe(true);
  });
});

describe('applyCompaction', () => {
  it('should reduce token count', () => {
    let snap = createContextSnapshot({ contextLimit: 100000 });
    snap = recordUsage(snap, 150000); // 50k tokens (ceil(150000/3))
    snap = applyCompaction(snap, 30000);

    expect(snap.currentTokens).toBe(20000);
  });

  it('should not go below zero', () => {
    let snap = createContextSnapshot();
    snap = recordUsage(snap, 400); // 100 tokens
    snap = applyCompaction(snap, 500);

    expect(snap.currentTokens).toBe(0);
  });
});

describe('ContextMonitor', () => {
  it('should wrap pure functions with state', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });

    const { status } = monitor.record(40000, 'tool output');
    expect(status).toBe(CONTEXT_STATUS.OK);
    expect(monitor.getStatus()).toBe(CONTEXT_STATUS.OK);
  });

  it('should return summary', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    monitor.record(30000);

    const summary = monitor.getSummary();
    expect(summary.tokens).toBe(10000);
    expect(summary.remaining).toBe(90000);
  });

  it('should support compaction', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    monitor.record(150000); // 50k tokens (ceil(150000/3))
    monitor.compact(30000);

    expect(monitor.getSummary().tokens).toBe(20000);
  });

  it('should return action', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    expect(monitor.getAction()).toBeNull();

    monitor.record(200000); // 50%
    expect(monitor.getAction()).toContain('压缩');
  });

  it('should expose snapshot', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    const snap = monitor.getSnapshot();
    expect(snap.contextLimit).toBe(100000);
    expect(Object.isFrozen(snap)).toBe(true);
  });
});
