import path from 'path';
import fs from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import {
  getClaudeDir,
  getSourceDir,
  COMPONENTS,
  saveInstalledVersion,
  getPackageVersion,
  getInstalledVersion
} from './utils.js';

/**
 * 安装选中的组件
 */
export async function install(selectedComponents, options = {}) {
  const claudeDir = getClaudeDir();
  const sourceDir = getSourceDir();
  const { backup = true, force = false } = options;

  const spinner = ora('正在准备安装...').start();

  try {
    // 确保 claude 目录存在
    await fs.ensureDir(claudeDir);

    const installedFiles = [];
    const skippedFiles = [];

    for (const componentKey of selectedComponents) {
      const component = COMPONENTS[componentKey];
      if (!component) continue;

      spinner.text = `正在安装 ${component.name}...`;

      const sourcePath = path.join(sourceDir, component.source);
      const targetPath = path.join(claudeDir, component.target);

      // 确保目标目录存在
      await fs.ensureDir(targetPath);

      if (component.recursive) {
        // 递归复制整个目录
        const files = await copyRecursive(sourcePath, targetPath, { backup, force });
        installedFiles.push(...files.installed);
        skippedFiles.push(...files.skipped);
      } else {
        // 只复制匹配的文件
        const ext = component.pattern.replace('*.', '');
        const files = await fs.readdir(sourcePath);
        for (const file of files) {
          if (!file.endsWith(ext)) continue;

          const srcFile = path.join(sourcePath, file);
          const destFile = path.join(targetPath, file);

          const stats = await fs.stat(srcFile);
          if (!stats.isFile()) continue;

          const exists = await fs.pathExists(destFile);
          if (exists && !force) {
            if (backup) {
              await backupFile(destFile);
            }
            skippedFiles.push(destFile);
          } else {
            await fs.copy(srcFile, destFile);
            installedFiles.push(destFile);
          }
        }
      }
    }

    // 保存版本信息（包括安装的文件列表）
    await saveInstalledVersion(getPackageVersion(), selectedComponents, installedFiles);

    spinner.succeed(chalk.green('安装完成！'));

    console.log('');
    console.log(chalk.cyan('已安装文件：'));
    console.log(chalk.gray(`  安装目录：${getClaudeDir()}`));
    console.log(chalk.gray(`  文件数量：${installedFiles.length}`));
    console.log('');

    if (skippedFiles.length > 0) {
      console.log(chalk.yellow(`  已跳过：${skippedFiles.length}`));
    }

    return { installedFiles, skippedFiles };
  } catch (error) {
    spinner.fail(chalk.red('安装失败'));
    throw error;
  }
}

/**
 * 备份文件（使用时间戳后缀，避免反复覆盖）
 */
async function backupFile(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.copy(filePath, `${filePath}.backup.${timestamp}`);
}

const MAX_RECURSION_DEPTH = 20;

/**
 * 递归复制文件
 */
async function copyRecursive(src, dest, options = {}, depth = 0) {
  if (depth > MAX_RECURSION_DEPTH) {
    throw new Error(`目录层级超过 ${MAX_RECURSION_DEPTH} 层，可能存在循环链接`);
  }

  const { backup = true, force = false } = options;
  const installed = [];
  const skipped = [];

  const items = await fs.readdir(src);

  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stats = await fs.stat(srcPath);

    if (stats.isDirectory()) {
      await fs.ensureDir(destPath);
      const subResult = await copyRecursive(srcPath, destPath, options, depth + 1);
      installed.push(...subResult.installed);
      skipped.push(...subResult.skipped);
    } else {
      const exists = await fs.pathExists(destPath);
      if (exists && !force) {
        if (backup) {
          await backupFile(destPath);
        }
        skipped.push(destPath);
      } else {
        await fs.copy(srcPath, destPath);
        installed.push(destPath);
      }
    }
  }

  return { installed, skipped };
}

/**
 * 卸载组件
 * 只删除版本文件中记录的已安装文件，不会影响其他插件的文件
 */
export async function uninstall(selectedComponents) {
  const claudeDir = getClaudeDir();
  const spinner = ora('正在移除文件...').start();

  try {
    const removedFiles = [];
    const failedFiles = [];

    // 获取已安装的版本信息
    const installedVersion = await getInstalledVersion();
    const installedFiles = installedVersion?.installedFiles || [];

    if (installedFiles.length > 0) {
      // 使用记录的文件列表进行精确删除
      spinner.text = '正在移除已安装的文件...';

      for (const filePath of installedFiles) {
        try {
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            removedFiles.push(filePath);
          }
        } catch {
          failedFiles.push(filePath);
        }
      }

      // 清理空目录（只清理 Auto CLI 相关的子目录）
      await cleanupEmptyDirs(claudeDir, selectedComponents);
    } else {
      // 兼容旧版本：没有记录文件列表时，只删除 Auto CLI 特定的文件/目录
      spinner.text = '正在移除组件（兼容模式）...';

      for (const componentKey of selectedComponents) {
        const component = COMPONENTS[componentKey];
        if (!component) continue;

        spinner.text = `正在移除 ${component.name}...`;

        const targetPath = path.join(claudeDir, component.target);

        if (await fs.pathExists(targetPath)) {
          // 只有 commands/auto 目录可以整体删除（这是 Auto CLI 独占的）
          if (componentKey === 'commands') {
            await fs.remove(targetPath);
            removedFiles.push(targetPath);
          } else {
            // 对于共享目录（agents、rules、skills），需要根据源文件匹配删除
            const sourceDir = getSourceDir();
            const sourcePath = path.join(sourceDir, component.source);

            if (await fs.pathExists(sourcePath)) {
              const sourceFiles = await getSourceFilesList(sourcePath, component.recursive);
              for (const relativeFile of sourceFiles) {
                const targetFile = path.join(targetPath, relativeFile);
                if (await fs.pathExists(targetFile)) {
                  await fs.remove(targetFile);
                  removedFiles.push(targetFile);
                }
              }
              // 清理可能产生的空目录
              await cleanupEmptySubDirs(targetPath);
            }
          }
        }
      }
    }

    // 移除版本文件
    const versionFile = path.join(claudeDir, '.auto-version');
    if (await fs.pathExists(versionFile)) {
      await fs.remove(versionFile);
    }

    spinner.succeed(chalk.green('卸载完成！'));
    console.log(chalk.gray(`  已移除：${removedFiles.length} 个文件`));

    if (failedFiles.length > 0) {
      console.log(chalk.yellow(`  失败：${failedFiles.length} 个文件`));
    }

    return removedFiles;
  } catch (error) {
    spinner.fail(chalk.red('卸载失败'));
    throw error;
  }
}

/**
 * 获取源目录中的文件列表（相对路径）
 */
async function getSourceFilesList(sourcePath, recursive = false) {
  const files = [];

  async function traverse(currentPath, relativePath = '', depth = 0) {
    if (depth > MAX_RECURSION_DEPTH) {
      throw new Error(`目录层级超过 ${MAX_RECURSION_DEPTH} 层，可能存在循环链接`);
    }

    const items = await fs.readdir(currentPath);
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const itemRelative = relativePath ? path.join(relativePath, item) : item;
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory() && recursive) {
        await traverse(itemPath, itemRelative, depth + 1);
      } else if (stats.isFile()) {
        files.push(itemRelative);
      }
    }
  }

  await traverse(sourcePath);
  return files;
}

/**
 * 清理空的子目录
 */
async function cleanupEmptySubDirs(dirPath) {
  if (!(await fs.pathExists(dirPath))) return;

  const items = await fs.readdir(dirPath);
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = await fs.stat(itemPath);

    if (stats.isDirectory()) {
      await cleanupEmptySubDirs(itemPath);
      // 如果目录为空，删除它
      const subItems = await fs.readdir(itemPath);
      if (subItems.length === 0) {
        await fs.remove(itemPath);
      }
    }
  }
}

/**
 * 清理 Auto CLI 相关的空目录
 */
async function cleanupEmptyDirs(claudeDir, selectedComponents) {
  for (const componentKey of selectedComponents) {
    const component = COMPONENTS[componentKey];
    if (!component) continue;

    const targetPath = path.join(claudeDir, component.target);

    // 对于 commands/auto，如果目录为空则删除
    if (componentKey === 'commands' && (await fs.pathExists(targetPath))) {
      try {
        const items = await fs.readdir(targetPath);
        if (items.length === 0) {
          await fs.remove(targetPath);
        }
      } catch {
        // 忽略错误
      }
    } else if (await fs.pathExists(targetPath)) {
      // 对于其他共享目录，只清理空的子目录
      await cleanupEmptySubDirs(targetPath);
    }
  }
}

/**
 * 检查组件安装状态
 */
export async function checkStatus() {
  const claudeDir = getClaudeDir();
  const status = {};

  for (const [componentKey, component] of Object.entries(COMPONENTS)) {
    const targetPath = path.join(claudeDir, component.target);
    const fileCount = await countFiles(targetPath, component.recursive);

    status[componentKey] = {
      installed: fileCount > 0,
      path: targetPath,
      fileCount
    };
  }

  return status;
}

/**
 * 统计目录内文件数量
 */
async function countFiles(dirPath, recursive = false, depth = 0) {
  if (depth > MAX_RECURSION_DEPTH) {
    throw new Error(`目录层级超过 ${MAX_RECURSION_DEPTH} 层，可能存在循环链接`);
  }

  if (!(await fs.pathExists(dirPath))) return 0;

  let count = 0;
  const items = await fs.readdir(dirPath);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = await fs.stat(itemPath);

    if (stats.isFile()) {
      count += 1;
      continue;
    }

    if (stats.isDirectory() && recursive) {
      count += await countFiles(itemPath, true, depth + 1);
    }
  }

  return count;
}
