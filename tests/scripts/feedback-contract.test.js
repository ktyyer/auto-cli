import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeObservations,
  validateFeedbackReference
} from '../../scripts/feedback-contract.js';

const observation = (outcome, uses = 1) => ({
  uses,
  date: '2026-09-29',
  outcome,
  evidence: ['run/quest-results.md']
});
function store(collection, outcomes) {
  return {
    schemaVersion: 'auto-feedback/v1',
    lastUpdated: '2026-09-29',
    ...(collection === 'skills' ? { portablePatterns: [] } : {}),
    entry: {
      [collection === 'skills' ? 'usageCount' : 'totalCalls']: 100,
      lastUsed: '2026-09-29',
      successRate: 0.5,
      observations: {
        a: observation('success'),
        b: observation('failure'),
        c: observation('unknown')
      },
      legacyMetrics: { successRate: 1 },
      tier: 'core',
      ...outcomes
    }
  };
}

test('measured rate excludes unknown runs, historical counts and repeated calls', () => {
  const data = store('agents');
  data.entry.observations.a.uses = 20;
  assert.equal(validateFeedbackReference(data, 'agents', 'entry'), null);
  assert.deepEqual(summarizeObservations(data.entry.observations, 'agents'), {
    uses: 22,
    lastUsed: '2026-09-29',
    measuredCount: 2,
    successRate: 0.5
  });
  assert.equal(summarizeObservations({ a: observation('unknown') }, 'skills').successRate, null);
  assert.equal(summarizeObservations({}, 'skills').successRate, null);
  data.entry.successRate = 20 / 21;
  assert.match(validateFeedbackReference(data, 'agents', 'entry'), /successRate/);
});

test('canonical entries preserve extensions, require observations and reject schema drift', () => {
  for (const collection of ['skills', 'agents']) {
    const data = store(collection);
    const before = JSON.stringify(data);
    assert.equal(validateFeedbackReference(data, collection, 'entry'), null);
    assert.equal(JSON.stringify(data), before);
    for (const mutate of [
      (d) => {
        d.schemaVersion = 'auto-feedback/v9';
      },
      (d) => {
        d[collection] = {};
      },
      (d) => {
        delete d.entry.observations;
      },
      (d) => {
        d.entry.successRate = null;
      },
      (d) => {
        d.entry.lastUsed = '2026-02-30';
      },
      (d) => {
        d.entry.lastUsed = '2026-09-28';
      },
      (d) => {
        d.entry[collection === 'skills' ? 'usageCount' : 'totalCalls'] = 1;
      },
      (d) => {
        d.entry.portablePatterns = [];
      },
      (d) => {
        d.entry.observations.c.evidence = [null];
      },
      (d) => {
        d.entry.observations.c.outcome = 'pending';
      }
    ]) {
      const changed = structuredClone(data);
      mutate(changed);
      assert.match(validateFeedbackReference(changed, collection, 'entry'), /invalid feedback/);
    }
  }
});

test('legacy references validate counts without manufacturing samples', () => {
  for (const collection of ['skills', 'agents']) {
    const count = collection === 'skills' ? 'usageCount' : 'totalCalls';
    const entries = JSON.parse(`{"constructor":{"${count}":4,"successRate":1}}`);
    assert.equal(validateFeedbackReference(entries, collection, 'constructor'), null);
    assert.equal(
      validateFeedbackReference({ [collection]: entries }, collection, 'constructor'),
      null
    );
    assert.match(
      validateFeedbackReference({ ...entries, [collection]: entries }, collection, 'constructor'),
      /ambiguous/
    );
    for (const value of [-1, 1.5, '4', Number.MAX_SAFE_INTEGER + 1]) {
      assert.match(
        validateFeedbackReference({ entry: { [count]: value } }, collection, 'entry'),
        /invalid/
      );
    }
    assert.match(validateFeedbackReference({}, collection, 'constructor'), /missing/);
    for (const key of [
      'version',
      'schemaVersion',
      'portablePatterns',
      'skills',
      'agents',
      'lastUpdated'
    ]) {
      assert.match(
        validateFeedbackReference({ [key]: { [count]: 4 } }, collection, key),
        /reserved/
      );
    }
  }
});

test('portable knowledge has one canonical location and valid source identity', () => {
  const data = store('skills');
  data.portablePatterns = [
    {
      id: 'p1',
      runId: 'run-p1',
      skill: 'entry',
      scope: 'universal',
      confidence: 'high',
      title: 'Pattern',
      summary: 'Evidence matters'
    }
  ];
  assert.equal(validateFeedbackReference(data, 'skills', 'entry'), null);
  data.portablePatterns[0].scope = 'project';
  assert.match(validateFeedbackReference(data, 'skills', 'entry'), /portablePatterns/);
  const agentData = store('agents');
  agentData.portablePatterns = [];
  assert.match(validateFeedbackReference(agentData, 'agents', 'entry'), /portablePatterns/);
});

test('skill activations are once per run; agent calls remain safe integers', () => {
  assert.match(
    summarizeObservations({ a: observation('success', 2) }, 'skills').error,
    /observation/
  );
  assert.match(
    summarizeObservations(
      { a: observation('success', Number.MAX_SAFE_INTEGER), b: observation('success') },
      'agents'
    ).error,
    /safe integer/
  );
  const empty = store('skills', {
    usageCount: 0,
    lastUsed: null,
    observations: {},
    successRate: null
  });
  assert.equal(validateFeedbackReference(empty, 'skills', 'entry'), null);
});
