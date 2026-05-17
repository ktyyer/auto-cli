#!/usr/bin/env node

/**
 * Auto CLI 安装脚本
 * 检测已安装的工具（Claude Code / Codex），将 commands/、agents/、skills/、hooks/ 复制到对应目录
 *
 * 映射规则：
 *   Claude (~/.claude/): commands/*.md  agents/*.md  skills/<name>.md  rules/*.md  hooks/*
 *   Codex  (~/.codex/):  prompts/*.md   (skip)       skills/<name>/SKILL.md  (skip)  (skip)
 *
 * 命令覆盖规则：
 *   若存在 *.codex.md，则仅安装到 Codex，目标文件名会去掉 .codex 后缀。
 *   例如 commands/auto.codex.md -> ~/.codex/prompts/auto.md
 *
 * 用法：
 *   node scripts/install.js          # 安装到所有检测到的工具
 *   node scripts/install.js --clean  # 清理旧资源后安装
 */

import fs from 'fs';
import path from 'path';
import {
  CODEX_MANAGED_FILES,
  CODEX_ALLOWED_COMMAND_FILES,
  CODEX_ALLOWED_COMMAND_SUBDIR_FILES,
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

function resetManagedCommandTargets(tools) {
  for (const tool of tools) {
    if (tool.name === 'codex') {
      for (const file of CODEX_MANAGED_FILES.rootFiles || []) {
        cleanDir(path.join(tool.dir, file));
      }
    }

    if (!tool.commandsDir) continue;

    if (tool.name === 'codex') {
      for (const file of CODEX_MANAGED_FILES.prompts) {
        cleanDir(path.join(tool.commandsDir, file));
      }
      for (const subdir of CODEX_MANAGED_FILES.promptDirs) {
        cleanDir(path.join(tool.commandsDir, subdir));
      }
      continue;
    }

    const managedCommands = MANAGED_FILES.find(
      ({ dir }) => dir === tool.commandsDir,
    );
    if (!managedCommands) continue;

    for (const file of managedCommands.files) {
      cleanDir(path.join(tool.commandsDir, file));
    }
    for (const subdir of managedCommands.subdirs || []) {
      cleanDir(path.join(tool.commandsDir, subdir));
    }
  }
}

function copyCodexRootFiles(srcRoot, tools) {
  let totalCopied = 0;

  for (const tool of tools) {
    if (tool.name !== 'codex') continue;

    for (const file of CODEX_MANAGED_FILES.rootFiles || []) {
      const srcPath = path.join(srcRoot, file);
      if (!fs.existsSync(srcPath)) continue;
      fs.copyFileSync(srcPath, path.join(tool.dir, file));
      totalCopied++;
    }
  }

  return totalCopied;
}

function copyCommands(src, tools) {
  const toDestName = (fileName) => fileName.replace(/\.codex\.md$/, '.md');

  const isCodexAllowed = (relativeDir, destName) => {
    if (!relativeDir) {
      return CODEX_ALLOWED_COMMAND_FILES.includes(destName);
    }
    const allowedInDir = CODEX_ALLOWED_COMMAND_SUBDIR_FILES[relativeDir] || [];
    return allowedInDir.includes(destName);
  };

  const listCommandFiles = (dir, toolName) => {
    const dirEntries = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirEntries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
    const codexOverrides = new Set(
      files
        .filter((file) => file.name.endsWith('.codex.md'))
        .map((file) => file.name.replace(/\.codex\.md$/, '.md')),
    );

    return files.filter((file) => {
      const destName = toDestName(file.name);
      if (file.name.endsWith('.codex.md')) {
        return toolName === 'codex' && isCodexAllowed(path.basename(dir), destName);
      }
      if (toolName === 'codex' && codexOverrides.has(file.name)) {
        return false;
      }
      if (toolName === 'codex') {
        return isCodexAllowed(path.basename(dir), destName);
      }
      return true;
    });
  };

  // 读取源 commands/ 下的所有 .md 及 auto/ 子目录
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let totalCopied = 0;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);

    if (entry.isDirectory()) {
      for (const tool of tools) {
        const toolSubDir = path.join(tool.commandsDir, entry.name);
        ensureDir(toolSubDir);
        const subFiles = listCommandFiles(srcPath, tool.name);
        for (const sub of subFiles) {
          fs.copyFileSync(
            path.join(srcPath, sub.name),
            path.join(toolSubDir, toDestName(sub.name)),
          );
          totalCopied++;
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      for (const tool of tools) {
        if (entry.name.endsWith('.codex.md') && tool.name !== 'codex') {
          continue;
        }
        if (
          tool.name === 'codex' &&
          !entry.name.endsWith('.codex.md') &&
          fs.existsSync(path.join(src, entry.name.replace(/\.md$/, '.codex.md')))
        ) {
          continue;
        }
        if (tool.name === 'codex' && !isCodexAllowed('', toDestName(entry.name))) {
          continue;
        }
        ensureDir(tool.commandsDir);
        fs.copyFileSync(srcPath, path.join(tool.commandsDir, toDestName(entry.name)));
        totalCopied++;
      }
    }
  }

  return totalCopied;
}

function copySkills(src, tools) {
  // 读取 skills/<name>/SKILL.md 源结构（Anthropic 开放标准对齐）
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let totalCopied = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'community') continue;

    const skillFile = path.join(src, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const skillName = entry.name;

    for (const tool of tools) {
      if (tool.skillFileName) {
        // Codex: skills/<name>/SKILL.md（与源结构一致）
        const skillDir = path.join(tool.skillsDir, skillName);
        ensureDir(skillDir);
        fs.copyFileSync(skillFile, path.join(skillDir, tool.skillFileName));
      } else {
        // Claude: skills/<name>.md (flat，兼容旧用户路径，无需迁移)
        ensureDir(tool.skillsDir);
        fs.copyFileSync(skillFile, path.join(tool.skillsDir, `${skillName}.md`));
      }
      totalCopied++;
    }
  }

  return totalCopied;
}

function copyReferences(src, tools) {
  // 读取 skills/<name>/references/ 子目录（Anthropic 开放标准对齐）
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let totalCopied = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'community') continue;

    const refSrc = path.join(src, entry.name, 'references');
    if (!fs.existsSync(refSrc)) continue;

    const skillName = entry.name;

    for (const tool of tools) {
      if (tool.skillFileName) {
        // Codex: skills/<name>/references/（与源结构一致）
        const refDir = path.join(tool.skillsDir, skillName, 'references');
        ensureDir(refDir);
        totalCopied += copyDir(refSrc, refDir);
      } else {
        // Claude: skills/<name>.references/（flat 兼容）
        const destRefDir = path.join(tool.skillsDir, `${skillName}.references`);
        ensureDir(destRefDir);
        totalCopied += copyDir(refSrc, destRefDir);
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

// 0. Codex root bridge files
resetManagedCommandTargets(tools);
const codexRootCount = copyCodexRootFiles(srcRoot, tools);
if (codexRootCount > 0) {
  console.log(`  codex root → ${codexRootCount} 文件`);
  totalFiles += codexRootCount;
}

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
