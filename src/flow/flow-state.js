/**
 * FSM 状态定义与转移规则
 *
 * 借鉴 Claude Code 泄露源码的有限状态机架构，
 * 替代硬编码的 PHASE 1-6 线性流程，支持：
 * - 断点恢复：序列化当前状态到磁盘
 * - 重试：失败状态可回退到上一步
 * - 并行分支：多个状态可同时激活（未来扩展）
 */

/**
 * 流程状态枚举
 * @readonly
 */
export const FLOW_STATES = Object.freeze({
  IDLE: 'idle',
  ANALYZING: 'analyzing',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  REVIEWING: 'reviewing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused'
});

/**
 * 状态转移事件
 * @readonly
 */
export const FLOW_EVENTS = Object.freeze({
  START: 'start',
  ANALYSIS_DONE: 'analysis_done',
  PLAN_DONE: 'plan_done',
  EXECUTE_DONE: 'execute_done',
  REVIEW_DONE: 'review_done',
  FAIL: 'fail',
  RETRY: 'retry',
  PAUSE: 'pause',
  RESUME: 'resume',
  RESET: 'reset'
});

/**
 * 状态转移表
 * key: 当前状态, value: { event: 目标状态 }
 * @readonly
 */
export const TRANSITIONS = Object.freeze({
  [FLOW_STATES.IDLE]: {
    [FLOW_EVENTS.START]: FLOW_STATES.ANALYZING
  },
  [FLOW_STATES.ANALYZING]: {
    [FLOW_EVENTS.ANALYSIS_DONE]: FLOW_STATES.PLANNING,
    [FLOW_EVENTS.FAIL]: FLOW_STATES.FAILED,
    [FLOW_EVENTS.PAUSE]: FLOW_STATES.PAUSED
  },
  [FLOW_STATES.PLANNING]: {
    [FLOW_EVENTS.PLAN_DONE]: FLOW_STATES.EXECUTING,
    [FLOW_EVENTS.FAIL]: FLOW_STATES.FAILED,
    [FLOW_EVENTS.PAUSE]: FLOW_STATES.PAUSED
  },
  [FLOW_STATES.EXECUTING]: {
    [FLOW_EVENTS.EXECUTE_DONE]: FLOW_STATES.REVIEWING,
    [FLOW_EVENTS.FAIL]: FLOW_STATES.FAILED,
    [FLOW_EVENTS.PAUSE]: FLOW_STATES.PAUSED
  },
  [FLOW_STATES.REVIEWING]: {
    [FLOW_EVENTS.REVIEW_DONE]: FLOW_STATES.COMPLETED,
    [FLOW_EVENTS.FAIL]: FLOW_STATES.FAILED,
    [FLOW_EVENTS.PAUSE]: FLOW_STATES.PAUSED
  },
  [FLOW_STATES.FAILED]: {
    [FLOW_EVENTS.RETRY]: FLOW_STATES.IDLE,
    [FLOW_EVENTS.RESET]: FLOW_STATES.IDLE
  },
  [FLOW_STATES.PAUSED]: {
    [FLOW_EVENTS.RESUME]: null,
    [FLOW_EVENTS.RESET]: FLOW_STATES.IDLE
  },
  [FLOW_STATES.COMPLETED]: {
    [FLOW_EVENTS.RESET]: FLOW_STATES.IDLE
  }
});

/**
 * PHASE 名称到状态的映射（向后兼容）
 * @readonly
 */
export const PHASE_TO_STATE = Object.freeze({
  1: FLOW_STATES.ANALYZING,
  2: FLOW_STATES.PLANNING,
  3: FLOW_STATES.EXECUTING,
  4: FLOW_STATES.REVIEWING,
  5: FLOW_STATES.REVIEWING,
  6: FLOW_STATES.COMPLETED
});

/**
 * 状态到 PHASE 的反向映射
 * @readonly
 */
export const STATE_TO_PHASE = Object.freeze({
  [FLOW_STATES.ANALYZING]: 1,
  [FLOW_STATES.PLANNING]: 2,
  [FLOW_STATES.EXECUTING]: 3,
  [FLOW_STATES.REVIEWING]: 4,
  [FLOW_STATES.COMPLETED]: 6
});

/**
 * 检查状态转移是否合法
 * @param {string} currentState
 * @param {string} event
 * @returns {boolean}
 */
export function canTransition(currentState, event) {
  const stateTransitions = TRANSITIONS[currentState];
  if (!stateTransitions) return false;
  return event in stateTransitions;
}

/**
 * 获取目标状态
 * @param {string} currentState
 * @param {string} event
 * @returns {string|null}
 */
export function getNextState(currentState, event) {
  if (!canTransition(currentState, event)) return null;
  return TRANSITIONS[currentState][event];
}

/**
 * 检查是否为终态
 * @param {string} state
 * @returns {boolean}
 */
export function isTerminal(state) {
  return state === FLOW_STATES.COMPLETED || state === FLOW_STATES.FAILED;
}

/**
 * 检查是否可恢复
 * @param {string} state
 * @returns {boolean}
 */
export function isResumable(state) {
  return state === FLOW_STATES.PAUSED || state === FLOW_STATES.FAILED;
}
