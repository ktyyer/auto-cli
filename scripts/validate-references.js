#!/usr/bin/env node

// Auto CLI 引用完整性校验脚本
//
// 功能：
// 1. 扫描 commands/**/*.md 中的 agent / skill 引用
// 2. 支持多种引用语法：
//    - Agent(subagent_type: "xxx") / agent:xxx / subagent_type: "xxx"
//    - skill:xxx
//    - Markdown 表格单元格中的纯文本 agent/skill 名
//    - 行内反引号 `agent-name` 或 `skill-name`
// 3. 报告断链引用（failed）与真正孤立的能力（warn）
// 4. 输出 JSON 格式报告
//
// 用法：
//   node scripts/validate-references.js
//   node scripts/validate-references.js --json
//   node scripts/validate-references.js --strict   # 将 orphan 视为 failed

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCAN_FILES = [path.join(ROOT, 'AGENTS.md')];
const LOCAL_ABSOLUTE_LINK_PATTERN = /\[[^\]]+\]\(([A-Za-z]:\/[^)\s]+)(?::\d+)?\)/g;

const RESULTS = {
  passed: [],
  failed: [],
  warnings: [],
  mentioned: { agents: new Set(), skills: new Set() }
};

// 从内容中提取显式引用（落到 RESULTS.passed / failed 的判定依据）

// 校验 Skill frontmatter 格式（兼容 Agent Skills 标准 + auto-cli 扩展）
function validateSkillFrontmatter(filePath, skillName) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];

  // 提取 YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    RESULTS.failed.push({
      file: path.relative(ROOT, filePath),
      type: 'skill',
      name: skillName,
      message: '缺少 YAML frontmatter'
    });
    return;
  }

  const fm = fmMatch[1];
  const parseLine = (key) => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : null;
  };

  // 必填字段: name
  const nameVal = parseLine('name');
  if (!nameVal) {
    issues.push('缺少必填字段: name');
  } else {
    // name 命名规范（Agent Skills 标准: 小写字母+数字+中划线, 1-64字符）
    if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$/.test(nameVal)) {
      issues.push(
        `name 不符合规范: "${nameVal}" (应为小写字母+数字+中划线, 1-64字符, 首尾不能是中划线)`
      );
    }
    if (nameVal.includes('--')) {
      issues.push(`name 包含连续中划线: "${nameVal}"`);
    }
    // name 必须与文件名一致
    if (nameVal !== skillName) {
      issues.push(`name "${nameVal}" 与文件名 "${skillName}.md" 不一致`);
    }
  }

  // 必填字段: description
  const descVal = parseLine('description');
  if (!descVal) {
    issues.push('缺少必填字段: description');
  } else {
    if (descVal.length < 10) {
      issues.push(`description 过短 (${descVal.length} 字符)，应 ≥ 10 字符`);
    }
    if (descVal.length > 1024) {
      issues.push(`description 过长 (${descVal.length} 字符)，Agent Skills 标准限制 ≤ 1024 字符`);
    }
  }

  // auto-cli 扩展字段: tags（推荐）
  const tagsVal = parseLine('tags');
  if (!tagsVal) {
    RESULTS.warnings.push({
      type: 'skill',
      name: skillName,
      message: '缺少 tags 字段（auto-cli 推荐填写，用于动态发现匹配）'
    });
  }

  // Agent Skills 可选字段: license（如填写则校验格式）
  const licenseVal = parseLine('license');
  if (licenseVal && licenseVal.length > 200) {
    issues.push(`license 过长 (${licenseVal.length} 字符)，建议 ≤ 200 字符`);
  }

  // Agent Skills 可选字段: compatibility
  const compatVal = parseLine('compatibility');
  if (compatVal && compatVal.length > 500) {
    issues.push(`compatibility 过长 (${compatVal.length} 字符)，Agent Skills 标准限制 ≤ 500 字符`);
  }

  if (issues.length > 0) {
    for (const issue of issues) {
      RESULTS.failed.push({
        file: path.relative(ROOT, filePath),
        type: 'skill-frontmatter',
        name: skillName,
        message: issue
      });
    }
  } else {
    RESULTS.passed.push({
      file: path.relative(ROOT, filePath),
      type: 'skill-frontmatter',
      name: skillName,
      message: 'frontmatter 格式校验通过'
    });
  }
}

function extractReferences(content) {
  const references = [];

  const agentPatterns = [
    /Agent\(\s*subagent_type:\s*["']([a-zA-Z0-9-_]+)["']/gi,
    /agent:[ \t]*["']?([a-zA-Z0-9-_]+)["']?/gi,
    /subagent_type:[ \t]*["']([a-zA-Z0-9-_]+)["']/gi
  ];

  const skillPatterns = [/skill:[ \t]*["']?([a-zA-Z0-9-_]+)["']?/gi];

  for (const pattern of agentPatterns) {
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

function validatePortableLinks(filePath, content) {
  let match;
  while ((match = LOCAL_ABSOLUTE_LINK_PATTERN.exec(content)) !== null) {
    RESULTS.failed.push({
      file: path.relative(ROOT, filePath),
      type: 'portable-link',
      name: match[1],
      message: '包含开发机绝对路径链接，安装到其他机器后会失效'
    });
  }
}

// 记录"文档中出现过该 agent/skill 名称"（任何形式，含表格/反引号/纯文本）
// 用于消除 agent/skill 已在 auto.md 表格中登记但被判为 orphan 的假阳性
function recordMentions(content, availableAgents, availableSkills) {
  // 只采集 "被 ` 包裹" 或 "出现在 | ... |" 表格单元格 中的 token，避免误杀散文字
  const tokenRegex = /`([a-zA-Z0-9-_]+)`|\|\s*([a-zA-Z0-9-_]+)\s*\|/g;
  let match;
  while ((match = tokenRegex.exec(content)) !== null) {
    const token = match[1] || match[2];
    if (!token) continue;
    if (availableAgents.has(token)) RESULTS.mentioned.agents.add(token);
    if (availableSkills.has(token)) RESULTS.mentioned.skills.add(token);
  }

  // 额外识别：行首表格式列表 `| agent-name | 描述 |`（上一条已覆盖）
  // 以及独立行内 pipe 表格 `xxx.md` 路径中的 name.md
  const mdFileRegex = /`([a-zA-Z0-9-_]+)\.md`/g;
  while ((match = mdFileRegex.exec(content)) !== null) {
    const name = match[1];
    if (availableAgents.has(name)) RESULTS.mentioned.agents.add(name);
    if (availableSkills.has(name)) RESULTS.mentioned.skills.add(name);
  }
}

// 获取可用文件列表（不含 _shared-principles.md 等非实体文件）
function getAvailableFiles(dir) {
  const exclude = new Set(['_shared-principles.md', '.gitkeep']);

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !exclude.has(f))
    .map((f) => f.replace('.md', ''));
}

// 获取可用 Skill 列表（dir 结构：skills/<name>/SKILL.md）
function getAvailableSkills(dir) {
  const exclude = new Set([]);  // 移除 'community' 排除，让社区 skill 也参与校验

  if (!fs.existsSync(dir)) {
    return [];
  }

  const skills = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !exclude.has(entry.name))
    .filter((entry) => fs.existsSync(path.join(dir, entry.name, 'SKILL.md')))
    .map((entry) => entry.name);

  // 校验 community skills
  const communityDir = path.join(dir, 'community');
  if (fs.existsSync(communityDir)) {
    const communitySkills = fs
      .readdirSync(communityDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const skillFile = path.join(communityDir, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillFile)) {
          RESULTS.warnings.push({
            type: 'community-skill',
            name: entry.name,
            message: '社区 Skill 缺少 SKILL.md 文件'
          });
          return false;
        }
        return true;
      });

    // 校验 community skills frontmatter
    communitySkills.forEach((entry) => {
      const skillFile = path.join(communityDir, entry.name, 'SKILL.md');
      validateSkillFrontmatter(skillFile, entry.name);
    });

    skills.push(...communitySkills.map((entry) => entry.name));
  }

  return skills;
}

function validateReferences() {
  console.log('引用完整性校验');
  console.log('='.repeat(50));

  const agentsDir = path.join(ROOT, 'agents');
  const skillsDir = path.join(ROOT, 'skills');
  const commandsDir = path.join(ROOT, 'commands');

  const availableAgents = new Set(getAvailableFiles(agentsDir));
  const availableSkills = new Set(getAvailableSkills(skillsDir));

  console.log(`可用 Agents: ${availableAgents.size}`);
  console.log(`可用 Skills: ${availableSkills.size}`);
  console.log('');

  const scanFile = (filePath) => {
    if (!fs.existsSync(filePath)) return;

    const relativePath = path.relative(ROOT, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    recordMentions(content, availableAgents, availableSkills);
    validatePortableLinks(filePath, content);
    const refs = extractReferences(content);

    if (refs.length === 0) return;

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
  };

  const scanDir = (dir) => {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(ROOT, fullPath);

      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.md')) {
        scanFile(fullPath);
      }
    }
  };

  scanDir(commandsDir);
  for (const filePath of SCAN_FILES) {
    scanFile(filePath);
  }

  // Skill frontmatter 格式校验（dir 结构：skills/<name>/SKILL.md）
  const skillsDirEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of skillsDirEntries) {
    if (!entry.isDirectory() || entry.name === 'community') continue;
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      validateSkillFrontmatter(skillFile, entry.name);
    }
  }

  // Orphan 判定：能力文件存在，但在任何 commands/*.md 中都没有以任何形式被提及
  // 白名单：下沉实现 skill（从 auto.md 提取的细节，隐式引用）
  const implicitSkills = new Set(['knowledge-management', 'quality-gates']);

  for (const agent of availableAgents) {
    if (!RESULTS.mentioned.agents.has(agent)) {
      RESULTS.warnings.push({ type: 'agent', name: agent, message: '定义了但未被提及' });
    }
  }

  for (const skill of availableSkills) {
    if (!RESULTS.mentioned.skills.has(skill) && !implicitSkills.has(skill)) {
      RESULTS.warnings.push({ type: 'skill', name: skill, message: '定义了但未被提及' });
    }
  }

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
  }

  if (RESULTS.warnings.length > 0) {
    console.log('');
    console.log('警告（真正孤立的能力）:');
    for (const warn of RESULTS.warnings) {
      console.log(`  - ${warn.type}:${warn.name} - ${warn.message}`);
    }
  }

  const strictMode = process.argv.includes('--strict');
  return RESULTS.failed.length === 0 && (!strictMode || RESULTS.warnings.length === 0);
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  const success = validateReferences();

  if (jsonOutput) {
    console.log('');
    console.log(
      JSON.stringify(
        {
          passed: RESULTS.passed,
          failed: RESULTS.failed,
          warnings: RESULTS.warnings,
          mentioned: {
            agents: Array.from(RESULTS.mentioned.agents),
            skills: Array.from(RESULTS.mentioned.skills)
          }
        },
        null,
        2
      )
    );
  }

  process.exit(success ? 0 : 1);
}

main();
