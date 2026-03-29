/**
 * 配置文件
 * 集中管理所有配置常量
 *
 * @typedef {Object} AppConfig
 * @property {string} PROJECT_ROOT - 项目根目录的绝对路径
 * @property {string} DOCS_URL - 项目文档 URL
 * @property {'debug'|'info'|'warn'|'error'|'silent'} LOG_LEVEL - 日志级别
 * @property {number} DEFAULT_MAX_RETRIES - 默认重试次数
 * @property {number} DEFAULT_TIMEOUT - 默认超时时间（毫秒）
 * @property {string} CLAUDE_DIR - Claude Code 配置目录
 */
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
/** @type {string} */
export const PROJECT_ROOT = path.resolve(__dirname, '..');

// 文档 URL
/** @type {string} */
export const DOCS_URL = process.env.AUTO_CLI_DOCS_URL || 'https://github.com/ktyyer/auto-cli';

// 日志级别
/** @type {'debug'|'info'|'warn'|'error'|'silent'} */
export const LOG_LEVEL = process.env.AUTO_CLI_LOG_LEVEL || 'info';

// 默认重试次数
/** @type {number} */
export const DEFAULT_MAX_RETRIES = 3;

// 默认超时时间（毫秒）
/** @type {number} */
export const DEFAULT_TIMEOUT = 30000;

// Claude Code 配置目录
/** @type {string} */
export const CLAUDE_DIR = process.env.CLAUDE_DIR || '.claude';

/** @type {AppConfig} */
export default {
  PROJECT_ROOT,
  DOCS_URL,
  LOG_LEVEL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  CLAUDE_DIR
};
