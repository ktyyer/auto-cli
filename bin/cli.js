#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { interactiveMode, runInstall, runUpdate, runUninstall } from '../src/index.js';
import { getPackageVersion, COMPONENTS, openBrowser } from '../src/utils.js';
import { DOCS_URL } from '../src/config.js';
import { KnowledgeSteward } from '../src/knowledge/knowledge-steward.js';
import { KnowledgeGraph } from '../src/graph/knowledge-graph.js';
import { ENTITY_TYPE_LABELS } from '../src/graph/entity-types.js';
import { DigitalBrain } from '../src/brain/digital-brain.js';
import { SkillDiscovery } from '../src/skills/skill-discovery.js';
import { RuleEngine } from '../src/governance/rule-engine.js';
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

const loop = program.command('loop').description('任务状态机执行器（初始化、推进、恢复）');

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

// 知识图谱命令
const query = program.command('query').description('查询跨项目知识图谱');

query
  .command('extract')
  .description('从当前项目提取知识图谱')
  .option('-n, --name <name>', '项目名称')
  .action(async (options) => {
    try {
      const graph = new KnowledgeGraph();
      await graph.extractFromProject(options.name);

      console.log(chalk.green('知识图谱提取完成！'));

      const stats = await graph.getStats();
      console.log(chalk.gray(`  实体总数: ${stats.totalEntities}`));
      console.log(chalk.gray(`  关系总数: ${stats.totalRelations}`));
      console.log(chalk.gray(`  项目总数: ${stats.totalProjects}`));
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

query
  .command('search')
  .description('搜索知识图谱')
  .requiredOption('-q, --query <keyword>', '搜索关键词')
  .option('-t, --type <type>', '过滤实体类型')
  .option('-l, --limit <number>', '返回结果数量', '10')
  .action(async (options) => {
    try {
      const graph = new KnowledgeGraph();
      const limit = parseInt(options.limit, 10);
      const results = await graph.query(options.query, { type: options.type, limit });

      if (results.length === 0) {
        console.log(chalk.yellow(`未找到与 "${options.query}" 相关的实体`));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold(`找到 ${results.length} 个相关实体：`));
      console.log('');

      for (const { entity } of results) {
        const typeLabel = ENTITY_TYPE_LABELS[entity.type] || entity.type;
        console.log(`  ${chalk.bold(entity.name)} (${chalk.gray(typeLabel)})`);
        console.log(
          `    ${chalk.gray(`出现次数: ${entity.occurrences} | 相关项目: ${entity.projects.length}`)}`
        );
        if (entity.projects.length > 0) {
          console.log(`    ${chalk.cyan(`项目: ${entity.projects.join(', ')}`)}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

query
  .command('stats')
  .description('显示图谱统计信息')
  .action(async () => {
    try {
      const graph = new KnowledgeGraph();
      const stats = await graph.getStats();

      console.log('');
      console.log(chalk.cyan.bold('知识图谱统计：'));
      console.log('');
      console.log(`  ${chalk.bold('实体总数')}: ${stats.totalEntities}`);
      console.log(`  ${chalk.bold('关系总数')}: ${stats.totalRelations}`);
      console.log(`  ${chalk.bold('项目总数')}: ${stats.totalProjects}`);
      console.log('');
      console.log(chalk.cyan('按类型分布：'));
      for (const [type, count] of Object.entries(stats.entitiesByType)) {
        console.log(`  ${chalk.bold(type.padEnd(12))} ${chalk.green(count.toString())}`);
      }
      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 数字大脑命令
const brain = program.command('brain').description('个人知识库 - 管理身份、人脉、创意');

brain
  .command('add')
  .description('添加知识条目')
  .requiredOption('-t, --type <type>', '类型')
  .requiredOption('-c, --content <content>', '内容')
  .option('--tags <tags>', '标签，逗号分隔')
  .action(async (options) => {
    try {
      const brainInstance = new DigitalBrain();
      const tags = options.tags ? options.tags.split(',').map((s) => s.trim()) : [];

      switch (options.type) {
        case 'identity':
          await brainInstance.addIdentity(options.content, {
            skills: tags
          });
          break;
        case 'contact':
          await brainInstance.addContact(options.content, {
            tags
          });
          break;
        case 'idea':
          await brainInstance.addIdea(options.content, {
            tags
          });
          break;
        case 'review':
          await brainInstance.addReview(options.content, {});
          break;
        default:
          console.error(chalk.red(`未知类型: ${options.type}`));
          console.log(chalk.gray('支持的类型: identity, contact, idea, review'));
          process.exit(1);
      }

      console.log(chalk.green('✓ 已添加'));
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

brain
  .command('search')
  .description('搜索知识')
  .requiredOption('-t, --type <type>', '类型')
  .requiredOption('-q, --query <keyword>', '搜索关键词')
  .action(async (options) => {
    try {
      const brainInstance = new DigitalBrain();

      let results;
      switch (options.type) {
        case 'contact':
          results = await brainInstance.searchContacts(options.query);
          break;
        case 'idea':
          results = await brainInstance.searchIdeas(options.query);
          break;
        default:
          console.error(chalk.red(`未知类型: ${options.type}`));
          console.log(chalk.gray('支持的类型: contact, idea'));
          process.exit(1);
      }

      if (results.length === 0) {
        console.log(chalk.yellow(`未找到与 "${options.query}" 相关的${options.type}`));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold(`找到 ${results.length} 个结果：`));
      console.log('');
      for (const item of results) {
        console.log(`  ${chalk.bold(item.title || item.name)}`);
        if (item.description) {
          console.log(`    ${chalk.gray(item.description)}`);
        }
        if (item.tags && item.tags.length > 0) {
          console.log(`    ${chalk.cyan(`标签: ${item.tags.join(', ')}`)}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

brain
  .command('stats')
  .description('显示统计信息')
  .action(async () => {
    try {
      const brainInstance = new DigitalBrain();
      const stats = await brainInstance.getStats();

      console.log('');
      console.log(chalk.cyan.bold('个人知识库统计：'));
      console.log('');
      console.log(`  ${chalk.bold('身份定位')}: ${stats.identities}`);
      console.log(`  ${chalk.bold('人脉网络')}: ${stats.network}`);
      console.log(`  ${chalk.bold('创意灵感')}: ${stats.ideas}`);
      console.log(`  ${chalk.bold('复盘记录')}: ${stats.reviews}`);
      console.log(`  ${chalk.bold('总计')}: ${stats.total}`);
      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 技能管理命令
const skills = program.command('skills').description('技能管理 - 同步、搜索、安装社区技能');

skills
  .command('sync')
  .description('同步 Vibe-Skills 技能目录')
  .option('-f, --force', '强制重新克隆')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    try {
      const discovery = new SkillDiscovery();
      const result = await discovery.syncFromVibeSkills({
        force: options.force,
        verbose: options.verbose
      });

      if (result.success) {
        console.log(chalk.green(`✓ 同步完成，共 ${result.count} 个技能`));
      } else {
        console.log(chalk.yellow(`同步失败: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

skills
  .command('list')
  .description('列出所有可用技能')
  .option('-d, --domain <domain>', '过滤领域')
  .option('-r, --min-rating <rating>', '最低评分', '0')
  .action(async (options) => {
    try {
      const discovery = new SkillDiscovery();
      const skills_list = await discovery.listSkills({
        domain: options.domain,
        minRating: parseFloat(options.minRating)
      });

      if (skills_list.length === 0) {
        console.log(chalk.yellow('没有可用技能，请先运行 skills sync'));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold(`可用技能 (${skills_list.length})：`));
      console.log('');

      // 按领域分组
      const byDomain = {};
      for (const skill of skills_list) {
        if (!byDomain[skill.domain]) {
          byDomain[skill.domain] = [];
        }
        byDomain[skill.domain].push(skill);
      }

      for (const [domain, domainSkills] of Object.entries(byDomain)) {
        console.log(chalk.bold(`  ${domain} (${domainSkills.length})`));
        for (const skill of domainSkills.slice(0, 5)) {
          const rating = skill.rating > 0 ? chalk.yellow(`⭐ ${skill.rating.toFixed(1)}`) : '';
          console.log(`    ${chalk.green(skill.name.padEnd(25))} ${rating}`);
          if (skill.description) {
            console.log(`      ${chalk.gray(skill.description.slice(0, 60))}`);
          }
        }
        if (domainSkills.length > 5) {
          console.log(`    ${chalk.gray(`... 还有 ${domainSkills.length - 5} 个`)}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

skills
  .command('search <query>')
  .description('搜索技能')
  .option('-d, --domain <domain>', '过滤领域')
  .option('-r, --min-rating <rating>', '最低评分', '0')
  .action(async (query, options) => {
    try {
      const discovery = new SkillDiscovery();
      const results = await discovery.searchSkills(query, {
        domain: options.domain,
        minRating: parseFloat(options.minRating)
      });

      if (results.length === 0) {
        console.log(chalk.yellow(`未找到与 "${query}" 相关的技能`));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold(`搜索 "${query}" 的结果 (${results.length})：`));
      console.log('');

      for (const skill of results) {
        const rating = skill.rating > 0 ? chalk.yellow(`⭐ ${skill.rating.toFixed(1)}`) : '';
        console.log(`  ${chalk.bold(skill.name)} ${rating}`);
        if (skill.description) {
          console.log(`    ${chalk.gray(skill.description)}`);
        }
        if (skill.tags && skill.tags.length > 0) {
          console.log(`    ${chalk.cyan(`标签: ${skill.tags.join(', ')}`)}`);
        }
        console.log(`    ${chalk.gray(`来源: ${skill.source} | 领域: ${skill.domain}`)}`);
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

skills
  .command('install <name>')
  .description('安装技能到当前项目')
  .action(async (name) => {
    try {
      const discovery = new SkillDiscovery();
      const result = await discovery.installSkill(name, process.cwd());

      if (result.success) {
        console.log(chalk.green(`✓ 技能已安装: ${name}`));
        console.log(chalk.gray(`  路径: .claude/skills/${name}`));
      } else {
        console.log(chalk.yellow(`安装失败: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

skills
  .command('stats')
  .description('显示技能统计信息')
  .action(async () => {
    try {
      const discovery = new SkillDiscovery();
      const stats = await discovery.getStats();

      console.log('');
      console.log(chalk.cyan.bold('技能目录统计：'));
      console.log('');
      console.log(`  ${chalk.bold('技能总数')}: ${stats.total}`);
      console.log(`  ${chalk.bold('最后同步')}: ${stats.lastSync || '未同步'}`);

      if (Object.keys(stats.byDomain).length > 0) {
        console.log('');
        console.log('  按领域分布：');
        for (const [domain, count] of Object.entries(stats.byDomain)) {
          if (count > 0) {
            console.log(`    ${chalk.bold(domain)}: ${chalk.green(count)}`);
          }
        }
      }

      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

// 治理规则命令
const rules = program.command('rules').description('治理规则引擎 - 管理、验证、执行规则');

rules
  .command('list')
  .description('列出所有规则')
  .action(async () => {
    try {
      const engine = new RuleEngine();
      await engine.loadRules();
      const ruleList = engine.listRules();

      if (ruleList.length === 0) {
        console.log(chalk.yellow('没有可用规则'));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold(`治理规则 (${ruleList.length})：`));
      console.log('');

      // 按优先级分组
      const byPriority = {
        critical: ruleList.filter((r) => r.priority >= 100),
        high: ruleList.filter((r) => r.priority >= 90 && r.priority < 100),
        medium: ruleList.filter((r) => r.priority >= 70 && r.priority < 90),
        low: ruleList.filter((r) => r.priority >= 50 && r.priority < 70),
        info: ruleList.filter((r) => r.priority < 50)
      };

      for (const [priority, rules] of Object.entries(byPriority)) {
        if (rules.length === 0) continue;

        const priorityLabel = {
          critical: '🔴 关键',
          high: '🟠 高',
          medium: '🟡 中',
          low: '🟢 低',
          info: '🔵 信息'
        }[priority];

        console.log(`  ${priorityLabel} (${rules.length})`);
        for (const rule of rules) {
          const critical = rule.critical ? chalk.red(' [CRITICAL]') : '';
          console.log(`    ${chalk.bold(rule.name)}${critical}`);
          console.log(`      ${chalk.gray(rule.description)}`);
          console.log(
            `      动作: ${chalk.cyan(rule.action)} | 作用域: ${chalk.yellow(rule.scope || 'always')}`
          );
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

rules
  .command('validate <action>')
  .description('验证操作是否符合规则')
  .option('-f, --files <files>', '相关文件，逗号分隔')
  .option('-s, --scope <scope>', '作用域')
  .option('-m, --message <message>', '操作描述')
  .action(async (action, options) => {
    try {
      const engine = new RuleEngine();
      await engine.loadRules();

      const context = {
        files: options.files ? options.files.split(',') : [],
        scope: options.scope,
        message: options.message || ''
      };

      const result = await engine.validate(action, context);

      if (result.passed) {
        console.log(chalk.green('✓ 规则验证通过'));
        if (result.warnings && result.warnings.length > 0) {
          console.log('');
          console.log(chalk.yellow('警告：'));
          for (const warning of result.warnings) {
            console.log(`  ⚠️  ${warning.message}`);
          }
        }
      } else {
        console.log(chalk.red('✗ 规则验证失败'));
        console.log(chalk.red(`  原因: ${result.message}`));
        console.log(chalk.red(`  规则: ${result.rule}`));
        if (result.action === 'block') {
          console.log('');
          console.log(chalk.red('操作已阻止'));
          process.exit(1);
        }
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

rules
  .command('add <name>')
  .description('添加自定义规则')
  .requiredOption('-t, --trigger <keywords>', '触发关键词，逗号分隔')
  .requiredOption('-a, --action <action>', '动作类型 (block|warn|retry|skip|require)')
  .option('-d, --description <desc>', '规则描述')
  .option('-p, --priority <number>', '优先级 (1-100)', '50')
  .option('-s, --scope <scope>', '作用域 (always|pre-commit|edit|on-demand)')
  .action(async (name, options) => {
    try {
      const engine = new RuleEngine();
      await engine.loadRules();

      const rule = {
        name,
        description: options.description || `自定义规则: ${name}`,
        trigger: options.trigger.split(',').map((t) => t.trim()),
        action: options.action,
        priority: parseInt(options.priority, 10),
        scope: options.scope || 'always',
        critical: options.priority >= 90
      };

      const success = await engine.addRule(rule);

      if (success) {
        console.log(chalk.green(`✓ 规则已添加: ${name}`));
      } else {
        console.log(chalk.yellow(`添加规则失败`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

rules
  .command('remove <name>')
  .description('删除规则')
  .action(async (name) => {
    try {
      const engine = new RuleEngine();
      await engine.loadRules();

      const success = await engine.removeRule(name);

      if (success) {
        console.log(chalk.green(`✓ 规则已删除: ${name}`));
      } else {
        console.log(chalk.yellow(`规则不存在或无法删除: ${name}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

rules
  .command('stats')
  .description('显示规则统计')
  .action(async () => {
    try {
      const engine = new RuleEngine();
      await engine.loadRules();
      const stats = engine.getStats();

      console.log('');
      console.log(chalk.cyan.bold('治理规则统计：'));
      console.log('');
      console.log(`  ${chalk.bold('规则总数')}: ${stats.total}`);
      console.log(`  ${chalk.bold('关键规则')}: ${chalk.red(stats.criticalCount)}`);
      console.log('');

      console.log('  按动作分布：');
      for (const [action, count] of Object.entries(stats.byAction)) {
        console.log(`    ${chalk.bold(action)}: ${chalk.green(count)}`);
      }

      console.log('');
      console.log('  按作用域分布：');
      for (const [scope, count] of Object.entries(stats.byScope)) {
        console.log(`    ${chalk.bold(scope)}: ${chalk.green(count)}`);
      }

      console.log('');
      console.log('  按优先级分布：');
      console.log(`    🔴 关键: ${stats.byPriority.critical}`);
      console.log(`    🟠 高: ${stats.byPriority.high}`);
      console.log(`    🟡 中: ${stats.byPriority.medium}`);
      console.log(`    🟢 低: ${stats.byPriority.low}`);
      console.log(`    🔵 信息: ${stats.byPriority.info}`);
      console.log('');
    } catch (error) {
      console.error(chalk.red('错误：'), error.message);
      process.exit(1);
    }
  });

program.parse();
