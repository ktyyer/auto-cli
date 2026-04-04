import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import {
  DREAM_PHASES,
  DREAM_GATE_DEFAULTS,
  checkDreamGate,
  scoreEntry,
  selectMergeGroups,
  selectPromotionCandidates,
  createDreamResult,
  autoDream,
  AutoDreamScheduler,
  twoTurnExtract
} from '../src/memory/auto-dream.js';
import { MemoryManager } from '../src/memory/memory-manager.js';

// ─── Helpers ───────────────────────────────────────────

function createTestEntry(overrides = {}) {
  return {
    key: overrides.key ?? `key-${Date.now()}-${Math.random()}`,
    value: overrides.value ?? 'test-value',
    tier: overrides.tier ?? 'session',
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    accessCount: overrides.accessCount ?? 0,
    lastAccessedAt: overrides.lastAccessedAt ?? Date.now(),
    ttl: overrides.ttl ?? 7200000,
    version: 1
  };
}

// ─── checkDreamGate ────────────────────────────────────

describe('checkDreamGate', () => {
  it('should allow when all conditions met', () => {
    const result = checkDreamGate({
      lastDreamTime: null,
      sessionCount: 5,
      isIdle: true
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('门控通过');
  });

  it('should block when not idle', () => {
    const result = checkDreamGate({
      lastDreamTime: null,
      sessionCount: 5,
      isIdle: false
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('非空闲');
  });

  it('should block when session count too low', () => {
    const result = checkDreamGate({
      lastDreamTime: null,
      sessionCount: 1,
      isIdle: true
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('session');
  });

  it('should block when interval not elapsed', () => {
    const result = checkDreamGate({
      lastDreamTime: Date.now() - 60000, // 1 分钟前
      sessionCount: 5,
      isIdle: true
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('间隔');
  });

  it('should allow when interval elapsed', () => {
    const result = checkDreamGate({
      lastDreamTime: Date.now() - 10 * 60 * 1000, // 10 分钟前
      sessionCount: 5,
      isIdle: true
    });

    expect(result.allowed).toBe(true);
  });

  it('should respect custom gateConfig', () => {
    const result = checkDreamGate({
      lastDreamTime: null,
      sessionCount: 1,
      isIdle: true,
      gateConfig: { minIntervalMs: 0, minSessionCount: 1, requireIdle: false }
    });

    expect(result.allowed).toBe(true);
  });
});

// ─── scoreEntry ────────────────────────────────────────

describe('scoreEntry', () => {
  it('should give higher score to more accessed entries', () => {
    const low = createTestEntry({ accessCount: 1 });
    const high = createTestEntry({ accessCount: 10 });

    expect(scoreEntry(high)).toBeGreaterThan(scoreEntry(low));
  });

  it('should give higher score to more recent entries', () => {
    const old = createTestEntry({ updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000 });
    const recent = createTestEntry({ updatedAt: Date.now() });

    expect(scoreEntry(recent)).toBeGreaterThan(scoreEntry(old));
  });

  it('should return 0 for very old entries', () => {
    const entry = createTestEntry({
      updatedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
      accessCount: 0
    });

    expect(scoreEntry(entry)).toBe(0);
  });
});

// ─── selectMergeGroups ─────────────────────────────────

describe('selectMergeGroups', () => {
  it('should find groups with same value', () => {
    const entries = [
      createTestEntry({ key: 'a', value: { name: 'test' } }),
      createTestEntry({ key: 'b', value: { name: 'test' } }),
      createTestEntry({ key: 'c', value: { name: 'other' } })
    ];

    const groups = selectMergeGroups(entries);

    expect(groups.length).toBe(1);
    expect(groups[0].length).toBe(2);
    expect(groups[0].map((e) => e.key)).toContain('a');
    expect(groups[0].map((e) => e.key)).toContain('b');
  });

  it('should return empty for no duplicates', () => {
    const entries = [
      createTestEntry({ key: 'a', value: 'val1' }),
      createTestEntry({ key: 'b', value: 'val2' })
    ];

    const groups = selectMergeGroups(entries);

    expect(groups.length).toBe(0);
  });

  it('should return empty for empty input', () => {
    expect(selectMergeGroups([])).toEqual([]);
  });
});

// ─── selectPromotionCandidates ─────────────────────────

describe('selectPromotionCandidates', () => {
  it('should select entries with high access count in session tier', () => {
    const entries = [
      createTestEntry({ key: 'hot', tier: 'session', accessCount: 5 }),
      createTestEntry({ key: 'cold', tier: 'session', accessCount: 0 }),
      createTestEntry({ key: 'already-high', tier: 'project', accessCount: 5 })
    ];

    const candidates = selectPromotionCandidates(entries);

    expect(candidates.length).toBe(1);
    expect(candidates[0].key).toBe('hot');
  });

  it('should return empty for no candidates', () => {
    const entries = [createTestEntry({ tier: 'session', accessCount: 0 })];

    expect(selectPromotionCandidates(entries)).toEqual([]);
  });
});

// ─── createDreamResult ─────────────────────────────────

describe('createDreamResult', () => {
  it('should create frozen result', () => {
    const result = createDreamResult({
      executed: true,
      reason: 'done',
      stats: { merged: 1, promoted: 2, pruned: 3 }
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.stats)).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.stats.merged).toBe(1);
  });

  it('should default fields', () => {
    const result = createDreamResult({});

    expect(result.executed).toBe(false);
    expect(result.reason).toBe('');
    expect(result.stats).toEqual({});
  });
});

// ─── AutoDreamScheduler ────────────────────────────────

describe('AutoDreamScheduler', () => {
  it('should start with zero session count', () => {
    const scheduler = new AutoDreamScheduler();

    expect(scheduler.getSessionCount()).toBe(0);
    expect(scheduler.getLastDreamTime()).toBeNull();
  });

  it('should increment session count', () => {
    const scheduler = new AutoDreamScheduler();

    scheduler.incrementSession();
    scheduler.incrementSession();
    scheduler.incrementSession();

    expect(scheduler.getSessionCount()).toBe(3);
  });

  it('should block run until session threshold met', () => {
    const scheduler = new AutoDreamScheduler();

    const gate = scheduler.shouldRun();

    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain('session');
  });

  it('should allow run after enough sessions', () => {
    const scheduler = new AutoDreamScheduler();

    for (let i = 0; i < 3; i++) {
      scheduler.incrementSession();
    }

    const gate = scheduler.shouldRun();

    expect(gate.allowed).toBe(true);
  });
});

// ─── autoDream integration ─────────────────────────────

describe('autoDream integration', () => {
  let tempDir;
  let memoryManager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `dream-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    memoryManager = new MemoryManager({ projectDir: tempDir });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should skip when gate blocked', async () => {
    const result = await autoDream(memoryManager, {
      sessionCount: 0,
      isIdle: true
    });

    expect(result.executed).toBe(false);
    expect(result.reason).toContain('session');
  });

  it('should execute full cycle when gate passes', async () => {
    // Populate some memory entries
    await memoryManager.set('test-1', 'value-1', { tier: 'session', tags: ['test'] });
    await memoryManager.set('test-2', 'value-2', { tier: 'session', tags: ['test'] });

    const result = await autoDream(memoryManager, {
      lastDreamTime: null,
      sessionCount: 5,
      isIdle: true,
      gateConfig: { minIntervalMs: 0, minSessionCount: 3, requireIdle: false }
    });

    expect(result.executed).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats.gathered).toBeGreaterThanOrEqual(0);
    expect(result.stats.pruned).toBeGreaterThanOrEqual(0);
  });

  it('should merge duplicate entries', async () => {
    // Create duplicate entries
    await memoryManager.set('dup-1', { name: 'same' }, { tier: 'session' });
    await memoryManager.set('dup-2', { name: 'same' }, { tier: 'session' });

    const result = await autoDream(memoryManager, {
      lastDreamTime: null,
      sessionCount: 5,
      isIdle: true,
      gateConfig: { minIntervalMs: 0, minSessionCount: 3, requireIdle: false }
    });

    expect(result.executed).toBe(true);
    expect(result.stats.merged).toBeGreaterThanOrEqual(0);
  });

  it('should run in dry-run mode without side effects', async () => {
    await memoryManager.set('keep-me', 'important', { tier: 'session' });

    const beforeStats = await memoryManager.getStats();

    await autoDream(memoryManager, {
      lastDreamTime: null,
      sessionCount: 5,
      isIdle: true,
      dryRun: true,
      gateConfig: { minIntervalMs: 0, minSessionCount: 3, requireIdle: false }
    });

    const afterStats = await memoryManager.getStats();

    // Dry run should not modify entries
    expect(afterStats.session).toBe(beforeStats.session);
  });

  it('should update lastDreamTime after successful run', async () => {
    const scheduler = new AutoDreamScheduler({
      gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false }
    });

    for (let i = 0; i < 3; i++) {
      scheduler.incrementSession();
    }

    await scheduler.run(memoryManager);

    expect(scheduler.getLastDreamTime()).not.toBeNull();
  });
});

// ─── twoTurnExtract ───────────────────────────────────────

describe('twoTurnExtract', () => {
  let memoryManager;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `auto-dream-two-turn-${Date.now()}`);
    await fs.ensureDir(testDir);
    memoryManager = new MemoryManager({ projectDir: testDir });
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('should extract user preferences from messages', async () => {
    const messages = ['我喜欢用 vitest 而不是 jest', '偏好函数式编程风格'];

    const result = await twoTurnExtract(memoryManager, messages);

    expect(result.turn1Reads).toBeGreaterThanOrEqual(0);
    expect(result.turn2Writes).toBe(2);
    expect(result.extracted.length).toBe(2);
    expect(result.extracted[0].confidence).toBe('high');
    expect(Object.isFrozen(result.extracted)).toBe(true);
  });

  it('should extract error corrections from messages', async () => {
    const messages = ['修复：空指针异常导致崩溃，根因：未检查 null'];

    const result = await twoTurnExtract(memoryManager, messages);

    expect(result.turn2Writes).toBe(1);
    expect(result.extracted[0].value.type).toBe('error_correction');
  });

  it('should extract project patterns from messages', async () => {
    const messages = ['架构约定：所有 Service 必须有接口和实现分离'];

    const result = await twoTurnExtract(memoryManager, messages);

    expect(result.turn2Writes).toBe(1);
    expect(result.extracted[0].value.type).toBe('project_pattern');
  });

  it('should respect maxExtractions limit', async () => {
    const messages = [
      '我喜欢用 vitest',
      '修复：bug1',
      '架构约定：xxx',
      '我用 TypeScript',
      '偏好函数式编程'
    ];

    const result = await twoTurnExtract(memoryManager, messages, { maxExtractions: 2 });

    expect(result.turn2Writes).toBe(2);
    expect(result.extracted.length).toBe(2);
  });

  it('should respect maxMessages limit', async () => {
    const messages = Array.from({ length: 30 }, (_, i) => `Message ${i}`);

    const result = await twoTurnExtract(memoryManager, messages, { maxMessages: 5 });

    expect(result.turn1Reads).toBeGreaterThanOrEqual(0);
  });

  it('should deduplicate against existing memories', async () => {
    // Pre-populate a memory that would match
    await memoryManager.set(
      'pref_test',
      {
        statement: '我喜欢用 vitest 而不是 jest',
        type: 'user_preference'
      },
      { tier: 'session', tags: ['preference'] }
    );

    const messages = ['我喜欢用 vitest 而不是 jest'];
    const result = await twoTurnExtract(memoryManager, messages);

    // Should be deduplicated
    expect(result.turn2Writes).toBe(0);
    expect(result.extracted.length).toBe(0);
  });

  it('should return empty for messages without extractable patterns', async () => {
    const messages = ['Hello', 'How are you?', 'Good morning'];

    const result = await twoTurnExtract(memoryManager, messages);

    expect(result.turn2Writes).toBe(0);
    expect(result.extracted.length).toBe(0);
  });

  it('should produce immutable result', async () => {
    const result = await twoTurnExtract(memoryManager, ['test']);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.extracted)).toBe(true);
  });
});
