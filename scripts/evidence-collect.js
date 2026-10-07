#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  EVIDENCE_POLICY,
  EVIDENCE_LEVEL,
  snapshotTree,
  collectorSource,
  validateSelection,
  parseNodeTap,
  logDescriptor
} from './evidence-record.js';

export async function collectEvidence({ cwd = process.cwd(), runDir, questId, id, tests }) {
  cwd = fs.realpathSync(cwd);
  runDir = path.resolve(runDir);
  if (!/^run-[\w-]+$/.test(path.basename(runDir)))
    throw new Error('run directory must have a run-* identifier');
  if (!/^[\w-]+$/.test(id || '') || !/^[\w-]+$/.test(questId || ''))
    throw new Error('id and quest must use letters, digits, underscores or hyphens');
  const selection = validateSelection(cwd, tests);
  const before = snapshotTree(cwd);
  const source = collectorSource();
  const command = {
    executable: process.execPath,
    args: ['--test', '--test-reporter=tap', '--', ...selection]
  };
  fs.mkdirSync(runDir, { recursive: true });
  const base = `evidence-${id}`;
  const recordPath = path.join(runDir, `${base}.json`);
  // Exclusive creation prevents an accidental rerun from rewriting prior records.
  const recordFd = fs.openSync(recordPath, 'wx');
  const outputs = {};
  try {
    for (const stream of ['stdout', 'stderr'])
      outputs[stream] = {
        name: `${base}.${stream}.log`,
        fd: fs.openSync(path.join(runDir, `${base}.${stream}.log`), 'wx'),
        chunks: []
      };
    const startedAt = new Date().toISOString();
    const start = performance.now();
    const outcome = await new Promise((resolve) => {
      // An enclosing node --test process exports an internal child marker that
      // suppresses a nested runner. This collection is an independent process.
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      const child = spawn(command.executable, command.args, {
        cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let spawnError = null;
      child.on('error', (error) => {
        spawnError = error.message;
      });
      for (const stream of ['stdout', 'stderr'])
        child[stream].on('data', (chunk) => {
          outputs[stream].chunks.push(chunk);
          fs.writeSync(outputs[stream].fd, chunk);
        });
      child.on('close', (exitCode, signal) => resolve({ exitCode, signal, spawnError }));
    });
    const durationMs = performance.now() - start;
    const finishedAt = new Date().toISOString();
    let after = null;
    let snapshotError = null;
    try {
      after = snapshotTree(cwd);
    } catch (error) {
      // Preserve the child's result even when final state collection fails.
      snapshotError = error.message;
    }
    const logs = Object.fromEntries(
      Object.entries(outputs).map(([stream, output]) => [
        stream,
        logDescriptor(output.name, Buffer.concat(output.chunks))
      ])
    );
    const record = {
      schemaVersion: EVIDENCE_POLICY,
      level: EVIDENCE_LEVEL,
      runId: path.basename(runDir),
      questId,
      cwd,
      command,
      selection,
      startedAt,
      finishedAt,
      durationMs,
      ...outcome,
      before,
      after,
      snapshotError,
      tests: parseNodeTap(Buffer.concat(outputs.stdout.chunks).toString('utf8'), {
        cwd,
        tests: selection
      }),
      logs,
      source
    };
    fs.writeFileSync(recordFd, JSON.stringify(record, null, 2) + '\n');
    return { recordPath, exitCode: outcome.exitCode, signal: outcome.signal };
  } finally {
    fs.closeSync(recordFd);
    for (const output of Object.values(outputs)) fs.closeSync(output.fd);
  }
}

function parseArgs(args) {
  const options = { tests: [] };
  const keys = { '--run-dir': 'runDir', '--quest': 'questId', '--id': 'id', '--cwd': 'cwd' };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!(flag in keys) && flag !== '--test') throw new Error(`unknown option: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
    if (flag === '--test') options.tests.push(value);
    else if (options[keys[flag]]) throw new Error(`duplicate option: ${flag}`);
    else options[keys[flag]] = value;
  }
  if (!options.runDir) throw new Error('--run-dir is required');
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await collectEvidence(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ ...result, level: EVIDENCE_LEVEL }));
    // Collection does not turn zero discovery or an old baseline failure green.
    // Policy validation is a separate command and never overwrites this exit code.
    process.exitCode = result.exitCode ?? 1;
  } catch (error) {
    console.error(`Evidence collection failed: ${error.message}`);
    process.exitCode = 2;
  }
}
