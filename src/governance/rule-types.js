/**
 * 治理规则类型定义和常量
 *
 * 核心功能：
 * - 定义规则动作类型
 * - 定义规则优先级
 * - 定义规则配置结构
 */

/**
 * 规则动作类型
 * @readonly
 */
export const RULE_ACTIONS = Object.freeze({
  BLOCK: 'block', // 阻止继续执行
  WARN: 'warn', // 警告但继续
  RETRY: 'retry', // 重试（最多3次）
  SKIP: 'skip', // 跳过当前步骤
  REQUIRE: 'require' // 要求满足前置条件
});

/**
 * 规则优先级（数值越大越优先）
 * @readonly
 */
export const RULE_PRIORITIES = Object.freeze({
  CRITICAL: 100, // 关键规则（如安全检查）
  HIGH: 90, // 高优先级（如测试要求）
  MEDIUM: 70, // 中等优先级（如代码质量）
  LOW: 50, // 低优先级（如格式化）
  INFO: 30 // 信息性规则
});

/**
 * 规则元数据结构
 * @typedef {Object} RuleConfig
 * @property {string} name - 规则名称
 * @property {string} description - 规则描述
 * @property {string[]} trigger - 触发关键词列表
 * @property {number} priority - 优先级（1-100）
 * @property {string} action - 动作类型 (block/warn/retry/skip/require)
 * @property {string} scope - 作用域 (always | pre-commit | edit | on-demand)
 * @property {boolean} critical - 是否关键规则
 * @property {number} retryLimit - 重试限制（仅 action=retry 时有效）
 * @property {string[]} requires - 要求满足的前置条件
 * @property {Object} conditions - 额外条件
 * @property {string} message - 规则触发时的消息
 */

/**
 * 索引文件结构
 * @typedef {Object} RuleIndex
 * @property {RuleConfig[]} rules - 规则列表
 * @property {number} total - 总数
 * @property {string} lastSync - 最后同步时间
 * @property {string} version - 索引版本
 */
