#!/usr/bin/env node

import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { listSourceFiles } from './install-plan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REQUIRED_PACKAGE_FILES = [
  'AGENTS.md',
  'commands/auto.codex.md',
  'commands/auto/doctor.codex.md',
  'commands/auto/learn.codex.md',
  'commands/auto/route.codex.md',
  'commands/auto/status.codex.md',
  'package.json',
  ...['commands', 'skills', 'scripts', 'hooks'].flatMap((directory) =>
    listSourceFiles(ROOT, directory)
  )
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

console.log('Package 内容校验');
console.log('='.repeat(50));

const packed = spawnSync('npm', ['pack', '--dry-run', '--json'], {
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

const packagedPaths = new Set(latest.files.map((entry) => entry.path));
const missing = REQUIRED_PACKAGE_FILES.filter((entry) => !packagedPaths.has(entry));

console.log(`package: ${latest.filename}`);
console.log(`entries: ${latest.files.length}`);

if (missing.length > 0) {
  console.log('');
  console.log('缺失文件:');
  for (const file of missing) {
    console.log(`- ${file}`);
  }
  fail('\nFAIL: npm 分发包缺少安装或运行所需文件');
}

console.log('PASS: npm 分发包包含双宿主安装与运行工具链所需文件');
