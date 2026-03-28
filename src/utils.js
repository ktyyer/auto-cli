import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

/**
 * 获取 Claude 配置目录路径
 */
export function getClaudeDir() {
  return path.join(os.homedir(), '.claude');
}

/**
 * 获取 Auto CLI 官方文件目录（更新时会覆盖）
 */
export function getAutoDir() {
  return path.join(getClaudeDir(), 'auto');
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
  return path.join(getClaudeDir(), '.auto-version');
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
    name: 'auto 斜杠指令',
    description: '斜杠命令（/auto:plan, /auto:tdd, /auto:code-review 等）',
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
  },
  hooks: {
    name: 'Hooks（自动化门禁）',
    description: 'PreToolUse/PostToolUse/Stop 等 Hook 模板配置',
    source: 'hooks',
    target: 'hooks',
    pattern: '*.json'
  },
  mcpConfigs: {
    name: 'MCP Configs（外部服务配置）',
    description: 'MCP 服务器模板配置（playwright, supabase, context7 等）',
    source: 'mcp-configs',
    target: 'mcp-configs',
    pattern: '*.json'
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
 * 分析 MCP 服务器配置，返回每个服务器的状态
 * @param {string} configPath - mcp-servers.json 文件路径
 * @returns {Promise<{ready: Array, needsConfig: Array, total: number}>}
 */
export async function analyzeMcpServers(configPath) {
  try {
    if (!await fs.pathExists(configPath)) {
      return { ready: [], needsConfig: [], total: 0 };
    }

    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    const servers = config.mcpServers || {};

    const ready = [];
    const needsConfig = [];

    for (const [name, serverConfig] of Object.entries(servers)) {
      const hasPlaceholder = JSON.stringify(serverConfig).includes('YOUR_');
      const serverInfo = {
        name,
        description: serverConfig.description || '',
        type: serverConfig.type || 'stdio',
        command: serverConfig.command || ''
      };

      if (hasPlaceholder) {
        needsConfig.push(serverInfo);
      } else {
        ready.push(serverInfo);
      }
    }

    return { ready, needsConfig, total: ready.length + needsConfig.length };
  } catch {
    return { ready: [], needsConfig: [], total: 0 };
  }
}

/**
 * 获取 MCP 服务器按分类的统计
 * @param {string} configPath - mcp-servers.json 文件路径
 * @returns {Promise<Object>} 分类统计
 */
export async function getMcpServerCategories(configPath) {
  const { ready, needsConfig, total } = await analyzeMcpServers(configPath);

  const categories = {
    database: { ready: 0, total: 0, servers: [] },
    search: { ready: 0, total: 0, servers: [] },
    cloud: { ready: 0, total: 0, servers: [] },
    devtools: { ready: 0, total: 0, servers: [] },
    ai: { ready: 0, total: 0, servers: [] },
    integration: { ready: 0, total: 0, servers: [] }
  };

  const categoryMap = {
    'supabase': 'database',
    'clickhouse': 'database',
    'firecrawl': 'search',
    'brave-search': 'search',
    'tavily': 'search',
    'context7': 'search',
    'vercel': 'cloud',
    'railway': 'cloud',
    'cloudflare-docs': 'cloud',
    'cloudflare-workers-builds': 'cloud',
    'cloudflare-workers-bindings': 'cloud',
    'cloudflare-observability': 'cloud',
    'github': 'devtools',
    'filesystem': 'devtools',
    'ast-grep': 'devtools',
    'playwright': 'devtools',
    'memory': 'ai',
    'sequential-thinking': 'ai',
    'magic': 'ai',
    'composio': 'integration'
  };

  const allServers = [
    ...ready.map(s => ({ ...s, status: 'ready' })),
    ...needsConfig.map(s => ({ ...s, status: 'needs_config' }))
  ];

  for (const server of allServers) {
    const cat = categoryMap[server.name] || 'devtools';
    categories[cat].total += 1;
    categories[cat].servers.push(server);
    if (server.status === 'ready') {
      categories[cat].ready += 1;
    }
  }

  return { categories, summary: { ready: ready.length, needsConfig: needsConfig.length, total } };
}

/**
 * 快速统计 MCP 服务器数量
 * @param {string} configPath - mcp-servers.json 文件路径
 * @returns {Promise<{mcp_servers: number, mcp_ready: number, mcp_needs_config: number}>}
 */
export async function countMcpServers(configPath) {
  const { ready, needsConfig, total } = await analyzeMcpServers(configPath);
  return {
    mcp_servers: total,
    mcp_ready: ready.length,
    mcp_needs_config: needsConfig.length
  };
}

/**
 * 默认端口号
 */
export const DEFAULT_PORT = 8099;

/**
 * 跨平台打开浏览器
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
