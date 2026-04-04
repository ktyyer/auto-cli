/**
 * Phase Commit — PHASE 5: 增量提交
 *
 * 负责 git commit 消息构建和执行
 */

import { logger } from '../logger.js';
import { updatePhaseContext } from './phase-context.js';

export class PhaseCommit {
  /**
   * @param {Object} deps
   * @param {import('../memory/memory-manager.js').MemoryManager} deps.memory
   * @param {import('../budget/token-budget.js').TokenBudgetManager} deps.tokenBudget
   * @param {string} deps.projectDir
   * @param {boolean} deps.dryRun
   */
  constructor({ memory, tokenBudget, projectDir, dryRun }) {
    this.memory = memory;
    this.tokenBudget = tokenBudget;
    this.projectDir = projectDir;
    this.dryRun = dryRun;
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

    // 构建 commit 消息
    const questCount = ctx.completedQuests?.length || 0;
    const commitMessage =
      questCount > 0
        ? `auto: complete ${questCount} quest(s) - ${(ctx.task || 'task').slice(0, 60)}`
        : `auto: update - ${(ctx.task || 'task').slice(0, 60)}`;

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

    this.tokenBudget.consume('commit', 2000, 'PHASE 5 提交');

    return ctx;
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
}
