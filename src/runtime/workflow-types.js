/**
 * 工作流编排类型定义和常量
 *
 * 核心功能：
 * - 定义编排模式（顺序、并行、管道、自适应）
 * - 定义阶段状态和结果类型
 * - 定义工作流结构元数据
 */

/**
 * 编排模式枚举
 * @readonly
 */
export const ORCHESTRATION_MODES = Object.freeze({
  SEQUENTIAL: 'sequential', // 顺序执行（依次执行每个阶段）
  PARALLEL: 'parallel', // 并行执行（同时执行多个阶段）
  PIPELINE: 'pipeline', // 管道模式（输出传递给下一阶段）
  ADAPTIVE: 'adaptive' // 自适应模式（根据条件动态选择路径）
});

/**
 * 编排模式显示名称映射
 * @readonly
 */
export const ORCHESTRATION_MODE_NAMES = Object.freeze({
  sequential: '顺序执行',
  parallel: '并行执行',
  pipeline: '管道模式',
  adaptive: '自适应模式'
});

/**
 * 阶段执行状态
 * @readonly
 */
export const STAGE_STATES = Object.freeze({
  PENDING: 'pending', // 等待执行
  RUNNING: 'running', // 正在执行
  COMPLETED: 'completed', // 已完成
  FAILED: 'failed', // 失败
  SKIPPED: 'skipped', // 已跳过
  BLOCKED: 'blocked' // 被阻塞
});

/**
 * 阶段状态显示名称映射
 * @readonly
 */
export const STAGE_STATE_NAMES = Object.freeze({
  pending: '等待执行',
  running: '正在执行',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
  blocked: '被阻塞'
});

/**
 * 条件评估操作符
 * @readonly
 */
export const CONDITION_OPS = Object.freeze({
  INCLUDES: 'includes', // 包含（数组包含某个值）
  EXCLUDES: 'excludes', // 排除（数组不包含某个值）
  EQUALS: 'equals', // 等于（值相等）
  NOT_EQUALS: 'not_equals', // 不等于（值不等）
  EXISTS: 'exists', // 存在（字段存在）
  GREATER_THAN: 'greater_than', // 大于（数值比较）
  LESS_THAN: 'less_than', // 小于（数值比较）
  MATCHES: 'matches' // 匹配（正则表达式）
});

/**
 * 工作流结果类型
 * @readonly
 */
export const WORKFLOW_RESULT = Object.freeze({
  SUCCESS: 'success', // 成功完成
  PARTIAL: 'partial', // 部分完成（某些阶段失败）
  FAILED: 'failed', // 失败（关键阶段失败）
  ABORTED: 'aborted' // 中止（手动中断）
});

/**
 * 工作流结果显示名称映射
 * @readonly
 */
export const WORKFLOW_RESULT_NAMES = Object.freeze({
  success: '成功',
  partial: '部分成功',
  failed: '失败',
  aborted: '已中止'
});

/**
 * 阶段类型
 * @readonly
 */
export const STAGE_TYPES = Object.freeze({
  TASK: 'task', // 任务（执行单个任务）
  CONDITION: 'condition', // 条件（根据条件选择路径）
  PARALLEL: 'parallel', // 并行（并行执行多个子阶段）
  SEQUENCE: 'sequence', // 序列（顺序执行多个子阶段）
  RETRY: 'retry' // 重试（失败时重试）
});

/**
 * 工作流阶段结构
 * @typedef {Object} WorkflowStage
 * @property {string} id - 阶段唯一标识
 * @property {string} name - 阶段名称
 * @property {string} type - 阶段类型 (task|condition|parallel|sequence|retry)
 * @property {string} [description] - 阶段描述
 * @property {Object} [config] - 阶段配置（type 特定）
 * @property {WorkflowStage[]} [stages] - 子阶段（用于 parallel/sequence/retry 类型）
 * @property {Object} [condition] - 条件配置（用于 condition 类型）
 * @property {Object} [retry] - 重试配置（用于 retry 类型）
 * @property {number} [timeout] - 超时时间（毫秒）
 * @property {boolean} [continueOnError] - 出错时是否继续
 * @property {string[]} [dependsOn] - 依赖的阶段 ID 列表
 */

/**
 * 工作流配置结构
 * @typedef {Object} WorkflowConfig
 * @property {string} id - 工作流唯一标识
 * @property {string} name - 工作流名称
 * @property {string} [description] - 工作流描述
 * @property {string} mode - 编排模式 (sequential|parallel|pipeline|adaptive)
 * @property {WorkflowStage[]} stages - 阶段列表
 * @property {Object} [variables] - 全局变量
 * @property {Object} [context] - 上下文配置
 * @property {number} [timeout] - 全局超时时间（毫秒）
 * @property {boolean} [continueOnError] - 全局错误处理策略
 * @property {string} [version] - 版本号
 * @property {string[]} [tags] - 标签列表
 */

/**
 * 工作流执行状态
 * @typedef {Object} WorkflowExecution
 * @property {string} id - 执行 ID
 * @property {string} workflowId - 工作流 ID
 * @property {string} status - 执行状态 (pending|running|completed|failed|aborted)
 * @property {string} result - 执行结果 (success|partial|failed|aborted)
 * @property {Object} stageStates - 各阶段状态映射 {stageId: {status, result, output}}
 * @property {Object} context - 执行上下文（包含变量和输出）
 * @property {Date} startTime - 开始时间
 * @property {Date} [endTime] - 结束时间
 * @property {number} [duration] - 执行时长（毫秒）
 * @property {Error} [error] - 错误信息
 * @property {Object} [metadata] - 元数据
 */

/**
 * 工作流索引结构
 * @typedef {Object} WorkflowIndex
 * @property {WorkflowConfig[]} workflows - 工作流列表
 * @property {number} total - 总数
 * @property {string} lastSync - 最后同步时间
 * @property {string} version - 索引版本
 */
