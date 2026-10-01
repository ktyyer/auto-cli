/**
 * dashboard.js 的 run 发现逻辑测试
 *
 * 覆盖缺陷：run 目录发现写死 `startsWith('run-')` 前缀，但本仓库 21 个真实 run
 * 全部形如 <YYYYMMDD>-<desc> / <YYYY-MM-DD>-<desc>，导致 dashboard 永远报
 * "No runs found"。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { protocolRun, writeProtocolRun } from '../fixtures/protocol-run.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const dashboardScript = path.join(repoRoot, 'scripts', 'dashboard.js');

function makeRun(runsDir, name) {
  const dir = path.join(runsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'route-decision.md'),
    ['# RouteDecision', '', 'strategy: fix', 'complexity: low', ''].join('\n'),
    'utf8'
  );
  return dir;
}

function runDashboard(cwd) {
  return spawnSync(process.execPath, [dashboardScript], { cwd, encoding: 'utf8' });
}

test('prototype-named skills have numeric activation counts and deduplicate within a run', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-dashboard-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  for (const id of ['run-first', 'run-second']) {
    const docs = protocolRun(id);
    docs['route-decision.md'].skills = ['constructor', '__proto__', 'toString', 'constructor'];
    writeProtocolRun(tmp, id, docs);
  }
  const result = runDashboard(tmp);
  assert.equal(result.status, 0, result.stderr);
  for (const skill of ['constructor', '__proto__', 'toString']) {
    assert.match(result.stdout, new RegExp(`\\| \\d+ \\| ${skill} \\| 2 \\|`));
  }
  assert.doesNotMatch(result.stdout, /function|NaN/);
});

test('dashboard parses canonical artifacts and labels unknown observations', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-dashboard-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const dir = writeProtocolRun(tmp, 'run-known');
  // A stale pre-contract cache must not override source artifacts.
  fs.writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify({ skills: { count: 0 } }));
  const partial = protocolRun('run-partial');
  writeProtocolRun(tmp, 'run-partial', { 'route-decision.md': partial['route-decision.md'] });
  makeRun(path.join(tmp, '.auto', 'runs'), 'run-unknown');
  const result = runDashboard(tmp);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1\/2 \(50.0%\)/);
  assert.match(result.stdout, /protocol-validator/);
  assert.match(result.stdout, /unknown/);
  assert.match(result.stdout, /\| fix \| 2 \| 100% \(1 observed\) \| 1\.0 \|/);
  assert.doesNotMatch(result.stdout, /never activated/);
});

test('dashboard 能发现无 run- 前缀的历史 run 目录', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-dashboard-'));
  const runsDir = path.join(tmp, '.auto', 'runs');
  makeRun(runsDir, '20260517-second-audit');
  makeRun(runsDir, '2026-05-17-fix-codex-sync');

  const result = runDashboard(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(
    !/No runs found/.test(result.stdout),
    `不应报 No runs found，实际输出：\n${result.stdout}`
  );
});

test('dashboard 仍能发现 run- 前缀目录（不回归）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-dashboard-'));
  const runsDir = path.join(tmp, '.auto', 'runs');
  makeRun(runsDir, 'run-20260521-local-verify');

  const result = runDashboard(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(!/No runs found/.test(result.stdout), 'run- 前缀目录必须继续被发现');
});

test('dashboard 不把 archive 目录当作 run', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-dashboard-'));
  const runsDir = path.join(tmp, '.auto', 'runs');
  makeRun(runsDir, '20260517-real-run');
  // archive 下的历史 run 不应参与统计
  makeRun(path.join(runsDir, 'archive'), '20260101-archived');

  const result = runDashboard(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(!/archive/.test(result.stdout), `archive 不应出现在 run 列表：\n${result.stdout}`);
});

test('确实没有 run 时仍然给出 No runs found 提示', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-dashboard-'));
  fs.mkdirSync(path.join(tmp, '.auto', 'runs'), { recursive: true });

  const result = runDashboard(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });

  assert.match(result.stdout, /No runs found/, '空 runs 目录应明确提示无数据');
});

test('dashboard excludes not_applicable gates from the overall pass rate', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-dashboard-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const docs = protocolRun('run-na');
  docs['verify-report.md'].gateResults.push({
    name: 'security',
    status: 'not_applicable',
    evidence: 'docs-only change'
  });
  writeProtocolRun(tmp, 'run-na', docs);
  const result = runDashboard(tmp);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\*\*Overall Pass Rate\*\*: 1\/2 \(50\.0%\)/);
});

test('dashboard reports no applicable gates when every gate is not_applicable', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-dashboard-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const docs = protocolRun('run-all-na');
  docs['verify-report.md'].gateResults = [
    { name: 'test', status: 'not_applicable', evidence: 'explore strategy, no code change' }
  ];
  docs['verify-report.md'].overallStatus = 'not_applicable';
  writeProtocolRun(tmp, 'run-all-na', docs);
  const result = runDashboard(tmp);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\*\*Overall Pass Rate\*\*: unknown \(no applicable gates\)/);
});

test('dashboard reports no observed gates when no run recorded a verify report', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-dashboard-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const docs = Object.fromEntries(
    Object.entries(protocolRun('run-no-verify')).filter(([file]) => file !== 'verify-report.md')
  );
  writeProtocolRun(tmp, 'run-no-verify', docs);
  const result = runDashboard(tmp);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\*\*Overall Pass Rate\*\*: unknown \(no observed gates\)/);
});
