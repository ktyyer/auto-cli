#!/usr/bin/env node

/**
 * Auto CLI 卸载脚本
 * 移除所有检测到的工具目录（Claude Code ~/.claude/ + Codex ~/.codex/）下
 * 由 install.js 安装的文件。
 *
 * 用法：
 *   node scripts/uninstall.js
 */

import fs from 'fs';
import path from 'path';
import {
  CODEX_MANAGED_FILES,
  MANAGED_FILES,
  detectTools,
} from './manifest.js';

let removed = 0;

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true });
    removed++;
  }
}

console.log('Auto CLI 卸载');
console.log('');

const tools = detectTools();

if (tools.length === 0) {
  console.log('未检测到 Claude Code (~/.claude/) 或 Codex (~/.codex/)。');
  console.log('无需卸载。');
  process.exit(0);
}

console.log(
  `检测到: ${tools.map((t) => (t.name === 'claude' ? 'Claude Code' : 'Codex')).join(' + ')}`,
);
console.log('');

for (const tool of tools) {
  const dir = tool.dir;

  if (tool.name === 'claude') {
    // Claude: use MANAGED_FILES list
    for (const { dir: managedDir, files, subdirs } of MANAGED_FILES) {
      for (const file of files) {
        removeIfExists(path.join(managedDir, file));
      }
      if (subdirs) {
        for (const sub of subdirs) {
          removeIfExists(path.join(managedDir, sub));
        }
      }
    }

    // 清理 backup 残留
    for (const { dir: managedDir } of MANAGED_FILES) {
      if (!fs.existsSync(managedDir)) continue;
      const entries = fs.readdirSync(managedDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.includes('.backup.')) {
          fs.unlinkSync(path.join(managedDir, entry.name));
          removed++;
        }
      }
    }
  } else {
    // Codex: remove AGENTS.md, prompts/auto.md, prompts/auto/, skills/<skillName>/
    for (const rootFile of CODEX_MANAGED_FILES.rootFiles || []) {
      removeIfExists(path.join(dir, rootFile));
    }

    const promptsDir = path.join(dir, 'prompts');
    for (const promptFile of CODEX_MANAGED_FILES.prompts) {
      removeIfExists(path.join(promptsDir, promptFile));
    }
    for (const promptDir of CODEX_MANAGED_FILES.promptDirs) {
      removeIfExists(path.join(promptsDir, promptDir));
    }

    const skillsDir = path.join(dir, 'skills');
    if (fs.existsSync(skillsDir)) {
      for (const skillName of CODEX_MANAGED_FILES.skills) {
        removeIfExists(path.join(skillsDir, skillName));
      }
    }
  }
}

console.log(`卸载完成: 已移除 ${removed} 项`);
if (tools.some((t) => t.name === 'claude')) {
  console.log('~/.claude/ 目录保留（可能包含其他配置）');
}
if (tools.some((t) => t.name === 'codex')) {
  console.log('~/.codex/ 目录保留（可能包含其他配置）');
}
