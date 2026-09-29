import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { protocolRun, writeProtocolRun } from '../fixtures/protocol-run.js';

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

test('indented and tilde protocol runs remain structured and reject missing fields', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-fences-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  for (const delimiter of ['  ```', '~~~', '````']) {
    for (const valid of [true, false]) {
      const docs = protocolRun('run-fences');
      if (!valid) delete docs['route-decision.md'].skills;
      const dir = writeProtocolRun(tmp, 'run-fences', docs);
      for (const file of Object.keys(docs)) {
        const location = path.join(dir, file);
        fs.writeFileSync(location, fs.readFileSync(location, 'utf8').replace(/^```/gm, delimiter));
      }
      const result = runValidate(tmp, ['--run', 'run-fences', '--json']);
      assert.equal(result.status, valid ? 0 : 1, result.stdout + result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.protocolMode, 'structured');
      if (!valid) assert.ok(report.protocolIssues.some((issue) => issue.includes('.skills')));
    }
  }
});

test('feedback evidence resolves documented and legacy markers against flat and nested data', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-feedback-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const feedbackDir = path.join(tmp, '.auto', 'feedback');
  fs.mkdirSync(feedbackDir, { recursive: true });
  for (const type of ['skills', 'agents']) {
    for (const separator of ['#', ':']) {
      for (const nested of [false, true]) {
        const docs = protocolRun('run-feedback');
        docs['route-decision.md'].summary = `[feedback:${type}.json${separator}entry]`;
        docs['verify-report.md'].gateResults = [{ name: 'knowledge-reuse', status: 'pass' }];
        writeProtocolRun(tmp, 'run-feedback', docs);
        const entries = { entry: { [type === 'skills' ? 'usageCount' : 'totalCalls']: 2 } };
        const data = nested ? { version: 'auto-md/v1', [type]: entries } : entries;
        fs.writeFileSync(path.join(feedbackDir, `${type}.json`), JSON.stringify(data));
        const result = runValidate(tmp, ['--run', 'run-feedback', '--json']);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.deepEqual(JSON.parse(result.stdout).protocolIssues, []);
      }
    }
  }
});

test('feedback evidence rejects missing, malformed, metadata and inherited entries', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-feedback-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const feedbackDir = path.join(tmp, '.auto', 'feedback');
  fs.mkdirSync(feedbackDir, { recursive: true });
  const cases = [
    ['missing-file', undefined, 'entry', /missing feedback file/],
    ['missing-key', '{}', 'entry', /missing feedback key/],
    ['invalid-json', '{broken}', 'entry', /invalid feedback JSON/],
    ['null', 'null', 'entry', /invalid feedback data/],
    ['array', '[]', 'entry', /invalid feedback data/],
    ['metadata', '{"lastUpdated":"2026-09-29"}', 'lastUpdated', /invalid feedback entry/],
    ['inherited', '{}', 'constructor', /missing feedback key/],
    ['null-entry', '{"entry":null}', 'entry', /invalid feedback entry/],
    ['nested-missing', '{"skills":{},"agents":{}}', 'entry', /missing feedback key/]
  ];
  for (const type of ['skills', 'agents']) {
    for (const [name, content, key, issue] of cases) {
      const docs = protocolRun(`run-${type}-${name}`);
      docs['route-decision.md'].summary = `[feedback:${type}.json#${key}]`;
      docs['verify-report.md'].gateResults = [{ name: 'knowledge-reuse', status: 'pass' }];
      writeProtocolRun(tmp, `run-${type}-${name}`, docs);
      // Each type starts with a missing file, followed by independently written data.
      if (content !== undefined) fs.writeFileSync(path.join(feedbackDir, `${type}.json`), content);
      const result = runValidate(tmp, ['--run', `run-${type}-${name}`, '--json']);
      assert.equal(result.status, 1, `${type}/${name}: ${result.stdout}${result.stderr}`);
      assert.ok(JSON.parse(result.stdout).protocolIssues.some((value) => issue.test(value)));
    }
  }
});

for (const [name, key, data] of [
  ['object metadata', 'portablePatterns', { portablePatterns: { usageCount: 1 } }],
  [
    'ambiguous entries',
    'entry',
    { entry: { usageCount: 1 }, skills: { entry: { usageCount: 2 } } }
  ],
  ['negative count', 'entry', { entry: { usageCount: -1, successRate: 1 } }],
  [
    'unmeasured rate',
    'entry',
    {
      schemaVersion: 'auto-feedback/v1',
      lastUpdated: null,
      portablePatterns: [],
      entry: { usageCount: 10, lastUsed: null, observations: {}, successRate: 1 }
    }
  ]
]) {
  test(`feedback contract rejects ${name}`, (t) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-feedback-contract-'));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    const docs = protocolRun('run-feedback-contract');
    docs['route-decision.md'].summary = `[feedback:skills.json#${key}]`;
    docs['verify-report.md'].gateResults = [{ name: 'knowledge-reuse', status: 'pass' }];
    writeProtocolRun(tmp, 'run-feedback-contract', docs);
    const feedbackDir = path.join(tmp, '.auto', 'feedback');
    fs.mkdirSync(feedbackDir, { recursive: true });
    fs.writeFileSync(path.join(feedbackDir, 'skills.json'), JSON.stringify(data));
    const result = runValidate(tmp, ['--run', 'run-feedback-contract', '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(JSON.parse(result.stdout).protocolIssues.some((issue) => /feedback/.test(issue)));
  });
}

test('structured protocol checks required fields, types, links and failure guidance', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-protocol-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const cases = [
    ['valid', () => {}, 0],
    [
      'missing',
      (d) => {
        delete d['route-decision.md'].skills;
      },
      1
    ],
    [
      'type',
      (d) => {
        d['route-decision.md'].skills = 'a';
      },
      1
    ],
    [
      'correlation',
      (d) => {
        d['learn-cards.md'][0].correlationId = 'wrong';
      },
      1
    ],
    [
      'runId',
      (d) => {
        d['quest-map.md'].runId = 'wrong';
      },
      1
    ],
    [
      'route-link',
      (d) => {
        d['quest-map.md'].routeDecisionId = 'wrong';
      },
      1
    ],
    [
      'gate',
      (d) => {
        d['verify-report.md'].gateResults[0].status = 'fail';
      },
      1
    ],
    [
      'quest',
      (d) => {
        d['quest-results.md'][0].questId = 'unknown';
      },
      1
    ],
    [
      'attempt',
      (d) => {
        d['quest-results.md'][0].attempt = 0;
      },
      1
    ],
    [
      'result-status',
      (d) => {
        d['quest-results.md'][0].status = 'nonsense';
      },
      1
    ],
    [
      'overall-status',
      (d) => {
        d['verify-report.md'].overallStatus = 'nonsense';
      },
      1
    ],
    [
      'duplicate-attempt',
      (d) => {
        d['quest-results.md'].push({ ...d['quest-results.md'][0], id: 'other' });
      },
      1
    ],
    [
      'empty-gates',
      (d) => {
        d['verify-report.md'].gateResults = [];
      },
      0
    ],
    [
      'invalid-gate',
      (d) => {
        d['verify-report.md'].gateResults = [null];
      },
      1
    ],
    [
      'invalid-quests',
      (d) => {
        d['quest-map.md'].quests = [null];
      },
      1
    ],
    [
      'failed-quest',
      (d) => {
        d['quest-results.md'][0].status = 'failed';
      },
      1
    ],
    [
      'failed-gate-valid',
      (d) => {
        d['verify-report.md'].overallStatus = 'fail';
        d['verify-report.md'].gateResults[0] = {
          name: 'test',
          status: 'fail',
          evidence: 'exit 1',
          recommendedNext: 'fix'
        };
      },
      0
    ],
    [
      'contradiction',
      (d) => {
        d['verify-report.md'].gateResults[0] = {
          name: 'test',
          status: 'fail',
          evidence: 'exit 1',
          recommendedNext: 'fix'
        };
      },
      1
    ],
    [
      'implement',
      (d) => {
        d['route-decision.md'].strategy = 'implement';
      },
      1
    ]
  ];
  for (const [name, mutate, status] of cases) {
    const id = `run-${name}`;
    const d = protocolRun(id);
    mutate(d);
    writeProtocolRun(tmp, id, d);
    const result = runValidate(tmp, ['--run', id, '--json']);
    assert.equal(result.status, status, `${name}: ${result.stdout}${result.stderr}`);
    if (status) assert.ok(JSON.parse(result.stdout).protocolIssues.length > 0);
  }
});

test('raw JSON and multiple result blocks validate; mixed or malformed documents fail', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-protocol-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const docs = protocolRun('run-formats');
  const dir = writeProtocolRun(tmp, 'run-formats', docs);
  fs.writeFileSync(path.join(dir, 'route-decision.md'), JSON.stringify(docs['route-decision.md']));
  fs.writeFileSync(
    path.join(dir, 'quest-results.md'),
    '```json\n' + JSON.stringify(docs['quest-results.md'][0]) + '\n```'
  );
  assert.equal(runValidate(tmp, ['--run', 'run-formats']).status, 0);
  for (const value of [
    'goal: text',
    '```json\n{\n```',
    '```json\n{}\n```',
    '```json\nnull\n```',
    '```json\n' + JSON.stringify(docs['quest-map.md']) + '\n```\n```json\n{'
  ]) {
    fs.writeFileSync(path.join(dir, 'quest-map.md'), value);
    assert.equal(runValidate(tmp, ['--run', 'run-formats']).status, 1, value);
  }
});

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
    'route-decision.md':
      '- strategy: implement\n- complexity: medium\n- verify: npm run check\n- goal: improve coverage testing\n- knowledge inputs: [insight:patterns.md#Coverage testing pattern]\n',
    'quest-map.md': '- goal: add tests for scripts and verify coverage\n- plan: write unit tests\n',
    'quest-results.md':
      '- quest: Q1\n- execution: added tests\n- findings: coverage support works\n- status: pass\n',
    'verify-report.md':
      '- command: `npm run check`\n- result: PASS\n- command: `node scripts/validate-run-completeness.js --run run-coverage-pass`\n- result: PASS\n- `lint`: pass\n- `regression`: pass\n- `run-completeness`: pass\n- gate knowledge-reuse: PASS [insight:patterns.md#Coverage testing pattern]\n- verify: complete\n',
    'learn-cards.md':
      '- summary: added reusable coverage tests\n- recommendedAction: extend to other scripts\n- category: pattern\n- confidence: high\n',
    'index.md':
      '- runId: run-coverage-pass\n- strategy: implement\n- goal: improve coverage testing\n- verification: complete\n- status: completed\n'
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
    'route-decision.md':
      '- strategy: implement\n- complexity: medium\n- verify: npm run check\n- goal: improve coverage testing\n',
    'quest-map.md': '- goal: add tests\n- plan: add tests for scripts and verify coverage\n',
    'quest-results.md':
      '- quest: Q1\n- execution: added tests\n- findings: coverage support works\n',
    'verify-report.md':
      '- command: `npm run check`\n- result: PASS\n- `lint`: pass\n- `regression`: pass\n- `run-completeness`: pending\n- gate knowledge-reuse: PASS\n- verify: complete\n',
    'learn-cards.md':
      '- summary: added reusable coverage tests\n- recommendedAction: extend to other scripts\n- category: pattern\n- confidence: high\n',
    'index.md':
      '- runId: run-coverage-fail\n- strategy: implement\n- goal: improve coverage testing\n- verification: complete\n'
  });

  const result = runValidate(tempRoot, ['--run', 'run-coverage-fail']);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /knowledge-reuse/);
});
