import { describe, it, expect } from 'vitest';
import {
  FLOW_STATES,
  FLOW_EVENTS,
  TRANSITIONS,
  PHASE_TO_STATE,
  STATE_TO_PHASE,
  canTransition,
  getNextState,
  isTerminal,
  isResumable
} from '../src/flow/flow-state.js';

describe('FLOW_STATES', () => {
  it('should have 9 states', () => {
    expect(Object.keys(FLOW_STATES)).toHaveLength(9);
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(FLOW_STATES)).toBe(true);
  });

  it('should contain all expected states', () => {
    expect(FLOW_STATES.IDLE).toBe('idle');
    expect(FLOW_STATES.ANALYZING).toBe('analyzing');
    expect(FLOW_STATES.PLANNING).toBe('planning');
    expect(FLOW_STATES.EXECUTING).toBe('executing');
    expect(FLOW_STATES.REVIEWING).toBe('reviewing');
    expect(FLOW_STATES.COMPLETED).toBe('completed');
    expect(FLOW_STATES.FAILED).toBe('failed');
    expect(FLOW_STATES.PAUSED).toBe('paused');
  });
});

describe('FLOW_EVENTS', () => {
  it('should have 11 events', () => {
    expect(Object.keys(FLOW_EVENTS)).toHaveLength(11);
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(FLOW_EVENTS)).toBe(true);
  });
});

describe('TRANSITIONS', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(TRANSITIONS)).toBe(true);
  });

  it('should define transitions for all states', () => {
    for (const state of Object.values(FLOW_STATES)) {
      expect(TRANSITIONS[state]).toBeDefined();
    }
  });

  it('should have correct happy path', () => {
    expect(TRANSITIONS[FLOW_STATES.IDLE][FLOW_EVENTS.START]).toBe(FLOW_STATES.ANALYZING);
    expect(TRANSITIONS[FLOW_STATES.ANALYZING][FLOW_EVENTS.ANALYSIS_DONE]).toBe(
      FLOW_STATES.PLANNING
    );
    expect(TRANSITIONS[FLOW_STATES.PLANNING][FLOW_EVENTS.PLAN_DONE]).toBe(FLOW_STATES.EXECUTING);
    expect(TRANSITIONS[FLOW_STATES.EXECUTING][FLOW_EVENTS.EXECUTE_DONE]).toBe(
      FLOW_STATES.REVIEWING
    );
    expect(TRANSITIONS[FLOW_STATES.REVIEWING][FLOW_EVENTS.REVIEW_DONE]).toBe(
      FLOW_STATES.COMMITTING
    );
    expect(TRANSITIONS[FLOW_STATES.COMMITTING][FLOW_EVENTS.COMMIT_DONE]).toBe(
      FLOW_STATES.COMPLETED
    );
  });

  it('should allow fail from working states', () => {
    expect(TRANSITIONS[FLOW_STATES.ANALYZING][FLOW_EVENTS.FAIL]).toBe(FLOW_STATES.FAILED);
    expect(TRANSITIONS[FLOW_STATES.PLANNING][FLOW_EVENTS.FAIL]).toBe(FLOW_STATES.FAILED);
    expect(TRANSITIONS[FLOW_STATES.EXECUTING][FLOW_EVENTS.FAIL]).toBe(FLOW_STATES.FAILED);
    expect(TRANSITIONS[FLOW_STATES.REVIEWING][FLOW_EVENTS.FAIL]).toBe(FLOW_STATES.FAILED);
    expect(TRANSITIONS[FLOW_STATES.COMMITTING][FLOW_EVENTS.FAIL]).toBe(FLOW_STATES.FAILED);
  });

  it('should allow pause from working states', () => {
    expect(TRANSITIONS[FLOW_STATES.ANALYZING][FLOW_EVENTS.PAUSE]).toBe(FLOW_STATES.PAUSED);
    expect(TRANSITIONS[FLOW_STATES.PLANNING][FLOW_EVENTS.PAUSE]).toBe(FLOW_STATES.PAUSED);
    expect(TRANSITIONS[FLOW_STATES.EXECUTING][FLOW_EVENTS.PAUSE]).toBe(FLOW_STATES.PAUSED);
    expect(TRANSITIONS[FLOW_STATES.REVIEWING][FLOW_EVENTS.PAUSE]).toBe(FLOW_STATES.PAUSED);
    expect(TRANSITIONS[FLOW_STATES.COMMITTING][FLOW_EVENTS.PAUSE]).toBe(FLOW_STATES.PAUSED);
  });

  it('should allow reset from terminal and paused states', () => {
    expect(TRANSITIONS[FLOW_STATES.FAILED][FLOW_EVENTS.RESET]).toBe(FLOW_STATES.IDLE);
    expect(TRANSITIONS[FLOW_STATES.PAUSED][FLOW_EVENTS.RESET]).toBe(FLOW_STATES.IDLE);
    expect(TRANSITIONS[FLOW_STATES.COMPLETED][FLOW_EVENTS.RESET]).toBe(FLOW_STATES.IDLE);
  });
});

describe('PHASE_TO_STATE', () => {
  it('should map phases 1-6 to states', () => {
    expect(PHASE_TO_STATE[1]).toBe(FLOW_STATES.ANALYZING);
    expect(PHASE_TO_STATE[2]).toBe(FLOW_STATES.PLANNING);
    expect(PHASE_TO_STATE[3]).toBe(FLOW_STATES.EXECUTING);
    expect(PHASE_TO_STATE[6]).toBe(FLOW_STATES.COMPLETED);
  });
});

describe('STATE_TO_PHASE', () => {
  it('should reverse-map states to phases', () => {
    expect(STATE_TO_PHASE[FLOW_STATES.ANALYZING]).toBe(1);
    expect(STATE_TO_PHASE[FLOW_STATES.PLANNING]).toBe(2);
    expect(STATE_TO_PHASE[FLOW_STATES.EXECUTING]).toBe(3);
    expect(STATE_TO_PHASE[FLOW_STATES.REVIEWING]).toBe(4);
    expect(STATE_TO_PHASE[FLOW_STATES.COMPLETED]).toBe(6);
  });
});

describe('canTransition', () => {
  it('should return true for valid transitions', () => {
    expect(canTransition(FLOW_STATES.IDLE, FLOW_EVENTS.START)).toBe(true);
    expect(canTransition(FLOW_STATES.ANALYZING, FLOW_EVENTS.ANALYSIS_DONE)).toBe(true);
    expect(canTransition(FLOW_STATES.FAILED, FLOW_EVENTS.RETRY)).toBe(true);
  });

  it('should return false for invalid transitions', () => {
    expect(canTransition(FLOW_STATES.IDLE, FLOW_EVENTS.ANALYSIS_DONE)).toBe(false);
    expect(canTransition(FLOW_STATES.COMPLETED, FLOW_EVENTS.START)).toBe(false);
    expect(canTransition(FLOW_STATES.IDLE, FLOW_EVENTS.FAIL)).toBe(false);
  });

  it('should return false for unknown state', () => {
    expect(canTransition('unknown', FLOW_EVENTS.START)).toBe(false);
  });
});

describe('getNextState', () => {
  it('should return next state for valid transition', () => {
    expect(getNextState(FLOW_STATES.IDLE, FLOW_EVENTS.START)).toBe(FLOW_STATES.ANALYZING);
    expect(getNextState(FLOW_STATES.PLANNING, FLOW_EVENTS.PLAN_DONE)).toBe(FLOW_STATES.EXECUTING);
  });

  it('should return null for invalid transition', () => {
    expect(getNextState(FLOW_STATES.IDLE, FLOW_EVENTS.FAIL)).toBeNull();
    expect(getNextState('unknown', FLOW_EVENTS.START)).toBeNull();
  });
});

describe('isTerminal', () => {
  it('should return true for COMPLETED and FAILED', () => {
    expect(isTerminal(FLOW_STATES.COMPLETED)).toBe(true);
    expect(isTerminal(FLOW_STATES.FAILED)).toBe(true);
  });

  it('should return false for non-terminal states', () => {
    expect(isTerminal(FLOW_STATES.IDLE)).toBe(false);
    expect(isTerminal(FLOW_STATES.ANALYZING)).toBe(false);
    expect(isTerminal(FLOW_STATES.PAUSED)).toBe(false);
  });
});

describe('isResumable', () => {
  it('should return true for PAUSED and FAILED', () => {
    expect(isResumable(FLOW_STATES.PAUSED)).toBe(true);
    expect(isResumable(FLOW_STATES.FAILED)).toBe(true);
  });

  it('should return false for non-resumable states', () => {
    expect(isResumable(FLOW_STATES.IDLE)).toBe(false);
    expect(isResumable(FLOW_STATES.COMPLETED)).toBe(false);
    expect(isResumable(FLOW_STATES.EXECUTING)).toBe(false);
  });
});
