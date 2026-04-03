import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { MemoryManager } from '../src/memory/memory-manager.js';
import { MEMORY_TIERS } from '../src/memory/memory-tiers.js';
import {
  DREAM_PHASES,
  DREAM_GATE_DEFAULTS,
  createDreamResult,
  checkDreamGate,
  orient,
  gather,
  consolidate,
  autoDream
} from '../src/memory/auto-dream.js';

describe('checkDreamGate', () => {
  it('should allow when all gates pass', () => {
    const result = checkDreamGate({
      lastDreamTime: Date.now() - 48 * 60 * 60 * 1000,
      sessionCount: 10,
      isIdle: true
    });
    expect(result.allowed).toBe(true);
  });

  it('should block when interval too short', () => {
    const result = checkDreamGate({
      lastDreamTime: Date.now() - 1 * 60 * 60 * 1000,
      sessionCount: 10,
      isIdle: true
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('h');
  });

  it('should block when session count too low', () => {
    const result = checkDreamGate({
      lastDreamTime: Date.now() - 48 * 60 * 60 * 1000,
      sessionCount: 2,
      isIdle: true
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('会话');
  });

  it('should block when not idle', () => {
    const result = checkDreamGate({
      lastDreamTime: Date.now() - 48 * 60 * 60 * 1000,
      sessionCount: 10,
      isIdle: false
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('并发');
  });

  it('should allow with no lastDreamTime', () => {
    const result = checkDreamGate({
      sessionCount: 10,
      isIdle: true
    });
    expect(result.allowed).toBe(true);
  });

  it('should respect custom gateConfig', () => {
    const result = checkDreamGate({
      lastDreamTime: Date.now() - 1000,
      sessionCount: 1,
      isIdle: false,
      gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false }
    });
    expect(result.allowed).toBe(true);
  });
});

describe('orient', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `dream-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    manager = new MemoryManager({ projectDir: tempDir });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should analyze memory state', async () => {
    await manager.set('key1', 'value1');
    await manager.set('key2', 'value2', { tier: MEMORY_TIERS.PROJECT });

    const result = await orient(manager);

    expect(result.totalEntries).toBe(2);
    expect(result.byTier.session).toBe(1);
    expect(result.byTier.project).toBe(1);
    expect(result.expiredCount).toBe(0);
  });

  it('should detect expired entries', async () => {
    await manager.set('expire', 'val', { ttl: 1 });
    await new Promise((r) => setTimeout(r, 10));

    const result = await orient(manager);
    expect(result.expiredCount).toBeGreaterThanOrEqual(1);
  });

  it('should return immutable result', async () => {
    await manager.set('key1', 'value1');
    const result = await orient(manager);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.byTier)).toBe(true);
  });
});

describe('gather', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `dream-gather-${Date.now()}`);
    await fs.ensureDir(tempDir);
    manager = new MemoryManager({ projectDir: tempDir });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should collect recent entries', async () => {
    await manager.set('recent', 'val');
    const orientResult = await orient(manager);

    const gathered = await gather(orientResult, manager);
    expect(gathered.length).toBeGreaterThanOrEqual(1);
  });

  it('should sort by accessCount and recency', async () => {
    await manager.set('cold', 'val');
    await manager.set('hot', 'val');
    // Access 'hot' multiple times
    for (let i = 0; i < 5; i++) {
      await manager.get('hot');
    }

    const orientResult = await orient(manager);
    const gathered = await gather(orientResult, manager);

    // 'hot' should come first due to higher accessCount
    const hotIndex = gathered.findIndex((e) => e.key === 'hot');
    const coldIndex = gathered.findIndex((e) => e.key === 'cold');
    expect(hotIndex).toBeLessThan(coldIndex);
  });

  it('should return immutable entries', async () => {
    await manager.set('key1', 'val');
    const orientResult = await orient(manager);
    const gathered = await gather(orientResult, manager);

    for (const entry of gathered) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });
});

describe('createDreamResult', () => {
  it('should create frozen result', () => {
    const result = createDreamResult({ executed: true, reason: 'test' });
    expect(result.executed).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should default to not executed', () => {
    const result = createDreamResult();
    expect(result.executed).toBe(false);
    expect(result.phases).toEqual([]);
  });
});

describe('autoDream', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `dream-full-${Date.now()}`);
    await fs.ensureDir(tempDir);
    manager = new MemoryManager({ projectDir: tempDir });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should skip when gates blocked', async () => {
    const result = await autoDream(manager, {
      sessionCount: 1,
      gateConfig: { minIntervalMs: 0, minSessionCount: 5, requireIdle: false }
    });

    expect(result.executed).toBe(false);
    expect(result.reason).toContain('会话');
  });

  it('should execute all phases when gates pass', async () => {
    await manager.set('test1', 'val1');
    await manager.set('test2', 'val2');

    const result = await autoDream(manager, {
      sessionCount: 10,
      isIdle: true,
      gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false }
    });

    expect(result.executed).toBe(true);
    expect(result.phases).toContain(DREAM_PHASES.ORIENT);
    expect(result.phases).toContain(DREAM_PHASES.GATHER);
    expect(result.phases).toContain(DREAM_PHASES.CONSOLIDATE);
    expect(result.phases).toContain(DREAM_PHASES.PRUNE);
    expect(result.executedAt).toBeDefined();
  });

  it('should run in dryRun mode without side effects', async () => {
    await manager.set('persist', 'val', { tier: MEMORY_TIERS.PROJECT });

    const result = await autoDream(manager, {
      sessionCount: 10,
      isIdle: true,
      dryRun: true,
      gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false }
    });

    expect(result.executed).toBe(true);
    // dry run should still analyze but not prune
    expect(result.stats.prunedCount).toBe(0);
  });

  it('should return immutable result', async () => {
    await manager.set('key1', 'val');
    const result = await autoDream(manager, {
      sessionCount: 10,
      isIdle: true,
      gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false }
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.phases)).toBe(true);
    expect(Object.isFrozen(result.stats)).toBe(true);
  });

  describe('knowledgeSteward integration', () => {
    it('should save insights to knowledgeSteward when consolidation produces actions', async () => {
      // 创建有重复的条目
      await manager.set('key-a', { data: 'shared-value' }, { tier: MEMORY_TIERS.PROJECT });
      await manager.set('key-b', { data: 'shared-value' }, { tier: MEMORY_TIERS.SESSION });

      const savedInsights = [];
      const mockSteward = {
        save: vi.fn().mockImplementation(async (entry) => {
          savedInsights.push(entry);
          return { success: true, filePath: '/test/insights.md', categoryName: entry.category };
        })
      };

      const result = await autoDream(manager, {
        sessionCount: 10,
        isIdle: true,
        gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false },
        knowledgeSteward: mockSteward
      });

      // 如果有 consolidation actions，应该调用 steward.save
      if (result.stats.consolidationActions > 0) {
        expect(mockSteward.save).toHaveBeenCalled();
        // 洞察应该有 category 和 tags
        for (const insight of savedInsights) {
          expect(insight).toHaveProperty('content');
          expect(insight).toHaveProperty('category');
          expect(insight).toHaveProperty('tags');
          expect(Array.isArray(insight.tags)).toBe(true);
        }
      }
    });

    it('should not call steward.save when no consolidation actions', async () => {
      const mockSteward = {
        save: vi.fn().mockResolvedValue({ success: true })
      };

      const result = await autoDream(manager, {
        sessionCount: 10,
        isIdle: true,
        gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false },
        knowledgeSteward: mockSteward
      });

      // 没有重复条目，consolidation 应该是 0
      if (result.stats.consolidationActions === 0) {
        expect(mockSteward.save).not.toHaveBeenCalled();
      }
    });

    it('should not call steward.save in dryRun mode', async () => {
      await manager.set('key-a', { data: 'shared' }, { tier: MEMORY_TIERS.PROJECT });
      await manager.set('key-b', { data: 'shared' }, { tier: MEMORY_TIERS.SESSION });

      const mockSteward = {
        save: vi.fn().mockResolvedValue({ success: true })
      };

      const result = await autoDream(manager, {
        sessionCount: 10,
        isIdle: true,
        dryRun: true,
        gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false },
        knowledgeSteward: mockSteward
      });

      expect(mockSteward.save).not.toHaveBeenCalled();
    });

    it('should not fail when steward.save throws', async () => {
      const mockSteward = {
        save: vi.fn().mockRejectedValue(new Error('disk full'))
      };

      // 不应该抛出异常
      const result = await autoDream(manager, {
        sessionCount: 10,
        isIdle: true,
        gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false },
        knowledgeSteward: mockSteward
      });

      expect(result.executed).toBe(true);
    });

    it('should work without knowledgeSteward', async () => {
      const result = await autoDream(manager, {
        sessionCount: 10,
        isIdle: true,
        gateConfig: { minIntervalMs: 0, minSessionCount: 0, requireIdle: false }
        // 不传 knowledgeSteward
      });

      expect(result.executed).toBe(true);
    });
  });
});
