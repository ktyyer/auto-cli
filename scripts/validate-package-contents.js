#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REQUIRED_PACKAGE_FILES = [
  'AGENTS.md',
  'commands/auto.codex.md',
  'commands/auto/doctor.codex.md',
  'commands/auto/learn.codex.md',
  'commands/auto/route.codex.md',
  'commands/auto/status.codex.md',
  'scripts/install.js',
  'scripts/manifest.js',
  'scripts/uninstall.js'
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

console.log('Package 内容校验');
console.log('='.repeat(50));

const packed = spawnSync('npm', ['pack', '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32'
});

if (packed.status !== 0) {
  fail(`npm pack 失败:\n${packed.stderr || packed.stdout}`);
}

let packResult;
try {
  packResult = JSON.parse(packed.stdout.trim());
} catch (error) {
  fail(`无法解析 npm pack 输出: ${error.message}\n${packed.stdout}`);
}

const latest = Array.isArray(packResult) ? packResult[packResult.length - 1] : packResult;
if (!latest || !latest.filename || !Array.isArray(latest.files)) {
  fail(`npm pack 输出缺少预期字段: ${packed.stdout}`);
}

const packageFile = path.join(ROOT, latest.filename);
const packagedPaths = new Set(latest.files.map((entry) => entry.path));
const missing = REQUIRED_PACKAGE_FILES.filter((entry) => !packagedPaths.has(entry));

if (fs.existsSync(packageFile)) {
  fs.rmSync(packageFile, { force: true });
}

console.log(`package: ${latest.filename}`);
console.log(`entries: ${latest.files.length}`);

if (missing.length > 0) {
  console.log('');
  console.log('缺失文件:');
  for (const file of missing) {
    console.log(`- ${file}`);
  }
  fail('\nFAIL: npm 分发包缺少 Codex 运行所需文件');
}

console.log('PASS: npm 分发包包含 Codex 运行所需文件');
