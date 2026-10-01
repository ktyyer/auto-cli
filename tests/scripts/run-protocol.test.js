import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseProtocolDocument, readRunProtocol } from '../../scripts/run-protocol.js';
import { protocolRun, writeProtocolRun } from '../fixtures/protocol-run.js';

test('protocol fences accept Markdown indentation, delimiters and longer closing fences', () => {
  for (const [open, close] of [
    ['```json', '```'],
    ['  ```json', '  ```'],
    ['   ~~~JSON', ' ~~~~'],
    ['````json', '`````']
  ]) {
    const content = `# Protocol\r\n\r\n${open}\r\n{"id":"first"}\r\n${close}\r\n`;
    assert.deepEqual(parseProtocolDocument(content), {
      structured: true,
      objects: [{ id: 'first' }]
    });
  }
});

test('invalid or unclosed JSON fences cannot silently fall back or drop later objects', () => {
  for (const invalid of [
    '  ```json\n{broken}\n  ```',
    '~~~json\n{}',
    '````json\n{}\n```',
    '```json\n{}\n~~~',
    '   ~~~json\nnull\n   ~~~'
  ]) {
    for (const prefix of ['', '# Protocol\n\n```json\n{"id":"first"}\n```\n']) {
      const parsed = parseProtocolDocument(prefix + invalid);
      assert.equal(parsed.structured, true, prefix + invalid);
      assert.match(parsed.error, /invalid JSON/);
      assert.deepEqual(parsed.objects, []);
    }
  }
});

test('JSON examples inside non-protocol fences are not protocol data', () => {
  const examples = '# Example\n\n````text\n```json\n{broken}\n```\n````\n';
  assert.deepEqual(parseProtocolDocument(examples), { structured: false, objects: [] });
  assert.deepEqual(parseProtocolDocument(examples + '\n~~~json\n{"id":"real"}\n~~~'), {
    structured: true,
    objects: [{ id: 'real' }]
  });
});

/** Write a fixture run after `mutate` adjusts its documents, then validate it. */
function validate(t, mutate) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-protocol-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const docs = protocolRun('run-enum');
  mutate(docs);
  return readRunProtocol(writeProtocolRun(tmp, 'run-enum', docs));
}

const withQuestStatus = (status) => (docs) => {
  const quest = docs['quest-results.md'][0];
  quest.status = status;
  // A failed attempt is only valid with its recovery context, so supply it.
  if (status === 'failed') {
    quest.failureContext = { recommendedNext: 'retry with a narrower scope' };
    quest.retry = { allowed: true };
  }
};

test('QuestResult.status accepts v2 values and keeps v1 values valid', (t) => {
  const v2 = ['succeeded', 'cancelled', 'suspended'];
  const v1 = ['pending', 'running', 'completed', 'failed', 'skipped', 'blocked'];
  for (const status of [...v2, ...v1]) {
    const { issues } = validate(t, withQuestStatus(status));
    assert.deepEqual(issues, [], status);
  }
});

test('gate and overall status accept not_applicable when a reason is recorded', (t) => {
  const { issues } = validate(t, (docs) => {
    docs['verify-report.md'].gateResults = [
      { name: 'security', status: 'not_applicable', evidence: 'docs-only change' }
    ];
    docs['verify-report.md'].overallStatus = 'not_applicable';
  });
  assert.deepEqual(issues, []);
});

test('a not_applicable gate does not block an overall pass', (t) => {
  const { issues } = validate(t, (docs) => {
    docs['verify-report.md'].gateResults.push({
      name: 'security',
      status: 'not_applicable',
      evidence: 'no input handling touched'
    });
    docs['verify-report.md'].overallStatus = 'pass';
  });
  assert.deepEqual(issues, []);
});

test('unknown status values are rejected at every level', (t) => {
  assert.ok(
    validate(t, withQuestStatus('done')).issues.includes('QuestResult.status: invalid status')
  );
  const gate = validate(t, (docs) => {
    docs['verify-report.md'].gateResults[0].status = 'n/a';
  });
  assert.ok(gate.issues.includes('VerifyReport gate: invalid status'));
  const overall = validate(t, (docs) => {
    docs['verify-report.md'].overallStatus = 'ok';
  });
  assert.ok(overall.issues.includes('VerifyReport.overallStatus: invalid status'));
});

test('a not_applicable gate without a reason is rejected', (t) => {
  for (const evidence of [undefined, '', '   ', [], {}]) {
    const { issues } = validate(t, (docs) => {
      docs['verify-report.md'].gateResults.push({
        name: 'security',
        status: 'not_applicable',
        evidence
      });
    });
    assert.ok(
      issues.includes('VerifyReport not_applicable gate: evidence (reason) required'),
      JSON.stringify(evidence)
    );
  }
});

test('overall not_applicable requires every gate to be not_applicable', (t) => {
  const reason = 'VerifyReport.overallStatus: not_applicable requires all gates not_applicable';
  const na = { name: 'security', status: 'not_applicable', evidence: 'docs-only change' };
  const ran = [
    { status: 'fail', evidence: 'npm test exit 1', recommendedNext: 'fix the failing case' },
    { status: 'pass', evidence: 'npm test exit 0' },
    { status: 'warning', evidence: 'one flaky retry' },
    { status: 'skipped', evidence: 'runner unavailable' },
    { status: 'pending' }
  ].map((gate) => [{ name: 'test', ...gate }, na]);
  for (const gateResults of [...ran, [], [null]]) {
    const { issues } = validate(t, (docs) => {
      docs['verify-report.md'].gateResults = gateResults;
      docs['verify-report.md'].overallStatus = 'not_applicable';
    });
    assert.ok(issues.includes(reason), JSON.stringify({ gateResults, issues }));
  }
});

test('a report whose gates are all not_applicable cannot claim another verdict', (t) => {
  const reason = 'VerifyReport.overallStatus: all gates not_applicable requires not_applicable';
  for (const overallStatus of ['pass', 'pass-with-warnings', 'fail', 'partial', 'blocked']) {
    const { issues } = validate(t, (docs) => {
      docs['verify-report.md'].gateResults = [
        { name: 'test', status: 'not_applicable', evidence: 'explore strategy, no code change' },
        { name: 'security', status: 'not_applicable', evidence: 'docs-only change' }
      ];
      docs['verify-report.md'].overallStatus = overallStatus;
    });
    assert.ok(issues.includes(reason), `${overallStatus}: ${JSON.stringify(issues)}`);
  }
});

const failedGate = (evidence) => (docs) => {
  docs['verify-report.md'].gateResults = [
    { name: 'test', status: 'fail', evidence, recommendedNext: 'rerun after the fix' }
  ];
  docs['verify-report.md'].overallStatus = 'fail';
};

test('blank evidence is neither a not_applicable reason nor failure evidence', (t) => {
  const blank = [[''], ['  ', ''], { reason: null }, { reason: '  ' }, [[]], [{}]];
  // A bare number or boolean states no reason; scalars only count inside structured evidence.
  for (const evidence of [...blank, false, true, 0, 1, -1]) {
    const na = validate(t, (docs) => {
      docs['verify-report.md'].gateResults.push({
        name: 'security',
        status: 'not_applicable',
        evidence
      });
    });
    assert.ok(
      na.issues.includes('VerifyReport not_applicable gate: evidence (reason) required'),
      JSON.stringify(evidence)
    );
    const failed = validate(t, failedGate(evidence));
    assert.ok(
      failed.issues.includes('VerifyReport failed gate: evidence required'),
      JSON.stringify(evidence)
    );
  }
});

test('structured evidence with real content is accepted', (t) => {
  for (const evidence of [
    { command: 'npm test', exitCode: 1 },
    { exitCode: 1 },
    ['npm test exit 1'],
    { checks: [{ ok: false }] }
  ]) {
    assert.deepEqual(validate(t, failedGate(evidence)).issues, [], JSON.stringify(evidence));
  }
});

test('deeply nested evidence is walked without overflowing the stack', (t) => {
  const depth = 10000;
  const reason = 'VerifyReport not_applicable gate: evidence (reason) required';
  for (const [leaf, valid] of [
    ['', false],
    ['"docs-only change"', true]
  ]) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-protocol-'));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    const docs = protocolRun('run-deep');
    docs['verify-report.md'].gateResults.push({
      name: 'security',
      status: 'not_applicable',
      evidence: '__DEEP__'
    });
    const dir = writeProtocolRun(tmp, 'run-deep', docs);
    const file = path.join(dir, 'verify-report.md');
    const deep = '['.repeat(depth) + leaf + ']'.repeat(depth);
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf8').replace('"__DEEP__"', () => deep)
    );
    const { issues } = readRunProtocol(dir);
    if (valid) assert.deepEqual(issues, []);
    else assert.ok(issues.includes(reason), JSON.stringify(issues));
  }
});
