import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../hooks/lib/auto-clean-runs.sh', import.meta.url));
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-archive-candidates-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const initialized = spawnSync('git', ['init', '-q'], { cwd, encoding: 'utf8' });
  assert.equal(initialized.status, 0, initialized.stderr);
  const runs = path.join(cwd, '.auto', 'runs');
  const write = (relative, contents) => {
    const file = path.join(runs, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  };
  const run = (overrides = {}) =>
    spawnSync(bash, [script.replaceAll('\\', '/')], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        AUTO_RUNS_DIR: '.auto/runs',
        AUTO_CLEAN_RETENTION_DAYS: '30',
        AUTO_CLEAN_DRY_RUN: '',
        ...overrides
      }
    });
  return { cwd, runs, write, run };
}

function tree(directory) {
  if (!fs.existsSync(directory)) return null;
  return fs
    .readdirSync(directory)
    .sort()
    .map((name) => {
      const file = path.join(directory, name);
      return fs.statSync(file).isDirectory()
        ? [name, tree(file)]
        : [name, fs.readFileSync(file).toString('base64')];
    });
}

test('SessionStart archive helper only lists old candidates without creating an archive', (t) => {
  const f = fixture(t);
  f.write('run-20000101-old/index.md', 'status: completed');
  f.write('run-29990101-future/index.md', 'status: running');
  f.write('unknown-name/index.md', 'keep');
  const before = tree(f.runs);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Candidate.*run-20000101-old/);
  assert.doesNotMatch(result.stderr, /Candidate.*run-29990101-future|Archived:/);
  assert.match(result.stderr, /No files moved/);
  assert.deepEqual(tree(f.runs), before);
  assert.equal(fs.existsSync(path.join(f.runs, 'archive')), false);
});

test('explicit old flags cannot move active runs or merge same-name archive directories', (t) => {
  const f = fixture(t);
  for (const status of ['running', 'partial', 'blocked'])
    f.write(`run-20000101-${status}/index.md`, `status: ${status}`);
  f.write('archive/run-20000101-running/index.md', 'older independent artifact');
  const before = tree(f.runs);
  for (const dryRun of ['false', 'true']) {
    const result = f.run({ AUTO_CLEAN_DRY_RUN: dryRun, AUTO_CLEAN_ENABLED: 'true' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /active-state.*dependenc/);
    assert.deepEqual(tree(f.runs), before);
  }
});

test('retention input is validated before date or language fallback evaluation', (t) => {
  const f = fixture(t);
  f.write('run-20000101-old/index.md', 'keep');
  const before = tree(f.runs);
  for (const value of ['-1', '0', '1;throw Error()', 'x', '999999999999999999999999']) {
    const result = f.run({ AUTO_CLEAN_RETENTION_DAYS: value });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RETENTION_DAYS/);
    assert.deepEqual(tree(f.runs), before);
  }
});
