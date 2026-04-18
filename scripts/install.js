#!/usr/bin/env node

/**
 * Auto CLI 安装脚本
 * 将 commands/、agents/、skills/、hooks/ 复制到 ~/.claude/ 对应目录
 *
 * 用法：
 *   node scripts/install.js          # 安装
 *   node scripts/install.js --clean  # 清理 backup 残留后安装
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const COMPONENTS = [
  { src: 'commands', dest: path.join(CLAUDE_DIR, 'commands') },
  { src: 'agents', dest: path.join(CLAUDE_DIR, 'agents') },
  { src: 'skills', dest: path.join(CLAUDE_DIR, 'skills') },
  { src: 'rules', dest: path.join(CLAUDE_DIR, 'rules') },
  { src: 'hooks', dest: path.join(CLAUDE_DIR, 'hooks') },
];

const cleanFlag = process.argv.includes('--clean');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanBackups(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanBackups(fullPath);
    } else if (entry.name.includes('.backup.')) {
      fs.unlinkSync(fullPath);
    }
  }
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let copied = 0;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copied += copyDir(srcPath, destPath);
    } else if (/\.(md|json|js|sh)$/.test(entry.name)) {
      fs.copyFileSync(srcPath, destPath);
      copied++;
    }
  }
  return copied;
}

// Main
console.log('Auto CLI 安装');
console.log(`目标: ${CLAUDE_DIR}`);
console.log('');

let totalFiles = 0;

if (cleanFlag) {
  console.log('清理 Auto CLI 托管资源...');
  // 清理 install.js 部署的旧文件，与 uninstall.js 对齐
  const OLD_FILES = [
    { dir: path.join(CLAUDE_DIR, 'commands'), files: ['auto.md'], subdirs: ['auto'] },
    { dir: path.join(CLAUDE_DIR, 'agents'), files: [
      '_shared-principles.md', 'architect.md', 'build-error-resolver.md',
      'code-reviewer.md', 'doc-updater.md', 'e2e-runner.md', 'quest-designer.md',
      'refactor-cleaner.md', 'security-reviewer.md', 'tdd-guide.md', 'verification.md',
    ]},
    { dir: path.join(CLAUDE_DIR, 'skills'), files: [
      'code-style-enforcer.md', 'dependency-analyzer.md', 'error-patterns.md',
      'git-workflow.md', 'init-project.md', 'java-patterns.md',
      'performance-patterns.md', 'prd-writer.md', 'skill-creator.md',
      'systematic-debugging.md', 'workflow-patterns.md',
    ], subdirs: [
      'java-patterns.references', 'prd-writer.references',
      'systematic-debugging.references', 'workflow-patterns.references',
    ]},
    { dir: path.join(CLAUDE_DIR, 'rules'), files: [
      'agents.md', 'coding-style.md', 'git-workflow.md', 'hooks.md',
      'performance.md', 'security.md', 'testing.md',
    ]},
    { dir: path.join(CLAUDE_DIR, 'hooks'), files: ['hooks.json'] },
    { dir: path.join(CLAUDE_DIR, 'hooks', 'lib'), files: [
      'codemaps-hook.sh', 'tdd-guard-cli.js', 'tdd-guard.js',
    ]},
  ];

  let removed = 0;
  for (const { dir, files, subdirs } of OLD_FILES) {
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
        removed++;
      }
    }
    if (subdirs) {
      for (const sub of subdirs) {
        const subPath = path.join(dir, sub);
        if (fs.existsSync(subPath)) {
          fs.rmSync(subPath, { recursive: true, force: true });
          removed++;
        }
      }
    }
  }
  // 清理 backup 残留
  for (const { dest } of COMPONENTS) {
    cleanBackups(dest);
  }
  console.log(`已清理 ${removed} 项旧资源`);
  console.log('');
}

for (const { src, dest } of COMPONENTS) {
  const srcPath = path.resolve(process.cwd(), src);
  if (!fs.existsSync(srcPath)) {
    console.log(`  跳过 ${src}/ (不存在)`);
    continue;
  }
  const count = copyDir(srcPath, dest);
  totalFiles += count;
  console.log(`  ${src}/ → ${count} 文件`);
}

console.log('');
console.log(`安装完成: ${totalFiles} 文件已同步到 ~/.claude/`);
