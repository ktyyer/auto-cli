import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { MemoryManager } from '../src/memory/memory-manager.js';
import { MEMORY_TIERS, PROMOTE_THRESHOLD } from '../src/memory/memory-tiers.js';

describe('MemoryManager', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `memory-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    manager = new MemoryManager({ projectDir: tempDir });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('set / get (session)', () => {
    it('should store and retrieve session memory', async () => {
      await manager.set('key1', 'value1');
      const result = await manager.get('key1');
      expect(result).toBe('value1');
    });

    it('should return undefined for missing key', async () => {
      const result = await manager.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should overwrite existing value', async () => {
      await manager.set('key1', 'old');
      await manager.set('key1', 'new');
      const result = await manager.get('key1');
      expect(result).toBe('new');
    });

    it('should store complex objects', async () => {
      const obj = { nested: { data: [1, 2, 3] } };
      await manager.set('complex', obj);
      const result = await manager.get('complex');
      expect(result).toEqual(obj);
    });
  });

  describe('set / get (project)', () => {
    it('should persist to project tier', async () => {
      await manager.set('proj-key', 'proj-val', { tier: MEMORY_TIERS.PROJECT });
      const result = await manager.get('proj-key');
      expect(result).toBe('proj-val');

      // Verify file exists on disk
      const storePath = path.join(tempDir, '.auto', 'memory', 'store.json');
      expect(await fs.pathExists(storePath)).toBe(true);
    });

    it('should survive new manager instance', async () => {
      await manager.set('persist', 'data', { tier: MEMORY_TIERS.PROJECT });

      const manager2 = new MemoryManager({ projectDir: tempDir });
      const result = await manager2.get('persist');
      expect(result).toBe('data');
    });
  });

  describe('delete', () => {
    it('should delete session entry', async () => {
      await manager.set('del-me', 'val');
      const deleted = await manager.delete('del-me');
      expect(deleted).toBe(true);
      expect(await manager.get('del-me')).toBeUndefined();
    });

    it('should delete project entry', async () => {
      await manager.set('del-proj', 'val', { tier: MEMORY_TIERS.PROJECT });
      const deleted = await manager.delete('del-proj', MEMORY_TIERS.PROJECT);
      expect(deleted).toBe(true);
      expect(await manager.get('del-proj')).toBeUndefined();
    });

    it('should return false for non-existent key', async () => {
      const deleted = await manager.delete('nope');
      expect(deleted).toBe(false);
    });
  });

  describe('auto-promotion', () => {
    it('should promote session entry after threshold accesses', async () => {
      await manager.set('hot-key', 'hot-val');

      // Access enough times to trigger promotion
      for (let i = 0; i < PROMOTE_THRESHOLD; i++) {
        await manager.get('hot-key');
      }

      // Should now be in project tier (persisted)
      const stats = await manager.getStats();
      expect(stats.project).toBeGreaterThanOrEqual(1);
    });
  });

  describe('searchByTags', () => {
    it('should find entries by tags', async () => {
      await manager.set('arch-decision', 'use FSM', { tags: ['architecture', 'fsm'] });
      await manager.set('bug-fix', 'null check', { tags: ['bug', 'fix'] });

      const results = await manager.searchByTags(['architecture']);
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('arch-decision');
    });

    it('should return empty for no matches', async () => {
      await manager.set('item', 'val', { tags: ['a'] });
      const results = await manager.searchByTags(['nonexistent']);
      expect(results).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should search by key and value', async () => {
      await manager.set('db-config', { host: 'localhost', port: 5432 });
      await manager.set('api-key', 'secret-123');

      const results = await manager.search('localhost');
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('db-config');
    });
  });

  describe('cleanup', () => {
    it('should remove expired session entries', async () => {
      await manager.set('expire-me', 'val', { ttl: 1 });

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 10));

      const cleaned = await manager.cleanup();
      expect(cleaned).toBeGreaterThanOrEqual(1);
      expect(await manager.get('expire-me')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return counts per tier', async () => {
      await manager.set('s1', 'v1');
      await manager.set('s2', 'v2');
      await manager.set('p1', 'v1', { tier: MEMORY_TIERS.PROJECT });

      const stats = await manager.getStats();
      expect(stats.session).toBe(2);
      expect(stats.project).toBe(1);
      expect(stats.total).toBe(3);
    });
  });

  describe('search (semantic)', () => {
    it('should support multi-term matching', async () => {
      await manager.set('db-config', { host: 'localhost', port: 5432 }, { tags: ['database'] });
      await manager.set('api-config', { host: 'api.example.com' }, { tags: ['api'] });
      await manager.set('auth-config', { host: 'auth.example.com' }, { tags: ['auth'] });

      const results = await manager.search('localhost database');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.key === 'db-config')).toBe(true);
    });

    it('should support semantic TF-IDF ranking', async () => {
      await manager.set('item1', 'javascript typescript node', { tags: ['js'] });
      await manager.set('item2', 'javascript only', { tags: ['js'] });
      await manager.set('item3', 'python django flask', { tags: ['py'] });

      const results = await manager.search('javascript typescript', { semantic: true });
      expect(results.length).toBeGreaterThanOrEqual(2);
      // item1 should rank higher (matches more terms)
      expect(results[0].key).toBe('item1');
    });

    it('should respect limit option', async () => {
      for (let i = 0; i < 10; i++) {
        await manager.set(`item-${i}`, `test value ${i}`);
      }

      const results = await manager.search('test', { limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should search tags as well', async () => {
      await manager.set('entry1', 'some value', { tags: ['architecture', 'fsm'] });
      await manager.set('entry2', 'other value', { tags: ['testing'] });

      const results = await manager.search('architecture');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.key === 'entry1')).toBe(true);
    });
  });
});
