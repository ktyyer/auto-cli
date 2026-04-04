import { describe, it, expect } from 'vitest';
import {
  CIRCUIT_STATES,
  _CIRCUIT_EVENTS,
  DEFAULT_CIRCUIT_OPTIONS,
  createCircuitState,
  canExecute,
  recordSuccess,
  recordFailure,
  tryHalfOpen,
  recordHalfOpenAttempt,
  resetCircuit,
  getCircuitSummary
} from '../src/flow/circuit-breaker.js';
import { FlowEngine, FLOW_EVENTS } from '../src/flow/flow-engine.js';

describe('createCircuitState', () => {
  it('should create with default options', () => {
    const state = createCircuitState();

    expect(state.state).toBe(CIRCUIT_STATES.CLOSED);
    expect(state.failureCount).toBe(0);
    expect(state.successCount).toBe(0);
    expect(state.failureThreshold).toBe(DEFAULT_CIRCUIT_OPTIONS.failureThreshold);
    expect(state.resetTimeout).toBe(DEFAULT_CIRCUIT_OPTIONS.resetTimeout);
    expect(Object.isFrozen(state)).toBe(true);
  });

  it('should accept custom options', () => {
    const state = createCircuitState({
      failureThreshold: 5,
      resetTimeout: 60000,
      halfOpenMaxAttempts: 2
    });

    expect(state.failureThreshold).toBe(5);
    expect(state.resetTimeout).toBe(60000);
    expect(state.halfOpenMaxAttempts).toBe(2);
  });
});

describe('canExecute', () => {
  it('should allow execution when CLOSED', () => {
    const state = createCircuitState();
    const result = canExecute(state);

    expect(result.allowed).toBe(true);
    expect(result.state).toBe(CIRCUIT_STATES.CLOSED);
  });

  it('should block execution when OPEN and not timed out', () => {
    let state = createCircuitState({ resetTimeout: 60000 });
    state = { ...state, state: CIRCUIT_STATES.OPEN, openedAt: Date.now() };
    state = Object.freeze(state);

    const result = canExecute(state);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('circuit OPEN');
  });

  it('should allow execution when OPEN but timed out', () => {
    let state = createCircuitState({ resetTimeout: 1 });
    state = { ...state, state: CIRCUIT_STATES.OPEN, openedAt: Date.now() - 100 };
    state = Object.freeze(state);

    const result = canExecute(state);
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('HALF_OPEN');
  });

  it('should allow probe in HALF_OPEN under limit', () => {
    let state = createCircuitState({ halfOpenMaxAttempts: 1 });
    state = { ...state, state: CIRCUIT_STATES.HALF_OPEN, halfOpenAttempts: 0 };
    state = Object.freeze(state);

    const result = canExecute(state);
    expect(result.allowed).toBe(true);
  });

  it('should block in HALF_OPEN when max attempts reached', () => {
    let state = createCircuitState({ halfOpenMaxAttempts: 1 });
    state = { ...state, state: CIRCUIT_STATES.HALF_OPEN, halfOpenAttempts: 1 };
    state = Object.freeze(state);

    const result = canExecute(state);
    expect(result.allowed).toBe(false);
  });
});

describe('recordSuccess', () => {
  it('should reset failure count on success in CLOSED', () => {
    let state = createCircuitState();
    state = recordFailure(state, 'test');
    expect(state.failureCount).toBe(1);

    state = recordSuccess(state);
    expect(state.failureCount).toBe(0);
    expect(state.successCount).toBe(1);
  });

  it('should transition HALF_OPEN -> CLOSED on success', () => {
    let state = createCircuitState();
    state = { ...state, state: CIRCUIT_STATES.HALF_OPEN };
    state = Object.freeze(state);

    const newState = recordSuccess(state);
    expect(newState.state).toBe(CIRCUIT_STATES.CLOSED);
    expect(newState.failureCount).toBe(0);
    expect(newState.openedAt).toBeNull();
  });

  it('should return new object (immutable)', () => {
    const original = createCircuitState();
    const updated = recordSuccess(original);

    expect(original.successCount).toBe(0);
    expect(updated.successCount).toBe(1);
    expect(Object.isFrozen(updated)).toBe(true);
  });
});

describe('recordFailure', () => {
  it('should increment failure count in CLOSED', () => {
    const state = createCircuitState();
    const newState = recordFailure(state, 'test error');

    expect(newState.failureCount).toBe(1);
    expect(newState.lastFailureReason).toBe('test error');
    expect(newState.state).toBe(CIRCUIT_STATES.CLOSED);
  });

  it('should transition CLOSED -> OPEN at threshold', () => {
    let state = createCircuitState({ failureThreshold: 2 });
    state = recordFailure(state, 'fail 1');
    state = recordFailure(state, 'fail 2');

    expect(state.state).toBe(CIRCUIT_STATES.OPEN);
    expect(state.failureCount).toBe(2);
    expect(state.openedAt).toBeDefined();
  });

  it('should transition HALF_OPEN -> OPEN on failure', () => {
    let state = createCircuitState();
    state = { ...state, state: CIRCUIT_STATES.HALF_OPEN, halfOpenAttempts: 0 };
    state = Object.freeze(state);

    const newState = recordFailure(state, 'probe failed');
    expect(newState.state).toBe(CIRCUIT_STATES.OPEN);
    expect(newState.openedAt).toBeDefined();
  });

  it('should not open before threshold', () => {
    let state = createCircuitState({ failureThreshold: 5 });
    state = recordFailure(state, 'fail 1');
    state = recordFailure(state, 'fail 2');

    expect(state.state).toBe(CIRCUIT_STATES.CLOSED);
  });
});

describe('tryHalfOpen', () => {
  it('should transition OPEN -> HALF_OPEN after timeout', () => {
    let state = createCircuitState({ resetTimeout: 1 });
    state = { ...state, state: CIRCUIT_STATES.OPEN, openedAt: Date.now() - 100 };
    state = Object.freeze(state);

    const newState = tryHalfOpen(state);
    expect(newState.state).toBe(CIRCUIT_STATES.HALF_OPEN);
    expect(newState.halfOpenAttempts).toBe(0);
  });

  it('should not transition before timeout', () => {
    let state = createCircuitState({ resetTimeout: 60000 });
    state = { ...state, state: CIRCUIT_STATES.OPEN, openedAt: Date.now() };
    state = Object.freeze(state);

    const newState = tryHalfOpen(state);
    expect(newState.state).toBe(CIRCUIT_STATES.OPEN);
  });

  it('should not affect CLOSED state', () => {
    const state = createCircuitState();
    const newState = tryHalfOpen(state);
    expect(newState.state).toBe(CIRCUIT_STATES.CLOSED);
  });
});

describe('recordHalfOpenAttempt', () => {
  it('should increment halfOpenAttempts in HALF_OPEN', () => {
    let state = createCircuitState();
    state = { ...state, state: CIRCUIT_STATES.HALF_OPEN, halfOpenAttempts: 0 };
    state = Object.freeze(state);

    const newState = recordHalfOpenAttempt(state);
    expect(newState.halfOpenAttempts).toBe(1);
  });

  it('should not affect non-HALF_OPEN states', () => {
    const state = createCircuitState();
    const newState = recordHalfOpenAttempt(state);
    expect(newState).toBe(state);
  });
});

describe('resetCircuit', () => {
  it('should reset to initial CLOSED state', () => {
    let state = createCircuitState({ failureThreshold: 2 });
    state = recordFailure(state, 'fail 1');
    state = recordFailure(state, 'fail 2');
    expect(state.state).toBe(CIRCUIT_STATES.OPEN);

    const reset = resetCircuit(state);
    expect(reset.state).toBe(CIRCUIT_STATES.CLOSED);
    expect(reset.failureCount).toBe(0);
    expect(reset.successCount).toBe(0);
    expect(reset.failureThreshold).toBe(2); // preserves config
  });
});

describe('getCircuitSummary', () => {
  it('should return complete summary', () => {
    const state = createCircuitState({ failureThreshold: 3 });
    const summary = getCircuitSummary(state);

    expect(summary.state).toBe(CIRCUIT_STATES.CLOSED);
    expect(summary.failureCount).toBe(0);
    expect(summary.failureThreshold).toBe(3);
    expect(summary.isOperational).toBe(true);
    expect(summary.isBlocked).toBe(false);
    expect(Object.isFrozen(summary)).toBe(true);
  });
});

describe('full circuit breaker lifecycle', () => {
  it('should go CLOSED -> OPEN -> HALF_OPEN -> CLOSED', () => {
    let state = createCircuitState({ failureThreshold: 2, resetTimeout: 1 });

    // CLOSED: accumulate failures
    state = recordFailure(state, 'fail 1');
    expect(state.state).toBe(CIRCUIT_STATES.CLOSED);

    state = recordFailure(state, 'fail 2');
    expect(state.state).toBe(CIRCUIT_STATES.OPEN);

    // OPEN: wait for timeout
    state = { ...state, openedAt: Date.now() - 100 };
    state = Object.freeze(state);
    state = tryHalfOpen(state);
    expect(state.state).toBe(CIRCUIT_STATES.HALF_OPEN);

    // HALF_OPEN: successful probe
    state = recordSuccess(state);
    expect(state.state).toBe(CIRCUIT_STATES.CLOSED);
    expect(state.failureCount).toBe(0);
  });

  it('should go CLOSED -> OPEN -> HALF_OPEN -> OPEN on probe failure', () => {
    let state = createCircuitState({ failureThreshold: 2, resetTimeout: 1 });

    state = recordFailure(state, 'fail 1');
    state = recordFailure(state, 'fail 2');
    expect(state.state).toBe(CIRCUIT_STATES.OPEN);

    state = { ...state, openedAt: Date.now() - 100 };
    state = Object.freeze(state);
    state = tryHalfOpen(state);
    expect(state.state).toBe(CIRCUIT_STATES.HALF_OPEN);

    state = recordFailure(state, 'probe failed');
    expect(state.state).toBe(CIRCUIT_STATES.OPEN);
  });
});

describe('FlowEngine + Circuit Breaker integration', () => {
  it('should track circuit breaker in getSummary', () => {
    const engine = new FlowEngine('test-circuit');

    const summary = engine.getSummary();
    expect(summary.circuit).toBeDefined();
    expect(summary.circuit.state).toBe('closed');
    expect(summary.circuit.isOperational).toBe(true);
  });

  it('should expose getCircuitState', () => {
    const engine = new FlowEngine('test-circuit');

    const circuit = engine.getCircuitState();
    expect(circuit.state).toBe('closed');
    expect(circuit.failureCount).toBe(0);
  });

  it('should reset circuit on RESET event', () => {
    const engine = new FlowEngine('test-circuit', {
      maxRetries: 5,
      circuitFailureThreshold: 1
    });

    // Drive to ANALYZING
    engine.transition(FLOW_EVENTS.START, { phase: 1 });
    // Fail
    engine.transition(FLOW_EVENTS.FAIL, { error: 'test failure' });

    const afterFail = engine.getCircuitState();
    expect(afterFail.failureCount).toBe(1);

    // Reset
    engine.transition(FLOW_EVENTS.RESET);
    const afterReset = engine.getCircuitState();
    expect(afterReset.failureCount).toBe(0);
    expect(afterReset.state).toBe('closed');
  });

  it('should include circuit state in toSnapshot', () => {
    const engine = new FlowEngine('test-circuit');

    engine.transition(FLOW_EVENTS.START);
    const snapshot = engine.toSnapshot();
    expect(snapshot.circuitState).toBeDefined();
    expect(snapshot.circuitState.state).toBe('closed');
  });
});
