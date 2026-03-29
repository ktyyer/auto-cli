/**
 * 生态系统模块类型定义和常量
 *
 * 核心功能：
 * - 定义模块状态机
 * - 定义模块 ID 常量
 * - 定义生态系统事件
 * - 定义模块接口和数据结构
 */

/**
 * 模块状态枚举
 * @readonly
 */
export const MODULE_STATES = Object.freeze({
  IDLE: 'idle', // 空闲（未初始化）
  INITIALIZING: 'initializing', // 初始化中
  READY: 'ready', // 就绪
  BUSY: 'busy', // 忙碌（正在执行任务）
  ERROR: 'error', // 错误
  DISABLED: 'disabled' // 已禁用
});

/**
 * 模块状态显示名称映射
 * @readonly
 */
export const MODULE_STATE_NAMES = Object.freeze({
  idle: '空闲',
  initializing: '初始化中',
  ready: '就绪',
  busy: '忙碌',
  error: '错误',
  disabled: '已禁用'
});

/**
 * 模块 ID 常量
 * @readonly
 */
export const MODULE_IDS = Object.freeze({
  GOVERNANCE: 'governance', // 治理规则引擎 (v0.7.0)
  RUNTIME: 'runtime', // VCO 运行时 (v0.8.0)
  SKILLS: 'skills', // 技能目录 (v0.6.0)
  KNOWLEDGE: 'knowledge', // 个人知识库 (v0.5.0)
  GRAPH: 'graph', // 知识图谱 (v0.5.0)
  BRAIN: 'brain', // 数字大脑 (v0.5.0)
  ECOSYSTEM: 'ecosystem' // 生态系统本身
});

/**
 * 生态系统事件枚举
 * @readonly
 */
export const ECOSYSTEM_EVENTS = Object.freeze({
  MODULE_REGISTERED: 'module:registered', // 模块注册
  MODULE_UNREGISTERED: 'module:unregistered', // 模块注销
  MODULE_READY: 'module:ready', // 模块就绪
  MODULE_ERROR: 'module:error', // 模块错误
  MODULE_STATE_CHANGED: 'module:state-changed', // 模块状态变更
  DATA_FLOW_START: 'data:flow-start', // 数据流开始
  DATA_FLOW_END: 'data:flow-end', // 数据流结束
  CROSS_MODULE_WORKFLOW: 'workflow:cross-module' // 跨模块工作流
});

/**
 * 数据流类型
 * @readonly
 */
export const DATA_FLOW_TYPES = Object.freeze({
  SYNC: 'sync', // 同步数据流
  ASYNC: 'async', // 异步数据流
  BROADCAST: 'broadcast', // 广播
  REQUEST_RESPONSE: 'request-response' // 请求-响应
});

/**
 * 模块依赖关系类型
 * @readonly
 */
export const DEPENDENCY_TYPES = Object.freeze({
  REQUIRED: 'required', // 强依赖
  OPTIONAL: 'optional', // 可选依赖
  PEER: 'peer' // 对等模块
});

/**
 * 模块描述符结构
 * @typedef {Object} ModuleDescriptor
 * @property {string} id - 模块唯一标识
 * @property {string} name - 模块名称
 * @property {string} version - 模块版本
 * @property {string} description - 模块描述
 * @property {string} state - 模块状态
 * @property {Object} instance - 模块实例
 * @property {string[]} capabilities - 能力列表
 * @property {Object} dependencies - 依赖关系 {moduleId: type}
 * @property {Object} config - 模块配置
 * @property {Date} initializedAt - 初始化时间
 * @property {Date} lastActivityAt - 最后活动时间
 */

/**
 * 数据流配置结构
 * @typedef {Object} DataFlowConfig
 * @property {string} fromModule - 源模块 ID
 * @property {string} toModule - 目标模块 ID
 * @property {string} type - 数据流类型 (sync/async/broadcast/request-response)
 * @property {string} event - 事件名称
 * @property {Object} data - 数据载荷
 * @property {number} timeout - 超时时间（毫秒）
 */

/**
 * 跨模块工作流配置
 * @typedef {Object} CrossModuleWorkflow
 * @property {string} id - 工作流 ID
 * @property {string} name - 工作流名称
 * @property {string[]} modules - 涉及的模块列表
 * @property {Object[]} steps - 工作流步骤
 * @property {string} step[].module - 目标模块
 * @property {string} step[].action - 执行动作
 * @property {Object} step[].params - 参数
 * @property {Object} context - 执行上下文
 */

/**
 * 生态系统健康状态
 * @typedef {Object} EcosystemHealth
 * @property {string} status - 总体状态 (healthy/degraded/critical)
 * @property {number} totalModules - 总模块数
 * @property {number} readyModules - 就绪模块数
 * @property {number} errorModules - 错误模块数
 * @property {Object} moduleStates - 各模块状态 {moduleId: state}
 * @property {Object[]} issues - 问题列表
 * @property {Date} checkedAt - 检查时间
 */
