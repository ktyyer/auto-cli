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
