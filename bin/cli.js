#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { interactiveMode, runInstall, runUpdate, runUninstall } from '../src/index.js';
import { getPackageVersion, COMPONENTS } from '../src/utils.js';
import {
  DEFAULT_LOOP_STATE_FILE,
  createLoopState,
  loadLoopState,
  saveLoopState,
  advanceLoopState,
  formatLoopState
} from '../src/loop-state-machine.js';

const program = new Command();

program
  .name('auto')
  .description('Auto CLI - Claude Code 能力增强 CLI 工具')
  .version(getPackageVersion(), '-v, --version', '显示版本号');

// 默认命令 - 交互模式
program
  .action(async () => {
    try {
      await interactiveMode();
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 安装命令
program
  .command('install')
  .description('安装 Auto CLI')
  .option('-y, --yes', '跳过确认提示')
  .option('-f, --force', '强制覆盖现有文件（不备份）')
  .action(async (options) => {
    try {
      await runInstall({
        yes: options.yes,
        force: options.force,
        quiet: false
      });
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 更新命令
program
  .command('update')
  .description('更新 Auto CLI')
  .option('-y, --yes', '跳过确认提示')
  .action(async (options) => {
    try {
      await runUpdate({ yes: options.yes });
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 卸载命令
program
  .command('uninstall')
  .description('卸载 Auto CLI')
  .option('-y, --yes', '跳过确认提示')
  .action(async (options) => {
    try {
      await runUninstall({ yes: options.yes });
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 列表命令
program
  .command('list')
  .description('列出可用组件')
  .action(() => {
    console.log('');
    console.log(chalk.cyan.bold('可用组件：'));
    console.log('');
    for (const [key, value] of Object.entries(COMPONENTS)) {
      console.log(`  ${chalk.green(value.name.padEnd(16))} ${value.description}`);
    }
    console.log('');
  });

// 文档命令
program
  .command('docs')
  .description('打开使用文档')
  .action(async () => {
    const url = 'https://github.com/zhukunpenglinyutong/ai-max';
    console.log('');
    console.log(chalk.cyan('正在打开文档...'));
    console.log(chalk.gray(`  ${url}`));
    console.log('');

    // 跨平台打开浏览器
    const { exec } = await import('child_process');
    const platform = process.platform;
    let command;

    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
      if (error) {
        console.log(chalk.yellow('无法自动打开浏览器，请手动访问上述链接。'));
      }
    });
  });

function resolveStateFile(filePath) {
  if (!filePath) return DEFAULT_LOOP_STATE_FILE;
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function parseGates(input) {
  if (!input) return {};
  const result = {};
  const pairs = String(input).split(',');
  for (const pair of pairs) {
    const [key, value] = pair.split('=').map((s) => s.trim());
    if (key && value) result[key] = value;
  }
  return result;
}

const loop = program
  .command('loop')
  .description('任务状态机执行器（初始化、推进、恢复）');

loop
  .command('init')
  .description('初始化状态机检查点')
  .requiredOption('-t, --task <task>', '任务描述')
  .option('-s, --steps <steps>', '步骤列表，使用逗号分隔')
  .option('-f, --file <path>', '状态文件路径')
  .action(async (options) => {
    try {
      const state = createLoopState({
        task: options.task,
        steps: options.steps
      });
      const target = resolveStateFile(options.file);
      await saveLoopState(state, target);
      console.log(chalk.green(`状态机已初始化: ${target}`));
      console.log(formatLoopState(state));
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

loop
  .command('status')
  .description('查看当前状态机快照')
  .option('-f, --file <path>', '状态文件路径')
  .action(async (options) => {
    try {
      const state = await loadLoopState(resolveStateFile(options.file));
      console.log(formatLoopState(state));
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

loop
  .command('next')
  .description('推进到下一个状态')
  .option('-f, --file <path>', '状态文件路径')
  .option('--verify <result>', 'VERIFY 状态下的结果（pass|fail）', 'pass')
  .option('--max-retries <n>', '恢复状态最大重试次数', '3')
  .option('--gates <k=v,...>', '门禁结果，例如 build=pass,tests=fail')
  .action(async (options) => {
    try {
      const filePath = resolveStateFile(options.file);
      const state = await loadLoopState(filePath);
      const next = advanceLoopState(state, {
        verify: options.verify === 'fail' ? 'fail' : 'pass',
        maxRetries: Number(options.maxRetries) || 3,
        gateResults: parseGates(options.gates)
      });
      await saveLoopState(next, filePath);
      console.log(chalk.green('状态已推进'));
      console.log(formatLoopState(next));
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

loop
  .command('resume')
  .description('读取状态并显示下一步动作')
  .option('-f, --file <path>', '状态文件路径')
  .action(async (options) => {
    try {
      const state = await loadLoopState(resolveStateFile(options.file));
      console.log(formatLoopState(state));
      console.log('');
      console.log(chalk.cyan(`建议下一步：${state.next_action}`));
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

program.parse();
