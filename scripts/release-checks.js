#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateTarball } from './validate-package-contents.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION_FILES = ['package.json', 'package-lock.json', '.claude-plugin/plugin.json'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function execute(root, command, args, display = false) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', env, maxBuffer: 32e6 });
  if (display) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${path.basename(command)} ${args.join(' ')} failed (exit ${result.status}):\n${result.stderr || result.stdout}`
    );
  }
  return result.stdout.trim();
}

function git(root, ...args) {
  return execute(root, 'git', args);
}

function npm(root, ...args) {
  // Execute npm's JavaScript entry, avoiding cmd.exe interpolation of artifact paths.
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
    path.join(path.dirname(process.execPath), 'npm')
  ];
  const cli = candidates.find((file) => file && fs.existsSync(file));
  if (!cli) throw new Error('Cannot locate npm-cli.js for release checks');
  return execute(root, process.execPath, [fs.realpathSync(cli), ...args], args[0] !== 'pack');
}

function outputDirectory(root, output) {
  if (!output || !path.isAbsolute(output))
    throw new Error('Release output must be an absolute path');
  const relative = path.relative(path.resolve(root), path.resolve(output));
  if (
    !relative ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  ) {
    throw new Error('Release output must be outside the source checkout');
  }
  fs.mkdirSync(output, { recursive: true });
  return output;
}

function assertSource(root, expected) {
  if (!/^[0-9a-f]{40}$/.test(expected || ''))
    throw new Error('A full pinned source SHA is required');
  if (git(root, 'rev-parse', 'HEAD') !== expected)
    throw new Error('Source HEAD differs from pinned SHA');
}

function assertClean(root) {
  if (git(root, 'status', '--porcelain=v1', '--untracked-files=normal')) {
    throw new Error('Release requires a clean source checkout');
  }
}

export function validateVersions(root) {
  const pkg = readJson(path.join(root, 'package.json'));
  const lock = readJson(path.join(root, 'package-lock.json'));
  const plugin = readJson(path.join(root, '.claude-plugin/plugin.json'));
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version || ''))
    throw new Error('Expected a stable semver version');
  for (const [label, version] of [
    ['package-lock.json', lock.version],
    ['package-lock.json packages[""]', lock.packages?.['']?.version],
    ['.claude-plugin/plugin.json', plugin.version]
  ]) {
    if (version !== pkg.version)
      throw new Error(`Version mismatch in ${label}: ${version} != ${pkg.version}`);
  }
  return pkg.version;
}

function preflightReceipt(root, output) {
  const receipt = readJson(path.join(outputDirectory(root, output), 'preflight.json'));
  assertSource(root, receipt.sourceSha);
  if (receipt.sourceTree !== git(root, 'rev-parse', `${receipt.sourceSha}^{tree}`)) {
    throw new Error('Preflight source tree differs from the pinned commit');
  }
  return receipt;
}

export function preflightRelease({ root = ROOT, output, sourceSha }) {
  outputDirectory(root, output);
  // A failed retry must not leave a previous success receipt available for packaging.
  for (const name of ['preflight.json', 'release.json']) {
    fs.rmSync(path.join(output, name), { force: true });
  }
  assertSource(root, sourceSha);
  assertClean(root);
  const version = validateVersions(root);
  npm(root, 'test');
  assertSource(root, sourceSha);
  assertClean(root);
  const receipt = {
    schemaVersion: 1,
    sourceSha,
    sourceTree: git(root, 'rev-parse', 'HEAD^{tree}'),
    version,
    checkedAt: new Date().toISOString(),
    checks: ['npm test']
  };
  writeJson(path.join(output, 'preflight.json'), receipt);
  return receipt;
}

export function bumpReleaseVersion({ root = ROOT, output, bump }) {
  if (!['patch', 'minor', 'major'].includes(bump))
    throw new Error('Version bump must be patch, minor or major');
  const checked = preflightReceipt(root, output);
  assertClean(root);
  if (validateVersions(root) !== checked.version)
    throw new Error('Source version changed after preflight');
  npm(root, 'version', bump, '--no-git-tag-version', '--ignore-scripts');
  const pluginPath = path.join(root, '.claude-plugin/plugin.json');
  const plugin = readJson(pluginPath);
  plugin.version = readJson(path.join(root, 'package.json')).version;
  writeJson(pluginPath, plugin);
  return validateVersions(root);
}

function withoutVersionFields(file, value) {
  const copy = structuredClone(value);
  delete copy.version;
  if (file === 'package-lock.json' && copy.packages?.['']) delete copy.packages[''].version;
  return copy;
}

function assertVersionOnlyChanges(root, checked) {
  git(root, 'diff', '--quiet');
  const status = git(root, 'status', '--porcelain=v1', '--untracked-files=normal');
  if (status.split('\n').some((line) => line.startsWith('??'))) {
    throw new Error('Untracked files appeared after preflight');
  }
  const changed = git(root, 'diff', '--cached', '--name-only', checked.sourceSha)
    .split('\n')
    .filter(Boolean);
  if (changed.some((file) => !VERSION_FILES.includes(file))) {
    throw new Error('Only release version manifests may change after preflight');
  }
  for (const file of VERSION_FILES) {
    const before = JSON.parse(git(root, 'show', `${checked.sourceSha}:${file}`));
    const after = readJson(path.join(root, file));
    if (
      JSON.stringify(withoutVersionFields(file, before)) !==
      JSON.stringify(withoutVersionFields(file, after))
    ) {
      throw new Error(`Non-version content changed after preflight: ${file}`);
    }
  }
}

export function prepareRelease({ root = ROOT, output }) {
  outputDirectory(root, output);
  fs.rmSync(path.join(output, 'release.json'), { force: true });
  const checked = preflightReceipt(root, output);
  assertVersionOnlyChanges(root, checked);
  const version = validateVersions(root);
  if (version === checked.version) throw new Error('Release version has not been bumped');
  const packed = JSON.parse(
    npm(root, 'pack', '--json', '--ignore-scripts', '--pack-destination', output)
  );
  if (
    packed.length !== 1 ||
    !packed[0]?.filename ||
    path.basename(packed[0].filename) !== packed[0].filename
  ) {
    throw new Error('npm pack did not return one local archive');
  }
  const archive = path.join(output, packed[0].filename);
  const validation = validateTarball(archive, { root });
  if (validation.missing.length || validation.mismatched.length) {
    throw new Error(
      `Release archive differs from source: ${[...validation.missing, ...validation.mismatched].join(', ')}`
    );
  }
  // npm's explicit files list can include ignored files that git status does not report.
  const tracked = new Set(git(root, 'ls-files', '--cached', '-z').split('\0'));
  const untracked = validation.entries.filter((entry) => !tracked.has(entry.path));
  if (untracked.length) {
    throw new Error(
      `Release archive contains files outside the checked Git tree: ${untracked.map((entry) => entry.path).join(', ')}`
    );
  }
  // Verify the working files still match the index after package creation/inspection.
  assertVersionOnlyChanges(root, checked);
  const receipt = {
    schemaVersion: 1,
    sourceSha: checked.sourceSha,
    sourceTree: checked.sourceTree,
    releaseTree: git(root, 'write-tree'),
    version,
    tarball: packed[0].filename,
    sha256: validation.sha256,
    entries: validation.entries.length,
    preparedAt: new Date().toISOString()
  };
  writeJson(path.join(output, 'release.json'), receipt);
  return receipt;
}

export function verifyRelease({ root = ROOT, output }) {
  const receipt = readJson(path.join(outputDirectory(root, output), 'release.json'));
  if (typeof receipt.tarball !== 'string' || path.basename(receipt.tarball) !== receipt.tarball) {
    throw new Error('Invalid release archive path');
  }
  assertClean(root);
  const [commit, ...parents] = git(root, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ');
  if (parents.length !== 1 || parents[0] !== receipt.sourceSha) {
    throw new Error('Release commit must directly descend from the checked source');
  }
  if (git(root, 'rev-parse', 'HEAD^{tree}') !== receipt.releaseTree) {
    throw new Error('Release commit tree differs from the checked package source');
  }
  if (validateVersions(root) !== receipt.version)
    throw new Error('Release version changed after packaging');
  const sha256 = createHash('sha256')
    .update(fs.readFileSync(path.join(output, receipt.tarball)))
    .digest('hex');
  if (sha256 !== receipt.sha256) throw new Error('Release archive checksum mismatch');
  return { ...receipt, releaseCommit: commit };
}

function main(args) {
  const command = args.shift();
  const options = {};
  const keys = {
    '--root': 'root',
    '--output': 'output',
    '--source': 'sourceSha',
    '--bump': 'bump'
  };
  while (args.length) {
    const flag = args.shift();
    if (!keys[flag] || !args.length) throw new Error(`Invalid release-check option: ${flag}`);
    options[keys[flag]] = args.shift();
  }
  const actions = {
    preflight: preflightRelease,
    bump: bumpReleaseVersion,
    prepare: prepareRelease,
    verify: verifyRelease
  };
  if (!actions[command]) throw new Error('Use release-checks.js preflight|bump|prepare|verify');
  console.log(JSON.stringify(actions[command](options), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
