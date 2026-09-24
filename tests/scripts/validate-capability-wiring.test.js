import test from 'node:test';
import assert from 'node:assert/strict';

import { collectHooks, findWiringDrift } from '../../scripts/validate-capability-wiring.js';

// Minimal hooks.json shape: { <event>: [ { description, hooks: [{ command }] } ] }
function hooksFixture() {
  return {
    hooks: {
      PostToolUse: [
        {
          description: 'Incremental review: accumulate dirty file list at .auto/runs/<latest>/dirty.txt',
          hooks: [{ command: '#!/bin/bash\necho "$fp" >> .auto/runs/$run/dirty.txt' }],
        },
      ],
      Stop: [
        {
          description: 'If latest run lacks metrics.json, run scripts/generate-metrics.js',
          hooks: [{ command: '#!/bin/bash\nnode scripts/generate-metrics.js "$run"' }],
        },
      ],
    },
  };
}

function manifestFixture() {
  return [
    {
      event: 'PostToolUse',
      descriptionIncludes: 'Incremental review: accumulate dirty file list',
      evidenceIncludes: 'dirty.txt',
    },
    { event: 'Stop', descriptionIncludes: 'lacks metrics.json', evidenceIncludes: 'generate-metrics.js' },
  ];
}

test('collectHooks flattens events and entries into flat records', () => {
  const hooks = collectHooks(hooksFixture());
  assert.equal(hooks.length, 2);
  assert.deepEqual(
    hooks.map((h) => h.event).sort(),
    ['PostToolUse', 'Stop']
  );
  assert.ok(hooks.every((h) => typeof h.command === 'string' && h.command.length > 0));
});

test('consistent manifest and hooks produce no drift', () => {
  const hooks = collectHooks(hooksFixture());
  assert.deepEqual(findWiringDrift(hooks, manifestFixture()), []);
});

test('declared capability with no matching hook is flagged', () => {
  const hooks = collectHooks(hooksFixture());
  const manifest = [...manifestFixture(), { event: 'Stop', descriptionIncludes: 'nonexistent capability' }];
  const failures = findWiringDrift(hooks, manifest);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /declared-but-not-wired/);
});

test('evidence marker drift (dirty.txt renamed to dirty.json) is flagged', () => {
  const hooks = collectHooks(hooksFixture());
  const manifest = manifestFixture();
  manifest[0].evidenceIncludes = 'dirty.json'; // simulate the real bug we fixed
  const failures = findWiringDrift(hooks, manifest);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /evidence-missing/);
});

test('unregistered (orphan) hook is flagged', () => {
  const hooks = collectHooks(hooksFixture());
  const manifest = [manifestFixture()[0]]; // drop the Stop/metrics registration
  const failures = findWiringDrift(hooks, manifest);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /orphan-hook/);
});
