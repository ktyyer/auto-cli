/**
 * TypeScript 类型定义
 * 为 JavaScript 代码提供类型提示
 */

/**
 * @typedef {Object} LoopState
 * @property {string} run_id
 * @property {string} task
 * @property {string} current_state
 * @property {number} current_step_index
 * @property {number} steps_total
 * @property {string[]} steps
 * @property {Object.<string, number>} retries
 * @property {Object.<string, string>} gates
 * @property {string} next_action
 * @property {Array} artifacts
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Component
 * @property {string} name
 * @property {string} source
 * @property {string} target
 * @property {boolean} recursive
 */

/**
 * @typedef {Object} InstallOptions
 * @property {boolean} [backup=true]
 * @property {boolean} [force=false]
 * @property {boolean} [quiet=false]
 * @property {boolean} [yes=false]
 */

/**
 * @typedef {Object} InstallResult
 * @property {string[]} installedFiles
 * @property {string[]} skippedFiles
 */

export {};
