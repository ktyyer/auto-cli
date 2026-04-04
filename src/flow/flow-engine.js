/**
 * FSM 流程引擎
 *
 * 借鉴 Claude Code 的有限状态机架构，提供：
 * - 状态转移 + 事件驱动
 * - 上下文携带（每次转移可附加数据）
 * - 历史记录（完整转移轨迹）
 * - 快照序列化（断点恢复）
 * - 监听器（状态变化通知）
 * - 重试计数（防止无限循环）
 */

import path from 'node:path';
import fs from 'fs-extra';
import {
  FLOW_STATES,
  FLOW_EVENTS,
  TRANSITIONS,
  STATE_TO_PHASE,
  canTransition,
  getNextState,
  isTerminal,
  isResumable
} from './flow-state.js';
import {
  createCircuitState,
  canExecute as circuitCanExecute,
  recordSuccess as circuitRecordSuccess,
  recordFailure as circuitRecordFailure,
  tryHalfOpen as circuitTryHalfOpen,
  recordHalfOpenAttempt,
  resetCircuit,
  getCircuitSummary,
  CIRCUIT_STATES
} from './circuit-breaker.js';
import { logger } from '../logger.js';

const MAX_RETRIES = 3;
const SNAPSHOT_DIR = '.auto/snapshots';

export class FlowEngine {
  /**
   * @param {string} id - 流程唯一标识
   * @param {Object} [options]
   * @param {number} [options.maxRetries=3]
   */
  constructor(id, options = {}) {
    this.id = id;
    this.state = FLOW_STATES.IDLE;
    this.context = {};
    this.history = [];
    this.retryCount = 0;
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
    this._listeners = [];
    this._previousState = null;
    this._createdAt = Date.now();
    this._updatedAt = Date.now();

    // 断路器：连续失败保护
    this._circuitState = createCircuitState({
      failureThreshold: options.circuitFailureThreshold ?? 3,
      resetTimeout: options.circuitResetTimeout ?? 30000,
      halfOpenMaxAttempts: options.circuitHalfOpenMaxAttempts ?? 1
    });
  }

  /**
   * 执行状态转移
   * @param {string} event - 触发事件
   * @param {Object} [data] - 附加上下文数据
   * @returns {{ success: boolean, from: string, to: string, error?: string }}
   */
  transition(event, data = {}) {
    const from = this.state;

    if (!canTransition(from, event)) {
      const error = `非法转移: ${from} --[${event}]--> ? (不允许)`;
      logger.warn(error);
      return { success: false, from, to: from, error };
    }

    let to = getNextState(from, event);

    // PAUSED + RESUME → 回到暂停前的状态
    if (from === FLOW_STATES.PAUSED && event === FLOW_EVENTS.RESUME) {
      to = this._previousState || FLOW_STATES.IDLE;
    }

    // FAILED + RETRY → 回到失败前的状态（带重试计数）
    if (event === FLOW_EVENTS.RETRY) {
      // 断路器检查：尝试 HALF_OPEN 转换
      this._circuitState = circuitTryHalfOpen(this._circuitState);
      const circuitCheck = circuitCanExecute(this._circuitState);
      if (!circuitCheck.allowed) {
        const error = `断路器阻止重试: ${circuitCheck.reason}`;
        logger.warn(error);
        return { success: false, from, to: from, error };
      }
      // 记录 HALF_OPEN 试探
      if (this._circuitState.state === CIRCUIT_STATES.HALF_OPEN) {
        this._circuitState = recordHalfOpenAttempt(this._circuitState);
      }

      this.retryCount += 1;
      if (this.retryCount > this.maxRetries) {
        const error = `重试次数超限 (${this.retryCount}/${this.maxRetries})`;
        logger.warn(error);
        return { success: false, from, to: from, error };
      }
      to = this._previousState || FLOW_STATES.IDLE;
    }

    // 记录暂停/失败前的状态
    if (event === FLOW_EVENTS.PAUSE || event === FLOW_EVENTS.FAIL) {
      this._previousState = from;
    }

    // FAIL 事件：记录到断路器
    if (event === FLOW_EVENTS.FAIL) {
      const failReason = data.error ?? data.reason ?? 'unknown';
      this._circuitState = circuitRecordFailure(this._circuitState, String(failReason));
    }

    // 成功完成时：记录断路器成功（重置连续失败计数）
    if (event === FLOW_EVENTS.EXECUTE_DONE || event === FLOW_EVENTS.REVIEW_DONE) {
      this._circuitState = circuitRecordSuccess(this._circuitState);
    }

    // 重置时清空
    if (event === FLOW_EVENTS.RESET) {
      this.retryCount = 0;
      this._previousState = null;
      this.context = {};
      this._circuitState = resetCircuit(this._circuitState);
    }

    // 合并上下文（不可变）
    this.context = { ...this.context, ...data };

    // 记录历史
    this.history.push({
      from,
      to,
      event,
      timestamp: Date.now(),
      data: Object.keys(data).length > 0 ? data : undefined
    });

    // 更新状态
    this.state = to;
    this._updatedAt = Date.now();

    logger.debug(`状态转移: ${from} --[${event}]--> ${to}`);

    // 通知监听器
    this._notifyListeners({ from, to, event, data });

    return { success: true, from, to };
  }

  /**
   * 注册状态变化监听器
   * @param {Function} listener - (transition) => void
   * @returns {Function} 取消注册函数
   */
  onTransition(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  /**
   * 序列化为快照
   * @returns {Object}
   */
  toSnapshot() {
    return {
      id: this.id,
      state: this.state,
      context: { ...this.context },
      history: [...this.history],
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      circuitState: getCircuitSummary(this._circuitState),
      _previousState: this._previousState,
      _createdAt: this._createdAt,
      _updatedAt: this._updatedAt,
      version: 2
    };
  }

  /**
   * 从快照恢复
   * @param {Object} snapshot
   * @returns {FlowEngine}
   */
  static fromSnapshot(snapshot) {
    const engine = new FlowEngine(snapshot.id, {
      maxRetries: snapshot.maxRetries
    });
    engine.state = snapshot.state;
    engine.context = { ...snapshot.context };
    engine.history = [...snapshot.history];
    engine.retryCount = snapshot.retryCount;
    engine._previousState = snapshot._previousState;
    engine._createdAt = snapshot._createdAt;
    engine._updatedAt = snapshot._updatedAt;
    return engine;
  }

  /**
   * 保存快照到磁盘
   * @param {string} [projectDir] - 项目根目录
   * @returns {Promise<string>} 快照文件路径
   */
  async saveSnapshot(projectDir = process.cwd()) {
    const dir = path.join(projectDir, SNAPSHOT_DIR);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, `${this.id}.json`);
    await fs.writeJson(filePath, this.toSnapshot(), { spaces: 2 });
    logger.debug(`快照已保存: ${filePath}`);
    return filePath;
  }

  /**
   * 从磁盘加载快照
   * @param {string} id - 流程 ID
   * @param {string} [projectDir] - 项目根目录
   * @returns {Promise<FlowEngine|null>}
   */
  static async loadSnapshot(id, projectDir = process.cwd()) {
    const filePath = path.join(projectDir, SNAPSHOT_DIR, `${id}.json`);
    if (!(await fs.pathExists(filePath))) {
      return null;
    }
    const snapshot = await fs.readJson(filePath);
    return FlowEngine.fromSnapshot(snapshot);
  }

  /**
   * 获取当前 PHASE 编号（向后兼容）
   * @returns {number|null}
   */
  getPhase() {
    return STATE_TO_PHASE[this.state] ?? null;
  }

  /**
   * 获取引擎摘要
   * @returns {Object}
   */
  getSummary() {
    return {
      id: this.id,
      state: this.state,
      isTerminal: isTerminal(this.state),
      isResumable: isResumable(this.state),
      retryCount: this.retryCount,
      circuit: getCircuitSummary(this._circuitState),
      historyLength: this.history.length,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }

  /**
   * 获取断路器状态
   * @returns {Object}
   */
  getCircuitState() {
    return getCircuitSummary(this._circuitState);
  }

  /**
   * 通知监听器
   * @param {Object} transition
   * @private
   */
  _notifyListeners(transition) {
    for (const listener of this._listeners) {
      try {
        listener(transition);
      } catch (err) {
        logger.warn(`监听器执行失败: ${err.message}`);
      }
    }
  }
}

export default FlowEngine;
export { FLOW_STATES, FLOW_EVENTS, TRANSITIONS };
