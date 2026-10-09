#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CODEX_GLOBAL_BRIDGE, listSourceFiles } from './install-plan.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (contents) => createHash('sha256').update(contents).digest('hex');

export function requiredPackageFiles(root = ROOT) {
  return [
    ...new Set([
      'AGENTS.md',
      CODEX_GLOBAL_BRIDGE,
      '.claude-plugin/plugin.json',
      '.claude-plugin/marketplace.json',
      'commands/auto.codex.md',
      'commands/auto/doctor.codex.md',
      'commands/auto/learn.codex.md',
      'commands/auto/route.codex.md',
      'commands/auto/status.codex.md',
      'package.json',
      ...['commands', 'skills', 'scripts', 'hooks'].flatMap((directory) =>
        listSourceFiles(root, directory)
      )
    ])
  ].sort();
}

function missingFiles(paths, root) {
  const packagedPaths = new Set(paths);
  return requiredPackageFiles(root).filter((file) => !packagedPaths.has(file));
}

function runTar(args) {
  const result = spawnSync('tar', args, {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C', TAR_OPTIONS: '' },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30000
  });
  if (result.status !== 0) {
    throw new Error(`tar failed: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result.stdout.trimEnd().split(/\r?\n/).filter(Boolean);
}

function packageRelativePath(name, directory) {
  if (directory && (name === 'package/' || name === 'package')) return '';
  const relative = name.startsWith('package/')
    ? name.slice('package/'.length).replace(/\/$/, '')
    : '';
  if (
    !relative ||
    /[\\<>:"|?*\x00-\x1f]/.test(relative) ||
    relative
      .split('/')
      .some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..' ||
          /[. ]$/.test(part) ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
      )
  )
    throw new Error(`Unsafe package path: ${name}`);
  return relative;
}

function readRegularSource(root, relative) {
  let target = path.resolve(root);
  for (const part of ['', ...relative.split('/')]) {
    if (part) target = path.join(target, part);
    try {
      if (fs.lstatSync(target).isSymbolicLink())
        throw new Error(`Source symlinks are not supported: ${relative}`);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
  return fs.statSync(target).isFile() ? fs.readFileSync(target) : null;
}

// Validate the exact archive that will be published, not a second npm dry run.
export function validateTarball(tarballPath, { root = ROOT } = {}) {
  const archive = fs.readFileSync(tarballPath);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-tarball-'));
  try {
    const snapshot = path.join(temporary, 'archive.tgz');
    fs.writeFileSync(snapshot, archive);
    const names = runTar(['-tzf', snapshot]);
    const details = runTar(['-tzvf', snapshot]);
    if (!names.length || names.length !== details.length)
      throw new Error('Ambiguous package archive listing');
    const seen = new Set();
    const files = [];
    for (let index = 0; index < names.length; index++) {
      const type = details[index][0];
      if (type !== '-' && type !== 'd')
        throw new Error(`Unsupported package entry type: ${names[index]}`);
      const relative = packageRelativePath(names[index], type === 'd');
      const key = relative.toLowerCase();
      if (seen.has(key)) throw new Error(`Duplicate package path: ${names[index]}`);
      seen.add(key);
      if (type === '-') files.push(relative);
    }
    const extracted = path.join(temporary, 'extracted');
    fs.mkdirSync(extracted);
    runTar(['-xzf', snapshot, '-C', extracted, '--no-same-owner', '--no-same-permissions']);
    const extractedFiles = listSourceFiles(extracted, 'package')
      .map((file) => file.slice('package/'.length))
      .sort();
    files.sort();
    if (JSON.stringify(extractedFiles) !== JSON.stringify(files))
      throw new Error('Package extraction does not match its listing');
    const mismatched = [];
    const entries = files.map((relative) => {
      const contents = fs.readFileSync(path.join(extracted, 'package', relative));
      const source = readRegularSource(root, relative);
      if (!source || !contents.equals(source)) mismatched.push(relative);
      return { path: relative, size: contents.length, sha256: sha256(contents) };
    });
    return { entries, missing: missingFiles(files, root), mismatched, sha256: sha256(archive) };
  } finally {
    const boundary = path.relative(os.tmpdir(), temporary);
    if (
      !boundary.startsWith('auto-cli-tarball-') ||
      path.isAbsolute(boundary) ||
      boundary.includes(path.sep)
    ) {
      throw new Error('Unsafe temporary archive cleanup path');
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function dryRun() {
  const packed = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
  if (packed.status !== 0)
    throw new Error(`npm pack 失败:\n${packed.error?.message || packed.stderr || packed.stdout}`);
  const packResult = JSON.parse(packed.stdout.trim());
  const latest = Array.isArray(packResult) ? packResult[packResult.length - 1] : packResult;
  if (!latest?.filename || !Array.isArray(latest.files))
    throw new Error('npm pack 输出缺少预期字段');
  return {
    filename: latest.filename,
    entries: latest.files,
    missing: missingFiles(
      latest.files.map((file) => file.path),
      ROOT
    ),
    mismatched: []
  };
}

function main(args) {
  if (args.length && (args.length !== 2 || args[0] !== '--tarball')) {
    throw new Error('Usage: validate-package-contents.js [--tarball <package.tgz>]');
  }
  console.log('Package 内容校验');
  console.log('='.repeat(50));
  const report = args.length ? { filename: args[1], ...validateTarball(args[1]) } : dryRun();
  console.log(`package: ${report.filename}`);
  console.log(`entries: ${report.entries.length}`);
  for (const file of report.missing) console.error(`缺失文件: ${file}`);
  for (const file of report.mismatched) console.error(`包内容与源码不一致: ${file}`);
  if (report.missing.length || report.mismatched.length)
    throw new Error('FAIL: npm 分发包缺少所需文件或与源码不一致');
  console.log('PASS: npm 分发包包含双宿主安装与运行工具链所需文件');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
