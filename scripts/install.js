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
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
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
  console.log('清理 backup 残留...');
  for (const { dest } of COMPONENTS) {
    cleanBackups(dest);
  }
  console.log('已清理');
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
