#!/usr/bin/env node

// Auto CLI 引用完整性校验脚本
//
// 功能：
// 1. 解析 commands/**/*.md 中的 agent:/skill: 引用
// 2. 检查 agents/*.md / skills/*.md 是否存在
// 3. 报告断链引用
// 4. 输出 JSON 格式报告
//
// 用法：
//   node scripts/validate-references.js
//   node scripts/validate-references.js --json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const RESULTS = {
  passed: [],
  failed: [],
  warnings: [],
};

// 提取 Markdown 文件中的引用
// 支持多种格式：agent:, skill:, subagent_type, Agent(subagent_type: "xxx")
function extractReferences(content) {
  const references = [];

  // 匹配各种可能的引用格式
  const patterns = [
    // Agent(subagent_type: "xxx")
    /Agent\(\s*subagent_type:\s*["']([a-zA-Z0-9-_]+)["']/gi,
    // agent:xxx
    /agent:\s*["']?([a-zA-Z0-9-_]+)["']?/gi,
    // subagent_type: "xxx"
    /subagent_type:\s*["']([a-zA-Z0-9-_]+)["']/gi,
  ];

  const skillPatterns = [
    // skill:xxx
    /skill:\s*["']?([a-zA-Z0-9-_]+)["']?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      references.push({ type: 'agent', name: match[1] });
    }
  }

  for (const pattern of skillPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      references.push({ type: 'skill', name: match[1] });
    }
  }

  return references;
}

// 获取可用文件列表（不含 _shared-principles.md 等非实体文件）
function getAvailableFiles(dir, type) {
  const exclude = new Set([
    '_shared-principles.md',
    '.gitkeep',
  ]);

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && !exclude.has(f))
    .map(f => f.replace('.md', ''));
}

// 验证引用完整性
function validateReferences() {
  console.log('引用完整性校验');
  console.log('='.repeat(50));

  // 1. 获取可用的 agents 和 skills
  const agentsDir = path.join(ROOT, 'agents');
  const skillsDir = path.join(ROOT, 'skills');
  const commandsDir = path.join(ROOT, 'commands');

  const availableAgents = new Set(getAvailableFiles(agentsDir, 'agent'));
  const availableSkills = new Set(getAvailableFiles(skillsDir, 'skill'));

  console.log(`可用 Agents: ${availableAgents.size}`);
  console.log(`可用 Skills: ${availableSkills.size}`);
  console.log('');

  // 2. 扫描 commands/**/*.md
  const scanDir = (dir, baseDir = '') => {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(ROOT, fullPath);

      if (entry.isDirectory()) {
        scanDir(fullPath, path.join(baseDir, entry.name));
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const refs = extractReferences(content);

        if (refs.length === 0) continue;

        console.log(`扫描: ${relativePath}`);

        for (const ref of refs) {
          const availableSet = ref.type === 'agent' ? availableAgents : availableSkills;
          const exists = availableSet.has(ref.name);

          if (exists) {
            RESULTS.passed.push({ file: relativePath, ...ref });
          } else {
            RESULTS.failed.push({ file: relativePath, ...ref });
            console.log(`  ❌ ${ref.type}:${ref.name} - 文件不存在`);
          }
        }
      }
    }
  };

  scanDir(commandsDir);

  // 3. 检查孤立文件（定义了但未被引用）
  const allReferencedAgents = new Set(
    RESULTS.passed
      .filter(r => r.type === 'agent')
      .map(r => r.name)
  );
  const allReferencedSkills = new Set(
    RESULTS.passed
      .filter(r => r.type === 'skill')
      .map(r => r.name)
  );

  for (const agent of availableAgents) {
    if (!allReferencedAgents.has(agent)) {
      RESULTS.warnings.push({ type: 'agent', name: agent, message: '定义了但未被引用' });
    }
  }

  for (const skill of availableSkills) {
    if (!allReferencedSkills.has(skill)) {
      RESULTS.warnings.push({ type: 'skill', name: skill, message: '定义了但未被引用' });
    }
  }

  // 4. 输出结果
  console.log('');
  console.log('='.repeat(50));
  console.log('校验结果');
  console.log('='.repeat(50));

  console.log(`✅ 通过: ${RESULTS.passed.length}`);
  console.log(`❌ 失败: ${RESULTS.failed.length}`);
  console.log(`⚠️  警告: ${RESULTS.warnings.length}`);

  if (RESULTS.failed.length > 0) {
    console.log('');
    console.log('失败的引用:');
    for (const fail of RESULTS.failed) {
      console.log(`  - ${fail.file}: ${fail.type}:${fail.name}`);
    }
    return false;
  }

  if (RESULTS.warnings.length > 0) {
    console.log('');
    console.log('警告（未引用的文件）:');
    for (const warn of RESULTS.warnings) {
      console.log(`  - ${warn.type}:${warn.name} - ${warn.message}`);
    }
  }

  return RESULTS.failed.length === 0;
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  const success = validateReferences();

  if (jsonOutput) {
    console.log('');
    console.log(JSON.stringify(RESULTS, null, 2));
  }

  process.exit(success ? 0 : 1);
}

main();
