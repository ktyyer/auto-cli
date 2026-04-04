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
import { updatePhaseContext } from './phase-context.js';
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
      doctorResult
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
   * 扫描 commands/ 目录统计 .md 文件数
   * @returns {Promise<number>}
   * @private
   */
  async _countCommands() {
    try {
      const commandsDir = path.join(this.projectDir, 'commands');
      if (!(await fs.pathExists(commandsDir))) return 0;
      const files = await fs.readdir(commandsDir);
      return files.filter((f) => f.endsWith('.md')).length;
    } catch {
      return 0;
    }
  }

  /**
   * 读取 hooks/hooks.json 统计 hook 数量
   * @returns {Promise<number>}
   * @private
   */
  async _countHooks() {
    try {
      const hooksPath = path.join(this.projectDir, 'hooks', 'hooks.json');
      if (!(await fs.pathExists(hooksPath))) return 0;
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
    } catch {
      return 0;
    }
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

    return Object.freeze({
      healthy: issues.filter((i) => i.severity === 'error').length === 0,
      issues: Object.freeze(issues),
      checks: Object.freeze(checks)
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
}
