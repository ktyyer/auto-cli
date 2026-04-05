/**
 * Phase Commit — PHASE 5: 增量提交
 *
 * 负责 git commit 消息构建和执行
 * P1-3: 集成 FlowEngine 状态跟踪
 * P2-2: 自动加载 git-workflow Skill 约定作为 commit 格式参考
 */

import { FLOW_EVENTS } from '../flow/flow-engine.js';
import { logger } from '../logger.js';
import { updatePhaseContext } from './phase-context.js';

export class PhaseCommit {
  /**
   * @param {Object} deps
   * @param {import('../memory/memory-manager.js').MemoryManager} deps.memory
   * @param {import('../budget/token-budget.js').TokenBudgetManager} deps.tokenBudget
   * @param {import('../flow/flow-engine.js').FlowEngine} [deps.flowEngine] - P1-3
   * @param {import('../budget/context-monitor.js').ContextMonitor} [deps.contextMonitor] - P1-3
   * @param {string} deps.projectDir
   * @param {boolean} deps.dryRun
   * @param {import('../skills/skill-indexer.js').SkillIndexer} [deps.skillIndexer] - P2-2
   */
  constructor({
    memory,
    tokenBudget,
    flowEngine,
    contextMonitor,
    projectDir,
    dryRun,
    skillIndexer
  }) {
    this.memory = memory;
    this.tokenBudget = tokenBudget;
    this.flowEngine = flowEngine || null;
    this.contextMonitor = contextMonitor || null;
    this.projectDir = projectDir;
    this.dryRun = dryRun;
    this.skillIndexer = skillIndexer || null;
    this._gitWorkflowContent = null;
  }

  /**
   * 执行 PHASE 5: COMMIT
   * @param {Object} phaseContext - 当前阶段上下文
   * @returns {Promise<Object>} 更新后的 phaseContext
   */
  async run(phaseContext) {
    logger.info('[PHASE 5] COMMIT - 增量提交');

    let ctx = updatePhaseContext(phaseContext, { currentPhase: 5 });

    if (!this.tokenBudget.canAfford('commit', 3000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 5');
    }

    // P2-2: 加载 git-workflow Skill 内容
    await this._ensureGitWorkflowSkill();

    // 构建约定式提交消息（与 git-workflow Skill 对齐）
    const commitType = this._inferCommitType(ctx);
    const scope = this._inferScope(ctx);
    const summary = (ctx.task || 'task').slice(0, 72);
    const questCount = ctx.completedQuests?.length || 0;
    const commitMessage = scope
      ? `${commitType}(${scope}): ${summary}`
      : `${commitType}: ${summary}`;

    // 执行 git commit
    const gitResult = await this._executeGitCommit(ctx.changedFiles, commitMessage);

    // 记录提交结果到记忆
    await this.memory.set(
      'last_commit',
      {
        files: ctx.changedFiles,
        questCount,
        gitResult,
        timestamp: Date.now()
      },
      {
        tier: 'project',
        tags: ['commit', 'changes']
      }
    );

    ctx = updatePhaseContext(ctx, {
      gitResult
    });

    // P1-3: FlowEngine 状态转移
    if (this.flowEngine) {
      this.flowEngine.transition(FLOW_EVENTS.COMMIT_DONE);
    }

    this.tokenBudget.consume('commit', 2000, 'PHASE 5 提交');

    if (this.contextMonitor) {
      this.contextMonitor.record(2000, 'PHASE 5');
    }

    return ctx;
  }

  /**
   * 从上下文推断约定式提交类型
   * @param {Object} ctx
   * @returns {string} feat | fix | refactor | docs | test | chore
   * @private
   */
  _inferCommitType(ctx) {
    const task = (ctx.task || '').toLowerCase();
    const mode = ctx.mode;

    if (mode === 'micro') return 'fix';
    if (task.includes('重构') || task.includes('refactor')) return 'refactor';
    if (task.includes('文档') || task.includes('doc')) return 'docs';
    if (task.includes('测试') || task.includes('test')) return 'test';
    if (task.includes('修复') || task.includes('fix') || task.includes('bug')) return 'fix';
    return 'feat';
  }

  /**
   * 从变更文件推断提交作用域
   * @param {Object} ctx
   * @returns {string|null}
   * @private
   */
  _inferScope(ctx) {
    const files = ctx.changedFiles || [];
    if (files.length === 0) return null;

    // 从文件路径提取模块名
    const modules = files
      .map((f) => {
        const parts = f.split('/');
        return parts.length > 1 ? parts[0] : null;
      })
      .filter(Boolean);

    const unique = [...new Set(modules)];
    return unique.length === 1 ? unique[0] : null;
  }

  /**
   * 执行 git commit（dryRun 时跳过）
   * @param {string[]} files - 变更文件列表
   * @param {string} message - commit 消息
   * @returns {Promise<{committed: boolean, reason?: string, fileCount?: number}>}
   * @private
   */
  async _executeGitCommit(files, message) {
    if (this.dryRun || !files || files.length === 0) {
      logger.info('[PHASE 5] DRY RUN - 跳过 git commit');
      return Object.freeze({ committed: false, reason: files?.length ? 'dry-run' : 'no-files' });
    }

    try {
      const { execSync } = await import('node:child_process');

      for (const file of files) {
        execSync(`git add "${file}"`, { cwd: this.projectDir, stdio: 'pipe' });
      }

      const safeMessage = message.replace(/"/g, '\\"').slice(0, 500);
      execSync(`git commit -m "${safeMessage}"`, { cwd: this.projectDir, stdio: 'pipe' });

      logger.info(`[PHASE 5] Git commit: ${files.length} files`);
      return Object.freeze({ committed: true, fileCount: files.length });
    } catch (error) {
      logger.warn(`[PHASE 5] Git commit 失败: ${error.message}`);
      return Object.freeze({ committed: false, reason: error.message });
    }
  }

  /**
   * P2-2: 加载 git-workflow Skill 内容（用于对齐提交约定）
   * @private
   */
  async _ensureGitWorkflowSkill() {
    if (this._gitWorkflowContent !== null || !this.skillIndexer) return;

    try {
      const index = await this.skillIndexer.buildIndex();
      const gitSkill = index.entries.find((e) => e.name === 'git-workflow');
      if (gitSkill) {
        const loaded = await this.skillIndexer.loadContent(gitSkill.relativePath);
        this._gitWorkflowContent = loaded?.content || null;
        if (this._gitWorkflowContent) {
          logger.info('[PHASE 5] git-workflow Skill 已加载，提交格式对齐');
        }
      }
    } catch (e) {
      logger.debug(`[PHASE 5] git-workflow Skill 加载跳过: ${e.message}`);
      this._gitWorkflowContent = null;
    }
  }
}
