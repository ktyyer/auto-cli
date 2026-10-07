const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function projectRoot(file) {
  let dir = path.dirname(path.resolve(file));
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return dir;
}

function localBin(root, name, command = name) {
  try {
    const manifest = require.resolve(`${name}/package.json`, { paths: [root] });
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[command];
    return bin ? path.resolve(path.dirname(manifest), bin) : null;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED')
      return null;
    throw error;
  }
}

function check(root, name, args, command) {
  const bin = localBin(root, name, command);
  if (!bin) return `[Hook] ${name}: skipped; local executable is not installed.`;
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 1024 * 1024,
    windowsHide: true
  });
  if (result.status === 0) return '';
  const details = result.error?.message || `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  return `[Hook] ${name} check failed (exit ${result.status ?? 'unavailable'}):\n${details.slice(0, 3000)}`;
}

function checks(kind, file) {
  if (!file || !fs.existsSync(file) || !/\.[jt]sx?$/.test(file)) return '';
  const root = projectRoot(file);
  if (!root) return '';
  if (kind === 'tsc') {
    if (!/\.tsx?$/.test(file) || !fs.existsSync(path.join(root, 'tsconfig.json'))) return '';
    return check(
      root,
      'typescript',
      ['--noEmit', '--incremental', 'false', '--pretty', 'false'],
      'tsc'
    );
  }
  const messages = [];
  if (localBin(root, 'prettier')) messages.push(check(root, 'prettier', ['--check', file]));
  const configs = [
    '.eslintrc',
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    'eslint.config.js',
    'eslint.config.cjs',
    'eslint.config.mjs',
    'eslint.config.ts'
  ];
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (configs.some((name) => fs.existsSync(path.join(root, name))) || pkg.eslintConfig) {
    messages.push(check(root, 'eslint', [file]));
  }
  return messages.filter(Boolean).join('\n');
}

module.exports = { checks, projectRoot };
