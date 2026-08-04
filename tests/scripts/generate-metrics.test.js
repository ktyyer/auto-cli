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
import { fileURLToPath } from 'node:url';

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
