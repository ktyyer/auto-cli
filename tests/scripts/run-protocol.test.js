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
