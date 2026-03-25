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
export const DOCS_URL = process.env.AUTO_CLI_DOCS_URL || 'https://github.com/zhukunpenglinyutong/ai-max';
export const DOCS_URL_NPM = 'https://www.npmjs.com/package/auto-cli';
export const DOCS_URL_GITHUB = 'https://github.com/zhukunpenglinyutong/ai-max';

// 日志级别
export const LOG_LEVEL = process.env.AUTO_CLI_LOG_LEVEL || 'info';

// 版本文件名称
export const VERSION_FILE = '.auto-cli-version';

// 默认重试次数
export const DEFAULT_MAX_RETRIES = 3;

// 默认超时时间（毫秒）
export const DEFAULT_TIMEOUT = 30000;

// Claude Code 配置目录
export const CLAUDE_DIR = process.env.CLAUDE_DIR || '.claude';

// 支持的语言
export const SUPPORTED_LANGUAGES = [
  'java',
  'python',
  'javascript',
  'typescript',
  'go',
  'rust',
  'ruby',
  'php',
  'c',
  'cpp'
];

// 支持的框架
export const SUPPORTED_FRAMEWORKS = {
  java: ['spring', 'spring-boot', 'junit'],
  python: ['django', 'flask', 'fastapi', 'pytest'],
  javascript: ['react', 'vue', 'express', 'next', 'nuxt'],
  typescript: ['react', 'vue', 'express', 'next', 'nest'],
  go: ['gin', 'echo', 'fiber'],
  rust: ['actix', 'rocket', 'axum']
};

export default {
  PROJECT_ROOT,
  DOCS_URL,
  DOCS_URL_NPM,
  DOCS_URL_GITHUB,
  LOG_LEVEL,
  VERSION_FILE,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  CLAUDE_DIR,
  SUPPORTED_LANGUAGES,
  SUPPORTED_FRAMEWORKS
};
