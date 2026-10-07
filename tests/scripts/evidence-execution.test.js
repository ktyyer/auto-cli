import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectEvidence } from '../../scripts/evidence-collect.js';
import {
  validateEvidence,
  parseNodeTap,
  snapshotTree,
  validateSelection
} from '../../scripts/evidence-record.js';
import { readRunProtocol } from '../../scripts/run-protocol.js';
import { protocolRun, writeProtocolRun } from '../fixtures/protocol-run.js';

const collector = fileURLToPath(new URL('../../scripts/evidence-collect.js', import.meta.url));

function fixture(t, source = "const test = require('node:test'); test('real', () => {});") {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-evidence-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const runDir = path.join(cwd, '.auto', 'runs', 'run-evidence');
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(cwd, 'case.test.cjs'), source);
  fs.writeFileSync(path.join(cwd, 'app.cjs'), 'module.exports = 1;');
  const options = { cwd, runDir, questId: 'Q1', id: 'tests', tests: ['case.test.cjs'] };
  return { cwd, runDir, options };
}

function check(f, recordPath) {
  return validateEvidence(recordPath, { cwd: f.cwd, runId: 'run-evidence', questId: 'Q1' });
}

test('collector executes Node tests, preserves process output and binds the final tree', async (t) => {
  const f = fixture(
    t,
    "const test = require('node:test'); test('real', () => { console.error('stderr marker'); });"
  );
  const result = await collectEvidence(f.options);
  assert.equal(result.exitCode, 0);
  const record = JSON.parse(fs.readFileSync(result.recordPath, 'utf8'));
  assert.equal(record.runId, 'run-evidence');
  assert.equal(record.questId, 'Q1');
  assert.equal(record.command.executable, process.execPath);
  assert.deepEqual(record.command.args, ['--test', '--test-reporter=tap', '--', 'case.test.cjs']);
  assert.equal(record.tests.discovered, 1);
  assert.equal(record.tests.executed, 1);
  assert.ok(record.durationMs >= 0);
  assert.ok(record.source.collectorSha256);
  assert.ok(fs.existsSync(path.join(f.runDir, record.logs.stderr.path)));
  const verified = check(f, result.recordPath);
  assert.deepEqual(verified.issues, []);
  assert.equal(verified.level, 'local-consistency-only');
  assert.equal(verified.passed, true);
});

test('zero tests, all skipped, TODO and failures never pass', async (t) => {
  const cases = [
    ['', /no executed tests/],
    ["require('node:test').skip('skip', () => {});", /no executed tests/],
    ["require('node:test').todo('later');", /no executed tests/],
    ["require('node:test')('bad', () => { throw Error('baseline red'); });", /test command failed/]
  ];
  for (const [source, issue] of cases) {
    const f = fixture(t, source);
    const result = await collectEvidence(f.options);
    const verified = check(f, result.recordPath);
    assert.equal(verified.passed, false);
    assert.match(verified.issues.join('\n'), issue);
  }
});

test('edited, added, deleted test/source/config files invalidate prior evidence', async (t) => {
  for (const mutate of [
    (cwd) => fs.appendFileSync(path.join(cwd, 'app.cjs'), '\n// edit'),
    (cwd) => fs.writeFileSync(path.join(cwd, 'new-untracked.cjs'), 'new'),
    (cwd) => fs.writeFileSync(path.join(cwd, '.test-config'), 'new'),
    (cwd) => fs.unlinkSync(path.join(cwd, 'case.test.cjs'))
  ]) {
    const f = fixture(t);
    const result = await collectEvidence(f.options);
    mutate(f.cwd);
    assert.match(check(f, result.recordPath).issues.join('\n'), /file state changed/);
  }
});

test('test changing the bound tree while it runs is rejected', async (t) => {
  const f = fixture(
    t,
    "require('node:test')('writes', () => require('node:fs').writeFileSync('app.cjs', 'changed'));"
  );
  const result = await collectEvidence(f.options);
  assert.equal(result.exitCode, 0);
  assert.match(check(f, result.recordPath).issues.join('\n'), /changed during execution/);
});

test('missing and altered logs, absent discovery and forged summary are rejected', async (t) => {
  const mutations = [
    (r, f) => fs.unlinkSync(path.join(f.runDir, r.logs.stdout.path)),
    (r, f) => fs.appendFileSync(path.join(f.runDir, r.logs.stdout.path), '\npass'),
    (r) => {
      delete r.tests.discovered;
    },
    (r) => {
      r.tests.executed = 999;
    },
    (r) => {
      r.command.executable = 'echo';
    },
    (r) => {
      r.trust = 'trusted-ci';
    }
  ];
  for (const mutate of mutations) {
    const f = fixture(t);
    const result = await collectEvidence(f.options);
    const record = JSON.parse(fs.readFileSync(result.recordPath, 'utf8'));
    mutate(record, f);
    fs.writeFileSync(result.recordPath, JSON.stringify(record));
    assert.equal(check(f, result.recordPath).passed, false, JSON.stringify(record));
  }
  assert.ok(parseNodeTap('PASS\n# tests 10\n# pass 10\n').issues.length);
});

test('records cannot be replayed against another run, quest or cwd', async (t) => {
  const f = fixture(t);
  const result = await collectEvidence(f.options);
  for (const mismatch of [
    { runId: 'run-other' },
    { questId: 'Q2' },
    { cwd: path.dirname(f.cwd) }
  ]) {
    assert.equal(
      validateEvidence(result.recordPath, {
        cwd: f.cwd,
        runId: 'run-evidence',
        questId: 'Q1',
        ...mismatch
      }).passed,
      false
    );
  }
});

test('CLI uses argument arrays, preserves the test exit code and rejects non-test commands', (t) => {
  const f = fixture(t, "require('node:test')('bad', () => { throw Error('bad'); });");
  const result = spawnSync(
    process.execPath,
    [collector, '--run-dir', f.runDir, '--quest', 'Q1', '--id', 'cli', '--test', 'case.test.cjs'],
    { cwd: f.cwd, encoding: 'utf8' }
  );
  assert.equal(result.status, 1, result.stderr);
  const record = JSON.parse(fs.readFileSync(path.join(f.runDir, 'evidence-cli.json'), 'utf8'));
  assert.equal(record.exitCode, 1);
  const rejected = spawnSync(
    process.execPath,
    [
      collector,
      '--run-dir',
      f.runDir,
      '--quest',
      'Q1',
      '--id',
      'injection',
      '--test',
      'case.test.cjs; echo pass'
    ],
    { cwd: f.cwd, encoding: 'utf8' }
  );
  assert.equal(rejected.status, 2);
  assert.equal(fs.existsSync(path.join(f.runDir, 'evidence-injection.json')), false);
});

test('strict run protocol requires execution references; old protocol is readable but unverified', async (t) => {
  const f = fixture(t);
  const docs = protocolRun('run-evidence');
  docs['verify-report.md'].gateResults = [
    { name: 'test', status: 'pass', evidence: 'tests passed' }
  ];
  writeProtocolRun(f.cwd, 'run-evidence', docs);
  assert.deepEqual(readRunProtocol(f.runDir).issues, []);
  assert.equal(readRunProtocol(f.runDir).executionEvidence.status, 'not_checked');
  assert.match(
    readRunProtocol(f.runDir, { requireEvidence: true, cwd: f.cwd }).issues.join('\n'),
    /evidenceRefs/
  );
  const collected = await collectEvidence(f.options);
  docs['verify-report.md'].evidencePolicy = 'local-execution-v1';
  docs['verify-report.md'].gateResults[0].evidenceRefs = [path.basename(collected.recordPath)];
  writeProtocolRun(f.cwd, 'run-evidence', docs);
  const valid = readRunProtocol(f.runDir, { cwd: f.cwd });
  assert.deepEqual(valid.issues, []);
  assert.equal(valid.executionEvidence.status, 'local-consistent');
  fs.writeFileSync(path.join(f.cwd, 'app.cjs'), 'modified after green');
  assert.match(readRunProtocol(f.runDir, { cwd: f.cwd }).issues.join('\n'), /file state changed/);
});

test('strict not_applicable needs a textual reason and never means tests passed', (t) => {
  const f = fixture(t);
  const docs = protocolRun('run-evidence');
  docs['verify-report.md'].evidencePolicy = 'local-execution-v1';
  docs['verify-report.md'].overallStatus = 'not_applicable';
  docs['verify-report.md'].gateResults = [
    { name: 'test', status: 'not_applicable', evidence: { count: 0 } }
  ];
  writeProtocolRun(f.cwd, 'run-evidence', docs);
  assert.match(readRunProtocol(f.runDir, { cwd: f.cwd }).issues.join('\n'), /textual reason/);
  docs['verify-report.md'].gateResults[0].evidence =
    'Read-only documentation review; no executable behavior changed';
  writeProtocolRun(f.cwd, 'run-evidence', docs);
  const result = readRunProtocol(f.runDir, { cwd: f.cwd });
  assert.deepEqual(result.issues, []);
  assert.equal(result.executionEvidence.status, 'not_applicable');
});

test('nested suites and literal metacharacters in selected file names use the real runner', async (t) => {
  const f = fixture(
    t,
    "const { describe, it } = require('node:test'); describe('suite', () => { it('one', () => {}); it('two', () => {}); });"
  );
  fs.renameSync(path.join(f.cwd, 'case.test.cjs'), path.join(f.cwd, 'literal ; space.test.cjs'));
  f.options.tests = ['literal ; space.test.cjs'];
  const result = await collectEvidence(f.options);
  const checked = check(f, result.recordPath);
  assert.deepEqual(checked.issues, []);
  assert.equal(checked.record.tests.discovered, 2);
  assert.equal(checked.record.tests.suites, 1);
});

test('coherent rewriting is possible in a writable directory and never becomes attestation', async (t) => {
  const f = fixture(t);
  const result = await collectEvidence(f.options);
  fs.writeFileSync(path.join(f.cwd, 'app.cjs'), 'changed without rerunning');
  assert.equal(check(f, result.recordPath).passed, false);
  const record = JSON.parse(fs.readFileSync(result.recordPath, 'utf8'));
  // This intentionally demonstrates the boundary: hashes are not signatures.
  record.before = snapshotTree(f.cwd);
  record.after = record.before;
  fs.writeFileSync(result.recordPath, JSON.stringify(record));
  const local = check(f, result.recordPath);
  assert.equal(local.passed, true);
  assert.equal(local.level, 'local-consistency-only');
});

test('strict validator --root targets the project and rejects legacy evidence', async (t) => {
  const f = fixture(t);
  const validator = fileURLToPath(
    new URL('../../scripts/validate-run-completeness.js', import.meta.url)
  );
  const run = () =>
    spawnSync(
      process.execPath,
      [validator, '--root', f.cwd, '--run', 'run-evidence', '--require-evidence', '--json'],
      { encoding: 'utf8', env: { ...process.env, AUTO_CLI_TEST_ROOT: path.dirname(f.cwd) } }
    );
  const docs = protocolRun('run-evidence');
  docs['verify-report.md'].gateResults = [
    { name: 'test', status: 'pass', evidence: 'claimed pass' }
  ];
  writeProtocolRun(f.cwd, 'run-evidence', docs);
  assert.equal(run().status, 1);
  const collected = await collectEvidence(f.options);
  docs['verify-report.md'].gateResults[0].evidenceRefs = [path.basename(collected.recordPath)];
  writeProtocolRun(f.cwd, 'run-evidence', docs);
  const verified = run();
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
  assert.equal(JSON.parse(verified.stdout).executionEvidence.status, 'local-consistent');
  for (const file of Object.keys(docs))
    fs.writeFileSync(path.join(f.runDir, file), 'strategy goal quest gate confidence legacy');
  const legacy = run();
  assert.equal(legacy.status, 1);
  assert.match(
    JSON.parse(legacy.stdout).protocolIssues.join('\n'),
    /structured VerifyReport required/
  );
  const missing = spawnSync(
    process.execPath,
    [
      validator,
      '--root',
      path.join(f.cwd, 'empty'),
      '--latest',
      '--allow-missing',
      '--require-evidence',
      '--json'
    ],
    { encoding: 'utf8' }
  );
  assert.equal(missing.status, 1);
});

test('selection errors and accidental reuse cannot overwrite earlier evidence', async (t) => {
  const f = fixture(t);
  await assert.rejects(collectEvidence({ ...f.options, tests: [] }), /at least one/);
  await assert.rejects(
    collectEvidence({ ...f.options, tests: ['../outside.cjs'] }),
    /inside the bound/
  );
  await assert.rejects(
    collectEvidence({ ...f.options, tests: ['case.test.cjs', 'case.test.cjs'] }),
    /duplicate/
  );
  const result = await collectEvidence(f.options);
  const original = fs.readFileSync(result.recordPath);
  await assert.rejects(collectEvidence(f.options), /EEXIST/);
  assert.deepEqual(fs.readFileSync(result.recordPath), original);
});

test('baseline failure or skipped execution can be reported but cannot become overall success', (t) => {
  const f = fixture(t);
  for (const status of ['fail', 'warning', 'skipped']) {
    const docs = protocolRun('run-evidence');
    docs['verify-report.md'].evidencePolicy = 'local-execution-v1';
    docs['verify-report.md'].gateResults = [
      {
        name: 'test',
        status,
        evidence: 'baseline failed or adapter unavailable',
        recommendedNext: 'report limitation'
      }
    ];
    docs['verify-report.md'].overallStatus = 'partial';
    writeProtocolRun(f.cwd, 'run-evidence', docs);
    const honest = readRunProtocol(f.runDir, { cwd: f.cwd });
    assert.deepEqual(honest.issues, []);
    assert.equal(honest.executionEvidence.status, 'not_passed');
    docs['verify-report.md'].overallStatus = 'pass-with-warnings';
    writeProtocolRun(f.cwd, 'run-evidence', docs);
    assert.match(
      readRunProtocol(f.runDir, { cwd: f.cwd }).issues.join('\n'),
      /successful overall status requires/
    );
  }
});

function externalTree(t) {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-evidence-external-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(outside, 'outside.test.cjs'),
    "require('node:test')('external', () => {});"
  );
  return outside;
}

test('snapshot records junction metadata without reading external target contents', (t) => {
  const f = fixture(t);
  const outside = externalTree(t);
  const link = path.join(f.cwd, 'tool-metadata');
  fs.symlinkSync(outside, link, 'junction');
  const originalRead = fs.readFileSync;
  const originalList = fs.readdirSync;
  const guard = (location) => {
    if (typeof location !== 'string') return;
    const absolute = path.resolve(location);
    for (const excluded of [outside, link]) {
      const relative = path.relative(excluded, absolute);
      assert.ok(
        relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative),
        `must not read linked contents: ${location}`
      );
    }
  };
  t.mock.method(fs, 'readFileSync', (location, ...args) => {
    guard(location);
    return originalRead(location, ...args);
  });
  t.mock.method(fs, 'readdirSync', (location, ...args) => {
    guard(location);
    return originalList(location, ...args);
  });
  const before = snapshotTree(f.cwd);
  assert.deepEqual(
    before.files.find((file) => file.path === 'tool-metadata'),
    {
      path: 'tool-metadata',
      kind: 'symlink',
      target: fs.readlinkSync(link),
      mode: fs.lstatSync(link).mode & 0o777
    }
  );
  fs.writeFileSync(path.join(outside, 'outside.test.cjs'), 'external content changed');
  assert.deepEqual(
    snapshotTree(f.cwd),
    before,
    'external target contents are explicitly outside the binding'
  );
});

test('changing a junction target invalidates prior evidence', async (t) => {
  const f = fixture(t);
  const first = externalTree(t);
  const second = externalTree(t);
  const link = path.join(f.cwd, 'tool-metadata');
  fs.symlinkSync(first, link, 'junction');
  const result = await collectEvidence(f.options);
  assert.equal(check(f, result.recordPath).passed, true);
  fs.unlinkSync(link);
  fs.symlinkSync(second, link, 'junction');
  assert.match(check(f, result.recordPath).issues.join('\n'), /file state changed/);
});

test('selected links and any linked test ancestor are rejected before traversing the target', (t) => {
  const f = fixture(t);
  const outside = externalTree(t);
  const link = path.join(f.cwd, 'linked-tests');
  fs.symlinkSync(outside, link, 'junction');
  for (const selected of ['linked-tests', 'linked-tests/outside.test.cjs']) {
    assert.throws(
      () => validateSelection(f.cwd, [selected]),
      /test path traverses a symbolic link/
    );
  }
  const fileLink = path.join(f.cwd, 'linked.test.cjs');
  // Windows file symlink creation requires extra privilege. A real junction
  // exercises the same direct lstat rejection without changing machine policy.
  fs.symlinkSync(
    process.platform === 'win32' ? outside : path.join(f.cwd, 'case.test.cjs'),
    fileLink,
    process.platform === 'win32' ? 'junction' : 'file'
  );
  assert.throws(
    () => validateSelection(f.cwd, ['linked.test.cjs']),
    /test path traverses a symbolic link/
  );
});

test('executable canonical paths accept aliases but reject a different file with the same name', async (t) => {
  const f = fixture(t);
  // This same-name file exists before collection so the later rejection isolates
  // executable identity, rather than a changed workspace fingerprint.
  const otherNode = path.join(f.cwd, path.basename(process.execPath));
  fs.writeFileSync(otherNode, 'not the collector executable');
  const result = await collectEvidence(f.options);
  const record = JSON.parse(fs.readFileSync(result.recordPath, 'utf8'));
  const aliases = [
    `${path.dirname(process.execPath)}${path.sep}.${path.sep}${path.basename(process.execPath)}`
  ];
  if (process.platform === 'win32')
    aliases.push(
      path.join(path.dirname(process.execPath), path.basename(process.execPath).toUpperCase())
    );
  for (const alias of aliases) {
    record.command.executable = alias;
    fs.writeFileSync(result.recordPath, JSON.stringify(record));
    assert.deepEqual(check(f, result.recordPath).issues, [], alias);
    assert.equal(JSON.parse(fs.readFileSync(result.recordPath, 'utf8')).command.executable, alias);
  }
  record.command.executable = otherNode;
  fs.writeFileSync(result.recordPath, JSON.stringify(record));
  assert.match(check(f, result.recordPath).issues.join('\n'), /command does not match/);
  record.command.executable = process.execPath;
  record.command.args.push('--test-name-pattern=never');
  fs.writeFileSync(result.recordPath, JSON.stringify(record));
  assert.match(check(f, result.recordPath).issues.join('\n'), /command does not match/);
});
