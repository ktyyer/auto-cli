import { describe, it, expect } from 'vitest';
import {
  MEMORY_TIERS,
  TIER_PRIORITY,
  DEFAULT_TTL,
  PROMOTE_THRESHOLD,
  createMemoryEntry,
  touchEntry,
  updateEntryValue,
  promoteEntry,
  isExpired,
  shouldPromote,
  getProjectMemoryDir,
  getGlobalMemoryDir
} from '../src/memory/memory-tiers.js';

describe('MEMORY_TIERS', () => {
  it('should have 3 tiers', () => {
    expect(Object.keys(MEMORY_TIERS)).toHaveLength(3);
    expect(MEMORY_TIERS.SESSION).toBe('session');
    expect(MEMORY_TIERS.PROJECT).toBe('project');
    expect(MEMORY_TIERS.GLOBAL).toBe('global');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(MEMORY_TIERS)).toBe(true);
  });
});

describe('TIER_PRIORITY', () => {
  it('should have ascending priority: session < project < global', () => {
    expect(TIER_PRIORITY[MEMORY_TIERS.SESSION]).toBeLessThan(TIER_PRIORITY[MEMORY_TIERS.PROJECT]);
    expect(TIER_PRIORITY[MEMORY_TIERS.PROJECT]).toBeLessThan(TIER_PRIORITY[MEMORY_TIERS.GLOBAL]);
  });
});

describe('createMemoryEntry', () => {
  it('should create a frozen entry with defaults', () => {
    const entry = createMemoryEntry({ key: 'test', value: 'hello' });

    expect(entry.key).toBe('test');
    expect(entry.value).toBe('hello');
    expect(entry.tier).toBe(MEMORY_TIERS.SESSION);
    expect(entry.tags).toEqual([]);
    expect(entry.accessCount).toBe(0);
    expect(entry.version).toBe(1);
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it('should accept custom tier and tags', () => {
    const entry = createMemoryEntry({
      key: 'k',
      value: 'v',
      tier: MEMORY_TIERS.PROJECT,
      tags: ['arch', 'decision']
    });

    expect(entry.tier).toBe(MEMORY_TIERS.PROJECT);
    expect(entry.tags).toEqual(['arch', 'decision']);
    expect(entry.ttl).toBe(DEFAULT_TTL[MEMORY_TIERS.PROJECT]);
  });

  it('should accept custom TTL', () => {
    const entry = createMemoryEntry({ key: 'k', value: 'v', ttl: 1000 });
    expect(entry.ttl).toBe(1000);
  });
});

describe('touchEntry', () => {
  it('should increment accessCount and return new object', () => {
    const entry = createMemoryEntry({ key: 'k', value: 'v' });
    const touched = touchEntry(entry);

    expect(touched.accessCount).toBe(1);
    expect(touched).not.toBe(entry);
    expect(entry.accessCount).toBe(0); // original unchanged
  });
});

describe('updateEntryValue', () => {
  it('should update value and increment version', () => {
    const entry = createMemoryEntry({ key: 'k', value: 'old' });
    const updated = updateEntryValue(entry, 'new');

    expect(updated.value).toBe('new');
    expect(updated.version).toBe(2);
    expect(entry.value).toBe('old'); // original unchanged
  });
});

describe('promoteEntry', () => {
  it('should promote session to project', () => {
    const entry = createMemoryEntry({ key: 'k', value: 'v' });
    const promoted = promoteEntry(entry, MEMORY_TIERS.PROJECT);

    expect(promoted.tier).toBe(MEMORY_TIERS.PROJECT);
    expect(promoted.ttl).toBe(DEFAULT_TTL[MEMORY_TIERS.PROJECT]);
  });

  it('should not demote (return same entry)', () => {
    const entry = createMemoryEntry({
      key: 'k',
      value: 'v',
      tier: MEMORY_TIERS.PROJECT
    });
    const result = promoteEntry(entry, MEMORY_TIERS.SESSION);

    expect(result).toBe(entry);
    expect(result.tier).toBe(MEMORY_TIERS.PROJECT);
  });
});

describe('isExpired', () => {
  it('should return false for fresh entry', () => {
    const entry = createMemoryEntry({ key: 'k', value: 'v' });
    expect(isExpired(entry)).toBe(false);
  });

  it('should return true for expired entry', () => {
    const entry = createMemoryEntry({ key: 'k', value: 'v', ttl: 1 });
    // Manually create an expired entry
    const expired = { ...entry, updatedAt: Date.now() - 100 };
    expect(isExpired(expired)).toBe(true);
  });
});

describe('shouldPromote', () => {
  it('should return true when session entry reaches threshold', () => {
    let entry = createMemoryEntry({ key: 'k', value: 'v' });
    for (let i = 0; i < PROMOTE_THRESHOLD; i++) {
      entry = touchEntry(entry);
    }
    expect(shouldPromote(entry)).toBe(true);
  });

  it('should return false for project tier entries', () => {
    let entry = createMemoryEntry({
      key: 'k',
      value: 'v',
      tier: MEMORY_TIERS.PROJECT
    });
    for (let i = 0; i < PROMOTE_THRESHOLD + 1; i++) {
      entry = touchEntry(entry);
    }
    expect(shouldPromote(entry)).toBe(false);
  });

  it('should return false below threshold', () => {
    const entry = touchEntry(createMemoryEntry({ key: 'k', value: 'v' }));
    expect(shouldPromote(entry)).toBe(false);
  });
});

describe('getProjectMemoryDir', () => {
  it('should return .auto/memory under project dir', () => {
    const dir = getProjectMemoryDir('/tmp/proj');
    expect(dir).toContain('.auto');
    expect(dir).toContain('memory');
  });
});

describe('getGlobalMemoryDir', () => {
  it('should return .auto/memory under home dir', () => {
    const dir = getGlobalMemoryDir();
    expect(dir).toContain('.auto');
    expect(dir).toContain('memory');
  });
});
