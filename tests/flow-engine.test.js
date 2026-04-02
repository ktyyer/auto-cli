import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { FlowEngine, FLOW_STATES, FLOW_EVENTS } from '../src/flow/flow-engine.js';

describe('FlowEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new FlowEngine('test-flow');
  });

  describe('constructor', () => {
    it('should initialize with IDLE state', () => {
      expect(engine.state).toBe(FLOW_STATES.IDLE);
      expect(engine.id).toBe('test-flow');
      expect(engine.context).toEqual({});
      expect(engine.history).toEqual([]);
      expect(engine.retryCount).toBe(0);
    });

    it('should accept custom maxRetries', () => {
      const custom = new FlowEngine('custom', { maxRetries: 5 });
      expect(custom.maxRetries).toBe(5);
    });

    it('should default maxRetries to 3', () => {
      expect(engine.maxRetries).toBe(3);
    });
  });

  describe('transition', () => {
    it('should execute valid transition', () => {
      const result = engine.transition(FLOW_EVENTS.START);

      expect(result.success).toBe(true);
      expect(result.from).toBe(FLOW_STATES.IDLE);
      expect(result.to).toBe(FLOW_STATES.ANALYZING);
      expect(engine.state).toBe(FLOW_STATES.ANALYZING);
    });

    it('should reject invalid transition', () => {
      const result = engine.transition(FLOW_EVENTS.ANALYSIS_DONE);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(engine.state).toBe(FLOW_STATES.IDLE);
    });

    it('should carry context data through transitions', () => {
      engine.transition(FLOW_EVENTS.START, { task: 'build' });
      engine.transition(FLOW_EVENTS.ANALYSIS_DONE, { plan: 'step1' });

      expect(engine.context).toEqual({ task: 'build', plan: 'step1' });
    });

    it('should record history', () => {
      engine.transition(FLOW_EVENTS.START);
      engine.transition(FLOW_EVENTS.ANALYSIS_DONE);

      expect(engine.history).toHaveLength(2);
      expect(engine.history[0].from).toBe(FLOW_STATES.IDLE);
      expect(engine.history[0].to).toBe(FLOW_STATES.ANALYZING);
      expect(engine.history[0].event).toBe(FLOW_EVENTS.START);
      expect(engine.history[1].from).toBe(FLOW_STATES.ANALYZING);
      expect(engine.history[1].to).toBe(FLOW_STATES.PLANNING);
    });

    it('should complete full happy path', () => {
      engine.transition(FLOW_EVENTS.START);
      engine.transition(FLOW_EVENTS.ANALYSIS_DONE);
      engine.transition(FLOW_EVENTS.PLAN_DONE);
      engine.transition(FLOW_EVENTS.EXECUTE_DONE);
      engine.transition(FLOW_EVENTS.REVIEW_DONE);

      expect(engine.state).toBe(FLOW_STATES.COMPLETED);
      expect(engine.history).toHaveLength(5);
    });
  });

  describe('pause and resume', () => {
    it('should pause and resume to previous state', () => {
      engine.transition(FLOW_EVENTS.START);
      engine.transition(FLOW_EVENTS.ANALYSIS_DONE);
      expect(engine.state).toBe(FLOW_STATES.PLANNING);

      engine.transition(FLOW_EVENTS.PAUSE);
      expect(engine.state).toBe(FLOW_STATES.PAUSED);

      engine.transition(FLOW_EVENTS.RESUME);
      expect(engine.state).toBe(FLOW_STATES.PLANNING);
    });
  });

  describe('fail and retry', () => {
    it('should fail and retry to previous state', () => {
      engine.transition(FLOW_EVENTS.START);
      expect(engine.state).toBe(FLOW_STATES.ANALYZING);

      engine.transition(FLOW_EVENTS.FAIL);
      expect(engine.state).toBe(FLOW_STATES.FAILED);

      engine.transition(FLOW_EVENTS.RETRY);
      expect(engine.state).toBe(FLOW_STATES.ANALYZING);
      expect(engine.retryCount).toBe(1);
    });

    it('should enforce max retries', () => {
      engine.transition(FLOW_EVENTS.START);

      for (let i = 0; i < 3; i++) {
        engine.transition(FLOW_EVENTS.FAIL);
        engine.transition(FLOW_EVENTS.RETRY);
      }

      // 4th retry should fail
      engine.transition(FLOW_EVENTS.FAIL);
      const result = engine.transition(FLOW_EVENTS.RETRY);
      expect(result.success).toBe(false);
      expect(result.error).toContain('重试次数超限');
    });
  });

  describe('reset', () => {
    it('should reset to IDLE and clear state', () => {
      engine.transition(FLOW_EVENTS.START, { data: 'test' });
      engine.transition(FLOW_EVENTS.FAIL);
      engine.retryCount = 2;

      engine.transition(FLOW_EVENTS.RESET);

      expect(engine.state).toBe(FLOW_STATES.IDLE);
      expect(engine.retryCount).toBe(0);
      expect(engine.context).toEqual({});
    });
  });

  describe('onTransition', () => {
    it('should notify listeners on transition', () => {
      const events = [];
      engine.onTransition((t) => events.push(t));

      engine.transition(FLOW_EVENTS.START);

      expect(events).toHaveLength(1);
      expect(events[0].from).toBe(FLOW_STATES.IDLE);
      expect(events[0].to).toBe(FLOW_STATES.ANALYZING);
    });

    it('should return unsubscribe function', () => {
      const events = [];
      const unsub = engine.onTransition((t) => events.push(t));

      engine.transition(FLOW_EVENTS.START);
      unsub();
      engine.transition(FLOW_EVENTS.ANALYSIS_DONE);

      expect(events).toHaveLength(1);
    });

    it('should not crash on listener error', () => {
      engine.onTransition(() => {
        throw new Error('boom');
      });
      engine.onTransition(() => {}); // second listener should still fire

      expect(() => engine.transition(FLOW_EVENTS.START)).not.toThrow();
    });
  });

  describe('toSnapshot / fromSnapshot', () => {
    it('should serialize and restore state', () => {
      engine.transition(FLOW_EVENTS.START, { task: 'build' });
      engine.transition(FLOW_EVENTS.ANALYSIS_DONE);

      const snapshot = engine.toSnapshot();
      const restored = FlowEngine.fromSnapshot(snapshot);

      expect(restored.id).toBe('test-flow');
      expect(restored.state).toBe(FLOW_STATES.PLANNING);
      expect(restored.context).toEqual({ task: 'build' });
      expect(restored.history).toHaveLength(2);
    });

    it('should produce immutable snapshot', () => {
      engine.transition(FLOW_EVENTS.START, { key: 'val' });
      const snapshot = engine.toSnapshot();

      snapshot.context.key = 'modified';
      expect(engine.context.key).toBe('val');
    });
  });

  describe('saveSnapshot / loadSnapshot', () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = path.join(os.tmpdir(), `flow-test-${Date.now()}`);
      await fs.ensureDir(tempDir);
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('should save and load snapshot from disk', async () => {
      engine.transition(FLOW_EVENTS.START, { task: 'test' });

      const filePath = await engine.saveSnapshot(tempDir);
      expect(await fs.pathExists(filePath)).toBe(true);

      const loaded = await FlowEngine.loadSnapshot('test-flow', tempDir);
      expect(loaded).not.toBeNull();
      expect(loaded.state).toBe(FLOW_STATES.ANALYZING);
      expect(loaded.context.task).toBe('test');
    });

    it('should return null for non-existent snapshot', async () => {
      const loaded = await FlowEngine.loadSnapshot('non-existent', tempDir);
      expect(loaded).toBeNull();
    });
  });

  describe('getPhase', () => {
    it('should return phase number for mapped states', () => {
      engine.transition(FLOW_EVENTS.START);
      expect(engine.getPhase()).toBe(1);

      engine.transition(FLOW_EVENTS.ANALYSIS_DONE);
      expect(engine.getPhase()).toBe(2);

      engine.transition(FLOW_EVENTS.PLAN_DONE);
      expect(engine.getPhase()).toBe(3);
    });

    it('should return null for unmapped states', () => {
      expect(engine.getPhase()).toBeNull(); // IDLE has no phase
    });
  });

  describe('getSummary', () => {
    it('should return engine summary', () => {
      engine.transition(FLOW_EVENTS.START);
      const summary = engine.getSummary();

      expect(summary.id).toBe('test-flow');
      expect(summary.state).toBe(FLOW_STATES.ANALYZING);
      expect(summary.isTerminal).toBe(false);
      expect(summary.isResumable).toBe(false);
      expect(summary.retryCount).toBe(0);
      expect(summary.historyLength).toBe(1);
    });
  });
});
