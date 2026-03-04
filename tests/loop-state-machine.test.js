import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import {
  LOOP_STATES,
  createLoopState,
  advanceLoopState,
  canTransition,
  saveLoopState,
  loadLoopState,
  formatLoopState
} from '../src/loop-state-machine.js';

describe('loop-state-machine', () => {
  it('should create initial state with normalized steps', () => {
    const state = createLoopState({
      task: '优化支付链路',
      steps: 'collect metrics, optimize db, run tests'
    });

    expect(state.current_state).toBe(LOOP_STATES.INTAKE);
    expect(state.steps_total).toBe(3);
    expect(state.steps).toEqual(['collect metrics', 'optimize db', 'run tests']);
    expect(state.next_action).toBe('collect-context');
  });

  it('should reject empty task', () => {
    expect(() => createLoopState({ task: '' })).toThrow();
  });

  it('should validate transition map', () => {
    expect(canTransition(LOOP_STATES.INTAKE, LOOP_STATES.CONTEXT)).toBe(true);
    expect(canTransition(LOOP_STATES.INTAKE, LOOP_STATES.VERIFY)).toBe(false);
  });

  it('should advance through happy path to summarize', () => {
    let state = createLoopState({
      task: '重构订单模块',
      steps: ['analyze', 'refactor']
    });

    state = advanceLoopState(state); // INTAKE -> CONTEXT
    state = advanceLoopState(state); // CONTEXT -> DECOMPOSE
    state = advanceLoopState(state); // DECOMPOSE -> EXECUTE (step 1)
    expect(state.current_state).toBe(LOOP_STATES.EXECUTE);
    expect(state.current_step_index).toBe(0);

    state = advanceLoopState(state); // EXECUTE -> VERIFY
    state = advanceLoopState(state, { verify: 'pass' }); // VERIFY -> EXECUTE (step 2)
    expect(state.current_state).toBe(LOOP_STATES.EXECUTE);
    expect(state.current_step_index).toBe(1);

    state = advanceLoopState(state); // EXECUTE -> VERIFY
    state = advanceLoopState(state, { verify: 'pass' }); // VERIFY -> SUMMARIZE
    expect(state.current_state).toBe(LOOP_STATES.SUMMARIZE);
  });

  it('should enter recover on verify fail and track retries', () => {
    let state = createLoopState({
      task: '修复构建链路',
      steps: ['fix ts errors']
    });

    state = advanceLoopState(state); // INTAKE -> CONTEXT
    state = advanceLoopState(state); // CONTEXT -> DECOMPOSE
    state = advanceLoopState(state); // DECOMPOSE -> EXECUTE
    state = advanceLoopState(state); // EXECUTE -> VERIFY
    state = advanceLoopState(state, { verify: 'fail' }); // VERIFY -> RECOVER

    expect(state.current_state).toBe(LOOP_STATES.RECOVER);
    expect(state.retries['step-0']).toBe(1);
  });

  it('should summarize when recover hits retry limit', () => {
    let state = createLoopState({
      task: '修复 lint 问题',
      steps: ['step a']
    });

    state = advanceLoopState(state); // INTAKE -> CONTEXT
    state = advanceLoopState(state); // CONTEXT -> DECOMPOSE
    state = advanceLoopState(state); // DECOMPOSE -> EXECUTE
    state = advanceLoopState(state); // EXECUTE -> VERIFY
    state = advanceLoopState(state, { verify: 'fail' }); // VERIFY -> RECOVER retry=1

    // Force retries to max threshold for current step
    state.retries['step-0'] = 3;
    state = advanceLoopState(state, { maxRetries: 3 }); // RECOVER -> SUMMARIZE
    expect(state.current_state).toBe(LOOP_STATES.SUMMARIZE);
    expect(state.next_action).toBe('manual-decision-required');
  });

  it('should persist and load state from disk', async () => {
    const tempDir = path.join(os.tmpdir(), `aimax-loop-${Date.now()}`);
    const stateFile = path.join(tempDir, 'loop-state.json');
    const state = createLoopState({
      task: '持久化测试',
      steps: ['one']
    });

    await saveLoopState(state, stateFile);
    expect(await fs.pathExists(stateFile)).toBe(true);

    const loaded = await loadLoopState(stateFile);
    expect(loaded.run_id).toBe(state.run_id);
    expect(loaded.task).toBe('持久化测试');

    await fs.remove(tempDir);
  });

  it('should format state summary for console', () => {
    const state = createLoopState({
      task: 'format test',
      steps: ['a', 'b']
    });
    const output = formatLoopState(state);
    expect(output).toContain('run_id:');
    expect(output).toContain('state: INTAKE');
    expect(output).toContain('step: 1/2');
  });
});
