/**
 * Agent 执行循环系统
 *
 * 核心功能：
 * - 任务调度和依赖管理
 * - 并行/串行执行模式
 * - 状态管理和结果收集
 * - 错误处理和重试逻辑
 *
 * 灵感来源：
 * - HitCC Agent Loop：Task Scheduling + State Machine + Retry Logic
 */

import {
  AGENT_STATES,
  AGENT_MODES,
  DEFAULT_AGENT_CONFIG,
  validateAgentTask,
  canExecuteTask,
  sortTasksByPriority
} from './agent-types.js';

/**
 * Agent 执行器类
 */
export class AgentExecutor {
  constructor(config = {}) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    this.tasks = new Map();
    this.results = new Map();
    this.completedTasks = new Set();
    this.runningTasks = new Set();
    this.state = AGENT_STATES.IDLE;
  }

  /**
   * 添加任务
   * @param {Object} task - Agent 任务
   */
  addTask(task) {
    const validation = validateAgentTask(task);
    if (!validation.valid) {
      throw new Error(`Invalid task: ${validation.errors.join(', ')}`);
    }

    const enhancedTask = {
      priority: 'medium',
      timeout: this.config.timeout,
      retries: this.config.retries,
      dependencies: [],
      metadata: {},
      ...task
    };

    this.tasks.set(enhancedTask.id, enhancedTask);
    return this;
  }

  /**
   * 批量添加任务
   * @param {Array<Object>} tasks - 任务数组
   */
  addTasks(tasks) {
    for (const task of tasks) {
      this.addTask(task);
    }
    return this;
  }

  /**
   * 执行单个任务
   * @param {Object} task - 任务
   * @param {Object} context - 执行上下文
   * @returns {Promise<Object>} 执行结果
   */
  async executeTask(task, context) {
    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;

    while (attempt <= task.retries) {
      try {
        // 模拟 Agent 执行
        const result = await this.simulateAgentExecution(task, context);

        return {
          taskId: task.id,
          agentId: task.type,
          status: AGENT_STATES.COMPLETED,
          output: result,
          duration: Date.now() - startTime,
          attempt: attempt + 1
        };
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt <= task.retries) {
          // 等待后重试
          await this.sleep(1000 * attempt);
        }
      }
    }

    // 所有重试都失败
    return {
      taskId: task.id,
      agentId: task.type,
      status: AGENT_STATES.FAILED,
      error: lastError?.message || 'Unknown error',
      duration: Date.now() - startTime,
      attempt
    };
  }

  /**
   * 模拟 Agent 执行（实际应用中应该调用真实的 Agent）
   * @param {Object} task - 任务
   * @param {Object} context - 上下文
   * @returns {Promise<*>}
   */
  async simulateAgentExecution(task, context) {
    // 这里只是一个占位符实现
    // 在实际应用中，这里应该：
    // 1. 调用 AgentRegistry 获取 Agent 实例
    // 2. 构建完整的 prompt
    // 3. 调用 Claude API
    // 4. 处理工具调用
    // 5. 返回结果

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          summary: `Task ${task.id} completed by ${task.type}`,
          details: {
            taskType: task.type,
            prompt: task.prompt,
            context
          }
        });
      }, 100);
    });
  }

  /**
   * 串行执行任务
   * @param {Array<Object>} tasks - 任务列表
   * @param {Object} context - 执行上下文
   * @returns {Promise<Array<Object>>} 执行结果数组
   */
  async executeSequential(tasks, context) {
    const results = [];

    for (const task of tasks) {
      if (!canExecuteTask(task, this.completedTasks)) {
        continue;
      }

      this.runningTasks.add(task.id);

      try {
        const result = await this.executeTask(task, context);
        results.push(result);
        this.results.set(task.id, result);

        if (result.status === AGENT_STATES.COMPLETED) {
          this.completedTasks.add(task.id);
        } else if (this.config.stopOnFirstError) {
          break;
        }
      } finally {
        this.runningTasks.delete(task.id);
      }
    }

    return results;
  }

  /**
   * 并行执行任务
   * @param {Array<Object>} tasks - 任务列表
   * @param {Object} _context - 执行上下文（暂未使用）
   * @returns {Promise<Array<Object>>} 执行结果数组
   */
  async executeParallel(tasks, _context) {
    const maxParallel = this.config.maxParallel;
    const executing = new Set();

    const executeNext = async () => {
      // 找到下一个可执行的任务
      const task = tasks.find(
        (t) =>
          !this.runningTasks.has(t.id) &&
          !this.completedTasks.has(t.id) &&
          canExecuteTask(t, this.completedTasks)
      );

      if (!task) return;

      this.runningTasks.add(task.id);
      executing.add(executeNext(task));

      if (executing.size >= maxParallel) {
        await Promise.race(executing);
      }

      // 递归执行下一个任务
      await executeNext();
    };

    // 启动初始任务
    const initialPromises = [];
    for (let i = 0; i < Math.min(maxParallel, tasks.length); i++) {
      initialPromises.push(executeNext());
    }

    await Promise.all(initialPromises);

    // 返回所有结果
    return Array.from(this.results.values());
  }

  /**
   * Team 协作模式执行
   * @param {Array<Object>} tasks - 任务列表
   * @param {Object} context - 执行上下文
   * @returns {Promise<Array<Object>>} 执行结果数组
   */
  async executeTeam(tasks, context) {
    // Team 模式暂未实现，回退到并行模式
    return this.executeParallel(tasks, context);
  }

  /**
   * 运行所有任务
   * @param {Object} context - 执行上下文
   * @returns {Promise<Array<Object>>} 执行结果数组
   */
  async run(context = {}) {
    if (this.state === AGENT_STATES.RUNNING) {
      throw new Error('Executor is already running');
    }

    this.state = AGENT_STATES.RUNNING;
    const startTime = Date.now();

    try {
      // 按优先级排序任务
      const sortedTasks = sortTasksByPriority(Array.from(this.tasks.values()));

      // 根据模式选择执行方式
      let results;
      switch (this.config.mode) {
        case AGENT_MODES.PARALLEL:
          results = await this.executeParallel(sortedTasks, context);
          break;
        case AGENT_MODES.TEAM:
          results = await this.executeTeam(sortedTasks, context);
          break;
        case AGENT_MODES.SEQUENTIAL:
        default:
          results = await this.executeSequential(sortedTasks, context);
          break;
      }

      this.state = AGENT_STATES.COMPLETED;

      return {
        status: this.state,
        duration: Date.now() - startTime,
        results,
        stats: this.getStats()
      };
    } catch (error) {
      this.state = AGENT_STATES.FAILED;
      throw error;
    }
  }

  /**
   * 取消执行
   */
  cancel() {
    if (this.state === AGENT_STATES.RUNNING) {
      this.state = AGENT_STATES.CANCELLED;
      this.runningTasks.clear();
    }
  }

  /**
   * 获取执行统计
   * @returns {Object}
   */
  getStats() {
    const stats = {
      total: this.tasks.size,
      completed: this.completedTasks.size,
      running: this.runningTasks.size,
      failed: 0,
      cancelled: 0
    };

    for (const result of this.results.values()) {
      if (result.status === AGENT_STATES.FAILED) stats.failed++;
      if (result.status === AGENT_STATES.CANCELLED) stats.cancelled++;
    }

    return stats;
  }

  /**
   * 获取任务结果
   * @param {string} taskId - 任务 ID
   * @returns {Object|undefined}
   */
  getResult(taskId) {
    return this.results.get(taskId);
  }

  /**
   * 获取所有结果
   * @returns {Array<Object>}
   */
  getResults() {
    return Array.from(this.results.values());
  }

  /**
   * 重置执行器状态
   */
  reset() {
    this.tasks.clear();
    this.results.clear();
    this.completedTasks.clear();
    this.runningTasks.clear();
    this.state = AGENT_STATES.IDLE;
  }

  /**
   * 延迟函数
   * @param {number} ms - 毫秒
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 创建 Agent 执行器实例
 * @param {Object} config - 配置
 * @returns {AgentExecutor}
 */
export function createAgentExecutor(config) {
  return new AgentExecutor(config);
}
