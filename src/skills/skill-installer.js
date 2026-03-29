/**
 * 技能安装器
 * 负责安装、卸载、更新技能
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import fsExtra from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import { logger } from '../logger.js';
import { getClaudeDir } from '../utils.js';

/**
 * 技能安装器类
 */
export class SkillInstaller {
  constructor(options = {}) {
    this.sourceDir = options.sourceDir; // 源技能目录（如 bundled/skills/）
    this.targetDir = options.targetDir || path.join(getClaudeDir(), 'skills');
  }

  /**
   * 安装技能到项目
   * @param {string} skillName - 技能名称
   * @param {Object} options - 安装选项
   * @returns {Promise<boolean>}
   */
  async install(skillName, options = {}) {
    const spinner = ora(`安装技能: ${skillName}`).start();

    try {
      // 查找技能源
      const sourcePath = await this._findSkillSource(skillName);
      if (!sourcePath) {
        spinner.fail(chalk.red(`技能未找到: ${skillName}`));
        return false;
      }

      // 目标路径
      const targetPath = path.join(this.targetDir, skillName);

      // 检查是否已安装
      const exists = await fsExtra.pathExists(targetPath);
      if (exists && !options.force) {
        spinner.warn(chalk.yellow(`技能已安装: ${skillName}`));
        return true;
      }

      // 创建目标目录
      await fsExtra.ensureDir(targetPath);

      // 复制技能文件
      await fsExtra.copy(sourcePath, targetPath, {
        overwrite: options.force || false
      });

      spinner.succeed(chalk.green(`技能已安装: ${skillName}`));
      logger.info(`技能路径: ${targetPath}`);

      return true;
    } catch (error) {
      spinner.fail(chalk.red(`安装失败: ${error.message}`));
      logger.error(error);
      return false;
    }
  }

  /**
   * 卸载技能
   * @param {string} skillName - 技能名称
   * @returns {Promise<boolean>}
   */
  async uninstall(skillName) {
    const spinner = ora(`卸载技能: ${skillName}`).start();

    try {
      const targetPath = path.join(this.targetDir, skillName);

      // 检查是否存在
      const exists = await fsExtra.pathExists(targetPath);
      if (!exists) {
        spinner.warn(chalk.yellow(`技能未安装: ${skillName}`));
        return true;
      }

      // 删除技能目录
      await fsExtra.remove(targetPath);

      spinner.succeed(chalk.green(`技能已卸载: ${skillName}`));
      return true;
    } catch (error) {
      spinner.fail(chalk.red(`卸载失败: ${error.message}`));
      logger.error(error);
      return false;
    }
  }

  /**
   * 更新技能
   * @param {string} skillName - 技能名称
   * @returns {Promise<boolean>}
   */
  async update(skillName) {
    return await this.install(skillName, { force: true });
  }

  /**
   * 批量安装技能
   * @param {string[]} skillNames - 技能名称列表
   * @param {Object} options - 安装选项
   * @returns {Promise<Object>} 安装结果统计
   */
  async installBatch(skillNames, options = {}) {
    const spinner = ora(`批量安装 ${skillNames.length} 个技能`).start();

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const skillName of skillNames) {
      try {
        const sourcePath = await this._findSkillSource(skillName);
        if (!sourcePath) {
          results.failed.push(skillName);
          continue;
        }

        const targetPath = path.join(this.targetDir, skillName);
        const exists = await fsExtra.pathExists(targetPath);

        if (exists && !options.force) {
          results.skipped.push(skillName);
          continue;
        }

        await fsExtra.ensureDir(targetPath);
        await fsExtra.copy(sourcePath, targetPath, {
          overwrite: options.force || false
        });

        results.success.push(skillName);
      } catch (error) {
        logger.warn(`安装失败: ${skillName} - ${error.message}`);
        results.failed.push(skillName);
      }
    }

    spinner.succeed(
      chalk.green(
        `批量安装完成: ${results.success.length} 成功, ${results.skipped.length} 跳过, ${results.failed.length} 失败`
      )
    );

    return results;
  }

  /**
   * 列出已安装的技能
   * @returns {Promise<string[]>}
   */
  async listInstalled() {
    try {
      const exists = await fsExtra.pathExists(this.targetDir);
      if (!exists) {
        return [];
      }

      const entries = await fs.readdir(this.targetDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    } catch (error) {
      logger.error(`列出已安装技能失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 检查技能是否已安装
   * @param {string} skillName - 技能名称
   * @returns {Promise<boolean>}
   */
  async isInstalled(skillName) {
    const targetPath = path.join(this.targetDir, skillName);
    return await fsExtra.pathExists(targetPath);
  }

  /**
   * 查找技能源
   * @private
   * @param {string} skillName - 技能名称
   * @returns {Promise<string|undefined>}
   */
  async _findSkillSource(skillName) {
    if (!this.sourceDir) {
      return undefined;
    }

    const sourcePath = path.join(this.sourceDir, skillName);
    const exists = await fsExtra.pathExists(sourcePath);

    return exists ? sourcePath : undefined;
  }
}
