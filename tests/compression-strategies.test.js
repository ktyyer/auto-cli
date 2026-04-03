import { describe, it, expect } from 'vitest';
import {
  COMPRESSION_LEVELS,
  COMPRESSION_NAMES,
  STRATEGY_DEFAULTS,
  createCompressionResult,
  truncateShouldApply,
  truncateExecute,
  snipShouldApply,
  snipExecute,
  microCompactShouldApply,
  microCompactExecute,
  collapseShouldApply,
  collapseExecute,
  autoCompactShouldApply,
  autoCompactExecute,
  StrategyRegistry
} from '../src/budget/compression-strategies.js';
import { createContextSnapshot, recordUsage } from '../src/budget/context-monitor.js';

function createLargeSnapshot(contextLimit = 100000) {
  let snap = createContextSnapshot({ contextLimit });
  // Add a large entry
  snap = recordUsage(snap, 12000, 'Bash: npm test');
  // Add a normal entry
  snap = recordUsage(snap, 500, 'Read: src/index.js');
  // Add old tool entries
  snap = recordUsage(snap, 3000, 'Read: src/old1.js');
  snap = recordUsage(snap, 4000, 'Grep: pattern');
  snap = recordUsage(snap, 2000, 'Bash: ls');
  // Add recent entries
  snap = recordUsage(snap, 600, 'Bash: recent');
  snap = recordUsage(snap, 800, 'Bash: recent2');
  return snap;
}

describe('COMPRESSION_LEVELS', () => {
  it('should have 5 levels', () => {
    expect(COMPRESSION_LEVELS.TRUNCATE).toBe(1);
    expect(COMPRESSION_LEVELS.SNIP).toBe(2);
    expect(COMPRESSION_LEVELS.MICRO_COMPACT).toBe(3);
    expect(COMPRESSION_LEVELS.COLLAPSE).toBe(4);
    expect(COMPRESSION_LEVELS.AUTO_COMPACT).toBe(5);
  });
});

describe('COMPRESSION_NAMES', () => {
  it('should map all levels to names', () => {
    expect(COMPRESSION_NAMES[1]).toBe('TRUNCATE');
    expect(COMPRESSION_NAMES[2]).toBe('SNIP');
    expect(COMPRESSION_NAMES[3]).toBe('MICRO_COMPACT');
    expect(COMPRESSION_NAMES[4]).toBe('COLLAPSE');
    expect(COMPRESSION_NAMES[5]).toBe('AUTO_COMPACT');
  });
});

describe('createCompressionResult', () => {
  it('should create frozen result', () => {
    const result = createCompressionResult({ applied: true, reducedTokens: 100 });
    expect(result.applied).toBe(true);
    expect(result.reducedTokens).toBe(100);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should default to not applied', () => {
    const result = createCompressionResult();
    expect(result.applied).toBe(false);
    expect(result.reducedTokens).toBe(0);
  });
});

// ---- TRUNCATE ----

describe('TRUNCATE strategy', () => {
  it('should detect large entries', () => {
    const snap = createLargeSnapshot();
    const check = truncateShouldApply(snap);
    expect(check.shouldApply).toBe(true);
  });

  it('should not apply without large entries', () => {
    let snap = createContextSnapshot({ contextLimit: 100000 });
    snap = recordUsage(snap, 500, 'Read: file');
    const check = truncateShouldApply(snap);
    expect(check.shouldApply).toBe(false);
  });

  it('should truncate large entries', () => {
    const snap = createLargeSnapshot();
    const originalTokens = snap.currentTokens;

    const result = truncateExecute(snap);
    expect(result.currentTokens).toBeLessThan(originalTokens);
    expect(result.history[0].truncated).toBe(true);
    expect(result.history[0].chars).toBe(STRATEGY_DEFAULTS.truncateKeep);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should preserve original chars in truncated entry', () => {
    const snap = createLargeSnapshot();
    const result = truncateExecute(snap);
    const truncated = result.history.find((h) => h.truncated);
    expect(truncated.originalChars).toBe(12000);
  });
});

// ---- SNIP ----

describe('SNIP strategy', () => {
  it('should detect old tool entries', () => {
    const snap = createLargeSnapshot();
    const check = snipShouldApply(snap);
    expect(check.shouldApply).toBe(true);
  });

  it('should remove old tool entries', () => {
    const snap = createLargeSnapshot();
    const originalTokens = snap.currentTokens;
    const originalLength = snap.history.length;

    const result = snipExecute(snap);
    expect(result.history.length).toBeLessThan(originalLength);
    expect(result.currentTokens).toBeLessThan(originalTokens);
  });

  it('should keep recent entries', () => {
    const snap = createLargeSnapshot();
    const result = snipExecute(snap);
    const labels = result.history.map((h) => h.label);
    expect(labels).toContain('Bash: recent');
    expect(labels).toContain('Bash: recent2');
  });
});

// ---- MICRO_COMPACT ----

describe('MICRO_COMPACT strategy', () => {
  it('should detect excess history', () => {
    let snap = createContextSnapshot({ contextLimit: 100000 });
    for (let i = 0; i < 30; i++) {
      snap = recordUsage(snap, 400, `entry-${i}`);
    }
    const check = microCompactShouldApply(snap, { microCompactKeepCount: 10 });
    expect(check.shouldApply).toBe(true);
  });

  it('should keep only recent N entries', () => {
    let snap = createContextSnapshot({ contextLimit: 100000 });
    for (let i = 0; i < 30; i++) {
      snap = recordUsage(snap, 400, `entry-${i}`);
    }

    const result = microCompactExecute(snap, { microCompactKeepCount: 10 });
    expect(result.history.length).toBe(10);
    expect(result.currentTokens).toBeLessThan(snap.currentTokens);
  });
});

// ---- COLLAPSE ----

describe('COLLAPSE strategy', () => {
  it('should detect consecutive duplicates', () => {
    let snap = createContextSnapshot({ contextLimit: 100000 });
    snap = recordUsage(snap, 1000, 'Read');
    snap = recordUsage(snap, 1000, 'Read');
    snap = recordUsage(snap, 1000, 'Read');
    snap = recordUsage(snap, 1000, 'Read');

    const check = collapseShouldApply(snap);
    expect(check.shouldApply).toBe(true);
  });

  it('should not apply with diverse labels', () => {
    let snap = createContextSnapshot({ contextLimit: 100000 });
    snap = recordUsage(snap, 1000, 'Read');
    snap = recordUsage(snap, 1000, 'Write');
    snap = recordUsage(snap, 1000, 'Bash');

    const check = collapseShouldApply(snap);
    expect(check.shouldApply).toBe(false);
  });

  it('should collapse consecutive entries', () => {
    let snap = createContextSnapshot({ contextLimit: 100000 });
    snap = recordUsage(snap, 1000, 'Read');
    snap = recordUsage(snap, 1000, 'Read');
    snap = recordUsage(snap, 1000, 'Read');
    snap = recordUsage(snap, 500, 'Write');

    const result = collapseExecute(snap);
    expect(result.history.length).toBeLessThan(snap.history.length);

    const collapsed = result.history.find((h) => h.collapsed);
    expect(collapsed).toBeDefined();
    expect(collapsed.originalCount).toBe(3);
  });
});

// ---- AUTO_COMPACT ----

describe('AUTO_COMPACT strategy', () => {
  it('should apply when near limit', () => {
    let snap = createContextSnapshot({ contextLimit: 10000 });
    snap = recordUsage(snap, 36000); // 90%+

    const check = autoCompactShouldApply(snap);
    expect(check.shouldApply).toBe(true);
  });

  it('should not apply when not near limit', () => {
    let snap = createContextSnapshot({ contextLimit: 100000 });
    snap = recordUsage(snap, 40000); // ~10%

    const check = autoCompactShouldApply(snap);
    expect(check.shouldApply).toBe(false);
  });
});

// ---- StrategyRegistry ----

describe('StrategyRegistry', () => {
  it('should have 5 built-in strategies', () => {
    const registry = new StrategyRegistry();
    expect(registry.getAllStrategies()).toHaveLength(5);
  });

  it('should register custom strategy', () => {
    const registry = new StrategyRegistry();
    const result = registry.register(10, {
      name: 'CUSTOM',
      shouldApply: () => ({ shouldApply: true, reason: 'test' }),
      execute: (snap) => snap
    });
    expect(result).toBe(true);
    expect(registry.getAllStrategies()).toHaveLength(6);
  });

  it('should reject invalid strategy', () => {
    const registry = new StrategyRegistry();
    const result = registry.register(10, { name: 'BAD' });
    expect(result).toBe(false);
  });

  it('should unregister strategy', () => {
    const registry = new StrategyRegistry();
    expect(registry.unregister(COMPRESSION_LEVELS.TRUNCATE)).toBe(true);
    expect(registry.getAllStrategies()).toHaveLength(4);
  });

  it('should execute chain and return result', () => {
    const registry = new StrategyRegistry();
    const snap = createLargeSnapshot();

    const result = registry.executeChain(snap);
    expect(result).toBeDefined();
    expect(result.reducedTokens).toBeGreaterThanOrEqual(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should get strategy by level', () => {
    const registry = new StrategyRegistry();
    const strategy = registry.getStrategy(COMPRESSION_LEVELS.TRUNCATE);
    expect(strategy).toBeDefined();
    expect(strategy.name).toBe('TRUNCATE');
  });

  it('should return undefined for non-existent level', () => {
    const registry = new StrategyRegistry();
    expect(registry.getStrategy(99)).toBeUndefined();
  });
});
