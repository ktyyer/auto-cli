import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const validateRunScript = path.join(repoRoot, 'scripts', 'validate-run-completeness.js');

function makeRun(rootDir, runId, files) {
  const runDir = path.join(rootDir, '.auto', 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  for (const [fileName, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(runDir, fileName), content, 'utf8');
  }
  return runDir;
}

function runValidate(rootDir, args) {
  const result = spawnSync(process.execPath, [validateRunScript, ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, AUTO_CLI_TEST_ROOT: rootDir }
  });
  return result;
}

test('validate-run-completeness passes for a complete run with matching knowledge markers', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-run-pass-'));
  fs.mkdirSync(path.join(tempRoot, '.auto', 'insights'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, '.auto', 'feedback'), { recursive: true });
  fs.writeFileSync(
    path.join(tempRoot, '.auto', 'insights', 'patterns.md'),
    '# Patterns\n\n### Coverage testing pattern\n\nUseful pattern.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(tempRoot, '.auto', 'feedback', 'skills.json'),
    JSON.stringify({ version: 'auto-md/v1', skills: {} }, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(tempRoot, '.auto', 'feedback', 'agents.json'),
    JSON.stringify({ version: 'auto-md/v1', agents: {} }, null, 2),
    'utf8'
  );

  makeRun(tempRoot, 'run-coverage-pass', {
    'route-decision.md': '- strategy: implement\n- complexity: medium\n- verify: npm run check\n- goal: improve coverage testing\n- knowledge inputs: [insight:patterns.md#Coverage testing pattern]\n',
    'quest-map.md': '- plan: add tests for scripts and verify coverage\n',
    'quest-results.md': '- execution: added tests\n- findings: coverage support works\n',
    'verify-report.md': '- command: `npm run check`\n- result: PASS\n- command: `node scripts/validate-run-completeness.js --run run-coverage-pass`\n- result: PASS\n- `lint`: pass\n- `regression`: pass\n- `run-completeness`: pass\n- `knowledge-reuse`: PASS [insight:patterns.md#Coverage testing pattern]\n- verify: complete\n',
    'learn-cards.md': '- summary: added reusable coverage tests\n- recommendedAction: extend to other scripts\n- confidence: high\n',
    'index.md': '- strategy: implement\n- goal: improve coverage testing\n- verification: complete\n'
  });

  const result = runValidate(tempRoot, ['--run', 'run-coverage-pass']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /result: PASS/);
});

test('validate-run-completeness fails when verify report claims knowledge reuse without evidence marker', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-run-fail-'));
  fs.mkdirSync(path.join(tempRoot, '.auto', 'feedback'), { recursive: true });
  fs.writeFileSync(
    path.join(tempRoot, '.auto', 'feedback', 'skills.json'),
    JSON.stringify({ version: 'auto-md/v1', skills: {} }, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(tempRoot, '.auto', 'feedback', 'agents.json'),
    JSON.stringify({ version: 'auto-md/v1', agents: {} }, null, 2),
    'utf8'
  );

  makeRun(tempRoot, 'run-coverage-fail', {
    'route-decision.md': '- strategy: implement\n- complexity: medium\n- verify: npm run check\n- goal: improve coverage testing\n',
    'quest-map.md': '- plan: add tests for scripts and verify coverage\n',
    'quest-results.md': '- execution: added tests\n- findings: coverage support works\n',
    'verify-report.md': '- command: `npm run check`\n- result: PASS\n- `lint`: pass\n- `regression`: pass\n- `run-completeness`: pending\n- `knowledge-reuse`: PASS\n- verify: complete\n',
    'learn-cards.md': '- summary: added reusable coverage tests\n- recommendedAction: extend to other scripts\n- confidence: high\n',
    'index.md': '- strategy: implement\n- goal: improve coverage testing\n- verification: complete\n'
  });

  const result = runValidate(tempRoot, ['--run', 'run-coverage-fail']);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /knowledge-reuse/);
});
