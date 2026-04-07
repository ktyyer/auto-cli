#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  interactiveMode,
  runInstall,
  runUpdate,
  runUninstall,
  runAuto,
  runRoute,
  runAnalyze,
  runDoctor,
  runResume,
  runStatus,
  runLearn,
  runCreateHook
} from '../src/index.js';
import { getPackageVersion, COMPONENTS, openBrowser } from '../src/utils.js';
import { DOCS_URL } from '../src/config.js';
import { KnowledgeSteward } from '../src/knowledge/knowledge-steward.js';

const program = new Command();

function printPreExecutionSummary(summary) {
  if (!summary) {
    return;
  }

  const reasoning = summary.reasoning || {};
  const quests = summary.quests || [];
  const team = reasoning.team || {};

  console.log('');
  console.log(chalk.cyan.bold('执行前摘要'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log('');

  console.log(chalk.white.bold('任务理解:'));
  console.log(`  ${chalk.gray(reasoning.taskUnderstanding || summary.task || '')}`);
  console.log('');

  console.log(chalk.white.bold('模式判定:'));
  console.log(`  ${chalk.green(summary.mode || 'unknown')}`);
  if (reasoning.modeReason) {
    console.log(`  ${chalk.gray(reasoning.modeReason)}`);
  }
  console.log('');

  if (reasoning.model) {
    console.log(chalk.white.bold('模型路由:'));
    console.log(`  ${chalk.yellow(reasoning.model.tier)} — ${chalk.gray(reasoning.model.id)}`);
    console.log(`  ${chalk.gray(reasoning.model.reason)}`);
    console.log('');
  }

  if (reasoning.agent) {
    console.log(chalk.white.bold('Agent 路由:'));
    console.log(`  ${chalk.green(reasoning.agent.name)} (${reasoning.agent.displayName})`);
    console.log(
      `  ${chalk.gray(`score=${reasoning.agent.score}, reason=${reasoning.agent.reason}`)}`
    );
    console.log('');
  }

  if (team.lead) {
    console.log(chalk.white.bold('Team Lead:'));
    console.log(
      `  ${chalk.green(team.lead.name)} — ${chalk.gray((team.lead.capabilities || []).join(', '))}`
    );
    console.log('');
  }

  if ((team.members || []).length > 0) {
    console.log(chalk.white.bold('Team Members:'));
    for (const member of team.members) {
      console.log(
        `  ${chalk.cyan(member.name)} — ${chalk.gray((member.capabilities || []).join(', '))}`
      );
    }
    console.log('');
  }

  if ((reasoning.matchedSkills || []).length > 0) {
    console.log(chalk.white.bold('Skills:'));
    console.log(`  ${chalk.gray(reasoning.matchedSkills.join(', '))}`);
    console.log('');
  }

  if ((reasoning.risks || []).length > 0) {
    console.log(chalk.white.bold('风险:'));
    for (const risk of reasoning.risks) {
      console.log(`  ${chalk.gray(`- ${risk}`)}`);
    }
    console.log('');
  }

  if ((reasoning.boundaries || []).length > 0) {
    console.log(chalk.white.bold('边界:'));
    for (const boundary of reasoning.boundaries) {
      console.log(`  ${chalk.gray(`- ${boundary}`)}`);
    }
    console.log('');
  }

  if (quests.length > 0) {
    console.log(chalk.white.bold('Quest Map:'));
    for (const quest of quests) {
      console.log(
        `  ${chalk.yellow(`[${quest.complexity || 'unknown'}]`)} ${quest.id}: ${quest.title}`
      );
      if (quest.description) {
        console.log(`    ${chalk.gray(quest.description)}`);
      }
      if (quest.agent) {
        console.log(`    ${chalk.gray(`agent=${quest.agent.name} (${quest.agent.displayName})`)}`);
      }
      if ((quest.changedFiles || []).length > 0) {
        console.log(`    ${chalk.gray(`files=${quest.changedFiles.join(', ')}`)}`);
      }
      if ((quest.acceptanceCriteria || []).length > 0) {
        console.log(`    ${chalk.gray(`accept=${quest.acceptanceCriteria.join(' | ')}`)}`);
      }
      if ((quest.decisionNotes || []).length > 0) {
        console.log(`    ${chalk.gray(`notes=${quest.decisionNotes.join(' | ')}`)}`);
      }
    }
    console.log('');
  }

  console.log(chalk.gray('━'.repeat(50)));
  console.log('');
}

function createPreExecutionPrinter(options = {}) {
  if (options.json || options.dryRun) {
    return null;
  }

  let printed = false;
  return (summary) => {
    if (printed || !summary) {
      return;
    }
    printed = true;
    printPreExecutionSummary(summary);
  };
}

function printAnalyzeResult(result) {
  console.log('');
  console.log(chalk.cyan.bold('auto analyze'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log('');

  console.log(chalk.white.bold('Task:'));
  console.log(`  ${chalk.gray(result.task)}`);
  console.log('');

  printPreExecutionSummary(result.preExecutionSummary);
}

program
  .name('auto')
  .description('Auto CLI - Claude Code 能力增强 CLI 工具')
  .version(getPackageVersion(), '-v, --version', '显示版本号');

// 默认命令 - 交互模式
program.action(async () => {
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
  .option('-c, --components <list>', '指定安装的组件，逗号分隔（如: agents,commands,skills）')
  .action(async (options) => {
    try {
      await runInstall({
        yes: options.yes,
        force: options.force,
        quiet: false,
        components: options.components
          ? options.components
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined
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
    for (const [, value] of Object.entries(COMPONENTS)) {
      console.log(`  ${chalk.green(value.name.padEnd(16))} ${value.description}`);
    }
    console.log('');
  });

// 文档命令
program
  .command('docs')
  .description('打开使用文档')
  .action(async () => {
    const url = DOCS_URL;
    console.log('');
    console.log(chalk.cyan('正在打开文档...'));
    console.log(chalk.gray(`  ${url}`));
    console.log('');

    const success = await openBrowser(url);
    if (!success) {
      console.log(chalk.yellow('无法自动打开浏览器，请手动访问上述链接。'));
    }
  });

// 知识保存命令
const save = program.command('save').description('保存知识条目（灵感、踩坑经验、架构决策等）');

save
  .command('insight')
  .description('保存一条知识条目')
  .requiredOption('-c, --content <text>', '要保存的内容')
  .option('-t, --category <type>', '指定分类（prompt, trap, pattern, decision）')
  .option('--tags <tags>', '标签，逗号分隔（如: react,performance）')
  .option('--no-git', '跳过 git 自动提交')
  .action(async (options) => {
    try {
      const steward = new KnowledgeSteward();
      const tags = options.tags
        ? options.tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      const result = await steward.save({
        content: options.content,
        category: options.category,
        tags,
        gitCommit: options.git
      });

      if (result.success) {
        console.log(chalk.green('知识已保存！'));
        console.log(chalk.gray(`  分类: ${result.categoryName}`));
        console.log(chalk.gray(`  文件: ${result.filePath}`));
        if (result.gitHash) {
          console.log(chalk.gray(`  提交: ${result.gitHash}`));
        }
      } else {
        console.log(chalk.yellow(`保存失败: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

save
  .command('list')
  .description('列出所有知识条目统计')
  .action(async () => {
    try {
      const steward = new KnowledgeSteward();
      const stats = await steward.list();

      console.log('');
      console.log(chalk.cyan.bold('知识库统计：'));
      console.log('');
      for (const stat of stats) {
        const count = stat.count > 0 ? chalk.green(`${stat.count} 条`) : chalk.gray('空');
        console.log(
          `  ${chalk.bold(stat.category.padEnd(10))} ${count} ${chalk.gray(`- ${stat.description}`)}`
        );
      }
      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

save
  .command('search')
  .description('搜索知识条目')
  .requiredOption('-q, --query <keyword>', '搜索关键词')
  .action(async (options) => {
    try {
      const steward = new KnowledgeSteward();
      const results = await steward.search(options.query);

      if (results.length === 0) {
        console.log(chalk.yellow(`未找到与 "${options.query}" 相关的知识条目`));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold(`搜索 "${options.query}" 的结果：`));
      console.log('');
      for (const result of results) {
        console.log(chalk.bold(`  [${result.category}]`));
        for (const match of result.matches) {
          const lines = match.split('\n').slice(0, 5);
          for (const line of lines) {
            console.log(chalk.gray(`    ${line}`));
          }
          console.log('');
        }
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 工作流执行命令
program
  .command('run <task>')
  .description('执行完整的 /auto 6-PHASE 工作流')
  .option('-m, --mode <mode>', '执行模式 (micro|light|full)', 'full')
  .option('-d, --dir <path>', '项目目录', process.cwd())
  .option('--dry-run', '只分析不执行')
  .option('--json', '以 JSON 格式输出结果')
  .action(async (task, options) => {
    try {
      const onPreExecutionSummary = createPreExecutionPrinter(options);
      const result = await runAuto(task, {
        mode: options.mode,
        dir: options.dir,
        json: options.json,
        dryRun: options.dryRun,
        onPreExecutionSummary
      });

      if (options.dryRun) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.status === 'completed') {
        console.log(chalk.green.bold('\n/auto 工作流执行完成'));
        console.log(chalk.gray(`  模式: ${result.mode}`));
        if (result.completedQuests && result.completedQuests.length > 0) {
          console.log(chalk.gray(`  完成 Quests: ${result.completedQuests.length}`));
        }
        if (result.executionSummary && result.executionSummary.length > 0) {
          console.log(chalk.gray(`  执行摘要: ${result.executionSummary.length}`));
        }
        if (result.changedFiles && result.changedFiles.length > 0) {
          console.log(chalk.gray(`  变更文件: ${result.changedFiles.length}`));
        }
        if (result.verificationActions && result.verificationActions.length > 0) {
          console.log(chalk.gray(`  验证动作: ${result.verificationActions.length}`));
        }
        if (result.doctorResult?.issues?.length > 0) {
          console.log(chalk.gray(`  Doctor 问题: ${result.doctorResult.issues.length}`));
        }
        if (result.securityResult?.scanTriggered) {
          console.log(chalk.gray('  安全扫描: 已触发'));
        }
        if (result.resumeDirective) {
          console.log(chalk.gray('  Resume: 已生成续接指令'));
        }
      } else {
        console.log(chalk.red.bold('\n/auto 工作流执行失败'));
        if (result.error) {
          console.log(chalk.red(`  错误: ${result.error.message || result.error}`));
        }
        process.exit(1);
      }
      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 路由命令
program
  .command('route <intent>')
  .description('使用 Canonical Router 智能路由到最合适的 Agent')
  .option('-d, --debug', '显示详细的路由决策过程')
  .option('-j, --json', '以 JSON 格式输出')
  .action(async (intent, options) => {
    try {
      await runRoute(intent, options);
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// Doctor 命令
program
  .command('doctor')
  .description('检查项目健康状态与 Auto CLI 安装状态')
  .option('--json', '输出 JSON')
  .option('--fix', '自动修复安全且已支持的问题')
  .option('-d, --dir <dir>', '项目目录')
  .action(async (options) => {
    try {
      const result = await runDoctor(options);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// Resume 命令
program
  .command('resume <directive>')
  .description('根据 resume directive 继续任务')
  .option('--json', '输出 JSON')
  .option('-d, --dir <dir>', '项目目录')
  .option('-m, --mode <mode>', '执行模式 (micro|light|full)')
  .action(async (directive, options) => {
    try {
      const result = await runResume(directive, options);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// Status 命令
program
  .command('status')
  .description('显示 /auto 运行时状态、能力概览与健康信息')
  .option('--json', '输出 JSON')
  .option('-d, --dir <dir>', '项目目录')
  .option('-t, --task <task>', '可选任务描述，用于模式推断')
  .action(async (options) => {
    try {
      const result = await runStatus(options);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold('auto status'));
      console.log(chalk.gray('━'.repeat(50)));
      console.log('');

      console.log(chalk.white.bold('Summary:'));
      console.log(
        `  ${chalk.gray(`mode=${result.summary.mode}, phase=${result.summary.currentPhase}`)}`
      );
      console.log(
        `  ${chalk.gray(`completed=${result.summary.completedQuestsCount}, failed=${result.summary.failedQuestsCount}`)}`
      );
      console.log(
        `  ${chalk.gray(`changedFiles=${result.summary.changedFilesCount}, verificationActions=${result.summary.verificationActionsCount}`)}`
      );
      console.log('');

      console.log(chalk.white.bold('Capabilities:'));
      console.log(`  ${chalk.gray(`commands=${result.capabilities.commands}`)}`);
      console.log(`  ${chalk.gray(`agents=${result.capabilities.agents}`)}`);
      console.log(`  ${chalk.gray(`skills=${result.capabilities.skills}`)}`);
      console.log(`  ${chalk.gray(`hooks=${result.capabilities.hooks}`)}`);
      console.log('');

      if (result.summary.hasDoctorIssues) {
        console.log(chalk.white.bold('Doctor:'));
        console.log(`  ${chalk.yellow(`issues=${result.summary.doctorIssuesCount}`)}`);
        console.log('');
      }

      if (result.summary.hasPendingInvocations) {
        console.log(chalk.white.bold('Pending Invocations:'));
        console.log(`  ${chalk.yellow(result.summary.pendingInvocationsCount)}`);
        console.log('');
      }

      console.log(chalk.gray('━'.repeat(50)));
      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// Learn 命令
program
  .command('learn')
  .description('分析知识模式与 Git 历史经验')
  .option('--git', '分析 Git 历史模式')
  .option('--commit-count <n>', '分析最近 N 条提交', '50')
  .option('--json', '输出 JSON')
  .option('-d, --dir <dir>', '项目目录')
  .action(async (options) => {
    try {
      const result = await runLearn({
        ...options,
        commitCount: Number(options.commitCount)
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold('auto learn'));
      console.log(chalk.gray('━'.repeat(50)));
      console.log('');

      console.log(chalk.white.bold('Mode:'));
      console.log(`  ${chalk.green(result.mode)}`);
      console.log('');

      if (result.gitPatterns) {
        console.log(chalk.white.bold('Git Patterns:'));
        console.log(`  ${chalk.gray(JSON.stringify(result.gitPatterns, null, 2))}`);
        console.log('');
      }

      console.log(chalk.gray('━'.repeat(50)));
      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// Create Hook 命令
program
  .command('create-hook')
  .description('生成 Hook 模板建议')
  .option('-t, --type <type>', 'hook 类型')
  .option('-n, --name <name>', 'hook 名称')
  .option('--json', '输出 JSON')
  .action(async (options) => {
    try {
      const result = await runCreateHook(options);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold('Hook template'));
      console.log(chalk.gray(`  type: ${result.type}`));
      console.log(chalk.gray(`  name: ${result.name}`));
      console.log(chalk.gray(`  template: ${result.template}`));
      console.log(chalk.gray(`  location: ${result.recommendedLocation}`));
      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 代码地图命令
program
  .command('codemaps')
  .description('Generate repository symbol map (REPO_MAP.md + symbol-index.json)')
  .option('-d, --dir <path>', 'Project directory', process.cwd())
  .option('--dry-run', 'Show stats without writing files')
  .action(async (options) => {
    try {
      const { RepoIndexer } = await import('../src/indexer/repo-indexer.js');
      const indexer = new RepoIndexer(options.dir);

      if (options.dryRun) {
        const result = await indexer.buildIndex();
        console.log(chalk.cyan.bold('\nCodemaps dry-run:'));
        console.log(chalk.gray(`  Files: ${result.totalFiles}`));
        console.log(chalk.gray(`  Symbols: ${result.totalSymbols}`));
        console.log(chalk.gray(`  Sections: ${Object.keys(result.sections).length}`));
        console.log('');
        return;
      }

      const mapPath = await indexer.generateRepoMap();
      const indexPath = await indexer.generateSymbolIndex();

      console.log(chalk.green.bold('\nCodemaps generated:'));
      console.log(chalk.gray(`  REPO_MAP.md: ${mapPath}`));
      console.log(chalk.gray(`  symbol-index.json: ${indexPath}`));
      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 分析命令 — 仅执行 PHASE 1 + 2，输出结构化分析 JSON
program
  .command('analyze <task>')
  .description('Analyze task without execution (PHASE 1 + 2 only)')
  .option('-m, --mode <mode>', 'Force mode (micro|light|full)')
  .option('-d, --dir <path>', 'Project directory', process.cwd())
  .option('--dry-run', 'Dry run mode, only analyze, not execute')
  .option('--json', 'JSON output')
  .option('--no-color', 'Disable colors')
  .action(async (task, options) => {
    try {
      const result = await runAnalyze(task, {
        mode: options.mode,
        dir: options.dir,
        json: options.json
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (!options.color) {
        chalk.level = 0;
      }

      printAnalyzeResult(result);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
