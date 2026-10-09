import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const validator = fileURLToPath(new URL('../../scripts/validate-references.js', import.meta.url));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-reference-fixture-'));
  const write = (relative, contents) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  };
  write('package.json', '{"type":"module"}\n');
  write('scripts/validate-references.js', fs.readFileSync(validator));
  fs.mkdirSync(path.join(root, 'skills'));
  fs.mkdirSync(path.join(root, 'commands'));
  const skill = (name, body = '') =>
    write(
      `skills/${name}/SKILL.md`,
      `---\nname: ${name}\ndescription: Independent reference graph fixture.\ntags: [fixture]\n---\n# ${name}\n${body}\n`
    );
  const run = (...args) => {
    const result = spawnSync(
      process.execPath,
      ['scripts/validate-references.js', '--json', ...args],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 10000
      }
    );
    assert.equal(result.error, undefined, result.error?.message);
    const start = result.stdout.lastIndexOf('\n{');
    assert.ok(start >= 0, result.stderr || result.stdout);
    return { ...result, report: JSON.parse(result.stdout.slice(start)) };
  };
  t.after(() => {
    const relative = path.relative(os.tmpdir(), root);
    assert.ok(relative.startsWith('auto-reference-fixture-') && !relative.includes(path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, write, skill, run };
}

function orphanSkills(report) {
  return report.warnings
    .filter((item) => item.type === 'skill')
    .map((item) => item.name)
    .sort();
}

test('explicit existing capabilities count as references without requiring backticks', (t) => {
  const f = fixture(t);
  f.skill('direct-check');
  f.write('agents/task-worker.md', '# task-worker\n');
  f.write('commands/auto.md', 'skill:direct-check\nagent:task-worker\n');
  const result = f.run('--strict');
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(result.report.mentioned.skills, ['direct-check']);
  assert.deepEqual(result.report.mentioned.agents, ['task-worker']);
  assert.deepEqual(result.report.warnings, []);
});

test('both entry styles reach shared contracts while disconnected capabilities stay orphaned', (t) => {
  for (const entry of [
    ['auto.codex.md', 'Read **policy-root/references/contract.md**.\n'],
    ['auto.md', 'Read [shared contract](../skills/policy-root/references/contract.md).\n']
  ]) {
    const f = fixture(t);
    for (const name of [
      'policy-root',
      'task-repair',
      'leaf-check',
      'true-orphan',
      'near-name',
      'cycle-a',
      'cycle-b',
      'quality-gates',
      'knowledge-management'
    ])
      f.skill(name);
    f.write(`commands/${entry[0]}`, entry[1]);
    f.write(
      'skills/policy-root/references/contract.md',
      '[phase](phase.md)\nUse task-repair for a reproduced fault. Use near-name-extra as a distinct name. Read near-name.md as a filename.\n'
    );
    f.write(
      'skills/policy-root/references/phase.md',
      '[contract](contract.md)\nskill:leaf-check\n'
    );
    f.skill('cycle-a', '[peer](../cycle-b/SKILL.md)');
    f.skill('cycle-b', '[peer](../cycle-a/SKILL.md)');
    f.write('.auto/cache/old-reference.md', 'skill:true-orphan\n');
    const result = f.run();
    assert.equal(result.status, 0, result.stdout);
    assert.deepEqual(orphanSkills(result.report), [
      'cycle-a',
      'cycle-b',
      'knowledge-management',
      'near-name',
      'quality-gates',
      'true-orphan'
    ]);
    assert.deepEqual(
      new Set(result.report.mentioned.skills),
      new Set(['policy-root', 'task-repair', 'leaf-check'])
    );
    assert.equal(
      result.report.passed.filter((item) => item.type === 'skill' && item.name === 'leaf-check')
        .length,
      1
    );
    assert.equal(f.run('--strict').status, 1, 'strict still rejects the genuine orphans');
  }
});

test('a missing shared Markdown target fails at its referencing controller', (t) => {
  const f = fixture(t);
  f.skill('policy-root');
  f.write('commands/auto.codex.md', 'Read **policy-root/references/missing.md**.\n');
  const result = f.run();
  assert.equal(result.status, 1, result.stdout);
  assert.ok(
    result.report.failed.some(
      (item) => item.type === 'markdown-reference' && item.name.endsWith('references/missing.md')
    )
  );
});

test('a missing skill inside a reachable contract is still a failed reference', (t) => {
  const f = fixture(t);
  f.skill('policy-root');
  f.write('commands/auto.md', '[contract](../skills/policy-root/references/contract.md)\n');
  f.write('skills/policy-root/references/contract.md', 'skill:missing-target\n');
  const result = f.run();
  assert.equal(result.status, 1, result.stdout);
  const missing = result.report.failed.find(
    (item) => item.type === 'skill' && item.name === 'missing-target'
  );
  assert.equal(missing?.file.replaceAll('\\', '/'), 'skills/policy-root/references/contract.md');
});

test('runtime artifacts, placeholders and external URLs do not become local capability links', (t) => {
  const f = fixture(t);
  f.write(
    'commands/auto.md',
    '`skills/<name>/SKILL.md`\n`.auto/insights/future.md`\n[external](https://example.invalid/skills/example/SKILL.md)\n'
  );
  const result = f.run('--strict');
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(result.report.failed, []);
  assert.deepEqual(result.report.warnings, []);
});

test('bare artifact filenames and repository paths in shared prose are not relative document links', (t) => {
  const f = fixture(t);
  f.skill('policy-root');
  f.write('commands/auto.md', '[contract](../skills/policy-root/references/contract.md)\n');
  f.write(
    'skills/policy-root/references/contract.md',
    '`index.md` and session-continuity.md are run outputs. Read commands/auto.md, agents/verification.md, AGENTS.md and CLAUDE.md as appropriate.\n[repository context](../../../outside.md)\n'
  );
  f.write('outside.md', 'skill:outside-the-capability-graph\n');
  const result = f.run('--strict');
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(result.report.failed, []);
  assert.deepEqual(result.report.mentioned.skills, ['policy-root']);
});

test('a skill-document symlink cannot expand the scan outside the repository', (t) => {
  const f = fixture(t);
  const outside = fixture(t);
  f.skill('policy-root');
  outside.write('contract.md', 'skill:must-not-read-external-document\n');
  fs.mkdirSync(path.join(f.root, 'skills/policy-root/references'));
  fs.symlinkSync(
    outside.root,
    path.join(f.root, 'skills/policy-root/references/escape'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  f.write('commands/auto.md', '[contract](../skills/policy-root/references/escape/contract.md)\n');
  const result = f.run();
  assert.equal(result.status, 1, result.stdout);
  assert.equal(result.report.failed.length, 1);
  assert.equal(result.report.failed[0].type, 'markdown-reference');
  assert.deepEqual(result.report.mentioned.skills, []);
});

test('constraint names and fenced dashboard or invocation examples do not resolve capabilities', (t) => {
  const f = fixture(t);
  for (const name of [
    'policy-root',
    'constitution',
    'dashboard-only',
    'snippet-only',
    'example-path',
    'unreachable-child'
  ])
    f.skill(name);
  f.skill('example-path', 'skill:unreachable-child');
  f.write('commands/auto.md', '[contract](../skills/policy-root/references/contract.md)\n');
  f.write(
    'skills/policy-root/references/contract.md',
    [
      'Project constitution is a constraint; `.auto/constitution.md` is its artifact.',
      'Dashboard output example:',
      '```text',
      'Most used: dashboard-only',
      'Use snippet-only',
      'skills/example-path/SKILL.md',
      '```',
      ''
    ].join('\n')
  );
  const result = f.run();
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(orphanSkills(result.report), [
    'constitution',
    'dashboard-only',
    'example-path',
    'snippet-only',
    'unreachable-child'
  ]);
  assert.deepEqual(result.report.mentioned.skills, ['policy-root']);
  assert.equal(f.run('--strict').status, 1);
});
