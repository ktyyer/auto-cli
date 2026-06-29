import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function importSkillExtractsModule(cwdPath) {
  const previousCwd = process.cwd();
  process.chdir(cwdPath);
  try {
    return await import(new URL(`../../scripts/rebuild-skill-extracts.js?cwd=${encodeURIComponent(cwdPath)}&t=${Date.now()}`, import.meta.url));
  } finally {
    process.chdir(previousCwd);
  }
}

function writeSkill(skillRoot, skillName, content) {
  const skillDir = path.join(skillRoot, skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8');
}

test('rebuild-skill-extracts writes activation digest when skill has 激活摘要 section', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-skill-extracts-'));
  const skillsDir = path.join(tempRoot, 'skills');

  writeSkill(
    skillsDir,
    'demo-skill',
    `---\nname: demo-skill\ndescription: demo skill\n---\n\n## 激活摘要\n\n- [ ] first checklist\n\n## 其他章节\n\nignored\n`
  );

  await importSkillExtractsModule(tempRoot);

  const digestPath = path.join(tempRoot, '.auto', 'cache', 'skill-extracts', 'demo-skill.md');
  assert.equal(fs.existsSync(digestPath), true);
  const digest = fs.readFileSync(digestPath, 'utf8');
  assert.match(digest, /## 激活摘要/);
  assert.match(digest, /first checklist/);
  assert.doesNotMatch(digest, /ignored/);
});

test('rebuild-skill-extracts writes placeholder when skill lacks 激活摘要 section', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-skill-placeholder-'));
  const skillsDir = path.join(tempRoot, 'skills');

  writeSkill(
    skillsDir,
    'plain-skill',
    `---\nname: plain-skill\ndescription: plain skill\n---\n\n# Plain\n`
  );

  await importSkillExtractsModule(tempRoot);

  const digestPath = path.join(tempRoot, '.auto', 'cache', 'skill-extracts', 'plain-skill.md');
  const digest = fs.readFileSync(digestPath, 'utf8');
  assert.match(digest, /自动生成的最小摘要/);
  assert.match(digest, /plain-skill/);
});
