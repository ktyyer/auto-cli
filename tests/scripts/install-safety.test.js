import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { prepareInstall, applyPlans } from '../../scripts/managed-install.js';
import {
  BLOCK_START,
  BLOCK_END,
  listSourceFiles,
  managedBlock
} from '../../scripts/install-plan.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-install-safety-'));
  fs.writeFileSync(
    path.join(home, '.auto-cli-install-test-root'),
    'auto-cli isolated installation fixture\n'
  );
  for (const host of ['.claude', '.codex']) fs.mkdirSync(path.join(home, host));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const write = (file, value) => {
    const target = path.join(home, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
    return target;
  };
  const run = (script, ...args) =>
    spawnSync(process.execPath, [path.join(repoRoot, 'scripts', script), ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        AUTO_CLI_INSTALL_TEST_MODE: '1',
        AUTO_CLI_INSTALL_HOME: home,
        HOME: home,
        USERPROFILE: home,
        CODEX_HOME: path.join(home, '.codex'),
        CLAUDE_CONFIG_DIR: path.join(home, '.claude')
      }
    });
  const ok = (script, ...args) => {
    const result = run(script, ...args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result;
  };
  return { home, write, run, ok };
}

test('clean install preserves extras and personal backups; uninstall restores collisions and AGENTS', (t) => {
  const f = fixture(t);
  const agents = f.write('.codex/AGENTS.md', '# My private instructions\n');
  const colliding = f.write('.codex/skills/api-design/SKILL.md', '# Third party skill\n');
  const extra = f.write('.codex/skills/api-design/my-notes.md', 'keep notes');
  const command = f.write('.claude/commands/auto/custom.md', 'personal command');
  const backup = f.write('.claude/skills/user.backup.2020.md', 'personal backup');
  const hookPackage = f.write('.claude/hooks/package.json', '{"type":"commonjs"}\n');
  f.ok('install.js', '--clean');
  assert.match(fs.readFileSync(agents, 'utf8'), /^# My private instructions\n/);
  for (const file of [extra, command, backup]) assert.ok(fs.existsSync(file), file);
  assert.equal(fs.readFileSync(hookPackage, 'utf8'), '{"type":"commonjs"}\n');
  f.ok('install.js', '--clean');
  f.ok('uninstall.js');
  assert.equal(fs.readFileSync(agents, 'utf8'), '# My private instructions\n');
  assert.equal(fs.readFileSync(colliding, 'utf8'), '# Third party skill\n');
  for (const file of [extra, command, backup]) assert.ok(fs.existsSync(file), file);
  assert.equal(fs.readFileSync(hookPackage, 'utf8'), '{"type":"commonjs"}\n');
});

test('Codex global bridge routes Auto without distributing this repository rules', (t) => {
  const f = fixture(t);
  const personal = '# Personal rules\r\nKeep my editor preferences.\r\n';
  const agents = f.write('.codex/AGENTS.md', personal);
  const projectRules = '# Business project\nUse Node.js and update agents/ when needed.\n';
  const project = f.write('business-project/AGENTS.md', projectRules);
  const otherSkill = f.write('.agents/skills/personal/SKILL.md', '# Personal agent skill\n');
  f.ok('install.js');

  const installed = fs.readFileSync(agents, 'utf8');
  const bridge = managedBlock(Buffer.from(installed)).text;
  assert.ok(installed.startsWith(personal));
  assert.doesNotMatch(
    bridge,
    /本仓库是纯 Markdown|不引入 JS\/Node 运行时代码|不修改.*agents\/|当前版本/
  );
  assert.match(bridge, /\/auto/);
  assert.match(bridge, /\/prompts:auto/);
  assert.match(bridge, /commands\/auto\.codex\.md/);
  assert.match(bridge, /<host-root>\/prompts\/auto\.md/);
  assert.match(bridge, /RouteDecision/);
  assert.match(bridge, /Plan/);
  assert.equal(fs.readFileSync(project, 'utf8'), projectRules);
  assert.equal(fs.readFileSync(otherSkill, 'utf8'), '# Personal agent skill\n');
  assert.ok(fs.existsSync(path.join(f.home, '.codex/skills/api-design/SKILL.md')));
  assert.equal(fs.existsSync(path.join(f.home, '.agents/skills/api-design')), false);
  assert.match(f.ok('install.js').stdout, /0 changes/);
  f.ok('uninstall.js');
  assert.equal(fs.readFileSync(agents, 'utf8'), personal);
  assert.equal(fs.readFileSync(project, 'utf8'), projectRules);
});

test('an unmanaged historical whole-file bridge is preserved and diagnosed', (t) => {
  const f = fixture(t);
  const legacy = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'));
  const agents = f.write('.codex/AGENTS.md', legacy);
  const result = f.ok('install.js');
  const installed = fs.readFileSync(agents);
  assert.ok(
    installed.subarray(0, legacy.length).equals(legacy),
    'the unmanaged legacy bytes must remain intact'
  );
  assert.match(result.stderr, /AGENTS\.md:1-\d+: unmanaged Auto section preserved/);
  assert.match(result.stderr, /lines only in unmanaged section/);
  assert.match(result.stderr, /lines only in managed bridge/);
  const bridge = managedBlock(installed).text;
  assert.doesNotMatch(bridge, /本仓库是纯 Markdown|不引入 JS\/Node 运行时代码/);
  assert.match(f.ok('install.js').stdout, /0 changes/);
  f.ok('uninstall.js');
  assert.deepEqual(fs.readFileSync(agents), legacy);
});

test('upgrade replaces only a receipted historical block and preserves unmanaged sections', (t) => {
  const f = fixture(t);
  f.ok('install.js');
  const legacy = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8').trimEnd();
  const prefix = `# Personal rules\nKeep my preferences.\n\n${legacy}`;
  const suffix = '\n# Personal footer\nKeep this too.\n';
  const oldBlock = `${BLOCK_START}\n${legacy}\n${BLOCK_END}`;
  const oldRemoval = `\n\n${oldBlock}\n`;
  const agents = f.write('.codex/AGENTS.md', prefix + oldRemoval + suffix);
  const receiptPath = path.join(f.home, '.codex/auto-cli/install-manifest.json');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const entry = receipt.files.find((file) => file.path === 'AGENTS.md');
  Object.assign(entry, {
    source: 'AGENTS.md',
    sourceSha256: createHash('sha256').update(legacy).digest('hex'),
    sha256: createHash('sha256').update(fs.readFileSync(agents)).digest('hex'),
    blockText: oldBlock,
    removeText: oldRemoval,
    preserveEmpty: true
  });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));

  const result = f.ok('install.js');
  const installed = fs.readFileSync(agents, 'utf8');
  const block = managedBlock(Buffer.from(installed));
  assert.equal(installed.slice(0, block.start), `${prefix}\n\n`);
  assert.equal(installed.slice(block.end), `\n${suffix}`);
  assert.doesNotMatch(block.text, /本仓库是纯 Markdown|不引入 JS\/Node 运行时代码/);
  assert.match(result.stderr, /AGENTS\.md:4-\d+: unmanaged Auto section preserved/);
  assert.match(f.ok('install.js').stdout, /0 changes/);
  f.ok('uninstall.js');
  assert.equal(fs.readFileSync(agents, 'utf8'), prefix + suffix);
});

test('an edited global bridge blocks reinstall and survives uninstall with its receipt', (t) => {
  const f = fixture(t);
  const personal = '# Personal rules\n';
  const agents = f.write('.codex/AGENTS.md', personal);
  f.ok('install.js');
  const edited = fs
    .readFileSync(agents, 'utf8')
    .replace(BLOCK_END, `Personal block edit.\n${BLOCK_END}`);
  fs.writeFileSync(agents, edited);
  const before = new Map(
    listSourceFiles(f.home).map((file) => [file, fs.readFileSync(path.join(f.home, file))])
  );
  const rejected = f.run('install.js');
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /unowned or edited auto-cli block/);
  assert.deepEqual(listSourceFiles(f.home), [...before.keys()]);
  for (const [file, value] of before)
    assert.deepEqual(fs.readFileSync(path.join(f.home, file)), value, file);
  f.ok('uninstall.js');
  assert.equal(fs.readFileSync(agents, 'utf8'), edited);
  const retained = JSON.parse(
    fs.readFileSync(path.join(f.home, '.codex/auto-cli/install-manifest.json'), 'utf8')
  );
  assert.deepEqual(
    retained.files.map((file) => file.path),
    ['AGENTS.md']
  );
});

test('invalid settings fail before any host is modified', (t) => {
  const f = fixture(t);
  const agents = f.write('.codex/AGENTS.md', 'personal');
  const prompt = f.write('.codex/prompts/auto.md', 'old prompt');
  const settings = f.write('.claude/settings.json', '{"hooks":');
  const result = f.run('install.js', '--clean');
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(agents, 'utf8'), 'personal');
  assert.equal(fs.readFileSync(prompt, 'utf8'), 'old prompt');
  assert.equal(fs.readFileSync(settings, 'utf8'), '{"hooks":');
  assert.equal(fs.existsSync(path.join(f.home, '.claude/commands/auto.md')), false);
});

test('symlink destination is rejected before writes outside the host', (t) => {
  const f = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-install-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const sentinel = path.join(outside, 'api-design', 'SKILL.md');
  fs.mkdirSync(path.dirname(sentinel));
  fs.writeFileSync(sentinel, 'outside');
  fs.symlinkSync(outside, path.join(f.home, '.codex', 'skills'), 'junction');
  const result = f.run('install.js', '--clean');
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'outside');
  assert.equal(fs.existsSync(path.join(f.home, '.claude/commands/auto.md')), false);
});

test('source discovery rejects a junction at the selected top-level directory', (t) => {
  const f = fixture(t);
  const source = path.join(f.home, 'source');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'source');
  fs.symlinkSync(source, path.join(f.home, 'skills'), 'junction');
  assert.throws(() => listSourceFiles(f.home, 'skills'), /Source symlinks are not supported/);
});

test('uninstall preserves files modified after installation and removes stale tagged hooks', (t) => {
  const f = fixture(t);
  const settingsPath = f.write(
    '.claude/settings.json',
    JSON.stringify({
      hooks: { OldEvent: [{ _source: 'auto-cli', hooks: [] }, { hooks: [{ command: 'user' }] }] }
    })
  );
  f.ok('install.js');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.deepEqual(settings.hooks.OldEvent, [{ hooks: [{ command: 'user' }] }]);
  const edited = f.write('.codex/skills/api-design/SKILL.md', 'my custom version');
  f.ok('uninstall.js');
  assert.equal(fs.readFileSync(edited, 'utf8'), 'my custom version');
});

test('installs runnable ESM tooling with version and per-file hashes', (t) => {
  const f = fixture(t);
  f.ok('install.js');
  for (const host of ['.claude', '.codex']) {
    const runtime = path.join(f.home, host, 'auto-cli');
    const receipt = JSON.parse(
      fs.readFileSync(path.join(runtime, 'install-manifest.json'), 'utf8')
    );
    assert.equal(receipt.schemaVersion, 1);
    assert.equal(
      receipt.packageVersion,
      JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'))).version
    );
    assert.ok(
      receipt.files.some(
        (file) =>
          file.path === 'auto-cli/scripts/validate-run-completeness.js' &&
          /^[a-f0-9]{64}$/.test(file.sha256)
      )
    );
    const result = spawnSync(
      process.execPath,
      [path.join(runtime, 'scripts/validate-run-completeness.js'), '--latest', '--allow-missing'],
      {
        encoding: 'utf8',
        env: { ...process.env, AUTO_CLI_TEST_ROOT: f.home }
      }
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
});

test('uninstall without a receipt preserves unowned same-name files and nested extras', (t) => {
  const f = fixture(t);
  const files = [
    f.write('.codex/AGENTS.md', 'private instructions'),
    f.write('.codex/skills/api-design/SKILL.md', 'third party'),
    f.write('.claude/commands/auto/local.md', 'local command'),
    f.write('.claude/skills/api-design.references/custom.md', 'personal reference')
  ];
  f.ok('uninstall.js');
  for (const file of files) assert.ok(fs.existsSync(file));
});

test('preflight rejects malformed hook arrays and traversal in an install receipt', (t) => {
  const f = fixture(t);
  const settings = f.write('.claude/settings.json', '{"hooks":{"Stop":{}}}');
  const original = f.write('.codex/prompts/auto.md', 'unchanged');
  assert.notEqual(f.run('install.js').status, 0);
  assert.equal(fs.readFileSync(original, 'utf8'), 'unchanged');
  fs.writeFileSync(settings, '{}');
  f.write(
    '.codex/auto-cli/install-manifest.json',
    JSON.stringify({
      schemaVersion: 1,
      package: 'auto-cli',
      host: 'codex',
      files: [{ path: '../outside', sha256: '0'.repeat(64) }]
    })
  );
  assert.notEqual(f.run('uninstall.js').status, 0);
  assert.equal(fs.readFileSync(original, 'utf8'), 'unchanged');
});

test('a forged receipt cannot claim host credentials or user configuration', (t) => {
  const f = fixture(t);
  const privateFile = f.write('.codex/config.toml', 'user configuration');
  f.write(
    '.codex/auto-cli/install-manifest.json',
    JSON.stringify({
      schemaVersion: 1,
      package: 'auto-cli',
      host: 'codex',
      files: [
        {
          path: 'config.toml',
          sha256: createHash('sha256').update('user configuration').digest('hex')
        }
      ]
    })
  );
  assert.notEqual(f.run('uninstall.js').status, 0);
  assert.equal(fs.readFileSync(privateFile, 'utf8'), 'user configuration');
});

test('unrecognized historical skill names are preserved even if claimed by a receipt', (t) => {
  const f = fixture(t);
  const personal = f.write('.codex/skills/personal/SKILL.md', 'personal skill');
  f.write(
    '.codex/auto-cli/install-manifest.json',
    JSON.stringify({
      schemaVersion: 1,
      package: 'auto-cli',
      host: 'codex',
      files: [
        {
          path: 'skills/personal/SKILL.md',
          source: 'skills/personal/SKILL.md',
          sha256: createHash('sha256').update('personal skill').digest('hex')
        }
      ]
    })
  );
  f.ok('uninstall.js');
  assert.equal(fs.readFileSync(personal, 'utf8'), 'personal skill');
});

test('upgrade removes stale owned files while retaining extras and is idempotent', (t) => {
  const f = fixture(t);
  f.ok('install.js');
  const stale = f.write('.codex/prompts/auto/obsolete.md', 'old managed command');
  const extra = f.write('.codex/prompts/auto/custom.md', 'personal command');
  const manifestPath = path.join(f.home, '.codex/auto-cli/install-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files.push({
    path: 'prompts/auto/obsolete.md',
    sha256: createHash('sha256').update('old managed command').digest('hex')
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  f.ok('install.js', '--clean');
  assert.equal(fs.existsSync(stale), false);
  assert.equal(fs.readFileSync(extra, 'utf8'), 'personal command');
  assert.match(f.ok('install.js', '--clean').stdout, /0 changes/);
});

test('transaction rolls back an I/O failure without losing either host configuration', (t) => {
  const f = fixture(t);
  const old = f.write('.codex/prompts/auto.md', 'old prompt');
  const plan = prepareInstall({
    name: 'codex',
    dir: path.join(f.home, '.codex'),
    isolationRoot: f.home,
    hasHooks: false,
    hasAgents: false
  });
  const originalRename = fs.renameSync;
  let injected = false;
  fs.renameSync = (source, destination) => {
    if (!injected && destination.endsWith(`${path.sep}SKILL.md`)) {
      injected = true;
      throw new Error('injected write failure');
    }
    return originalRename(source, destination);
  };
  try {
    assert.throws(() => applyPlans([plan]), /injected write failure/);
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(fs.readFileSync(old, 'utf8'), 'old prompt');
  assert.equal(fs.existsSync(path.join(f.home, '.codex/AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(f.home, '.codex/auto-cli/install-manifest.json')), false);
});

test('changes made after preflight stop installation and remain intact', (t) => {
  const f = fixture(t);
  const old = f.write('.codex/prompts/auto.md', 'old prompt');
  const plan = prepareInstall({
    name: 'codex',
    dir: path.join(f.home, '.codex'),
    isolationRoot: f.home,
    hasHooks: false,
    hasAgents: false
  });
  fs.writeFileSync(old, 'concurrent user edit');
  assert.throws(() => applyPlans([plan]), /changed during installation preflight/);
  assert.equal(fs.readFileSync(old, 'utf8'), 'concurrent user edit');
});

function smallPlan(f, values) {
  const root = path.join(f.home, '.codex');
  const entries = Object.entries(values);
  for (const [relative, value] of entries) f.write(`.codex/${relative}`, value);
  return {
    tool: { name: 'codex', dir: root, isolationRoot: f.home },
    operations: new Map(entries.map(([relative]) => [relative, Buffer.from('installed')])),
    expected: new Map(entries.map(([relative, value]) => [relative, Buffer.from(value)]))
  };
}

test('rollback preserves an external edit made after an earlier successful write', (t) => {
  const f = fixture(t);
  const plan = smallPlan(f, { 'first.md': 'original first', 'second.md': 'original second' });
  const first = path.join(f.home, '.codex/first.md');
  const originalRename = fs.renameSync;
  fs.renameSync = (source, destination) => {
    if (destination.endsWith(`${path.sep}second.md`)) {
      fs.writeFileSync(first, 'concurrent user edit');
      throw new Error('injected operation failure');
    }
    return originalRename(source, destination);
  };
  try {
    assert.throws(
      () => applyPlans([plan]),
      /rollback incomplete: concurrent edit preserved: first.md/
    );
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(fs.readFileSync(first, 'utf8'), 'concurrent user edit');
});

test('rollback continues restoring independent files after a restore I/O failure', (t) => {
  const f = fixture(t);
  const plan = smallPlan(f, {
    'first.md': 'original first',
    'second.md': 'original second',
    'third.md': 'original third'
  });
  const originalRename = fs.renameSync;
  let recovering = false;
  fs.renameSync = (source, destination) => {
    if (destination.endsWith(`${path.sep}third.md`)) {
      recovering = true;
      throw new Error('injected operation failure');
    }
    if (recovering && destination.endsWith(`${path.sep}second.md`))
      throw new Error('injected restore failure');
    return originalRename(source, destination);
  };
  try {
    assert.throws(() => applyPlans([plan]), /rollback incomplete: restore failed: second.md/);
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(fs.readFileSync(path.join(f.home, '.codex/first.md'), 'utf8'), 'original first');
  assert.equal(fs.readFileSync(path.join(f.home, '.codex/second.md'), 'utf8'), 'installed');
});

test('rollback refuses a newly inserted junction instead of restoring outside the host', (t) => {
  const f = fixture(t);
  const plan = smallPlan(f, { 'owned/first.md': 'original first', 'second.md': 'original second' });
  const owned = path.join(f.home, '.codex/owned');
  const moved = path.join(f.home, '.codex/owned-before-junction');
  const outside = path.join(f.home, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'first.md'), 'outside sentinel');
  const originalRename = fs.renameSync;
  fs.renameSync = (source, destination) => {
    if (destination.endsWith(`${path.sep}second.md`)) {
      assert.ok(path.relative(f.home, owned).startsWith(`.codex${path.sep}`));
      assert.ok(path.relative(f.home, moved).startsWith(`.codex${path.sep}`));
      originalRename(owned, moved);
      fs.symlinkSync(outside, owned, 'junction');
      throw new Error('injected operation failure');
    }
    return originalRename(source, destination);
  };
  try {
    assert.throws(() => applyPlans([plan]), /rollback incomplete: restore failed: owned\/first.md/);
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(fs.readFileSync(path.join(outside, 'first.md'), 'utf8'), 'outside sentinel');
});
