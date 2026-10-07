import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(root, 'hooks/lib/snapshot.cjs');
function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fixture(t, commit = true) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-snapshot space-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const dir = path.join(parent, 'source');
  fs.mkdirSync(dir);
  git(dir, 'init', '-q');
  git(dir, 'config', 'core.autocrlf', 'false');
  if (commit) {
    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'base\n');
    git(dir, 'add', '.');
    git(
      dir,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-qm',
      'base'
    );
  }
  return { parent, dir };
}
function run(dir, ...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 20000
  });
}
function create(dir) {
  const result = run(dir, 'create');
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function addUntracked(dir) {
  fs.mkdirSync(path.join(dir, 'new folder'), { recursive: true });
  for (const name of ['a.txt', 'b.txt', '中文.txt'])
    fs.writeFileSync(path.join(dir, 'new folder', name), `untracked ${name}\r\n`);
}
function status(dir) {
  return git(dir, 'status', '--porcelain=v1', '--untracked-files=all');
}

for (const mode of ['mixed', 'only untracked', 'unborn']) {
  test(`snapshot preserves and independently restores ${mode} state`, (t) => {
    const { parent, dir } = fixture(t, mode !== 'unborn');
    addUntracked(dir);
    if (mode === 'mixed') {
      fs.writeFileSync(path.join(dir, 'tracked.txt'), 'staged\n');
      git(dir, 'add', 'tracked.txt');
      fs.writeFileSync(path.join(dir, 'tracked.txt'), 'working\r\n');
    }
    const before = status(dir);
    const indexPath = path.join(dir, '.git/index');
    const indexBefore = fs.existsSync(indexPath) ? fs.readFileSync(indexPath) : null;
    const snapshot = create(dir);
    assert.match(snapshot.ref, /^refs\/auto-snapshots\//);
    assert.equal(status(dir), before);
    if (indexBefore) assert.deepEqual(fs.readFileSync(indexPath), indexBefore);
    else assert.equal(fs.existsSync(indexPath), false);
    const dest = path.join(parent, 'independent recovery');
    const restored = run(dir, 'restore', snapshot.ref, dest);
    assert.equal(restored.status, 0, restored.stderr);
    assert.equal(status(dest), before);
    for (const name of ['a.txt', 'b.txt', '中文.txt'])
      assert.deepEqual(
        fs.readFileSync(path.join(dest, 'new folder', name)),
        fs.readFileSync(path.join(dir, 'new folder', name))
      );
    if (mode === 'mixed') {
      assert.equal(git(dest, 'show', ':tracked.txt'), 'staged');
      assert.equal(fs.readFileSync(path.join(dest, 'tracked.txt'), 'utf8'), 'working\r\n');
    }
    assert.equal(status(dir), before);
    assert.notEqual(run(dir, 'restore', snapshot.ref, dest).status, 0);
  });
}

test('snapshot from worktree subdirectory resolves its own index and root', (t) => {
  const { parent, dir } = fixture(t);
  const worktree = path.join(parent, 'linked worktree');
  git(dir, 'worktree', 'add', '-q', '-b', 'fixture', worktree);
  addUntracked(worktree);
  const before = status(worktree);
  const snapshot = create(path.join(worktree, 'new folder'));
  const dest = path.join(parent, 'recovered');
  const result = run(worktree, 'restore', snapshot.ref, dest);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(status(dest), before);
  assert.equal(status(worktree), before);
  assert.equal(status(dir), '');
});

test('concurrent snapshots never overwrite a ref and preserve files', async (t) => {
  const { dir } = fixture(t);
  addUntracked(dir);
  const before = status(dir);
  const call = () =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [cli, 'create'], { cwd: dir });
      let stdout = '',
        stderr = '';
      child.stdout.on('data', (data) => (stdout += data));
      child.stderr.on('data', (data) => (stderr += data));
      child.on('close', (status) => resolve({ status, stdout, stderr }));
    });
  const results = await Promise.all([call(), call(), call()]);
  const success = results
    .filter((result) => result.status === 0)
    .map((result) => JSON.parse(result.stdout));
  assert.ok(success.length >= 1, JSON.stringify(results));
  assert.equal(new Set(success.map((item) => item.ref)).size, success.length);
  for (const result of results.filter((item) => item.status !== 0))
    assert.match(result.stderr, /lock|busy/i);
  for (const item of success) assert.equal(git(dir, 'rev-parse', item.ref), item.sha);
  assert.equal(status(dir), before);
});

test('pre-existing index lock fails explicitly without creating a ref', (t) => {
  const { dir } = fixture(t);
  addUntracked(dir);
  fs.writeFileSync(path.join(dir, '.git/index.lock'), 'owned by somebody else');
  const result = run(dir, 'create');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /lock|busy/i);
  assert.equal(git(dir, 'for-each-ref', 'refs/auto-snapshots'), '');
  assert.equal(
    fs.readFileSync(path.join(dir, '.git/index.lock'), 'utf8'),
    'owned by somebody else'
  );
});

test('staged rename, deletion, new binary and split index survive independent restoration', (t) => {
  const { parent, dir } = fixture(t);
  fs.writeFileSync(path.join(dir, 'delete.txt'), 'delete me');
  git(dir, 'add', '.');
  git(
    dir,
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'second'
  );
  git(dir, 'mv', 'tracked.txt', 'renamed.txt');
  git(dir, 'rm', 'delete.txt');
  const binary = Buffer.from([0, 255, 13, 10, 20, 127]);
  fs.writeFileSync(path.join(dir, 'binary'), binary);
  git(dir, 'add', 'binary');
  fs.writeFileSync(path.join(dir, 'renamed.txt'), 'unstaged after rename\n');
  git(dir, 'update-index', '--split-index');
  const before = status(dir);
  const snapshot = create(dir);
  const destination = path.join(parent, 'portable');
  const result = run(dir, 'restore', snapshot.ref, destination);
  assert.equal(result.status, 0, result.stderr);
  fs.renameSync(dir, path.join(parent, 'source moved away'));
  assert.equal(status(destination), before);
  assert.deepEqual(fs.readFileSync(path.join(destination, 'binary')), binary);
  assert.equal(git(destination, 'show', ':renamed.txt'), 'base');
  assert.equal(fs.existsSync(path.join(destination, 'delete.txt')), false);
  assert.equal(fs.existsSync(path.join(destination, '.git/objects/info/alternates')), false);
});

test('snapshot preserves index flags and intent-to-add entries', (t) => {
  const { parent, dir } = fixture(t);
  fs.writeFileSync(path.join(dir, 'intent.txt'), 'not staged');
  git(dir, 'add', '-N', 'intent.txt');
  git(dir, 'update-index', '--assume-unchanged', 'tracked.txt');
  addUntracked(dir);
  const flags = git(dir, 'ls-files', '-v');
  const before = status(dir);
  const snapshot = create(dir);
  const target = path.join(parent, 'flags');
  const result = run(dir, 'restore', snapshot.ref, target);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(target, 'ls-files', '-v'), flags);
  assert.equal(status(target), before);
});

test('recovery rejects targets inside source without mutation', (t) => {
  const { dir } = fixture(t);
  addUntracked(dir);
  const snapshot = create(dir);
  const target = path.join(dir, 'unsafe');
  const result = run(dir, 'restore', snapshot.ref, target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside/);
  assert.equal(fs.existsSync(target), false);
});

test('recovery ignores inherited Git routing variables and preserves the source index', (t) => {
  const { parent, dir } = fixture(t);
  addUntracked(dir);
  const snapshot = create(dir);
  const target = path.join(parent, 'safe despite environment');
  const index = fs.readFileSync(path.join(dir, '.git/index'));
  const result = spawnSync(process.execPath, [cli, 'restore', snapshot.ref, target], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_DIR: path.join(dir, '.git'),
      GIT_WORK_TREE: dir,
      GIT_INDEX_FILE: path.join(dir, '.git/index')
    }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readFileSync(path.join(dir, '.git/index')), index);
  assert.equal(status(target), status(dir));
});

test('sha256 repositories retain their object format on restoration', (t) => {
  const { parent, dir } = fixture(t, false);
  fs.rmSync(path.join(dir, '.git'), { recursive: true, force: true });
  git(dir, 'init', '-q', '--object-format=sha256');
  addUntracked(dir);
  const snapshot = create(dir);
  const target = path.join(parent, 'sha256 recovery');
  const result = run(dir, 'restore', snapshot.ref, target);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(target, 'rev-parse', '--show-object-format'), 'sha256');
  assert.equal(status(target), status(dir));
});

test('files beyond the recovery size limit fail before publishing a snapshot ref', (t) => {
  const { dir } = fixture(t);
  const file = path.join(dir, 'oversized');
  const handle = fs.openSync(file, 'w');
  fs.ftruncateSync(handle, 64 * 1024 * 1024 + 1);
  fs.closeSync(handle);
  const result = run(dir, 'create');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /64 MiB/);
  assert.equal(git(dir, 'for-each-ref', 'refs/auto-snapshots'), '');
  assert.equal(fs.statSync(file).size, 64 * 1024 * 1024 + 1);
  assert.equal(fs.existsSync(path.join(dir, '.git/index.lock')), false);
});
