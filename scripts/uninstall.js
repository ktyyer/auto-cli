#!/usr/bin/env node

/**
 * Auto CLI 卸载脚本
 * 移除 ~/.claude/ 下由 install.js 安装的文件
 *
 * 用法：
 *   node scripts/uninstall.js
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');

const REMOVE = [
  { dir: path.join(CLAUDE_DIR, 'commands'), files: ['auto.md'], subdirs: ['auto'] },
  { dir: path.join(CLAUDE_DIR, 'agents'), files: [
    '_shared-principles.md', 'architect.md', 'build-error-resolver.md',
    'code-reviewer.md', 'doc-updater.md', 'e2e-runner.md', 'quest-designer.md',
    'refactor-cleaner.md', 'security-reviewer.md', 'tdd-guide.md', 'verification.md',
  ]},
  { dir: path.join(CLAUDE_DIR, 'skills'), files: [
    'code-style-enforcer.md', 'dependency-analyzer.md', 'error-patterns.md',
    'git-workflow.md', 'init-project.md', 'java-patterns.md',
    'performance-patterns.md', 'workflow-patterns.md',
  ]},
  { dir: path.join(CLAUDE_DIR, 'hooks'), files: ['hooks.json'] },
];

let removed = 0;

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true });
    removed++;
  }
}

console.log('Auto CLI 卸载');
console.log('');

for (const { dir, files, subdirs } of REMOVE) {
  for (const file of files) {
    removeIfExists(path.join(dir, file));
  }
  if (subdirs) {
    for (const sub of subdirs) {
      removeIfExists(path.join(dir, sub));
    }
  }
}

// 清理 backup 残留
for (const { dir } of REMOVE) {
  if (!fs.existsSync(dir)) continue;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.includes('.backup.')) {
      fs.unlinkSync(path.join(dir, entry.name));
      removed++;
    }
  }
}

console.log(`卸载完成: 已移除 ${removed} 项`);
console.log('~/.claude/ 目录保留（可能包含其他配置）');
