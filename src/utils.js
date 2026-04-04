import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

/**
 * @typedef {Object} ComponentConfig
 * @property {string} name - 组件名称
 * @property {string} description - 组件描述
 * @property {string} source - 源目录
 * @property {string} target - 目标目录
 * @property {string} pattern - 文件匹配模式
 * @property {boolean} [recursive] - 是否递归
 */

/**
 * 获取 Claude 配置目录路径
 * @returns {string} Claude 配置目录的绝对路径
 */
export function getClaudeDir() {
  return path.join(os.homedir(), '.claude');
}

/**
 * 获取 Auto CLI 官方文件目录（更新时会覆盖）
 * @returns {string} Auto CLI 官方文件目录的绝对路径
 */
export function getAutoDir() {
  return path.join(getClaudeDir(), 'auto');
}

/**
 * 获取用户自定义目录（永不覆盖）
 * @returns {string} 用户自定义目录的绝对路径
 */
export function getCustomDir() {
  return path.join(getClaudeDir(), 'custom');
}

/**
 * 获取版本文件路径
 * @returns {string} 版本文件的绝对路径
 */
export function getVersionFilePath() {
  return path.join(getClaudeDir(), '.auto-version');
}

/**
 * 获取已安装的版本信息
 * @returns {Promise<{version: string, components: string[], installedFiles: string[], installedAt: string}|null>} 版本信息对象，如果不存在则返回 null
 */
export async function getInstalledVersion() {
  const versionFile = getVersionFilePath();
  try {
    if (await fs.pathExists(versionFile)) {
      const content = await fs.readFile(versionFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // 文件不存在或损坏，返回 null
    // 这不是致命错误，可能是首次安装
  }
  return null;
}

/**
 * 保存已安装版本信息
 * @param {string} version - 版本号
 * @param {string[]} components - 组件列表
 * @param {string[]} [installedFiles=[]] - 安装的文件列表（绝对路径）
 * @returns {Promise<void>}
 */
export async function saveInstalledVersion(version, components, installedFiles = []) {
  const versionFile = getVersionFilePath();
  await fs.writeJson(
    versionFile,
    {
      version,
      components,
      installedFiles,
      installedAt: new Date().toISOString()
    },
    { spaces: 2 }
  );
}

/**
 * 获取包版本
 * @returns {string} 当前包的版本号
 */
export function getPackageVersion() {
  const pkgPath = path.join(getSourceDir(), 'package.json');
  const pkg = fs.readJsonSync(pkgPath);
  return pkg.version;
}

/**
 * 组件定义
 * @type {{agents: ComponentConfig, rules: ComponentConfig, commands: ComponentConfig, skills: ComponentConfig, hooks: ComponentConfig}}
 */
export const COMPONENTS = {
  agents: {
    name: 'Agents（代理）',
    description: '专用子代理（planner, architect, tdd-guide 等）',
    source: 'agents',
    target: 'agents',
    pattern: '*.md'
  },
  rules: {
    name: 'Rules（规则）',
    description: '必须遵循的准则（security, testing, coding-style 等）',
    source: 'rules',
    target: 'rules',
    pattern: '*.md'
  },
  commands: {
    name: 'auto 斜杠指令',
    description: '斜杠命令（/auto, /auto:route, /auto:doctor 等）',
    source: 'commands',
    target: 'commands/auto',
    pattern: '*.md'
  },
  skills: {
    name: 'Skills（技能）',
    description: '工作流定义和领域知识',
    source: 'skills',
    target: 'skills',
    pattern: '**/*',
    recursive: true
  },
  hooks: {
    name: 'Hooks（自动化门禁）',
    description: 'PreToolUse/PostToolUse/Stop 等 Hook 模板配置',
    source: 'hooks',
    target: 'hooks',
    pattern: '*.json'
  }
};

/**
 * 获取源目录（包安装的位置）
 * @returns {string} 源目录的绝对路径
 */
export function getSourceDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.dirname(__dirname);
}

/**
 * 跨平台打开浏览器
 * @param {string} url - 要打开的 URL
 * @returns {Promise<boolean>} 是否成功打开
 */
export async function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  return new Promise((resolve) => {
    exec(command, (error) => {
      resolve(!error);
    });
  });
}
