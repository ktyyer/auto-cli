/**
 * TodoList 类型定义和常量
 *
 * 核心功能：
 * - 定义 TodoItem 结构
 * - 定义 TodoListSnapshot 结构
 * - 定义状态常量
 */

/**
 * Todo 项状态
 * @readonly
 */
export const TODO_STATES = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  CANCELLED: 'cancelled'
});

/**
 * Todo 项优先级
 * @readonly
 */
export const TODO_PRIORITIES = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
});

/**
 * Todo 项
 * @typedef {Object} TodoItem
 * @property {string} id - 唯一标识（自动生成）
 * @property {string} content - 任务描述
 * @property {string} status - 状态（pending|in_progress|completed|blocked|cancelled）
 * @property {string} priority - 优先级（critical|high|medium|low）
 * @property {string[]} dependsOn - 依赖的 Todo ID 列表
 * @property {string} questId - 关联的 Quest ID（如 Quest 1.1）
 * @property {string[]} tags - 标签列表
 * @property {string} [note] - 附加说明
 * @property {string} createdAt - 创建时间（ISO 字符串）
 * @property {string} updatedAt - 更新时间（ISO 字符串）
 * @property {string} [completedAt] - 完成时间（ISO 字符串）
 */

/**
 * TodoList 快照（用于跨会话持久化）
 * @typedef {Object} TodoListSnapshot
 * @property {string} id - 快照 ID
 * @property {string} taskName - 任务名称
 * @property {string} createdAt - 创建时间
 * @property {string} updatedAt - 更新时间
 * @property {TodoItem[]} items - Todo 项列表
 * @property {Object} meta - 元数据（如 source quest-map 版本）
 */
