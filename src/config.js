/**
 * 配置文件
 * 集中管理所有配置常量
 */
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
export const PROJECT_ROOT = path.resolve(__dirname, '..');

// 文档 URL
export const DOCS_URL = process.env.AUTO_CLI_DOCS_URL || 'https://github.com/ktyyer/auto-cli';

// 日志级别
export const LOG_LEVEL = process.env.AUTO_CLI_LOG_LEVEL || 'info';

// 默认重试次数
export const DEFAULT_MAX_RETRIES = 3;

// 默认超时时间（毫秒）
export const DEFAULT_TIMEOUT = 30000;

// Claude Code 配置目录
export const CLAUDE_DIR = process.env.CLAUDE_DIR || '.claude';

export default {
  PROJECT_ROOT,
  DOCS_URL,
  LOG_LEVEL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  CLAUDE_DIR
};
