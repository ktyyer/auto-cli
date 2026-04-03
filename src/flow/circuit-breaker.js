/**
 * Circuit Breaker -- 断路器模式
 *
 * 标准 CLOSED/OPEN/HALF_OPEN 三态断路器:
 * - CLOSED: 正常运行，记录失败次数
 * - OPEN: 连续失败超阈值，拒绝所有请求
 * - HALF_OPEN: 允许一次试探性执行，成功则 CLOSED，失败则继续 OPEN
 *
 * 参考 Claude Code 的 AutoCompact 断路器设计
 * 不可变模式: 所有状态转移返回新对象
 */

import { logger } from '../logger.js';

/**
 * 断路器状态
 * @readonly
 */
export const CIRCUIT_STATES = Object.freeze({
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open'
});

/**
 * 断路器事件
 * @readonly
 */
export const CIRCUIT_EVENTS = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  TRIP: 'trip',
  RESET: 'reset',
  HALF_OPEN_RETRY: 'half_open_retry'
});

/**
 * 默认断路器配置
 * @readonly
 */
export const DEFAULT_CIRCUIT_OPTIONS = Object.freeze({
  failureThreshold: 3,
  resetTimeout: 30000,
  halfOpenMaxAttempts: 1
});

/**
 * 创建断路器状态快照（不可变）
 * @param {Object} [options]
 * @returns {Object}
 */
export function createCircuitState(options = {}) {
  return Object.freeze({
    state: CIRCUIT_STATES.CLOSED,
    failureCount: 0,
    successCount: 0,
    lastFailureTime: null,
    lastFailureReason: null,
    openedAt: null,
    halfOpenAttempts: 0,
    failureThreshold: options.failureThreshold ?? DEFAULT_CIRCUIT_OPTIONS.failureThreshold,
    resetTimeout: options.resetTimeout ?? DEFAULT_CIRCUIT_OPTIONS.resetTimeout,
    halfOpenMaxAttempts: options.halfOpenMaxAttempts ?? DEFAULT_CIRCUIT_OPTIONS.halfOpenMaxAttempts,
    _createdAt: Date.now(),
    _updatedAt: Date.now()
  });
}

/**
 * 检查断路器是否允许执行
 * @param {Object} circuitState
 * @returns {{ allowed: boolean, state: string, reason?: string }}
 */
export function canExecute(circuitState) {
  if (circuitState.state === CIRCUIT_STATES.CLOSED) {
    return Object.freeze({ allowed: true, state: circuitState.state });
  }

  if (circuitState.state === CIRCUIT_STATES.OPEN) {
    const elapsed = Date.now() - circuitState.openedAt;
    if (elapsed >= circuitState.resetTimeout) {
      return Object.freeze({
        allowed: true,
        state: circuitState.state,
        reason: 'resetTimeout elapsed, transitioning to HALF_OPEN'
      });
    }
    return Object.freeze({
      allowed: false,
      state: circuitState.state,
      reason: `circuit OPEN, retry after ${Math.ceil((circuitState.resetTimeout - elapsed) / 1000)}s`
    });
  }

  if (circuitState.state === CIRCUIT_STATES.HALF_OPEN) {
    if (circuitState.halfOpenAttempts < circuitState.halfOpenMaxAttempts) {
      return Object.freeze({
        allowed: true,
        state: circuitState.state,
        reason: 'HALF_OPEN: allowing probe attempt'
      });
    }
    return Object.freeze({
      allowed: false,
      state: circuitState.state,
      reason: 'HALF_OPEN: max probe attempts reached'
    });
  }

  return Object.freeze({ allowed: false, state: circuitState.state, reason: 'unknown state' });
}

/**
 * 记录成功（返回新状态）
 * @param {Object} circuitState
 * @returns {Object}
 */
export function recordSuccess(circuitState) {
  if (circuitState.state === CIRCUIT_STATES.HALF_OPEN) {
    logger.info('断路器: HALF_OPEN -> CLOSED (探测成功)');
    return Object.freeze({
      ...circuitState,
      state: CIRCUIT_STATES.CLOSED,
      failureCount: 0,
      successCount: circuitState.successCount + 1,
      halfOpenAttempts: 0,
      openedAt: null,
      _updatedAt: Date.now()
    });
  }

  return Object.freeze({
    ...circuitState,
    failureCount: 0,
    successCount: circuitState.successCount + 1,
    _updatedAt: Date.now()
  });
}

/**
 * 记录失败（返回新状态）
 * @param {Object} circuitState
 * @param {string} [reason]
 * @returns {Object}
 */
export function recordFailure(circuitState, reason = '') {
  const newFailureCount = circuitState.failureCount + 1;

  if (circuitState.state === CIRCUIT_STATES.HALF_OPEN) {
    logger.warn(`断路器: HALF_OPEN -> OPEN (探测失败: ${reason})`);
    return Object.freeze({
      ...circuitState,
      state: CIRCUIT_STATES.OPEN,
      failureCount: newFailureCount,
      lastFailureTime: Date.now(),
      lastFailureReason: reason,
      openedAt: Date.now(),
      halfOpenAttempts: 0,
      _updatedAt: Date.now()
    });
  }

  if (newFailureCount >= circuitState.failureThreshold) {
    logger.warn(
      `断路器: CLOSED -> OPEN (连续失败 ${newFailureCount}/${circuitState.failureThreshold}: ${reason})`
    );
    return Object.freeze({
      ...circuitState,
      state: CIRCUIT_STATES.OPEN,
      failureCount: newFailureCount,
      lastFailureTime: Date.now(),
      lastFailureReason: reason,
      openedAt: Date.now(),
      _updatedAt: Date.now()
    });
  }

  return Object.freeze({
    ...circuitState,
    failureCount: newFailureCount,
    lastFailureTime: Date.now(),
    lastFailureReason: reason,
    _updatedAt: Date.now()
  });
}

/**
 * 尝试转换到 HALF_OPEN（如果 OPEN 且超时已到）
 * @param {Object} circuitState
 * @returns {Object}
 */
export function tryHalfOpen(circuitState) {
  if (circuitState.state !== CIRCUIT_STATES.OPEN) {
    return circuitState;
  }

  const elapsed = Date.now() - circuitState.openedAt;
  if (elapsed < circuitState.resetTimeout) {
    return circuitState;
  }

  logger.debug('断路器: OPEN -> HALF_OPEN (resetTimeout elapsed)');
  return Object.freeze({
    ...circuitState,
    state: CIRCUIT_STATES.HALF_OPEN,
    halfOpenAttempts: 0,
    _updatedAt: Date.now()
  });
}

/**
 * 记录 HALF_OPEN 试探（返回新状态）
 * @param {Object} circuitState
 * @returns {Object}
 */
export function recordHalfOpenAttempt(circuitState) {
  if (circuitState.state !== CIRCUIT_STATES.HALF_OPEN) {
    return circuitState;
  }

  return Object.freeze({
    ...circuitState,
    halfOpenAttempts: circuitState.halfOpenAttempts + 1,
    _updatedAt: Date.now()
  });
}

/**
 * 重置断路器（返回新状态）
 * @param {Object} circuitState
 * @returns {Object}
 */
export function resetCircuit(circuitState) {
  return Object.freeze({
    ...createCircuitState({
      failureThreshold: circuitState.failureThreshold,
      resetTimeout: circuitState.resetTimeout,
      halfOpenMaxAttempts: circuitState.halfOpenMaxAttempts
    })
  });
}

/**
 * 获取断路器摘要
 * @param {Object} circuitState
 * @returns {Object}
 */
export function getCircuitSummary(circuitState) {
  return Object.freeze({
    state: circuitState.state,
    failureCount: circuitState.failureCount,
    successCount: circuitState.successCount,
    failureThreshold: circuitState.failureThreshold,
    isOperational: circuitState.state === CIRCUIT_STATES.CLOSED,
    isBlocked: circuitState.state === CIRCUIT_STATES.OPEN,
    lastFailureReason: circuitState.lastFailureReason
  });
}
