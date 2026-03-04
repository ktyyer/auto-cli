import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

/**
 * 获取 Claude 配置目录路径
 */
export function getClaudeDir() {
  return path.join(os.homedir(), '.claude');
}

/**
 * 获取 AI MAX 官方文件目录（更新时会覆盖）
 */
export function getAimaxDir() {
  return path.join(getClaudeDir(), 'aimax');
}

/**
 * 获取用户自定义目录（永不覆盖）
 */
export function getCustomDir() {
  return path.join(getClaudeDir(), 'custom');
}

/**
 * 获取版本文件路径
 */
export function getVersionFilePath() {
  return path.join(getClaudeDir(), '.aimax-version');
}

/**
 * 获取已安装的版本信息
 */
export async function getInstalledVersion() {
  const versionFile = getVersionFilePath();
  try {
    if (await fs.pathExists(versionFile)) {
      const content = await fs.readFile(versionFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // 忽略错误
  }
  return null;
}

/**
 * 保存已安装版本信息
 * @param {string} version - 版本号
 * @param {string[]} components - 组件列表
 * @param {string[]} installedFiles - 安装的文件列表（绝对路径）
 */
export async function saveInstalledVersion(version, components, installedFiles = []) {
  const versionFile = getVersionFilePath();
  await fs.writeJson(versionFile, {
    version,
    components,
    installedFiles,
    installedAt: new Date().toISOString()
  }, { spaces: 2 });
}

/**
 * 获取包版本
 */
export function getPackageVersion() {
  const pkgPath = path.join(getSourceDir(), 'package.json');
  const pkg = fs.readJsonSync(pkgPath);
  return pkg.version;
}

/**
 * 组件定义
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
    name: 'aimax 斜杠指令',
    description: '斜杠命令（/auto:plan, /auto:tdd, /auto:code-review 等）',
    source: 'commands',
    target: 'commands/aimax',
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
  plugins: {
    name: 'Plugins（插件）',
    description: '内置插件和框架插件（auto-core, superpowers, adaptive-evolution 等）',
    source: 'plugins',
    target: 'plugins',
    pattern: '**/*',
    recursive: true
  },
  templates: {
    name: 'Templates（模板）',
    description: 'CI 门禁、项目配置等可复用模板',
    source: 'templates',
    target: 'templates',
    pattern: '**/*',
    recursive: true
  },
  lib: {
    name: 'Lib（核心库）',
    description: 'Axiom 检测等核心库文件',
    source: 'lib',
    target: 'lib',
    pattern: '**/*',
    recursive: true
  }
};

/**
 * 获取源目录（包安装的位置）
 */
export function getSourceDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.dirname(__dirname);
}

/**
 * 默认端口号
 */
export const DEFAULT_PORT = 8099;
