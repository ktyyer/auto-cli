import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { discoverTestFiles } from '../../scripts/run-unit-tests.js';

const runner = fileURLToPath(new URL('../../scripts/run-unit-tests.js', import.meta.url));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli test runner '));
  fs.mkdirSync(path.join(root, 'tests', 'scripts'), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('unit discovery returns sorted explicit test files and rejects an empty suite', (t) => {
  const root = fixture(t);
  assert.throws(() => discoverTestFiles(root), /No unit test files/);
  for (const file of ['z.test.js', 'a.test.js', 'helper.js']) {
    fs.writeFileSync(path.join(root, 'tests', 'scripts', file), '');
  }
  fs.mkdirSync(path.join(root, 'tests', 'scripts', 'directory.test.js'));
  assert.deepEqual(discoverTestFiles(root), [
    path.join(root, 'tests', 'scripts', 'a.test.js'),
    path.join(root, 'tests', 'scripts', 'z.test.js')
  ]);
});

test('portable runner executes every discovered file and propagates a failed test', (t) => {
  const root = fixture(t);
  fs.writeFileSync(
    path.join(root, 'tests', 'scripts', 'a.test.js'),
    "require('node:test')('first test', () => {});\n"
  );
  fs.writeFileSync(
    path.join(root, 'tests', 'scripts', 'z.test.js'),
    "require('node:test')('deliberate failure', () => { throw new Error('release must stop'); });\n"
  );
  const result = spawnSync(process.execPath, [runner, '--test-reporter=tap'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /first test/);
  assert.match(result.stdout, /deliberate failure/);
  assert.match(result.stdout, /# tests 2/);
  assert.match(result.stdout, /# fail 1/);
});

test('portable runner fails when discovery has no test files', (t) => {
  const root = fixture(t);
  const result = spawnSync(process.execPath, [runner], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No unit test files/);
});
