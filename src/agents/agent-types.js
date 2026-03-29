/**
 * Agent 执行系统类型定义和常量
 *
 * 核心功能：
 * - 定义 Agent 状态（idle/running/completed/failed）
 * - 定义 Agent 执行上下文
 * - 定义 Agent 任务和结果结构
 *
 * 灵感来源：
 * - HitCC Agent System：State Machine + Task Model + Result Aggregation
 */

/**
 * Agent 执行状态
 * @readonly
 * @enum {string}
 */
export const AGENT_STATES = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
});

/**
 * Agent 任务优先级
 * @readonly
 * @enum {string}
 */
export const AGENT_PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
});

/**
 * Agent 执行模式
 * @readonly
 * @enum {string}
 */
export const AGENT_MODES = Object.freeze({
  SEQUENTIAL: 'sequential',
  PARALLEL: 'parallel',
  TEAM: 'team'
});

/**
 * Agent 任务定义
 * @typedef {Object} AgentTask
 * @property {string} id - 任务 ID
 * @property {string} type - Agent 类型
 * @property {string} prompt - 任务提示词
 * @property {Object} context - 任务上下文
 * @property {string} priority - 任务优先级
 * @property {Array} dependencies - 依赖的任务 ID 列表
 * @property {number} timeout - 超时时间（毫秒）
 * @property {number} retries - 重试次数
 * @property {Object} metadata - 元数据
 */

/**
 * Agent 执行上下文
 * @typedef {Object} AgentExecutionContext
 * @property {string} agentId - Agent ID
 * @property {string} agentType - Agent 类型
 * @property {AgentTask} task - 当前任务
 * @property {Object} capabilities - 能力清单
 * @property {Object} config - 配置
 * @property {Array} history - 历史记录
 * @property {number} startTime - 开始时间
 * @property {number} endTime - 结束时间
 */

/**
 * Agent 执行结果
 * @typedef {Object} AgentResult
 * @property {string} taskId - 任务 ID
 * @property {string} agentId - Agent ID
 * @property {string} status - 执行状态
 * @property {*} output - 输出
 * @property {Error} error - 错误信息
 * @property {number} duration - 执行时长（毫秒）
 * @property {Array} toolCalls - 工具调用记录
 * @property {Object} metadata - 元数据
 */

/**
 * Agent Team 配置
 * @typedef {Object} AgentTeamConfig
 * @property {string} name - Team 名称
 * @property {Array} members - Team 成员
 * @property {string} coordinator - 协调者 Agent
 * @property {Object} strategy - 协作策略
 * @property {number} maxParallel - 最大并行数
 */

/**
 * 默认 Agent 配置
 */
export const DEFAULT_AGENT_CONFIG = Object.freeze({
  timeout: 300000, // 5 分钟
  retries: 2,
  mode: AGENT_MODES.SEQUENTIAL,
  maxParallel: 3,
  stopOnFirstError: false
});

/**
 * Agent 验证函数
 * @param {AgentTask} task - Agent 任务
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateAgentTask(task) {
  const errors = [];

  if (!task.id || typeof task.id !== 'string') {
    errors.push('Invalid or missing task id');
  }

  if (!task.type || typeof task.type !== 'string') {
    errors.push('Invalid or missing task type');
  }

  if (!task.prompt || typeof task.prompt !== 'string') {
    errors.push('Invalid or missing task prompt');
  }

  if (task.priority && !Object.values(AGENT_PRIORITY).includes(task.priority)) {
    errors.push(`Invalid priority: ${task.priority}`);
  }

  if (task.timeout && (typeof task.timeout !== 'number' || task.timeout <= 0)) {
    errors.push('Invalid timeout value');
  }

  if (task.retries && (typeof task.retries !== 'number' || task.retries < 0)) {
    errors.push('Invalid retries value');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 检查 Agent 任务是否可以执行
 * @param {AgentTask} task - 任务
 * @param {Map} completedTasks - 已完成任务集合
 * @returns {boolean}
 */
export function canExecuteTask(task, completedTasks) {
  if (!task.dependencies || task.dependencies.length === 0) {
    return true;
  }

  return task.dependencies.every((depId) => completedTasks.has(depId));
}

/**
 * 计算任务优先级分数
 * @param {AgentTask} task - 任务
 * @returns {number} 优先级分数（越高越优先）
 */
export function calculateTaskPriority(task) {
  const priorityScores = {
    [AGENT_PRIORITY.CRITICAL]: 1000,
    [AGENT_PRIORITY.HIGH]: 100,
    [AGENT_PRIORITY.MEDIUM]: 10,
    [AGENT_PRIORITY.LOW]: 1
  };

  return priorityScores[task.priority] || 0;
}

/**
 * 排序任务列表（按优先级和依赖关系）
 * @param {Array<AgentTask>} tasks - 任务列表
 * @returns {Array<AgentTask>} 排序后的任务列表
 */
export function sortTasksByPriority(tasks) {
  const sorted = [...tasks].sort((a, b) => {
    const priorityDiff = calculateTaskPriority(b) - calculateTaskPriority(a);
    if (priorityDiff !== 0) return priorityDiff;

    // 如果优先级相同，按依赖数量排序（依赖少的先执行）
    return (a.dependencies?.length || 0) - (b.dependencies?.length || 0);
  });

  return sorted;
}
