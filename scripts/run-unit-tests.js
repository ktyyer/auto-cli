#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function discoverTestFiles(root) {
  const directory = path.join(root, 'tests', 'scripts');
  const files = fs.existsSync(directory)
    ? fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
        .map((entry) => path.join(directory, entry.name))
        .sort()
    : [];
  if (files.length === 0) throw new Error(`No unit test files found in ${directory}`);
  return files;
}

export function runUnitTests(root, nodeOptions = []) {
  // Node 18 does not expand a quoted test glob; explicit paths work on both hosts.
  const env = { ...process.env };
  // A separate runner must discover tests even when invoked from another test process.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    ['--test', ...nodeOptions, ...discoverTestFiles(path.resolve(root))],
    { cwd: root, env, stdio: 'inherit' }
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = runUnitTests(process.cwd(), process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
