#!/usr/bin/env node

// Rebuild .auto/cache/skill-extracts/ from skills/<name>/SKILL.md
// Extracts the "## 激活摘要" section from each SKILL.md file.
// If no activation digest exists, generates a minimal placeholder from frontmatter.

import fs from 'fs';
import path from 'path';

const SKILLS_DIR = path.resolve('skills');
const CACHE_DIR = path.resolve('.auto', 'cache', 'skill-extracts');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function extractActivationDigest(content) {
  const marker = /^## 激活摘要/m;
  const idx = content.search(marker);
  if (idx === -1) return null;

  const afterMarker = content.slice(idx);
  const lines = afterMarker.split('\n');
  const result = [];
  let started = false;

  for (const line of lines) {
    if (!started) {
      started = true;
      result.push(line);
      continue;
    }
    if (/^## /.test(line) && result.length > 1) break;
    result.push(line);
  }

  return result.join('\n').trim();
}

function generatePlaceholder(fm, skillName) {
  return `## 激活摘要

> 自动生成的最小摘要（skill 尚未添加 ## 激活摘要 段落）

### checklist
- [ ] 参考 ${skillName} skill 全文

### constraints
- 见 skills/${skillName}/SKILL.md

### anti-patterns
- 待补充

### output template
- 无特定模板`;
}

function main() {
  ensureDir(CACHE_DIR);

  if (!fs.existsSync(SKILLS_DIR)) {
    console.log('skills/ directory not found, skipping.');
    return;
  }

  // 新结构: skills/<name>/SKILL.md（对齐 Anthropic 开放标准）
  const entries = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'community');

  let extracted = 0;
  let placeholder = 0;
  let total = 0;

  for (const entry of entries) {
    const skillFile = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    total++;

    const skillName = entry.name;
    const content = fs.readFileSync(skillFile, 'utf-8');
    const fm = extractFrontmatter(content);

    let digest = extractActivationDigest(content);
    if (digest) {
      extracted++;
    } else {
      digest = generatePlaceholder(fm, skillName);
      placeholder++;
    }

    const outPath = path.join(CACHE_DIR, `${skillName}.md`);
    fs.writeFileSync(outPath, digest + '\n', 'utf-8');
  }

  console.log(
    `skill-extracts rebuilt: ${extracted} extracted, ${placeholder} placeholder, ${total} total`
  );
}

main();
