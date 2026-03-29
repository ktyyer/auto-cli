/**
 * Agent 类型定义和常量
 *
 * 核心功能：
 * - 定义 Agent 清单元数据结构
 * - 定义 Agent 能力声明格式
 * - 定义触发规则和回退链
 */

/**
 * Agent 执行层复杂度
 * @readonly
 */
export const COMPLEXITY_LEVELS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
});

/**
 * Agent 状态
 * @readonly
 */
export const AGENT_STATES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
  DEPRECATED: 'deprecated'
});

/**
 * Agent 清单结构
 * @typedef {Object} AgentManifest
 * @property {string} name - Agent 名称（唯一标识，如 'planner'）
 * @property {string} displayName - 显示名称（如 '复杂功能规划专家'）
 * @property {string} description - 简短描述
 * @property {string[]} capabilities - 能力标签（如 ['planning', 'risk-assessment']）
 * @property {string[]} triggerKeywords - 触发关键词（如 ['plan', '规划', '设计']）
 * @property {number} priority - 优先级（0-100，数值越大越优先）
 * @property {string} complexity - 适用复杂度（low|medium|high）
 * @property {string[]} fallbackAgents - 回退 Agent 列表（按优先顺序）
 * @property {string} state - 状态（active|disabled|deprecated）
 * @property {string} [source] - 来源（built-in|community|custom）
 * @property {string} [version] - 版本号
 * @property {string} [filePath] - Agent .md 文件路径
 * @property {string[]} [tags] - 附加标签
 */

/**
 * 路由规则结构
 * @typedef {Object} RoutingRule
 * @property {string} id - 规则 ID
 * @property {string[]} keywords - 匹配关键词
 * @property {string} agentName - 目标 Agent
 * @property {number} priority - 优先级
 * @property {string} [scope] - 作用域（如 'pre-commit', 'edit', 'on-demand'）
 * @property {string[]} [excludeKeywords] - 排除关键词（负向匹配）
 * @property {Object} [conditions] - 附加条件
 */

/**
 * 路由结果
 * @typedef {Object} RouteResult
 * @property {AgentManifest} agent - 选中的 Agent
 * @property {number} score - 匹配分数
 * @property {string} matchReason - 匹配原因说明
 * @property {AgentManifest[]} fallbackChain - 回退链
 * @property {boolean} isDefault - 是否为默认路由
 */
