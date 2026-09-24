import test from 'node:test';
import assert from 'node:assert/strict';

import { extractAnchoredSections, findContractDrift } from '../../scripts/validate-capacity-contract.js';

const FULL =
  'intro\n' +
  '**容量假设** <!-- capacity-contract: assumption -->：数据量 ×100 反例，检查无界查询，否则 `capacity: not-applicable`。\n' +
  '\n' +
  '### 对抗验证\n' +
  '- **容量探针** <!-- capacity-contract: probe --> — 数据量 ×100、无界查询、全量集合，或 `capacity: not-applicable`\n' +
  '\n' +
  '## 下一节\n' +
  'unrelated text that must not be part of any anchored section\n';

const LIST =
  '- **容量/伸缩性** <!-- capacity-contract: probe --> — 数据量 ×100；检查无界查询，或 `capacity: not-applicable`\n' +
  '\n' +
  '涉及数据的任务在 PASS 前必须执行容量探针。\n' +
  '\n' +
  '#### 模式 1: 验证逃避\n' +
  '\n' +
  '警惕以下逃避策略: 这个不太可能发生\n';

const SPEC = { file: 'doc.md', anchors: { assumption: 1, probe: 1 } };

test('extractAnchoredSections stops each section at the next heading', () => {
  const sections = extractAnchoredSections(FULL);
  assert.deepEqual(Object.keys(sections).sort(), ['assumption', 'probe']);
  assert.equal(sections.assumption.length, 1);
  assert.equal(sections.probe.length, 1);
  assert.ok(sections.probe[0].includes('无界查询'));
  assert.ok(!sections.probe[0].includes('unrelated text'));
});

test('a complete document satisfies the contract', () => {
  assert.deepEqual(findContractDrift(FULL, SPEC), []);
});

test('a section continues past indented list content and stops at the next heading', () => {
  const sections = extractAnchoredSections(LIST);
  assert.equal(sections.probe.length, 1);
  assert.ok(sections.probe[0].includes('PASS 前必须执行容量探针'));
  assert.ok(!sections.probe[0].includes('验证逃避'));
  assert.deepEqual(findContractDrift(LIST, { file: 'doc.md', anchors: { probe: 1 } }), []);
});

test('dropping an anchor fails even when every phrase survives elsewhere', () => {
  const content = FULL.replace('<!-- capacity-contract: probe -->', '');
  const failures = findContractDrift(content, SPEC);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /expected 1 "probe" anchor/);
});

test('rewording a section so it drops a requirement fails', () => {
  const content = FULL.replace('无界查询、全量集合', '全量集合');
  const failures = findContractDrift(content, SPEC);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /"probe" section missing requirement "unbounded-query"/);
});

test('an undeclared role is flagged', () => {
  const content = FULL + '\n<!-- capacity-contract: budget --> extra\n';
  const failures = findContractDrift(content, SPEC);
  assert.ok(failures.some((f) => /unexpected capacity-contract role "budget"/.test(f)));
});
