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
import { MANAGED_FILES } from './manifest.js';

let removed = 0;

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true });
    removed++;
  }
}

console.log('Auto CLI 卸载');
console.log('');

for (const { dir, files, subdirs } of MANAGED_FILES) {
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
for (const { dir } of MANAGED_FILES) {
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
