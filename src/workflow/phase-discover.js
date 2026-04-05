/**
 * Phase Discover — PHASE 1: 扫描 + 能力清单
 *
 * 负责项目上下文发现、Skill/Agent/Command/Hook 统计、
 * Doctor 快检、REPO_MAP 生成
 */

import { FLOW_EVENTS } from '../flow/flow-engine.js';
import { CONTEXT_STATUS } from '../budget/context-monitor.js';
import { AgentRegistry } from '../router/agent-registry.js';
import { RepoIndexer } from '../indexer/repo-indexer.js';
import { updatePhaseContext, detectProjectProfile, PHASE_SKILL_MAP } from './phase-context.js';
import { logger } from '../logger.js';
import fs from 'fs-extra';
import path from 'node:path';

export class PhaseDiscover {
  /**
   * @param {Object} deps
   * @param {import('../memory/memory-manager.js').MemoryManager} deps.memory
   * @param {import('../budget/token-budget.js').TokenBudgetManager} deps.tokenBudget
   * @param {import('../budget/context-monitor.js').ContextMonitor} deps.contextMonitor
   * @param {import('../skills/skill-indexer.js').SkillIndexer} deps.skillIndexer
   * @param {import('../flow/flow-engine.js').FlowEngine} deps.flowEngine
   * @param {string} deps.projectDir
   */
  constructor({ memory, tokenBudget, contextMonitor, skillIndexer, flowEngine, projectDir }) {
    this.memory = memory;
    this.tokenBudget = tokenBudget;
    this.contextMonitor = contextMonitor;
    this.skillIndexer = skillIndexer;
    this.flowEngine = flowEngine;
    this.projectDir = projectDir;

    // 懒初始化
    this._agentRegistry = null;
  }

  /**
   * 执行 PHASE 1: DISCOVER
   * @param {Object} phaseContext - 当前阶段上下文
   * @returns {Promise<Object>} 更新后的 phaseContext
   */
  async run(phaseContext) {
    logger.info('[PHASE 1] DISCOVER - 扫描上下文和能力');

    let ctx = updatePhaseContext(phaseContext, { currentPhase: 1 });

    // Token 预算检查
    if (!this.tokenBudget.canAfford('discover', 5000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 1');
    }

    // 构建 Skill 索引
    let skillIndex = { totalSkills: 0, indexSize: 0 };
    try {
      skillIndex = await this.skillIndexer.buildIndex();
    } catch (e) {
      logger.warn(`[PHASE 1] SkillIndexer 失败: ${e.message}`);
    }

    // 统计 Agent 数量
    let agentCount = 0;
    try {
      const registry = await this._ensureAgentRegistry();
      agentCount = registry.listAgents().length;
    } catch (e) {
      logger.warn(`[PHASE 1] AgentRegistry 失败: ${e.message}`);
    }

    // 统计 Command 数量
    const commandCount = await this._countCommands();

    // 统计 Hook 数量
    const hookCount = await this._countHooks();

    // 确保 REPO_MAP.md 存在且新鲜
    await this._ensureRepoMap();

    // P0-1: 注入 discover 阶段 Skill（PHASE_SKILL_MAP.discover 消费）
    let discoverSkills = await this._injectDiscoverSkills();

    // P1-1 fix: 检测项目语言并自动注入对应 Skill（如 java-patterns）
    const projectLanguages = this._detectProjectLanguages();
    const languageSkills = await this._injectLanguageSkills(projectLanguages);
    if (languageSkills.length > 0) {
      discoverSkills = [...discoverSkills, ...languageSkills];
    }

    // P0-2: 消费上次 /auto 留下的 pending-invocations
    const pendingInvocations = await this._consumePendingInvocations();

    // Doctor 快检：项目健康度诊断
    const doctorResult = await this._runDoctorCheck();
    if (doctorResult.issues.length > 0) {
      logger.warn(`[PHASE 1] Doctor 检测到 ${doctorResult.issues.length} 个问题`);
      for (const issue of doctorResult.issues) {
        logger.warn(`  - ${issue.severity}: ${issue.message}`);
      }
    } else {
      logger.info('[PHASE 1] Doctor 快检通过');
    }

    // 上下文窗口检查
    const contextStatus = this.contextMonitor.getStatus();
    if (contextStatus === CONTEXT_STATUS.COMPRESS_REQUIRED) {
      logger.warn('[PHASE 1] 上下文窗口严重不足，建议压缩');
    }

    // 存储发现结果到记忆
    await this.memory.set(
      'last_discover',
      {
        commands: commandCount,
        agents: agentCount,
        skills: skillIndex.totalSkills,
        hooks: hookCount,
        contextStatus,
        timestamp: Date.now()
      },
      { tier: 'session' }
    );

    // FlowEngine 状态转移
    this.flowEngine.transition(FLOW_EVENTS.START, { phase: 1 });
    this.flowEngine.transition(FLOW_EVENTS.ANALYSIS_DONE, {
      skillsIndexed: skillIndex.totalSkills,
      agentsDiscovered: agentCount,
      commandsDiscovered: commandCount,
      hooksDiscovered: hookCount
    });

    // 消耗资源
    this.tokenBudget.consume('discover', 3000, 'PHASE 1 扫描');
    this.contextMonitor.record(5000, 'PHASE 1');

    const capabilities = Object.freeze({
      commands: commandCount,
      agents: agentCount,
      skills: skillIndex.totalSkills,
      hooks: hookCount
    });

    ctx = updatePhaseContext(ctx, {
      capabilities,
      contextStatus,
      doctorResult,
      projectProfile: detectProjectProfile(this.projectDir),
      projectLanguages,
      discoverSkills,
      pendingInvocations
    });

    logger.info(
      `[PHASE 1] 完成: ${commandCount} cmd, ${agentCount} agents, ` +
        `${skillIndex.totalSkills} skills, ${hookCount} hooks`
    );

    return ctx;
  }

  /**
   * 懒初始化 Agent 注册表
   * @returns {Promise<AgentRegistry>}
   * @private
   */
  async _ensureAgentRegistry() {
    if (!this._agentRegistry) {
      this._agentRegistry = new AgentRegistry(this.projectDir);
      await this._agentRegistry.initialize();
    }
    return this._agentRegistry;
  }

  /**
   * 递归扫描 commands/ 目录统计 .md 文件数（含子目录如 commands/auto/）
   * @returns {Promise<number>}
   * @private
   */
  async _countCommands() {
    try {
      const commandsDir = path.join(this.projectDir, 'commands');
      if (!(await fs.pathExists(commandsDir))) return 0;
      return await this._countMarkdownFiles(commandsDir);
    } catch {
      return 0;
    }
  }

  /**
   * 递归统计目录中的 .md 文件数量
   * @param {string} dir - 目录路径
   * @param {number} [maxDepth=3] - 最大递归深度
   * @returns {Promise<number>}
   * @private
   */
  async _countMarkdownFiles(dir, maxDepth = 3) {
    if (maxDepth <= 0) return 0;
    let count = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        count++;
      } else if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !entry.name.startsWith('_')
      ) {
        count += await this._countMarkdownFiles(path.join(dir, entry.name), maxDepth - 1);
      }
    }
    return count;
  }

  /**
   * 读取 hooks/hooks.json 统计 hook 数量
   * 若 hooks.json 不存在，自动生成最小默认配置
   * @returns {Promise<number>}
   * @private
   */
  async _countHooks() {
    try {
      const hooksDir = path.join(this.projectDir, 'hooks');
      const hooksPath = path.join(hooksDir, 'hooks.json');

      if (!(await fs.pathExists(hooksPath))) {
        await this._ensureDefaultHooks(hooksDir, hooksPath);
        return this._countHooksFromConfig(hooksPath);
      }

      return this._countHooksFromConfig(hooksPath);
    } catch {
      return 0;
    }
  }

  /**
   * 从 hooks.json 文件中统计 hook 数量
   * @param {string} hooksPath
   * @returns {Promise<number>}
   * @private
   */
  async _countHooksFromConfig(hooksPath) {
    const data = await fs.readJson(hooksPath);
    const hookSections = data.hooks || {};
    return Object.values(hookSections).reduce((total, entries) => {
      const sectionEntries = Array.isArray(entries) ? entries : [];
      return (
        total +
        sectionEntries.reduce((sum, matcher) => {
          return sum + (matcher.hooks ? matcher.hooks.length : 0);
        }, 0)
      );
    }, 0);
  }

  /**
   * 自动生成最小默认 hooks.json（TDD Guard + Prettier + TS Check + Secret Detection）
   * @param {string} hooksDir
   * @param {string} hooksPath
   * @private
   */
  async _ensureDefaultHooks(hooksDir, hooksPath) {
    const defaultConfig = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'tool == "Write" || tool == "Edit"',
            hooks: [
              {
                type: 'command',
                command:
                  '#!/bin/bash\ninput=$(cat)\nfile=$(echo "$input" | jq -r \'.tool_input.file_path // ""\')\nif echo "$file" | grep -qE "\\.env|credentials|secret|\\.pem|\\.key"; then\n  echo "[Hook] BLOCKED: Sensitive file detected" >&2\n  exit 1\nfi\necho "$input"'
              }
            ],
            description: 'Secret Detection: 阻止编辑敏感文件'
          }
        ],
        PostToolUse: [
          {
            matcher:
              '(tool == "Write" || tool == "Edit") && tool_input.file_path matches "\\.(ts|tsx|js|jsx)$"',
            hooks: [
              {
                type: 'command',
                command:
                  '#!/bin/bash\ninput=$(cat)\nfile=$(echo "$input" | jq -r \'.tool_input.file_path // ""\')\nif command -v npx &>/dev/null; then\n  npx --no prettier --write "$file" 2>/dev/null || true\nfi\necho "$input"'
              }
            ],
            description: 'Auto-format: Prettier 自动格式化'
          },
          {
            matcher: '(tool == "Write" || tool == "Edit") && tool_input.file_path matches "\\.ts$"',
            hooks: [
              {
                type: 'command',
                command:
                  '#!/bin/bash\ninput=$(cat)\nfile=$(echo "$input" | jq -r \'.tool_input.file_path // ""\')\nif [ -f "tsconfig.json" ] && command -v npx &>/dev/null; then\n  npx --no tsc --noEmit --pretty 2>&1 | head -5 || true\nfi\necho "$input"'
              }
            ],
            description: 'TypeScript Check: 类型检查'
          }
        ]
      }
    };

    await fs.ensureDir(hooksDir);
    await fs.writeJson(hooksPath, defaultConfig, { spaces: 2 });
    logger.info('[PHASE 1] 已自动生成默认 hooks.json（4 个 hook）');
  }

  /**
   * 确保 REPO_MAP.md 存在且新鲜（<24h），否则生成
   * @private
   */
  async _ensureRepoMap() {
    try {
      const repoMapPath = path.join(this.projectDir, 'REPO_MAP.md');

      if (await fs.pathExists(repoMapPath)) {
        const stat = await fs.stat(repoMapPath);
        const age = Date.now() - stat.mtimeMs;
        if (age < 24 * 60 * 60 * 1000) {
          logger.debug('[PHASE 1] REPO_MAP.md 新鲜，跳过重新生成');
          return;
        }
      }

      const indexer = new RepoIndexer(this.projectDir);
      await indexer.generateRepoMap();
      logger.info('[PHASE 1] REPO_MAP.md 已生成');
    } catch (e) {
      logger.warn(`[PHASE 1] RepoIndexer 失败: ${e.message}`);
    }
  }

  /**
   * Doctor 快检：项目健康度诊断
   * @returns {Promise<{healthy: boolean, issues: Object[], checks: Object}>}
   * @private
   */
  async _runDoctorCheck() {
    const issues = [];
    const checks = {};

    // 1. 关键文件检查
    const criticalFiles = [
      { path: 'CLAUDE.md', severity: 'warning', message: 'CLAUDE.md 缺失 — 项目上下文文件不存在' },
      { path: 'REPO_MAP.md', severity: 'info', message: 'REPO_MAP.md 缺失 — 代码地图未生成' },
      {
        path: 'package.json',
        severity: 'info',
        message: 'package.json 缺失 — 非 Node.js 项目或未初始化'
      }
    ];

    for (const cf of criticalFiles) {
      const exists = await fs.pathExists(path.join(this.projectDir, cf.path));
      checks[cf.path] = exists;
      if (!exists) {
        issues.push({ severity: cf.severity, message: cf.message, file: cf.path });
      }
    }

    // 2. Git 状态检查
    try {
      const { execSync } = await import('node:child_process');
      const branch = execSync('git branch --show-current', {
        cwd: this.projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      })
        .toString()
        .trim();
      checks.gitBranch = branch;

      const status = execSync('git status --porcelain', {
        cwd: this.projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      })
        .toString()
        .trim();
      checks.dirtyFiles = status ? status.split('\n').length : 0;
    } catch {
      checks.gitAvailable = false;
      issues.push({ severity: 'info', message: 'Git 不可用 — 无法检查仓库状态' });
    }

    // 3. 依赖安装检查
    const nodeModulesExists = await fs.pathExists(path.join(this.projectDir, 'node_modules'));
    checks.nodeModules = nodeModulesExists;
    if (!nodeModulesExists && checks['package.json']) {
      issues.push({
        severity: 'warning',
        message: 'node_modules 缺失 — 运行 npm install 安装依赖'
      });
    }

    // 4. 测试运行器检查
    const testRunner = await this._detectTestRunner();
    checks.testRunner = testRunner ? testRunner.runner : null;
    if (!testRunner && checks['package.json']) {
      issues.push({
        severity: 'info',
        message: '未配置测试运行器 — 建议在 package.json 中添加 test 脚本'
      });
    }

    // 5. Hooks 配置检查
    const hooksPath = path.join(this.projectDir, 'hooks', 'hooks.json');
    const hooksExists = await fs.pathExists(hooksPath);
    checks.hooksConfigured = hooksExists;

    // 6. 记忆系统检查
    try {
      const stats = await this.memory.getStats();
      checks.memoryStats = stats;
    } catch {
      checks.memoryAvailable = false;
    }

    // P1-2: 推荐的自动动作（如 Skill 注入建议）
    const recommendedActions = [];
    if (!checks['CLAUDE.md']) {
      recommendedActions.push(
        Object.freeze({
          action: 'run-init-project',
          skill: 'init-project',
          reason: 'CLAUDE.md 缺失，建议运行 init-project Skill 生成项目上下文'
        })
      );
    }

    // P2-1: 推荐 TDD Guard Hook（当 hooks 中缺少 TDD 相关配置时）
    if (checks.hooksConfigured) {
      try {
        const hooksDir = path.join(this.projectDir, 'hooks');
        const hooksJsonPath = path.join(hooksDir, 'hooks.json');
        if (await fs.pathExists(hooksJsonPath)) {
          const hooksData = await fs.readJson(hooksJsonPath);
          const preHooks = hooksData.hooks?.PreToolUse || [];
          const hasTDDGuard = preHooks.some(
            (h) => h.description && h.description.toLowerCase().includes('tdd')
          );
          if (!hasTDDGuard) {
            recommendedActions.push(
              Object.freeze({
                action: 'add-tdd-guard-hook',
                hook: 'tdd-guard',
                reason: '缺少 TDD Guard Hook — 建议运行 /auto:create-hook 添加测试优先检查'
              })
            );
          }
        }
      } catch {
        // hooks.json 读取失败，跳过
      }
    }

    return Object.freeze({
      healthy: issues.filter((i) => i.severity === 'error').length === 0,
      issues: Object.freeze(issues),
      checks: Object.freeze(checks),
      recommendedActions: Object.freeze(recommendedActions)
    });
  }

  /**
   * 检测测试运行器（Doctor 内部使用）
   * @returns {Promise<{command: string, runner: string}|null>}
   * @private
   */
  async _detectTestRunner() {
    try {
      const pkgPath = path.join(this.projectDir, 'package.json');
      if (!(await fs.pathExists(pkgPath))) return null;
      const pkg = await fs.readJson(pkgPath);
      const testScript = pkg.scripts?.test;
      if (!testScript || testScript === 'echo "Error: no test specified" && exit 1') return null;
      return { command: testScript, runner: 'npm' };
    } catch {
      return null;
    }
  }

  /**
   * 检测项目编程语言（用于自动注入对应 Skill）
   * @returns {Readonly<string[]>} 检测到的语言列表
   * @private
   */
  _detectProjectLanguages() {
    const languages = [];

    // Java: pom.xml, build.gradle, *.java
    const javaIndicators = ['pom.xml', 'build.gradle', 'build.gradle.kts'];
    for (const indicator of javaIndicators) {
      if (fs.pathExistsSync(path.join(this.projectDir, indicator))) {
        languages.push('java');
        break;
      }
    }

    // Go: go.mod
    if (fs.pathExistsSync(path.join(this.projectDir, 'go.mod'))) {
      languages.push('go');
    }

    // Python: requirements.txt, setup.py, pyproject.toml
    const pythonIndicators = ['requirements.txt', 'setup.py', 'pyproject.toml'];
    for (const indicator of pythonIndicators) {
      if (fs.pathExistsSync(path.join(this.projectDir, indicator))) {
        languages.push('python');
        break;
      }
    }

    // Rust: Cargo.toml
    if (fs.pathExistsSync(path.join(this.projectDir, 'Cargo.toml'))) {
      languages.push('rust');
    }

    // Node.js: package.json
    if (fs.pathExistsSync(path.join(this.projectDir, 'package.json'))) {
      languages.push('javascript');
    }

    logger.info(`[PHASE 1] 项目语言检测: ${languages.join(', ') || 'unknown'}`);
    return Object.freeze(languages);
  }

  /**
   * P0-1: 注入 discover 阶段的 Skill 到上下文
   * 消费 PHASE_SKILL_MAP.discover 中定义的 Skill（dependency-analyzer）
   * @returns {Promise<Readonly<Object[]>>} 已加载的 Skill 内容列表
   * @private
   */
  async _injectDiscoverSkills() {
    const skillNames = PHASE_SKILL_MAP.discover || [];
    if (skillNames.length === 0) return Object.freeze([]);

    const loaded = [];
    try {
      const index = await this.skillIndexer.buildIndex();
      for (const name of skillNames) {
        const entry = index.entries.find((e) => e.name === name);
        if (entry) {
          const result = await this.skillIndexer.loadContent(entry.relativePath);
          if (result?.content) {
            loaded.push(Object.freeze({ name: entry.name, content: result.content }));
            logger.info(`[PHASE 1] discover Skill 已加载: ${entry.name}`);
          }
        }
      }
    } catch (e) {
      logger.warn(`[PHASE 1] discover Skill 注入失败: ${e.message}`);
    }

    return Object.freeze(loaded);
  }

  /**
   * P1-1 fix: 根据项目语言自动注入对应的 Skill
   * 如检测到 Java 项目时注入 java-patterns
   * @param {Readonly<string[]>} languages - 检测到的语言列表
   * @returns {Promise<Readonly<Object[]>>} 已加载的 Skill 内容列表
   * @private
   */
  async _injectLanguageSkills(languages) {
    const languageSkillMap = {
      java: 'java-patterns'
    };

    const targetSkills = [];
    for (const lang of languages) {
      const skillName = languageSkillMap[lang];
      if (skillName) {
        targetSkills.push(skillName);
      }
    }

    if (targetSkills.length === 0) return Object.freeze([]);

    const loaded = [];
    try {
      const index = await this.skillIndexer.buildIndex();
      for (const name of targetSkills) {
        const entry = index.entries.find((e) => e.name === name);
        if (entry) {
          const result = await this.skillIndexer.loadContent(entry.relativePath);
          if (result?.content) {
            loaded.push(Object.freeze({ name: entry.name, content: result.content }));
            logger.info(`[PHASE 1] 语言 Skill 自动注入: ${entry.name} (${languages.join(',')})`);
          }
        }
      }
    } catch (e) {
      logger.debug(`[PHASE 1] 语言 Skill 注入跳过: ${e.message}`);
    }

    return Object.freeze(loaded);
  }

  /**
   * P0-2: 消费 .auto/pending-invocations.json 中的待执行调度
   * 将上次 /auto (PHASE 6) 生成的 doc-updater/refactor-cleaner 调度注入当前工作流
   * @returns {Promise<Readonly<Object[]>>} 待执行的 invocation 列表
   * @private
   */
  async _consumePendingInvocations() {
    try {
      const queuePath = path.join(this.projectDir, '.auto', 'pending-invocations.json');
      if (!(await fs.pathExists(queuePath))) {
        return [];
      }

      const queue = await fs.readJson(queuePath);
      if (!Array.isArray(queue) || queue.length === 0) {
        return [];
      }

      const pending = queue.filter((item) => item.status === 'pending');
      if (pending.length === 0) {
        return [];
      }

      const updated = queue.map((item) =>
        item.status === 'pending' ? { ...item, status: 'consumed', consumedAt: Date.now() } : item
      );
      await fs.writeJson(queuePath, updated, { spaces: 2 });

      logger.info(
        `[PHASE 1] 消费 ${pending.length} 个待执行调度: ${pending.map((p) => p.subagent_type).join(', ')}`
      );

      return pending.map((p) =>
        Object.freeze({
          subagent_type: p.subagent_type,
          description: p.description,
          prompt: p.prompt,
          model: p.model,
          trigger: p.trigger,
          enqueuedAt: p.enqueuedAt
        })
      );
    } catch (e) {
      logger.debug(`[PHASE 1] pending-invocations consumption skipped: ${e.message}`);
      return [];
    }
  }
}
