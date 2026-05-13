#!/usr/bin/env node

/**
 * Auto CLI 安装脚本
 * 检测已安装的工具（Claude Code / Codex），将 commands/、agents/、skills/、hooks/ 复制到对应目录
 *
 * 映射规则：
 *   Claude (~/.claude/): commands/*.md  agents/*.md  skills/<name>.md  rules/*.md  hooks/*
 *   Codex  (~/.codex/):  prompts/*.md   (skip)       skills/<name>/SKILL.md  (skip)  (skip)
 *
 * 用法：
 *   node scripts/install.js          # 安装到所有检测到的工具
 *   node scripts/install.js --clean  # 清理旧资源后安装
 */

import fs from 'fs';
import path from 'path';
import {
  CODEX_MANAGED_FILES,
  COMPONENTS,
  MANAGED_FILES,
  detectTools,
} from './manifest.js';

const cleanFlag = process.argv.includes('--clean');

function ensureDir(dir) {
  if (!dir) return;
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

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return 0;
  fs.rmSync(dir, { recursive: true, force: true });
  return 1;
}

function copyCommands(src, tools) {
  // 读取源 commands/ 下的所有 .md 及 auto/ 子目录
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let totalCopied = 0;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);

    if (entry.isDirectory()) {
      // commands/auto/ → prompts/auto/ or commands/auto/
      const subEntries = fs.readdirSync(srcPath, { withFileTypes: true });

      for (const tool of tools) {
        const toolSubDir = path.join(tool.commandsDir, entry.name);
        ensureDir(toolSubDir);
        for (const sub of subEntries) {
          if (sub.isFile() && sub.name.endsWith('.md')) {
            fs.copyFileSync(
              path.join(srcPath, sub.name),
              path.join(toolSubDir, sub.name),
            );
            totalCopied++;
          }
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      for (const tool of tools) {
        ensureDir(tool.commandsDir);
        fs.copyFileSync(srcPath, path.join(tool.commandsDir, entry.name));
        totalCopied++;
      }
    }
  }

  return totalCopied;
}

function copySkills(src, tools) {
  // 读取 skills/*.md 源文件
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let totalCopied = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

    const srcPath = path.join(src, entry.name);

    for (const tool of tools) {
      if (tool.skillFileName) {
        // Codex: skills/<name>/SKILL.md
        const skillName = entry.name.replace(/\.md$/, '');
        const skillDir = path.join(tool.skillsDir, skillName);
        ensureDir(skillDir);
        fs.copyFileSync(srcPath, path.join(skillDir, tool.skillFileName));
      } else {
        // Claude: skills/<name>.md (flat)
        ensureDir(tool.skillsDir);
        fs.copyFileSync(srcPath, path.join(tool.skillsDir, entry.name));
      }
      totalCopied++;
    }
  }

  return totalCopied;
}

function copyReferences(src, tools) {
  // 读取 skills/ 下的 .references/ 子目录
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let totalCopied = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith('.references')) continue;

    for (const tool of tools) {
      if (tool.skillFileName) {
        // Codex: map <skill>.references/ to skills/<skill>/references/
        const skillName = entry.name.replace(/\.references$/, '');
        const refDir = path.join(tool.skillsDir, skillName, 'references');
        ensureDir(refDir);
        const count = copyDir(path.join(src, entry.name), refDir);
        totalCopied += count;
      } else {
        // Claude: skills/<name>.references/ (flat alongside .md)
        const destRefDir = path.join(tool.skillsDir, entry.name);
        ensureDir(destRefDir);
        const count = copyDir(path.join(src, entry.name), destRefDir);
        totalCopied += count;
      }
    }
  }

  return totalCopied;
}

function cleanClaudeManagedFiles() {
  let removed = 0;
  for (const { dir, files, subdirs } of MANAGED_FILES) {
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

  return removed;
}

function cleanCodexManagedFiles(tool) {
  let removed = 0;
  const promptsDir = path.join(tool.dir, 'prompts');
  const skillsDir = path.join(tool.dir, 'skills');

  for (const promptFile of CODEX_MANAGED_FILES.prompts) {
    removed += cleanDir(path.join(promptsDir, promptFile));
  }
  for (const promptDir of CODEX_MANAGED_FILES.promptDirs) {
    removed += cleanDir(path.join(promptsDir, promptDir));
  }
  for (const skillDir of CODEX_MANAGED_FILES.skills) {
    removed += cleanDir(path.join(skillsDir, skillDir));
  }

  return removed;
}

function cleanManagedFiles(tools) {
  let removed = 0;

  for (const tool of tools) {
    if (tool.name === 'claude') {
      removed += cleanClaudeManagedFiles();
    } else if (tool.name === 'codex') {
      removed += cleanCodexManagedFiles(tool);
    }
  }

  return removed;
}

// === Main ===

const tools = detectTools();

console.log('Auto CLI 安装');
console.log('');

if (tools.length === 0) {
  console.log('未检测到 Claude Code (~/.claude/) 或 Codex (~/.codex/)。');
  console.log('请先安装 Claude Code 或 Codex CLI。');
  process.exit(1);
}

console.log(
  `检测到: ${tools.map((t) => (t.name === 'claude' ? 'Claude Code' : 'Codex')).join(' + ')}`,
);
console.log('');

if (cleanFlag) {
  console.log('清理旧资源...');
  const removed = cleanManagedFiles(tools);
  console.log(`已清理 ${removed} 项旧资源`);
  console.log('');
}

const srcRoot = process.cwd();
let totalFiles = 0;

// 1. Commands → Prompts (for Codex) / Commands (for Claude)
const commandsSrc = path.join(srcRoot, 'commands');
if (fs.existsSync(commandsSrc)) {
  const count = copyCommands(commandsSrc, tools);
  console.log(`  commands/ → ${count} 文件`);
  totalFiles += count;
}

// 2. Skills (with conversion for Codex)
const skillsSrc = path.join(srcRoot, 'skills');
if (fs.existsSync(skillsSrc)) {
  const count = copySkills(skillsSrc, tools);
  console.log(`  skills/ → ${count} 文件`);
  totalFiles += count;

  // .references/ subdirectories
  const refCount = copyReferences(skillsSrc, tools);
  if (refCount > 0) {
    console.log(`  skills/*.references/ → ${refCount} 文件`);
    totalFiles += refCount;
  }
}

// 3. Agents (Claude only)
const agentsSrc = path.join(srcRoot, 'agents');
if (fs.existsSync(agentsSrc)) {
  let agentCount = 0;
  for (const tool of tools) {
    if (tool.hasAgents) {
      ensureDir(tool.agentsDir);
      const count = copyDir(agentsSrc, tool.agentsDir);
      agentCount += count;
    }
  }
  console.log(`  agents/ → ${agentCount} 文件`);
  totalFiles += agentCount;
}

// 4. Rules (Claude only)
const rulesSrc = path.join(srcRoot, 'rules');
if (fs.existsSync(rulesSrc)) {
  let ruleCount = 0;
  for (const tool of tools) {
    if (tool.hasRules) {
      ensureDir(tool.rulesDir);
      const count = copyDir(rulesSrc, tool.rulesDir);
      ruleCount += count;
    }
  }
  console.log(`  rules/ → ${ruleCount} 文件`);
  totalFiles += ruleCount;
}

// 5. Hooks (Claude only)
const hooksSrc = path.join(srcRoot, 'hooks');
if (fs.existsSync(hooksSrc)) {
  let hookCount = 0;
  for (const tool of tools) {
    if (tool.hasHooks) {
      ensureDir(tool.hooksDir);
      const count = copyDir(hooksSrc, tool.hooksDir);
      hookCount += count;
    }
  }
  console.log(`  hooks/ → ${hookCount} 文件`);
  totalFiles += hookCount;
}

console.log('');
const targetDesc =
  tools.length === 2
    ? '~/.claude/ + ~/.codex/'
    : tools[0].name === 'claude'
      ? '~/.claude/'
      : '~/.codex/';
console.log(`安装完成: ${totalFiles} 文件已同步到 ${targetDesc}`);
