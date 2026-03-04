import path from 'path';
import fs from 'fs-extra';

export const LOOP_STATES = Object.freeze({
  INTAKE: 'INTAKE',
  CONTEXT: 'CONTEXT',
  DECOMPOSE: 'DECOMPOSE',
  EXECUTE: 'EXECUTE',
  VERIFY: 'VERIFY',
  RECOVER: 'RECOVER',
  SUMMARIZE: 'SUMMARIZE',
  PERSIST: 'PERSIST'
});

export const DEFAULT_LOOP_STATE_FILE = path.join(
  process.cwd(),
  '.aimax',
  'state',
  'loop-state.json'
);

const TRANSITIONS = Object.freeze({
  [LOOP_STATES.INTAKE]: [LOOP_STATES.CONTEXT, LOOP_STATES.PERSIST],
  [LOOP_STATES.CONTEXT]: [LOOP_STATES.DECOMPOSE, LOOP_STATES.PERSIST],
  [LOOP_STATES.DECOMPOSE]: [LOOP_STATES.EXECUTE, LOOP_STATES.PERSIST],
  [LOOP_STATES.EXECUTE]: [LOOP_STATES.VERIFY, LOOP_STATES.PERSIST],
  [LOOP_STATES.VERIFY]: [LOOP_STATES.RECOVER, LOOP_STATES.EXECUTE, LOOP_STATES.SUMMARIZE, LOOP_STATES.PERSIST],
  [LOOP_STATES.RECOVER]: [LOOP_STATES.EXECUTE, LOOP_STATES.SUMMARIZE, LOOP_STATES.PERSIST],
  [LOOP_STATES.SUMMARIZE]: [LOOP_STATES.PERSIST],
  [LOOP_STATES.PERSIST]: [LOOP_STATES.INTAKE, LOOP_STATES.CONTEXT, LOOP_STATES.DECOMPOSE, LOOP_STATES.EXECUTE, LOOP_STATES.VERIFY, LOOP_STATES.RECOVER, LOOP_STATES.SUMMARIZE]
});

function nowIso() {
  return new Date().toISOString();
}

function stepKey(index) {
  return `step-${Math.max(index, 0)}`;
}

function getStepTitle(state, index) {
  if (!Array.isArray(state.steps) || state.steps.length === 0) {
    return `step-${index}`;
  }
  return state.steps[index] || `step-${index}`;
}

function nextActionForState(state) {
  const current = state.current_state;
  const index = state.current_step_index;
  const total = state.steps_total;

  switch (current) {
    case LOOP_STATES.INTAKE:
      return 'collect-context';
    case LOOP_STATES.CONTEXT:
      return 'decompose-task';
    case LOOP_STATES.DECOMPOSE:
      return total > 0 ? `execute ${getStepTitle(state, index)}` : 'execute-first-step';
    case LOOP_STATES.EXECUTE:
      return 'verify-gates';
    case LOOP_STATES.VERIFY:
      return 'decide-pass-or-recover';
    case LOOP_STATES.RECOVER:
      return 'retry-or-summarize';
    case LOOP_STATES.SUMMARIZE:
      return 'persist-final-summary';
    case LOOP_STATES.PERSIST:
      return 'completed';
    default:
      return 'unknown';
  }
}

function createRunId(prefix = 'loop') {
  const date = new Date();
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${y}${m}${d}-${seq}`;
}

function normalizeSteps(steps) {
  if (!steps) return [];
  if (Array.isArray(steps)) {
    return steps.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(steps)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createLoopState({
  task,
  steps = [],
  runId,
  gates,
  now
} = {}) {
  if (!task || !String(task).trim()) {
    throw new Error('task 不能为空');
  }

  const normalizedSteps = normalizeSteps(steps);
  const timestamp = now || nowIso();

  const state = {
    run_id: runId || createRunId(),
    task: String(task).trim(),
    current_state: LOOP_STATES.INTAKE,
    current_step_index: 0,
    steps_total: normalizedSteps.length,
    steps: normalizedSteps,
    retries: {},
    gates: {
      build: 'pending',
      tests: 'pending',
      lint: 'pending',
      security: 'pending',
      eval: 'pending',
      ...(gates || {})
    },
    next_action: 'collect-context',
    artifacts: [],
    updated_at: timestamp
  };

  return state;
}

export function canTransition(fromState, toState) {
  const allowed = TRANSITIONS[fromState] || [];
  return allowed.includes(toState);
}

function assertValidState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('state 不存在或格式无效');
  }
  if (!state.current_state || !(state.current_state in TRANSITIONS)) {
    throw new Error(`未知状态: ${state.current_state}`);
  }
}

export function transitionLoopState(state, toState, { now } = {}) {
  assertValidState(state);
  if (!(toState in TRANSITIONS)) {
    throw new Error(`目标状态无效: ${toState}`);
  }
  if (!canTransition(state.current_state, toState)) {
    throw new Error(`非法状态迁移: ${state.current_state} -> ${toState}`);
  }

  const next = {
    ...state,
    current_state: toState,
    updated_at: now || nowIso()
  };
  next.next_action = nextActionForState(next);
  return next;
}

function markRecoverRetry(state) {
  const retries = { ...(state.retries || {}) };
  const key = stepKey(state.current_step_index);
  retries[key] = (retries[key] || 0) + 1;
  return retries;
}

export function advanceLoopState(state, options = {}) {
  const {
    verify = 'pass',
    maxRetries = 3,
    now,
    gateResults
  } = options;

  assertValidState(state);

  const merged = {
    ...state,
    gates: { ...(state.gates || {}), ...(gateResults || {}) }
  };

  const current = merged.current_state;

  if (current === LOOP_STATES.INTAKE) {
    return transitionLoopState(merged, LOOP_STATES.CONTEXT, { now });
  }

  if (current === LOOP_STATES.CONTEXT) {
    return transitionLoopState(merged, LOOP_STATES.DECOMPOSE, { now });
  }

  if (current === LOOP_STATES.DECOMPOSE) {
    const next = transitionLoopState(merged, LOOP_STATES.EXECUTE, { now });
    next.current_step_index = Math.min(next.current_step_index, Math.max(next.steps_total - 1, 0));
    next.next_action = nextActionForState(next);
    return next;
  }

  if (current === LOOP_STATES.EXECUTE) {
    return transitionLoopState(merged, LOOP_STATES.VERIFY, { now });
  }

  if (current === LOOP_STATES.VERIFY) {
    if (verify === 'fail') {
      const next = transitionLoopState(merged, LOOP_STATES.RECOVER, { now });
      next.retries = markRecoverRetry(next);
      next.next_action = nextActionForState(next);
      return next;
    }

    const hasMoreSteps = merged.current_step_index < Math.max(merged.steps_total - 1, 0);
    if (hasMoreSteps) {
      const next = transitionLoopState(merged, LOOP_STATES.EXECUTE, { now });
      next.current_step_index += 1;
      next.next_action = nextActionForState(next);
      return next;
    }

    return transitionLoopState(merged, LOOP_STATES.SUMMARIZE, { now });
  }

  if (current === LOOP_STATES.RECOVER) {
    const key = stepKey(merged.current_step_index);
    const retryCount = Number((merged.retries || {})[key] || 0);
    if (retryCount >= maxRetries) {
      const next = transitionLoopState(merged, LOOP_STATES.SUMMARIZE, { now });
      next.next_action = 'manual-decision-required';
      return next;
    }
    return transitionLoopState(merged, LOOP_STATES.EXECUTE, { now });
  }

  if (current === LOOP_STATES.SUMMARIZE) {
    return transitionLoopState(merged, LOOP_STATES.PERSIST, { now });
  }

  if (current === LOOP_STATES.PERSIST) {
    return {
      ...merged,
      updated_at: now || nowIso(),
      next_action: 'completed'
    };
  }

  throw new Error(`无法推进状态: ${current}`);
}

export function getRetryCount(state) {
  const retries = state?.retries || {};
  return Number(retries[stepKey(state.current_step_index)] || 0);
}

export function formatLoopState(state) {
  assertValidState(state);
  const retries = getRetryCount(state);
  return [
    `run_id: ${state.run_id}`,
    `state: ${state.current_state}`,
    `step: ${state.current_step_index + 1}/${Math.max(state.steps_total, 1)}`,
    `retry: ${retries}`,
    `next: ${state.next_action}`,
    `updated_at: ${state.updated_at}`
  ].join('\n');
}

export async function saveLoopState(state, filePath = DEFAULT_LOOP_STATE_FILE) {
  assertValidState(state);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, state, { spaces: 2 });
  return filePath;
}

export async function loadLoopState(filePath = DEFAULT_LOOP_STATE_FILE) {
  if (!await fs.pathExists(filePath)) {
    throw new Error(`状态文件不存在: ${filePath}`);
  }
  const state = await fs.readJson(filePath);
  assertValidState(state);
  return state;
}
