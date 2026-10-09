/**
 * generate-metrics.js 的 run 发现逻辑测试
 *
 * 覆盖缺陷：无参调用时用 `startsWith('run-')` 找最新 run，但本仓库真实 run
 * 目录名形如 <YYYYMMDD>-<desc>，导致 "No runs found" 且 metrics.json 永不生成。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { protocolRun, writeProtocolRun } from '../fixtures/protocol-run.js';
import { importHostObservation } from '../../scripts/import-host-observation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const script = path.join(repoRoot, 'scripts', 'generate-metrics.js');

function makeRun(runsDir, name) {
  const dir = path.join(runsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'route-decision.md'),
    ['# RouteDecision', '', 'strategy: fix', ''].join('\n'),
    'utf8'
  );
  return dir;
}

function run(cwd, args = []) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
}

function addHostObservation(root, runDir) {
  const sourceDir = path.join(root, 'host-source');
  fs.mkdirSync(sourceDir);
  const raw = Buffer.from(
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 20, output_tokens: 5 } }) + '\n'
  );
  fs.writeFileSync(path.join(sourceDir, 'raw.jsonl'), raw);
  const manifestPath = path.join(sourceDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      schemaVersion: 'auto-host-attempts/v1',
      runId: path.basename(runDir),
      attempts: [
        {
          attemptId: 'codex-1',
          host: 'codex',
          surface: 'exec-json',
          hostVersion: '0.154.0',
          model: 'gpt-6-astra',
          status: 'succeeded',
          startedAt: '2026-10-08T11:00:00Z',
          finishedAt: '2026-10-08T11:00:01Z',
          wallTimeMs: 1000,
          exitCode: 0,
          usageScope: 'attempt',
          log: { path: 'raw.jsonl', sha256: createHash('sha256').update(raw).digest('hex') }
        }
      ]
    })
  );
  return importHostObservation({ manifestPath, runDir });
}

test('a later failed attempt in a different fence replaces the earlier completed observation', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  for (const fence of ['  ```', '~~~']) {
    const docs = protocolRun('run-retry');
    const dir = writeProtocolRun(tmp, 'run-retry', docs);
    const failed = {
      ...docs['quest-results.md'][0],
      id: 'retry',
      attempt: 2,
      status: 'failed',
      failureContext: { recommendedNext: 'repair' },
      retry: {}
    };
    fs.appendFileSync(
      path.join(dir, 'quest-results.md'),
      `\n${fence}json\n${JSON.stringify(failed)}\n${fence}\n`
    );
    const result = run(tmp, ['run-retry']);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const metrics = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json'), 'utf8'));
    assert.deepEqual(metrics.quests, { total: 1, completed: 0, failed: 1 });
  }
});

test('canonical counts ignore nested statuses and use latest quest attempt', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const docs = protocolRun('run-counts');
  const result = docs['quest-results.md'][0];
  docs['quest-results.md'] = [
    {
      ...result,
      id: 'failed',
      status: 'failed',
      failureContext: { recommendedNext: 'retry' },
      retry: {}
    },
    { ...result, attempt: 2 }
  ];
  const dir = writeProtocolRun(tmp, 'run-counts', docs);
  assert.equal(run(tmp, ['run-counts']).status, 0);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json')));
  assert.equal(m.skills.count, 2);
  assert.deepEqual(m.quests, { total: 1, completed: 1, failed: 0 });
  assert.equal(m.gates.total, 2);
  assert.equal(m.gates.applicable, 2);
  assert.equal(m.gates.passed, 1);
  assert.equal(m.gates.warning, 1);
  assert.equal(m.gates.passRate, 0.5);
  assert.equal(m.duration.total, null);
  assert.equal(m.files.read, null);
  assert.equal(m.agents.count, null);
  assert.notEqual(m.status, 'completed');
  assert.equal('hostObservation' in m, false, 'old runs retain their existing metrics shape');
});

test('optional host completion preserves all prior run, gate and unmeasured telemetry semantics', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const dir = writeProtocolRun(tmp, 'run-host-metrics', protocolRun('run-host-metrics'));
  assert.equal(run(tmp, ['run-host-metrics']).status, 0);
  const before = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json'), 'utf8'));
  addHostObservation(tmp, dir);
  const result = run(tmp, ['run-host-metrics']);
  assert.equal(result.status, 0, result.stderr);
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json'), 'utf8'));
  assert.equal(after.hostObservation.status, 'verified');
  assert.equal(after.hostObservation.summary.byHost.codex.totalTokens, 25);
  assert.equal(after.hostObservation.summary.taskAcceptance, 'not-measured');
  assert.match(result.stdout, /task acceptance is measured separately/);
  delete before.timestamp;
  delete after.timestamp;
  delete after.hostObservation;
  assert.deepEqual(after, before);
});

test('metrics preserve unknown resumed-session cost while retaining incremental tokens and gate verdicts', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const runId = 'run-resume-metrics';
  const dir = writeProtocolRun(tmp, runId, protocolRun(runId));
  assert.equal(run(tmp, [runId]).status, 0);
  const before = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json'), 'utf8'));
  const sourceDir = path.join(tmp, 'host-source');
  fs.mkdirSync(sourceDir);
  const attempts = [0.3, 0.5].map((cost, index) => {
    const raw = Buffer.from(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        session_id: 'resumed-session',
        usage: {
          input_tokens: 10,
          output_tokens: 4,
          cache_read_input_tokens: 20,
          cache_creation_input_tokens: 0
        },
        total_cost_usd: cost
      }) + '\n'
    );
    const file = 'attempt-' + index + '.jsonl';
    fs.writeFileSync(path.join(sourceDir, file), raw);
    return {
      attemptId: 'claude-' + index,
      host: 'claude',
      surface: 'stream-json',
      hostVersion: '2.1.281',
      model: 'glm-5.3',
      status: 'succeeded',
      startedAt: '2026-10-08T11:00:00Z',
      finishedAt: '2026-10-08T11:00:01Z',
      wallTimeMs: 1000,
      exitCode: 0,
      usageScope: 'attempt',
      resumeSessionId: index ? 'resumed-session' : null,
      log: { path: file, sha256: createHash('sha256').update(raw).digest('hex') }
    };
  });
  const manifestPath = path.join(sourceDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ schemaVersion: 'auto-host-attempts/v1', runId, attempts })
  );
  importHostObservation({ manifestPath, runDir: dir });
  const result = run(tmp, [runId]);
  assert.equal(result.status, 0, result.stderr);
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json'), 'utf8'));
  const summary = after.hostObservation.summary.byHost.claude;
  assert.equal(after.hostObservation.status, 'verified');
  assert.equal(summary.reportedEstimateUsd, null);
  assert.equal(summary.totalTokens, 68);
  assert.equal(summary.estimateAccounting, 'unknown-session-overlap');
  assert.deepEqual(summary.nonAdditiveEstimateAttemptIds, ['claude-0', 'claude-1']);
  delete before.timestamp;
  delete after.timestamp;
  delete after.hostObservation;
  assert.deepEqual(after, before);
});

test('a tampered optional host observation fails metrics CLI explicitly without rewriting gate verdicts', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const dir = writeProtocolRun(tmp, 'run-host-invalid', protocolRun('run-host-invalid'));
  assert.equal(run(tmp, ['run-host-invalid']).status, 0);
  const before = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json'), 'utf8'));
  const observed = addHostObservation(tmp, dir);
  observed.summary.byHost.codex.totalTokens = 0;
  fs.writeFileSync(path.join(dir, 'host-observation.json'), JSON.stringify(observed));
  const result = run(tmp, ['run-host-invalid']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /derivation differs/);
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json'), 'utf8'));
  assert.equal(after.hostObservation.status, 'invalid');
  assert.equal(after.hostObservation.summary, null);
  assert.equal(after.status, before.status);
  assert.deepEqual(after.gates, before.gates);
  assert.match(after.unavailable.join('\n'), /host observation: invalid/);
});

test('legacy/missing observations stay unknown and invalid structured input is reported', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const dir = makeRun(path.join(tmp, '.auto', 'runs'), 'run-unknown');
  assert.equal(run(tmp, ['run-unknown']).status, 0);
  let m = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json')));
  assert.equal(m.skills.count, null);
  assert.equal(m.gates.total, null);
  assert.equal(m.gates.applicable, null);
  assert.equal(m.status, 'unknown');
  assert.ok(m.unavailable.length > 0);
  fs.writeFileSync(path.join(dir, 'route-decision.md'), '```json\n{"skills": [}\n```');
  assert.equal(run(tmp, ['run-unknown']).status, 1);
  m = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json')));
  assert.equal(m.status, 'invalid');
  assert.ok(m.protocolIssues.length > 0);
});

test('observed empty gates are zero with unknown rate, not missing data', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const docs = protocolRun('run-empty');
  docs['verify-report.md'].gateResults = [];
  docs['route-decision.md'].skills = [];
  const dir = writeProtocolRun(tmp, 'run-empty', docs);
  assert.equal(run(tmp, ['run-empty']).status, 0);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json')));
  assert.equal(m.gates.total, 0);
  assert.equal(m.gates.passRate, null);
  assert.equal(m.skills.count, 0);
});

test('无参调用能定位无 run- 前缀的最新 run 并生成 metrics.json', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  const runsDir = path.join(tmp, '.auto', 'runs');
  makeRun(runsDir, '20260517-older');
  makeRun(runsDir, '20260523-newest');

  const result = run(tmp);

  const generated = fs.existsSync(path.join(runsDir, '20260523-newest', 'metrics.json'));
  fs.rmSync(tmp, { recursive: true, force: true });

  assert.equal(result.status, 0, `应成功退出：${result.stdout}${result.stderr}`);
  assert.ok(generated, '应为字典序最新的 run 生成 metrics.json');
});

test('仍支持 run- 前缀目录（不回归）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  const runsDir = path.join(tmp, '.auto', 'runs');
  makeRun(runsDir, 'run-20260521-local-verify');

  const result = run(tmp);
  const generated = fs.existsSync(path.join(runsDir, 'run-20260521-local-verify', 'metrics.json'));
  fs.rmSync(tmp, { recursive: true, force: true });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.ok(generated, 'run- 前缀目录必须继续被支持');
});

test('archive 目录不会被当作最新 run', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  const runsDir = path.join(tmp, '.auto', 'runs');
  makeRun(runsDir, '20260101-real');
  // archive 字典序在数字之后，若未排除会被当成 "最新"
  makeRun(path.join(runsDir, 'archive'), '20260102-archived');

  const result = run(tmp);
  const archiveGotMetrics = fs.existsSync(path.join(runsDir, 'archive', 'metrics.json'));
  const realGotMetrics = fs.existsSync(path.join(runsDir, '20260101-real', 'metrics.json'));
  fs.rmSync(tmp, { recursive: true, force: true });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(archiveGotMetrics, false, 'archive 目录不应被当作 run');
  assert.ok(realGotMetrics, '应选中真正的 run');
});

test('显式传入 runId 时仍按该 runId 生成', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  const runsDir = path.join(tmp, '.auto', 'runs');
  makeRun(runsDir, '20260517-target');
  makeRun(runsDir, '20260523-newest');

  const result = run(tmp, ['20260517-target']);
  const targeted = fs.existsSync(path.join(runsDir, '20260517-target', 'metrics.json'));
  fs.rmSync(tmp, { recursive: true, force: true });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.ok(targeted, '显式 runId 必须优先于自动发现');
});

test('v2 statuses: succeeded counts as completed and not_applicable leaves the pass rate', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const docs = protocolRun('run-v2');
  docs['quest-results.md'][0].status = 'succeeded';
  docs['verify-report.md'].gateResults.push({
    name: 'security',
    status: 'not_applicable',
    evidence: 'docs-only change'
  });
  const dir = writeProtocolRun(tmp, 'run-v2', docs);
  const result = run(tmp, ['run-v2']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json')));
  assert.deepEqual(m.quests, { total: 1, completed: 1, failed: 0 });
  assert.equal(m.gates.total, 3);
  assert.equal(m.gates.notApplicable, 1);
  assert.equal(m.gates.applicable, 2);
  assert.equal(m.gates.passRate, 0.5);
  assert.match(result.stdout, /Gates: 1\/2 passed \(50\.0%\), 1 not applicable/);
});

test('only not_applicable gates give an unknown pass rate, not zero', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const docs = protocolRun('run-na');
  docs['verify-report.md'].gateResults = [
    { name: 'test', status: 'not_applicable', evidence: 'explore strategy' }
  ];
  docs['verify-report.md'].overallStatus = 'not_applicable';
  const dir = writeProtocolRun(tmp, 'run-na', docs);
  const result = run(tmp, ['run-na']);
  assert.equal(result.status, 0, result.stderr);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'metrics.json')));
  assert.equal(m.gates.total, 1);
  assert.equal(m.gates.notApplicable, 1);
  assert.equal(m.gates.applicable, 0);
  assert.equal(m.gates.passRate, null);
  assert.match(result.stdout, /Gates: 0\/0 passed \(unknown\), 1 not applicable/);
});

test('CLI exits non-zero without writing metrics when the run or runs directory is missing', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-metrics-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const noRunsDir = run(tmp);
  assert.equal(noRunsDir.status, 1);
  assert.match(noRunsDir.stderr, /No runs directory found/);

  const runsDir = path.join(tmp, '.auto', 'runs');
  fs.mkdirSync(path.join(runsDir, 'archive'), { recursive: true });
  const onlyArchive = run(tmp);
  assert.equal(onlyArchive.status, 1);
  assert.match(onlyArchive.stderr, /No runs found/);

  const unknownRun = run(tmp, ['run-missing']);
  assert.equal(unknownRun.status, 1);
  assert.match(unknownRun.stderr, /Run directory not found/);
  assert.equal(fs.existsSync(path.join(runsDir, 'run-missing')), false);
});
