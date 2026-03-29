import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { TodoManager } from '../src/todos/todo-manager.js';
import { TODO_STATES, TODO_PRIORITIES } from '../src/todos/todo-types.js';

describe('TodoManager', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `todo-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    manager = new TodoManager(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('initialize', () => {
    it('should create new snapshot with task name', async () => {
      const snapshot = await manager.initialize('Test Task');

      expect(snapshot.taskName).toBe('Test Task');
      expect(snapshot.items).toEqual([]);
      expect(snapshot.id).toBeDefined();
    });

    it('should create .auto/todos directory', async () => {
      await manager.initialize('Test');

      const todosDir = path.join(tempDir, '.auto', 'todos');
      const exists = await fs.pathExists(todosDir);
      expect(exists).toBe(true);
    });

    it('should load existing active snapshot', async () => {
      const first = await manager.initialize('First Task');
      await manager.add({ content: 'Existing item' });

      const secondManager = new TodoManager(tempDir);
      const loaded = await secondManager.initialize('Should be ignored');

      expect(loaded.taskName).toBe('First Task');
      expect(loaded.items.length).toBe(1);
    });
  });

  describe('add', () => {
    beforeEach(async () => {
      await manager.initialize('Test Task');
    });

    it('should add a todo item', async () => {
      const item = await manager.add({ content: 'Write tests' });

      expect(item.id).toBeDefined();
      expect(item.content).toBe('Write tests');
      expect(item.status).toBe(TODO_STATES.PENDING);
      expect(item.priority).toBe(TODO_PRIORITIES.MEDIUM);
    });

    it('should add item with all options', async () => {
      const item = await manager.add({
        content: 'Complex task',
        questId: 'Quest 1.2',
        priority: TODO_PRIORITIES.HIGH,
        tags: ['testing', 'critical'],
        note: 'Must pass coverage'
      });

      expect(item.questId).toBe('Quest 1.2');
      expect(item.priority).toBe(TODO_PRIORITIES.HIGH);
      expect(item.tags).toEqual(['testing', 'critical']);
      expect(item.note).toBe('Must pass coverage');
    });

    it('should block item with unmet dependencies', async () => {
      const parent = await manager.add({ content: 'Parent task' });
      const child = await manager.add({
        content: 'Child task',
        dependsOn: [parent.id]
      });

      expect(child.status).toBe(TODO_STATES.BLOCKED);
    });

    it('should throw for non-existent dependency', async () => {
      await expect(manager.add({ content: 'Bad dep', dependsOn: ['nonexistent'] })).rejects.toThrow(
        '依赖项不存在'
      );
    });

    it('should persist to disk', async () => {
      await manager.add({ content: 'Persisted item' });

      const files = await fs.readdir(path.join(tempDir, '.auto', 'todos'));
      const activeFile = files.find((f) => f.startsWith('active_'));
      expect(activeFile).toBeDefined();

      const data = await fs.readJson(path.join(tempDir, '.auto', 'todos', activeFile));
      expect(data.items.length).toBe(1);
    });
  });

  describe('updateStatus', () => {
    beforeEach(async () => {
      await manager.initialize('Test Task');
    });

    it('should update status to in_progress', async () => {
      const item = await manager.add({ content: 'Work item' });
      const updated = await manager.updateStatus(item.id, TODO_STATES.IN_PROGRESS);

      expect(updated.status).toBe(TODO_STATES.IN_PROGRESS);
    });

    it('should set completedAt when completed', async () => {
      const item = await manager.add({ content: 'Done item' });
      const updated = await manager.updateStatus(item.id, TODO_STATES.COMPLETED);

      expect(updated.completedAt).toBeDefined();
    });

    it('should unblock dependents when completed', async () => {
      const parent = await manager.add({ content: 'Parent' });
      const child = await manager.add({
        content: 'Child',
        dependsOn: [parent.id]
      });

      expect(child.status).toBe(TODO_STATES.BLOCKED);

      await manager.updateStatus(parent.id, TODO_STATES.COMPLETED);

      const snapshot = manager.getSnapshot();
      const updatedChild = snapshot.items.find((i) => i.id === child.id);
      expect(updatedChild.status).toBe(TODO_STATES.PENDING);
    });

    it('should throw when starting blocked item', async () => {
      const parent = await manager.add({ content: 'Parent' });
      const child = await manager.add({
        content: 'Child',
        dependsOn: [parent.id]
      });

      await expect(manager.updateStatus(child.id, TODO_STATES.IN_PROGRESS)).rejects.toThrow(
        '未完成的依赖项'
      );
    });

    it('should return null for non-existent id', async () => {
      const result = await manager.updateStatus('nonexistent', TODO_STATES.COMPLETED);
      expect(result).toBeNull();
    });
  });

  describe('getNext', () => {
    beforeEach(async () => {
      await manager.initialize('Test Task');
    });

    it('should return highest priority pending item', async () => {
      await manager.add({ content: 'Low task', priority: TODO_PRIORITIES.LOW });
      await manager.add({ content: 'High task', priority: TODO_PRIORITIES.HIGH });
      await manager.add({ content: 'Medium task', priority: TODO_PRIORITIES.MEDIUM });

      const next = manager.getNext();
      expect(next.content).toBe('High task');
    });

    it('should skip blocked items', async () => {
      const parent = await manager.add({ content: 'Parent' });
      await manager.add({
        content: 'Blocked child',
        dependsOn: [parent.id]
      });

      const next = manager.getNext();
      expect(next.content).toBe('Parent');
    });

    it('should return null when all completed', async () => {
      const item = await manager.add({ content: 'Only task' });
      await manager.updateStatus(item.id, TODO_STATES.COMPLETED);

      expect(manager.getNext()).toBeNull();
    });

    it('should return null when empty', () => {
      const freshManager = new TodoManager(tempDir);
      freshManager._snapshot = {
        id: 'test',
        taskName: 'test',
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        meta: {}
      };

      expect(freshManager.getNext()).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      await manager.initialize('Stats Test');

      await manager.add({ content: 'Task 1' });
      await manager.add({ content: 'Task 2' });
      const item3 = await manager.add({ content: 'Task 3' });
      await manager.updateStatus(item3.id, TODO_STATES.COMPLETED);

      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(2);
      expect(stats.completionPercent).toBe(33);
    });

    it('should handle empty list', async () => {
      await manager.initialize('Empty');
      const stats = manager.getStats();

      expect(stats.total).toBe(0);
      expect(stats.completionPercent).toBe(0);
    });
  });

  describe('getSorted', () => {
    it('should topologically sort items', async () => {
      await manager.initialize('Sort Test');

      const a = await manager.add({ content: 'A' });
      const b = await manager.add({ content: 'B', dependsOn: [a.id] });
      const c = await manager.add({ content: 'C', dependsOn: [b.id] });

      const sorted = manager.getSorted();

      const indexA = sorted.findIndex((i) => i.id === a.id);
      const indexB = sorted.findIndex((i) => i.id === b.id);
      const indexC = sorted.findIndex((i) => i.id === c.id);

      expect(indexA).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
    });
  });

  describe('toMarkdown', () => {
    it('should generate markdown report', async () => {
      await manager.initialize('MD Report');

      await manager.add({ content: 'Pending task', questId: 'Q1' });
      const done = await manager.add({ content: 'Done task' });
      await manager.updateStatus(done.id, TODO_STATES.COMPLETED);

      const md = manager.toMarkdown();

      expect(md).toContain('# TodoList: MD Report');
      expect(md).toContain('[x]');
      expect(md).toContain('[ ]');
      expect(md).toContain('Q1');
    });
  });

  describe('archive', () => {
    it('should rename active file to archived', async () => {
      await manager.initialize('Archive Test');
      const item = await manager.add({ content: 'Done' });
      await manager.updateStatus(item.id, TODO_STATES.COMPLETED);

      const archivePath = await manager.archive();
      expect(archivePath).toContain('archived_');

      const exists = await fs.pathExists(archivePath);
      expect(exists).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw when calling methods before initialize', () => {
      const uninitManager = new TodoManager(tempDir);
      expect(() => uninitManager.getNext()).toThrow('未初始化');
    });
  });
});
