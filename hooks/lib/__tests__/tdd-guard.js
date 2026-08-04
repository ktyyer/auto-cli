/**
 * TDD Guard 自身的测试（放在 __tests__/ 下，受 excludedDirs 豁免）
 *
 * 覆盖本轮修复的缺陷：镜像测试根目录（tests/<dir>/<base>.test.js）未被识别，
 * 导致「测试集中放在独立 tests/ 树」的项目所有源码编辑都被误判为无测试。
 *
 * 运行：node --test hooks/lib/__tests__/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TDDGuard } from '../tdd-guard.js';

test('镜像测试根目录：scripts/x.js 应识别 tests/scripts/x.test.js', () => {
  const guard = new TDDGuard();
  const paths = guard.getTestFilePaths('scripts/manifest.js').map((p) => p.replace(/\\/g, '/'));
  assert.ok(
    paths.includes('tests/scripts/manifest.test.js'),
    `期望包含 tests/scripts/manifest.test.js，实际：${JSON.stringify(paths)}`
  );
});

test('同目录约定仍然保留（不回归）', () => {
  const guard = new TDDGuard();
  const paths = guard.getTestFilePaths('src/util.js').map((p) => p.replace(/\\/g, '/'));
  assert.ok(paths.includes('src/util.test.js'), '同目录 .test.js 约定必须保留');
  assert.ok(paths.includes('src/util.spec.js'), '同目录 .spec.js 约定必须保留');
});

test('已在测试树内不再拼接镜像前缀（避免 tests/tests/...）', () => {
  const guard = new TDDGuard();
  const paths = guard
    .getTestFilePaths('tests/scripts/manifest.test.js')
    .map((p) => p.replace(/\\/g, '/'));
  assert.ok(
    !paths.some((p) => p.startsWith('tests/tests/')),
    `不应出现 tests/tests/ 前缀，实际：${JSON.stringify(paths)}`
  );
});

test('检测到真实存在的镜像测试文件时判定为有测试', async () => {
  const guard = new TDDGuard();
  // tests/scripts/manifest.test.js 在本仓库真实存在
  const result = await guard.checkTestFile('scripts/manifest.js');
  assert.equal(result.hasTest, true, '应通过镜像路径找到已存在的测试文件');
});

test('确实没有测试的文件仍然被拦下（守卫不失效）', async () => {
  const guard = new TDDGuard();
  const result = await guard.checkTestFile('scripts/__definitely_absent__.js');
  assert.equal(result.hasTest, false, '无测试文件时必须仍然报告 hasTest=false');
});

test('__tests__ 与配置文件保持豁免', () => {
  const guard = new TDDGuard();
  assert.equal(guard.isExempt('hooks/lib/__tests__/tdd-guard.js'), true);
  assert.equal(guard.isExempt('vitest.config.js'), true);
  assert.equal(guard.isExempt('scripts/manifest.js'), false);
});

test('测试文件自身必须豁免（否则会要求 x.test.test.js 这种荒谬路径）', () => {
  const guard = new TDDGuard();
  for (const p of [
    'tests/scripts/manifest.test.js',
    'tests/scripts/install-community.test.js',
    'src/util.spec.ts',
    'e2e/login.cy.js'
  ]) {
    assert.equal(guard.isExempt(p), true, `测试文件应豁免：${p}`);
  }
});

test('测试文件豁免不误伤含 test 字样的源码文件', () => {
  const guard = new TDDGuard();
  // 这些是源码，不是测试，必须仍然受守卫约束
  for (const p of ['src/testUtils.js', 'src/latest.js', 'scripts/contest.js']) {
    assert.equal(guard.isExempt(p), false, `源码不应被误判豁免：${p}`);
  }
});
