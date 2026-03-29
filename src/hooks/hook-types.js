/**
 * Hook 系统类型定义和常量
 *
 * 核心功能：
 * - 定义 Hook 生命周期阶段（PreToolUse / PostToolUse / Stop）
 * - 定义 Hook Schema 结构（event、matcher、command、timeout）
 * - 定义 Hook 运行时结果结构
 *
 * 灵感来源：
 * - HitCC Hook System：Schema 驱动 + Event Input 匹配 + Runtime Order
 */

/**
 * Hook 生命周期阶段
 * @readonly
 * @enum {string}
 */
export const HOOK_PHASES = Object.freeze({
  PRE_TOOL_USE: 'PreToolUse',
  POST_TOOL_USE: 'PostToolUse',
  STOP: 'Stop'
});

/**
 * Hook 匹配策略
 * @readonly
 * @enum {string}
 */
export const HOOK_MATCH_STRATEGIES = Object.freeze({
  ALL: 'all',
  REGEX: 'regex',
  GLOB: 'glob',
  EXACT: 'exact'
});

/**
 * Hook 执行结果状态
 * @readonly
 * @enum {string}
 */
export const HOOK_RESULT_STATES = Object.freeze({
  SUCCESS: 'success',
  BLOCKED: 'blocked',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  SKIPPED: 'skipped'
});

/**
 * Hook Schema 定义
 * @typedef {Object} HookDefinition
 * @property {string} event - Hook 生命周期阶段 (PreToolUse/PostToolUse/Stop)
 * @property {Object} matcher - 匹配规则
 * @property {string} matcher.strategy - 匹配策略 (all/regex/glob/exact)
 * @property {string|RegExp} matcher.pattern - 匹配模式
 * @property {string} command - 要执行的命令
 * @property {number} timeout - 超时时间（毫秒）
 * @property {Object} options - 附加选项
 */

/**
 * Hook 执行上下文
 * @typedef {Object} HookContext
 * @property {string} phase - 当前生命周期阶段
 * @property {string} toolName - 工具名称
 * @property {Object} toolInput - 工具输入
 * @property {Object} toolOutput - 工具输出（PostToolUse）
 * @property {number} timestamp - 时间戳
 */

/**
 * Hook 执行结果
 * @typedef {Object} HookResult
 * @property {string} status - 执行状态
 * @property {string} hookId - Hook ID
 * @property {number} duration - 执行时长（毫秒）
 * @property {Error} error - 错误信息（如有）
 * @property {Object} output - Hook 输出
 */

/**
 * 默认 Hook 配置
 */
export const DEFAULT_HOOK_CONFIG = Object.freeze({
  timeout: 5000,
  stopOnFirstError: false,
  parallelExecution: true
});

/**
 * Hook 验证函数
 * @param {HookDefinition} hookDef - Hook 定义
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateHookDefinition(hookDef) {
  const errors = [];

  if (!hookDef.event || !Object.values(HOOK_PHASES).includes(hookDef.event)) {
    errors.push(`Invalid event: ${hookDef.event}`);
  }

  if (!hookDef.command || typeof hookDef.command !== 'string') {
    errors.push('Invalid or missing command');
  }

  if (hookDef.matcher) {
    const { strategy, pattern } = hookDef.matcher;
    if (!Object.values(HOOK_MATCH_STRATEGIES).includes(strategy)) {
      errors.push(`Invalid match strategy: ${strategy}`);
    }
    if (!pattern) {
      errors.push('Missing pattern in matcher');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
