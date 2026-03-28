import inquirer from 'inquirer';
import chalk from 'chalk';
import { getClaudeDir, getInstalledVersion, getPackageVersion, COMPONENTS } from './utils.js';

/**
 * 显示欢迎横幅
 */
export function showBanner() {
  const version = getPackageVersion();
  console.log('');
  console.log(chalk.cyan.bold('  ╔═══════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('  ║                                           ║'));
  console.log(
    chalk.cyan.bold('  ║') +
      chalk.white.bold(`           Auto CLI（v${version}）                 `) +
      chalk.cyan.bold('║')
  );
  console.log(
    chalk.cyan.bold('  ║') +
      chalk.gray('     Claude Code 一键能力增强，开箱即用      ') +
      chalk.cyan.bold('║')
  );
  console.log(chalk.cyan.bold('  ║                                           ║'));
  console.log(chalk.cyan.bold('  ╚═══════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.gray(`  目标目录：${getClaudeDir()}`));
  console.log('');
}

/**
 * 提示确认
 */
export async function promptConfirmation(message = '确认继续安装？') {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: true
    }
  ]);

  return confirmed;
}

/**
 * 提示卸载确认
 */
export async function promptUninstallConfirmation() {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.yellow('确定要卸载 Auto CLI 吗？'),
      default: false
    }
  ]);

  return confirmed;
}

/**
 * 提示选择要安装的组件
 */
export async function promptComponentSelection() {
  const installedVersion = await getInstalledVersion();
  const installedComponents = installedVersion?.components || [];

  const choices = Object.entries(COMPONENTS).map(([key, component]) => {
    const isInstalled = installedComponents.includes(key);
    return {
      name: `${component.name}${isInstalled ? chalk.green(' (已安装)') : ''}`,
      value: key,
      checked: true
    };
  });

  const { selectedComponents } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedComponents',
      message: '选择要安装的组件（空格选择/取消，回车确认）：',
      choices,
      pageSize: 10
    }
  ]);

  if (selectedComponents.length === 0) {
    console.log(chalk.yellow('未选择任何组件，操作已取消。'));
    return null;
  }

  return selectedComponents;
}

/**
 * 提示选择操作（主菜单）
 */
export async function promptMainMenu() {
  const installedVersion = await getInstalledVersion();

  const choices = [
    { name: '安装 Auto CLI', value: 'install' },
    { name: '更新 Auto CLI', value: 'update', disabled: !installedVersion ? '（未安装）' : false },
    {
      name: '卸载 Auto CLI',
      value: 'uninstall',
      disabled: !installedVersion ? '（未安装）' : false
    },
    new inquirer.Separator(),
    { name: '查看文档', value: 'docs' },
    { name: '退出', value: 'exit' }
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择操作：',
      choices
    }
  ]);

  return action;
}

/**
 * 提示用户选择要安装的 MCP 服务器
 * @param {Array} readyServers - 开箱即用的服务器列表
 * @param {Array} needsConfigServers - 需要额外配置的服务器列表
 * @returns {Promise<string[]|null>} 选中的服务器名称列表，或 null（跳过）
 */
export async function promptMcpSelection(readyServers, needsConfigServers) {
  const choices = [
    new inquirer.Separator(chalk.cyan('--- 开箱即用 ---')),
    ...readyServers.map((s) => ({
      name: `${s.name} ${chalk.gray(`(${s.description || s.type})`)}`,
      value: s.name,
      checked: true
    })),
    new inquirer.Separator(chalk.yellow('--- 需要额外配置（API Key 等）---')),
    ...needsConfigServers.map((s) => ({
      name: `${s.name} ${chalk.gray(`(${s.description || s.type})`)} ${chalk.yellow('[需配置]')}`,
      value: s.name,
      checked: false
    }))
  ];

  if (readyServers.length === 0 && needsConfigServers.length === 0) {
    console.log(chalk.yellow('没有可用的 MCP 服务器模板。'));
    return null;
  }

  const { selectedServers } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedServers',
      message: '选择要配置的 MCP 服务器（空格选择/取消，回车确认，直接回车跳过）：',
      choices,
      pageSize: 15
    }
  ]);

  return selectedServers.length > 0 ? selectedServers : null;
}
