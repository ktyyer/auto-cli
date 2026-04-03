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
import { StrategyRegistry } from '../src/budget/compression-strategies.js';

describe('estimateTokens', () => {
  it('should estimate ~4 chars per token', () => {
    expect(estimateTokens(400)).toBe(100);
    expect(estimateTokens(401)).toBe(101); // ceil
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

    expect(updated.currentTokens).toBe(1000); // 4000/4
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

    expect(snap.currentTokens).toBe(3000); // 1000 + 2000
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
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 300000);
    expect(getContextStatus(snap)).toBe(CONTEXT_STATUS.ISOLATE_SUGGESTED); // 75k/100k
  });

  it('should return COMPRESS_REQUIRED at 90%', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 360000);
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
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 300000);
    const action = getSuggestedAction(snap);
    expect(action).toContain('subagent');
  });
});

describe('getContextSummary', () => {
  it('should return complete summary', () => {
    const snap = recordUsage(createContextSnapshot({ contextLimit: 100000 }), 40000);
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
    snap = recordUsage(snap, 200000); // 50k tokens
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
    monitor.record(40000);

    const summary = monitor.getSummary();
    expect(summary.tokens).toBe(10000);
    expect(summary.remaining).toBe(90000);
  });

  it('should support compaction', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    monitor.record(200000); // 50k tokens
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

  it('should have compress method', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    expect(typeof monitor.compress).toBe('function');
  });

  it('should return strategy registry', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    const registry = monitor.getStrategyRegistry();
    expect(registry).toBeDefined();
    expect(typeof registry.getAllStrategies).toBe('function');
  });

  it('should register custom compression strategy', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    const result = monitor.registerCompressionStrategy(99, {
      name: 'TEST_STRATEGY',
      shouldApply: () => ({ shouldApply: true, reason: 'test' }),
      execute: (snap) => snap
    });
    expect(result).toBe(true);
  });

  it('should execute compress and return result', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    monitor.record(12000, 'Bash: npm test');
    monitor.record(3000, 'Read: old file');

    const result = monitor.compress();
    expect(result).toBeDefined();
    expect(typeof result.applied).toBe('boolean');
    expect(typeof result.reducedTokens).toBe('number');
  });

  it('should accept custom strategyRegistry via constructor', () => {
    const customRegistry = new StrategyRegistry();
    const monitor = new ContextMonitor({
      contextLimit: 100000,
      strategyRegistry: customRegistry
    });
    expect(monitor.getStrategyRegistry()).toBe(customRegistry);
  });

  it('should keep compact method working', () => {
    const monitor = new ContextMonitor({ contextLimit: 100000 });
    monitor.record(200000); // 50k tokens
    monitor.compact(30000);
    expect(monitor.getSummary().tokens).toBe(20000);
  });
});
