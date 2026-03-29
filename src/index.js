import chalk from 'chalk';
import { install, uninstall } from './installer.js';
import {
  showBanner,
  promptConfirmation,
  promptUninstallConfirmation,
  promptMainMenu,
  promptComponentSelection,
  promptMcpSelection
} from './prompts.js';
import { getInstalledVersion, COMPONENTS, openBrowser } from './utils.js';
import { logger } from './logger.js';
import { DOCS_URL } from './config.js';
import { getAvailableMcpServers, installMcpServers } from './mcp-installer.js';
import { SkillCatalog } from './skills/skill-catalog.js';
import { SkillInstaller } from './skills/skill-installer.js';

/**
 * 交互模式 - 主菜单
 */
export async function interactiveMode() {
  showBanner();

  const action = await promptMainMenu();

  switch (action) {
    case 'install':
      await runInstall();
      break;
    case 'update':
      await runUpdate();
      break;
    case 'uninstall':
      await runUninstall();
      break;
    case 'docs':
      await runDocs();
      break;
    case 'exit':
      console.log(chalk.gray('再见！'));
      break;
  }
}

/**
 * 运行安装命令
 */
export async function runInstall(options = {}) {
  if (!options.quiet) {
    showBanner();
  }

  // 选择性安装：支持 --yes 时跳过选择直接全量安装
  let selectedComponents;
  if (options.yes || options.components) {
    selectedComponents = options.components || Object.keys(COMPONENTS);
  } else {
    selectedComponents = await promptComponentSelection();
    if (!selectedComponents) {
      return;
    }
  }

  console.log('');
  console.log(chalk.cyan('将要安装以下组件：'));
  for (const key of selectedComponents) {
    console.log(chalk.gray(`  • ${COMPONENTS[key].name}`));
  }
  console.log('');

  if (!options.yes) {
    const confirmed = await promptConfirmation('确认安装 Auto CLI？');
    if (!confirmed) {
      console.log(chalk.yellow('安装已取消。'));
      return;
    }
  }

  console.log('');
  await install(selectedComponents, { force: options.force });

  // MCP 自动配置（可选）
  if (!options.skipMcp) {
    try {
      const { ready, needsConfig } = await getAvailableMcpServers();
      if (ready.length > 0 || needsConfig.length > 0) {
        console.log(chalk.cyan('检测到 MCP 服务器模板，是否配置？'));
        const selectedServers = options.yes
          ? ready.map((s) => s.name)
          : await promptMcpSelection(ready, needsConfig);

        if (selectedServers && selectedServers.length > 0) {
          console.log('');
          await installMcpServers(selectedServers);
        }
      }
    } catch (error) {
      logger.warn(`MCP 配置跳过: ${error.message}`);
    }
  }

  console.log('');
  console.log(chalk.cyan('后续步骤：'));
  console.log(chalk.gray('  1. 重启 Claude Code 以加载新配置'));
  console.log(chalk.gray('  2. 使用 /auto:tdd, /auto:code-review, /auto:route 等命令'));
  console.log('');
}

/**
 * 运行更新命令
 */
export async function runUpdate(options = {}) {
  const installedVersion = await getInstalledVersion();

  if (!installedVersion) {
    console.log(chalk.yellow('未找到安装记录，请先运行安装命令。'));
    return;
  }

  console.log(chalk.cyan(`正在从版本 ${installedVersion.version} 更新...`));
  console.log('');

  const selectedComponents = installedVersion.components || Object.keys(COMPONENTS);

  if (!options.yes) {
    const confirmed = await promptConfirmation('确认更新 Auto CLI？');
    if (!confirmed) {
      console.log(chalk.yellow('更新已取消。'));
      return;
    }
  }

  await install(selectedComponents, { force: true });
}

/**
 * 运行卸载命令
 */
export async function runUninstall(options = {}) {
  const installedVersion = await getInstalledVersion();

  if (!installedVersion) {
    console.log(chalk.yellow('未找到安装记录。'));
    return;
  }

  if (!options.yes) {
    const confirmed = await promptUninstallConfirmation();
    if (!confirmed) {
      console.log(chalk.yellow('卸载已取消。'));
      return;
    }
  }

  const components = installedVersion.components || Object.keys(COMPONENTS);
  await uninstall(components);
}

/**
 * 打开使用文档
 */
export async function runDocs() {
  const url = DOCS_URL;
  console.log('');
  console.log(chalk.cyan('正在打开文档...'));
  console.log(chalk.gray(`  ${url}`));
  console.log('');

  const success = await openBrowser(url);
  if (!success) {
    logger.warn('无法自动打开浏览器，请手动访问上述链接。');
  }
}

/**
 * 列出所有可用技能
 */
export async function runSkillsList(options = {}) {
  const catalog = new SkillCatalog();
  const count = await catalog.scan();

  if (count === 0) {
    console.log(chalk.yellow('未找到任何技能。'));
    return;
  }

  const skills = catalog.list();

  if (options.json) {
    console.log(JSON.stringify(skills, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.cyan(`可用技能 (${skills.length}):`));
  console.log('');

  for (const skill of skills) {
    console.log(chalk.white.bold(`  ${skill.displayName}`));
    console.log(chalk.gray(`    ${skill.description}`));
    if (skill.tags.length > 0) {
      console.log(chalk.gray(`    标签: ${skill.tags.join(', ')}`));
    }
    console.log('');
  }
}

/**
 * 搜索技能
 */
export async function runSkillsSearch(query, options = {}) {
  const catalog = new SkillCatalog();
  await catalog.scan();

  const results = catalog.search(query);

  if (results.length === 0) {
    console.log(chalk.yellow(`未找到匹配"${query}"的技能。`));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.cyan(`搜索结果 (${results.length}):`));
  console.log('');

  for (const skill of results) {
    console.log(chalk.white.bold(`  ${skill.displayName}`));
    console.log(chalk.gray(`    ${skill.description}`));
    if (skill.rating > 0) {
      console.log(
        chalk.gray(`    评分: ${'★'.repeat(skill.rating)}${'☆'.repeat(5 - skill.rating)}`)
      );
    }
    console.log('');
  }
}

/**
 * 安装技能
 */
export async function runSkillsInstall(skillName, options = {}) {
  const installer = new SkillInstaller();

  const success = await installer.install(skillName, options);

  if (!success) {
    process.exit(1);
  }
}

/**
 * 智能路由 - 使用 Canonical Router 推荐合适的 Agent
 */
export async function runRoute(userIntent, options = {}) {
  const { CanonicalRouter } = await import('./router/canonical-router.js');
  const { AgentRegistry } = await import('./router/agent-registry.js');

  // 初始化 Router
  const registry = new AgentRegistry();
  const router = new CanonicalRouter(registry);
  await router.initialize();

  // 执行路由
  const result = await router.route(userIntent, {
    scope: 'on-demand'
  });

  // 输出结果
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.cyan.bold('🧠 路由分析'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log('');

  console.log(chalk.white.bold('📝 用户意图：'));
  console.log(`  ${chalk.gray(userIntent)}`);
  console.log('');

  console.log(chalk.white.bold('🎯 推荐结果：'));
  if (result.isDefault) {
    console.log(
      `  ${chalk.yellow('⚠️  无精确匹配，使用默认路由：')} ${chalk.white.bold(result.agent.displayName)}`
    );
  } else {
    console.log(
      `  ${chalk.green('✅ 主 Agent：')} ${chalk.white.bold(result.agent.displayName)} ${chalk.gray(
        `(${result.agent.name})`
      )}`
    );
    console.log(`  ${chalk.gray(`   优先级：${result.agent.priority}`)}`);
    console.log(`  ${chalk.gray(`   匹配原因：${result.matchReason}`)}`);
  }

  if (result.fallbackChain && result.fallbackChain.length > 0) {
    console.log('');
    console.log(chalk.white.bold('🔄 回退链（主 Agent 失败时）：'));
    result.fallbackChain.forEach((fallback, index) => {
      console.log(`  ${chalk.gray(`${index + 1}. ${fallback.displayName} (${fallback.name})`)}`);
    });
  }

  // Debug 模式：显示详细的路由决策过程
  if (options.debug) {
    console.log('');
    console.log(chalk.white.bold('🔍 调试信息：'));
    const diagnose = await router.diagnose();
    console.log(`  ${chalk.gray(`Agent 总数：${diagnose.agentCount}`)}`);
    console.log(`  ${chalk.gray(`初始化状态：${diagnose.initialized}`)}`);
  }

  console.log('');
  console.log(chalk.gray('━'.repeat(50)));
  console.log('');
}
