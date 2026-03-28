import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { getClaudeDir, getSourceDir, analyzeMcpServers } from './utils.js';
import { logger } from './logger.js';

/**
 * Claude Code MCP 配置文件路径（全局）
 */
function getClaudeMcpConfigPath() {
  return path.join(getClaudeDir(), 'claude_desktop_config.json');
}

/**
 * 获取项目自带的 MCP 模板配置
 */
function getMcpTemplatePath() {
  return path.join(getSourceDir(), 'mcp-configs', 'mcp-servers.json');
}

/**
 * 读取现有的 Claude MCP 配置
 */
async function readExistingMcpConfig(configPath) {
  try {
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
  } catch {
    // 配置文件损坏或不存在，返回空
  }
  return { mcpServers: {} };
}

/**
 * 将 MCP 模板中的服务器合并到用户配置
 * 策略：只添加用户配置中不存在的服务器，绝不覆盖已有配置
 *
 * @param {string[]} selectedServers - 用户选择的服务器名称列表
 * @returns {Promise<{added: string[], skipped: string[]}>}
 */
export async function installMcpServers(selectedServers) {
  const spinner = ora('正在配置 MCP 服务器...').start();

  try {
    const templatePath = getMcpTemplatePath();
    const configPath = getClaudeMcpConfigPath();

    if (!(await fs.pathExists(templatePath))) {
      spinner.warn('MCP 模板配置文件不存在，跳过');
      return { added: [], skipped: [] };
    }

    const template = await fs.readJson(templatePath);
    const templateServers = template.mcpServers || {};

    const existing = await readExistingMcpConfig(configPath);
    const existingServers = existing.mcpServers || {};

    const added = [];
    const skipped = [];

    for (const serverName of selectedServers) {
      if (!templateServers[serverName]) {
        skipped.push(serverName);
        continue;
      }

      if (existingServers[serverName]) {
        skipped.push(serverName);
        continue;
      }

      existingServers[serverName] = templateServers[serverName];
      added.push(serverName);
    }

    if (added.length > 0) {
      existing.mcpServers = existingServers;
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, existing, { spaces: 2 });
    }

    spinner.succeed(chalk.green('MCP 配置完成'));

    if (added.length > 0) {
      console.log(chalk.cyan('  已添加:'));
      for (const name of added) {
        console.log(chalk.gray(`    + ${name}`));
      }
    }

    if (skipped.length > 0) {
      console.log(chalk.yellow('  已跳过（已存在或不在模板中）:'));
      for (const name of skipped) {
        console.log(chalk.gray(`    - ${name}`));
      }
    }

    return { added, skipped };
  } catch (error) {
    spinner.fail(chalk.red('MCP 配置失败'));
    logger.error('MCP 安装错误', { error: error.message });
    throw error;
  }
}

/**
 * 获取可安装的 MCP 服务器列表
 * @returns {Promise<{ready: Array, needsConfig: Array, total: number}>}
 */
export async function getAvailableMcpServers() {
  const templatePath = getMcpTemplatePath();
  return analyzeMcpServers(templatePath);
}
