import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { VERSION_FILES, validateVersions } from '../../scripts/release-checks.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const checker = path.join(root, 'scripts', 'release-checks.js');

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function command(directory, program, args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(program, args, {
    cwd: directory,
    encoding: 'utf8',
    env,
    maxBuffer: 16e6
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function fixture(
  t,
  {
    failingTest = false,
    missingBridge = false,
    omitBridge = false,
    wrongVersion = false,
    ignoredPackageFile = false
  } = {}
) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli release fixture '));
  const directory = path.join(temporary, 'source');
  const output = path.join(temporary, 'artifacts');
  fs.mkdirSync(directory);
  const pkg = {
    name: 'auto-cli-release-fixture',
    version: '1.0.0',
    files: ['AGENTS.md', '.claude-plugin', 'commands', 'scripts'],
    scripts: { test: 'node --test test.cjs' }
  };
  if (ignoredPackageFile) {
    pkg.files.push('local-only.txt');
    fs.writeFileSync(path.join(directory, '.gitignore'), 'local-only.txt\n');
  }
  writeJson(path.join(directory, 'package.json'), pkg);
  writeJson(path.join(directory, 'package-lock.json'), {
    name: pkg.name,
    version: pkg.version,
    lockfileVersion: 3,
    requires: true,
    packages: { '': { name: pkg.name, version: pkg.version } }
  });
  const files = [
    'AGENTS.md',
    'commands/auto.codex.md',
    ...['doctor', 'learn', 'route', 'status'].map((name) => `commands/auto/${name}.codex.md`),
    ...(missingBridge ? [] : ['scripts/templates/codex-global-bridge.md'])
  ];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), `Fixture ${file}\n`);
  }
  fs.mkdirSync(path.join(directory, '.claude-plugin'));
  writeJson(path.join(directory, '.claude-plugin/plugin.json'), {
    name: pkg.name,
    version: wrongVersion ? '0.9.0' : pkg.version
  });
  writeJson(path.join(directory, '.claude-plugin/marketplace.json'), {
    name: 'release-fixture-marketplace',
    plugins: [{ name: pkg.name, source: './' }]
  });
  fs.writeFileSync(
    path.join(directory, 'test.cjs'),
    `require('node:test')('release check fixture', () => { ${failingTest ? "throw new Error('DELIBERATE_UNIT_FAILURE');" : ''} });\n`
  );
  if (omitBridge)
    fs.writeFileSync(
      path.join(directory, 'scripts/.npmignore'),
      'templates/codex-global-bridge.md\n'
    );
  command(directory, 'git', ['init', '--quiet']);
  command(directory, 'git', ['config', 'core.autocrlf', 'false']);
  command(directory, 'git', ['config', 'core.hooksPath', path.join(directory, '.git', 'no-hooks')]);
  command(directory, 'git', ['config', 'commit.gpgsign', 'false']);
  command(directory, 'git', ['config', 'user.name', 'Release test fixture']);
  command(directory, 'git', ['config', 'user.email', 'release-fixture@example.invalid']);
  command(directory, 'git', ['add', '.']);
  command(directory, 'git', ['commit', '--quiet', '-m', 'fixture source']);
  const sourceSha = command(directory, 'git', ['rev-parse', 'HEAD']);
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  return { directory, output, sourceSha, sentinel: path.join(temporary, 'mutation-sentinel') };
}

function check(f, action, extra = []) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(
    process.execPath,
    [checker, action, '--root', f.directory, '--output', f.output, ...extra],
    {
      cwd: f.directory,
      encoding: 'utf8',
      env,
      maxBuffer: 16e6
    }
  );
}

function prepare(f) {
  let result = check(f, 'preflight', ['--source', f.sourceSha]);
  if (result.status !== 0) return result;
  result = check(f, 'bump', ['--bump', 'patch']);
  if (result.status !== 0) return result;
  command(f.directory, 'git', ['add', ...VERSION_FILES]);
  return check(f, 'prepare');
}

function mutationSentinel(f, result) {
  if (result.status === 0) fs.writeFileSync(f.sentinel, 'remote mutation would now be eligible\n');
  return fs.existsSync(f.sentinel);
}

test('a real failed unit test removes stale preflight success and prevents the mutation sentinel', (t) => {
  const f = fixture(t, { failingTest: true });
  fs.mkdirSync(f.output);
  writeJson(path.join(f.output, 'preflight.json'), { stale: true });
  const result = prepare(f);
  assert.equal(result.status, 1);
  assert.match(result.stderr + result.stdout, /DELIBERATE_UNIT_FAILURE/);
  assert.equal(mutationSentinel(f, result), false);
  assert.equal(fs.existsSync(path.join(f.output, 'preflight.json')), false);
  t.diagnostic('real npm test failed; mutation sentinel and success receipt absent');
});

test('a missing bridge source and an omitted bridge archive both prevent the mutation sentinel', (t) => {
  for (const defect of [{ missingBridge: true }, { omitBridge: true }]) {
    const f = fixture(t, defect);
    const result = prepare(f);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /scripts\/templates\/codex-global-bridge\.md/);
    assert.equal(mutationSentinel(f, result), false);
    assert.equal(fs.existsSync(path.join(f.output, 'release.json')), false);
  }
  t.diagnostic(
    'two real npm packs rejected: absent source and source omitted from archive; no mutation sentinel'
  );
});

test('a Claude plugin version mismatch prevents the mutation sentinel', (t) => {
  const f = fixture(t, { wrongVersion: true });
  const result = prepare(f);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Version mismatch in .claude-plugin\/plugin.json/);
  assert.equal(mutationSentinel(f, result), false);
});

test('version validation rejects either lockfile version independently', (t) => {
  const f = fixture(t);
  const lockPath = path.join(f.directory, 'package-lock.json');
  const original = JSON.parse(fs.readFileSync(lockPath));
  for (const field of ['version', 'root-package']) {
    const lock = structuredClone(original);
    if (field === 'version') lock.version = '2.0.0';
    else lock.packages[''].version = '2.0.0';
    writeJson(lockPath, lock);
    assert.throws(() => validateVersions(f.directory), /Version mismatch/);
  }
});

test('one checked tarball stays tied to the pinned source and final release commit', (t) => {
  const f = fixture(t);
  const prepared = prepare(f);
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  const receipt = JSON.parse(fs.readFileSync(path.join(f.output, 'release.json')));
  assert.equal(receipt.sourceSha, f.sourceSha);
  assert.equal(receipt.version, '1.0.1');
  assert.equal(validateVersions(f.directory), '1.0.1');
  command(f.directory, 'git', ['commit', '--quiet', '-m', 'fixture version bump']);
  const verified = check(f, 'verify');
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(mutationSentinel(f, verified), true);
  fs.rmSync(f.sentinel);
  fs.appendFileSync(path.join(f.output, receipt.tarball), 'tampered archive');
  const tampered = check(f, 'verify');
  assert.equal(tampered.status, 1);
  assert.match(tampered.stderr, /checksum mismatch/);
  assert.equal(mutationSentinel(f, tampered), false);
  t.diagnostic(
    'valid source -> version-only commit -> exact archive accepted; modified archive blocked'
  );
});

test('unverified content cannot enter the prepared or final release tree', (t) => {
  const f = fixture(t);
  const prepared = prepare(f);
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  fs.appendFileSync(path.join(f.directory, 'AGENTS.md'), 'unverified content\n');
  command(f.directory, 'git', ['add', 'AGENTS.md']);
  const reprepare = check(f, 'prepare');
  assert.equal(reprepare.status, 1);
  assert.match(reprepare.stderr, /Only release version manifests/);
  assert.equal(mutationSentinel(f, reprepare), false);
  assert.equal(fs.existsSync(path.join(f.output, 'release.json')), false);
});

test('a changed final commit tree is rejected even when the archive is untouched', (t) => {
  const f = fixture(t);
  const prepared = prepare(f);
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  fs.appendFileSync(path.join(f.directory, 'AGENTS.md'), 'changed after packaging\n');
  command(f.directory, 'git', ['add', 'AGENTS.md']);
  command(f.directory, 'git', ['commit', '--quiet', '-m', 'fixture unexpected content']);
  const result = check(f, 'verify');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /commit tree differs/);
  assert.equal(mutationSentinel(f, result), false);
});

test('ignored local files cannot enter an archive tied to the checked Git tree', (t) => {
  const f = fixture(t, { ignoredPackageFile: true });
  const preflight = check(f, 'preflight', ['--source', f.sourceSha]);
  assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
  const bumped = check(f, 'bump', ['--bump', 'patch']);
  assert.equal(bumped.status, 0, bumped.stderr || bumped.stdout);
  fs.writeFileSync(path.join(f.directory, 'local-only.txt'), 'Unverified local content\n');
  command(f.directory, 'git', ['add', ...VERSION_FILES]);
  const result = check(f, 'prepare');
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /outside the checked Git tree: local-only\.txt/);
  assert.equal(mutationSentinel(f, result), false);
  assert.equal(fs.existsSync(path.join(f.output, 'release.json')), false);
});

test('preflight rejects a different input commit before running checks', (t) => {
  const f = fixture(t);
  const result = check(f, 'preflight', ['--source', '0'.repeat(40)]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HEAD differs from pinned SHA/);
  assert.equal(mutationSentinel(f, result), false);
});

test('CI and release declarations preserve mandatory checks and checked-artifact publication', () => {
  const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  const release = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  assert.match(ci, /workflow_call:/);
  assert.match(ci, /os: \[ubuntu-latest, windows-latest\]/);
  assert.match(ci, /node-version: \['18', '22', '24'\]/);
  assert.match(ci, /run: npm test/);
  assert.match(release, /uses: \.\/\.github\/workflows\/ci.yml/);
  assert.match(release, /needs: checks/);
  assert.match(release, /ref: \$\{\{ github.sha \}\}/);
  assert.doesNotMatch(release, /continue-on-error|always\(\)/);
  const validation = release.indexOf('release-checks.js verify');
  const push = release.indexOf('git push --atomic');
  const publish = release.indexOf('npm publish "$RELEASE_TARBALL"');
  assert.ok(validation >= 0 && push > validation && publish > push);
  assert.match(release, /release-checks.js prepare/);
});
