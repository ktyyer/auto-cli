import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProtocolDocument } from '../../scripts/run-protocol.js';

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

test('v2 enum expansion: QuestResult.status accepts succeeded/cancelled/suspended', async () => {
  const { readRunProtocol } = await import('../../scripts/run-protocol.js');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-'));
  const runDir = path.join(tmpDir, 'run-test-v2enum');
  fs.mkdirSync(runDir, { recursive: true });

  try {
    fs.writeFileSync(path.join(runDir, 'route-decision.md'), JSON.stringify({
      id: 'rd-1', runId: 'run-test-v2enum', correlationId: 'c1', status: 'completed',
      summary: 'test', userIntent: 'test', strategy: 'implement', primaryAgent: 'main',
      skills: [], next: 'PLAN'
    }));

    fs.writeFileSync(path.join(runDir, 'quest-map.md'), JSON.stringify({
      id: 'qm-1', runId: 'run-test-v2enum', correlationId: 'c1', status: 'completed',
      summary: 'test', routeDecisionId: 'rd-1', goal: 'test', executionMode: 'sequential',
      assumptions: [], alternatives: [], riskMatrix: [], reflexionNote: 'none',
      quests: [{ questId: 'q1', objective: 'test', ownerAgent: 'main', acceptance: ['done'] }]
    }));

    for (const status of ['succeeded', 'cancelled', 'suspended']) {
      fs.writeFileSync(path.join(runDir, 'quest-results.md'), JSON.stringify({
        id: 'qr-1', runId: 'run-test-v2enum', correlationId: 'c1', status,
        summary: 'test', questId: 'q1', attempt: 1, ownerAgent: 'main', changedFiles: []
      }));
      const result = readRunProtocol(runDir);
      assert.equal(result.issues.length, 0, `${status} should be valid, got: ${result.issues.join(', ')}`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v2 enum expansion: gate.status and overallStatus accept not_applicable', async () => {
  const { readRunProtocol } = await import('../../scripts/run-protocol.js');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-'));
  const runDir = path.join(tmpDir, 'run-test-v2gate');
  fs.mkdirSync(runDir, { recursive: true });

  try {
    fs.writeFileSync(path.join(runDir, 'route-decision.md'), JSON.stringify({
      id: 'rd-1', runId: 'run-test-v2gate', correlationId: 'c1', status: 'completed',
      summary: 'test', userIntent: 'test', strategy: 'explore', primaryAgent: 'main',
      skills: [], next: 'PLAN'
    }));

    fs.writeFileSync(path.join(runDir, 'verify-report.md'), JSON.stringify({
      id: 'vr-1', runId: 'run-test-v2gate', correlationId: 'c1', status: 'completed',
      summary: 'test', gateResults: [
        { name: 'test-gate', status: 'not_applicable', evidence: 'N/A for explore strategy' }
      ],
      overallStatus: 'not_applicable', nextAction: 'SUMMARIZE'
    }));

    const result = readRunProtocol(runDir);
    assert.equal(result.issues.length, 0, `not_applicable should be valid, got: ${result.issues.join(', ')}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
