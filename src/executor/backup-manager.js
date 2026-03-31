/**
 * 备份管理器 - 改进的备份机制
 *
 * 核心功能：
 * - git stash 暂存未提交更改（相比 git checkout -- . 可保留新建文件）
 * - 创建备份分支 + 分支切换
 * - 记录备份分支名便于追溯
 * - cleanupWorktree() 清理工作区
 *
 * @module BackupManager
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { logger } from '../logger.js';

/**
 * 备份结果
 * @typedef {Object} BackupResult
 * @property {boolean} success - 是否成功
 * @property {string} backupBranch - 备份分支名
 * @property {string} [stashName] - stash 名称
 * @property {string} [error] - 错误信息
 */

/**
 * 恢复结果
 * @typedef {Object} RestoreResult
 * @property {boolean} success - 是否成功
 * @property {string} [error] - 错误信息
 */

/**
 * 清理结果
 * @typedef {Object} CleanupResult
 * @property {boolean} success - 是否成功
 * @property {number} removedCount - 清理的文件数
 * @property {string[]} removedFiles - 被清理的文件列表
 * @property {string} [error] - 错误信息
 */

export class BackupManager {
  /**
   * @param {string} [projectDir] - 项目根目录
   */
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.logger = logger;
  }

  /**
   * 检查是否在 git 仓库中
   * @returns {boolean}
   * @private
   */
  _isGitRepo() {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.projectDir,
        stdio: 'pipe'
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 执行 git 命令（封装 execSync）
   * @param {string} command - git 命令
   * @returns {string} 命令输出
   * @private
   */
  _exec(command) {
    return execSync(command, {
      cwd: this.projectDir,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
  }

  /**
   * 获取当前分支名
   * @returns {string}
   * @private
   */
  _getCurrentBranch() {
    return this._exec('git branch --show-current');
  }

  /**
   * 检查工作区是否有未提交的更改
   * @returns {boolean}
   * @private
   */
  _isWorktreeDirty() {
    try {
      const status = this._exec('git status --porcelain');
      return status.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 创建备份（stash + 分支切换）
   * @param {string} [description] - 备份描述（用于分支名）
   * @returns {Promise<BackupResult>}
   */
  async backup(description = 'backup') {
    if (!this._isGitRepo()) {
      return {
        success: false,
        backupBranch: '',
        error: '不在 git 仓库中'
      };
    }

    const timestamp = Date.now();
    const currentBranch = this._getCurrentBranch();
    const backupBranch = `backup/${description}-${timestamp}`;

    try {
      // 1. 检查工作区是否脏
      const isDirty = this._isWorktreeDirty();
      let stashName = '';

      if (isDirty) {
        // 2. git stash 暂存更改
        stashName = this._exec('git stash push -m "auto-cli backup"');
        this.logger.info(`已 stash 当前更改: ${stashName}`);
      }

      // 3. 创建备份分支（基于当前 HEAD）
      this._exec(`git branch ${backupBranch}`);
      this.logger.info(`已创建备份分支: ${backupBranch}`);

      // 4. 记录到日志便于追溯
      this.logger.info(
        `备份完成 | 原分支: ${currentBranch} | 备份分支: ${backupBranch} | stash: ${stashName || '无'}`
      );

      return {
        success: true,
        backupBranch,
        stashName: stashName || undefined
      };
    } catch (error) {
      this.logger.error(`备份失败: ${error.message}`);
      return {
        success: false,
        backupBranch: '',
        error: error.message
      };
    }
  }

  /**
   * 恢复到备份点（切换回原分支 + pop stash）
   * @param {string} backupBranch - 备份分支名
   * @param {boolean} [popStash=true] - 是否恢复 stash
   * @returns {Promise<RestoreResult>}
   */
  async restore(backupBranch, popStash = true) {
    if (!this._isGitRepo()) {
      return { success: false, error: '不在 git 仓库中' };
    }

    const currentBranch = this._getCurrentBranch();

    try {
      // 1. 切换回原分支（或 main）
      const targetBranch = currentBranch.startsWith('backup/') ? 'main' : currentBranch;
      this._exec(`git checkout ${targetBranch}`);
      this.logger.info(`已切换到分支: ${targetBranch}`);

      // 2. 恢复 stash
      if (popStash) {
        try {
          this._exec('git stash pop');
          this.logger.info('已恢复 stash');
        } catch {
          this.logger.warn('没有 stash 可恢复或 stash pop 失败');
        }
      }

      // 3. 删除备份分支
      try {
        this._exec(`git branch -D ${backupBranch}`);
        this.logger.info(`已删除备份分支: ${backupBranch}`);
      } catch {
        this.logger.warn(`删除备份分支失败（可能不存在）: ${backupBranch}`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`恢复失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 清理工作区（删除未跟踪文件 + 忽略的文件的硬重置）
   * 比 git checkout -- . 更彻底，可清理新建文件
   * @returns {Promise<CleanupResult>}
   */
  async cleanupWorktree() {
    if (!this._isGitRepo()) {
      return { success: false, removedCount: 0, removedFiles: [], error: '不在 git 仓库中' };
    }

    const removedFiles = [];

    try {
      // 1. 获取未跟踪文件列表
      const untracked = this._exec('git ls-files --others --exclude-standard');

      if (untracked.trim()) {
        const files = untracked.split('\n').filter(Boolean);

        for (const file of files) {
          const filePath = path.join(this.projectDir, file);
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            removedFiles.push(file);
          }
        }
      }

      // 2. 硬重置到 HEAD（丢弃所有已跟踪文件的更改）
      this._exec('git reset --hard HEAD');

      this.logger.info(`工作区清理完成: 移除 ${removedFiles.length} 个文件`);

      return {
        success: true,
        removedCount: removedFiles.length,
        removedFiles
      };
    } catch (error) {
      this.logger.error(`清理失败: ${error.message}`);
      return {
        success: false,
        removedCount: 0,
        removedFiles: [],
        error: error.message
      };
    }
  }

  /**
   * 获取备份分支列表
   * @returns {string[]}
   */
  listBackups() {
    if (!this._isGitRepo()) {
      return [];
    }

    try {
      const branches = this._exec('git branch --list "backup/*"');
      return branches
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

export default BackupManager;
