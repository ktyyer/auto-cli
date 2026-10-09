import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  HOST_ATTEMPTS_SCHEMA,
  HOST_OBSERVATION_LIMITS,
  importHostObservation,
  readHostObservation
} from '../../scripts/import-host-observation.js';

const script = fileURLToPath(new URL('../../scripts/import-host-observation.js', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const codexTerminal = (usage = { input_tokens: 100, output_tokens: 5 }) => ({
  type: 'turn.completed',
  usage
});
const claudeTerminal = (overrides = {}) => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  uuid: 'result-1',
  usage: {
    input_tokens: 10,
    cache_read_input_tokens: 20,
    cache_creation_input_tokens: 30,
    output_tokens: 4
  },
  total_cost_usd: 0.01,
  ...overrides
});

function fixture(t, definitions, runId = 'run-observation') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-observation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, 'input');
  const runDir = path.join(root, '.auto', 'runs', runId);
  fs.mkdirSync(input, { recursive: true });
  fs.mkdirSync(runDir, { recursive: true });
  const manifest = {
    schemaVersion: HOST_ATTEMPTS_SCHEMA,
    runId,
    attempts: definitions.map(({ events = [], raw, missingLog, ...overrides }, index) => {
      const attempt = {
        attemptId: 'attempt-' + (index + 1),
        host: 'codex',
        surface: 'exec-json',
        hostVersion: '0.154.0',
        model: 'gpt-6-astra',
        status: 'succeeded',
        startedAt: '2026-10-08T11:00:00Z',
        finishedAt: '2026-10-08T11:00:01Z',
        wallTimeMs: 1000,
        exitCode: 0,
        usageScope: 'attempt',
        ...overrides
      };
      if (missingLog) attempt.log = null;
      else {
        const bytes = Buffer.from(
          raw ?? events.map((event) => JSON.stringify(event)).join('\n') + '\n'
        );
        const name = 'source-' + (index + 1) + '.jsonl';
        fs.writeFileSync(path.join(input, name), bytes);
        attempt.log = { path: name, sha256: hash(bytes) };
      }
      return attempt;
    })
  };
  const manifestPath = path.join(input, 'manifest.json');
  const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  save();
  return {
    root,
    input,
    runDir,
    manifestPath,
    manifest,
    save,
    read: () => importHostObservation({ manifestPath }),
    persist: () => importHostObservation({ manifestPath, runDir })
  };
}

test('Claude uses final aggregate once and records the observed model independently of its CLI brand', (t) => {
  const f = fixture(t, [
    {
      host: 'claude',
      surface: 'stream-json',
      hostVersion: '2.1.281',
      model: 'glm-5.3',
      events: [
        { type: 'system', subtype: 'init', model: 'glm-5.3', claude_code_version: '2.1.281' },
        {
          type: 'assistant',
          uuid: 'thinking',
          message: {
            id: 'same-message',
            model: 'glm-5.3',
            usage: { input_tokens: 0, output_tokens: 0 },
            content: [{ type: 'thinking' }]
          }
        },
        {
          type: 'assistant',
          uuid: 'text',
          message: {
            id: 'same-message',
            model: 'glm-5.3',
            usage: { input_tokens: 0, output_tokens: 0 },
            content: [{ type: 'text', text: 'done' }]
          }
        },
        { type: 'system', subtype: 'thinking_tokens', thinking_tokens: 9000 },
        claudeTerminal({
          usage: {
            input_tokens: 2136,
            cache_read_input_tokens: 1984,
            cache_creation_input_tokens: 0,
            output_tokens: 132,
            output_tokens_details: { thinking_tokens: 0 }
          },
          total_cost_usd: 0.0115808,
          duration_ms: 10020,
          duration_api_ms: 9679,
          num_turns: 2,
          modelUsage: {
            'glm-5.3': {
              inputTokens: 2136,
              outputTokens: 132,
              costUSD: 0.0115808,
              costBasis: 'unknown',
              provider: 'firstParty'
            }
          }
        })
      ]
    }
  ]);
  const observed = f.read();
  const attempt = observed.attempts[0];
  assert.equal(attempt.events.duplicates, 0, 'same message ID is not event identity');
  assert.deepEqual(attempt.observedModels, ['glm-5.3']);
  assert.deepEqual(attempt.observedVersions, ['2.1.281']);
  assert.equal(attempt.usage.totalInputTokens, 4120);
  assert.equal(attempt.usage.totalTokens, 4252);
  assert.equal(attempt.usage.reasoningOutputTokens, 0);
  assert.equal(attempt.cost.reportedEstimateUsd, 0.0115808);
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, 0.0115808);
  assert.equal(attempt.cost.billedUsd, null);
  assert.equal(attempt.cost.costBasis, 'unknown');
  assert.equal(attempt.timing.hostDurationMs, 10020);
  assert.equal(attempt.hostFields.reportedTurns, 2);
  assert.equal(observed.summary.taskAcceptance, 'not-measured');
  assert.equal(observed.summary.modelInvocations, null);
});

test('Codex inclusive input and output counters do not add cache or reasoning subsets again', (t) => {
  const f = fixture(t, [
    {
      events: [
        codexTerminal({
          input_tokens: 20306,
          cached_input_tokens: 10083,
          cache_write_input_tokens: 10217,
          output_tokens: 214,
          reasoning_output_tokens: 118
        })
      ]
    }
  ]);
  const attempt = f.read().attempts[0];
  assert.equal(attempt.usage.totalInputTokens, 20306);
  assert.equal(attempt.usage.totalTokens, 20520);
  assert.equal(attempt.usage.cacheReadInputTokens, 10083);
  assert.equal(attempt.usage.cacheWriteInputTokens, 10217);
  assert.equal(attempt.usage.reasoningOutputTokens, 118);
  assert.equal(attempt.cost.reportedEstimateUsd, null);
  assert.equal(attempt.cost.billedUsd, null);
});

test('Claude repeated root sessions retain each process and raw estimate without summing cumulative cost', (t) => {
  const f = fixture(t, [
    {
      host: 'claude',
      surface: 'stream-json',
      model: 'glm-5.3',
      events: [claudeTerminal({ session_id: 'shared-session', total_cost_usd: 0.3 })]
    },
    {
      host: 'claude',
      surface: 'stream-json',
      model: 'glm-5.3',
      retryOf: 'attempt-1',
      events: [claudeTerminal({ session_id: 'shared-session', total_cost_usd: 0.5 })]
    }
  ]);
  const observed = f.persist();
  assert.equal(observed.summary.attemptsStarted, 2);
  assert.deepEqual(
    observed.attempts.map((attempt) => attempt.cost.reportedEstimateUsd),
    [0.3, 0.5]
  );
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, null);
  assert.equal(observed.summary.byHost.claude.estimateAccounting, 'unknown-session-overlap');
  assert.deepEqual(observed.summary.byHost.claude.nonAdditiveEstimateAttemptIds, [
    'attempt-1',
    'attempt-2'
  ]);
  assert.equal(
    observed.summary.byHost.claude.totalTokens,
    128,
    'per-process usage is not cumulative modelUsage'
  );
  assert.equal(readHostObservation(f.runDir).status, 'verified');
});

test('a Claude resume descriptor prevents a single cumulative estimate from becoming attempt cost', (t) => {
  const f = fixture(t, [
    {
      host: 'claude',
      surface: 'stream-json',
      model: 'glm-5.3',
      resumeSessionId: 'prior-session',
      events: [claudeTerminal({ session_id: 'prior-session', total_cost_usd: 0.593956 })]
    }
  ]);
  const observed = f.read();
  assert.equal(observed.attempts[0].resumeSessionId, 'prior-session');
  assert.equal(observed.attempts[0].cost.reportedEstimateUsd, 0.593956);
  assert.equal(observed.attempts[0].cost.reportedEstimateScope, 'session-cumulative');
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, null);
  assert.equal(observed.summary.byHost.claude.estimateAccounting, 'unknown-estimate-scope');
  assert.deepEqual(observed.summary.byHost.claude.nonAdditiveEstimateAttemptIds, ['attempt-1']);
  assert.equal(observed.summary.byHost.claude.totalTokens, 64);
});

test('Claude cumulative modelUsage in a single log cannot be treated as process cost or token usage', (t) => {
  const modelUsage = {
    'glm-5.3': {
      inputTokens: 43730,
      outputTokens: 11115,
      cacheReadInputTokens: 983680,
      cacheCreationInputTokens: 0,
      costUSD: 0.593956
    }
  };
  const observed = fixture(t, [
    {
      host: 'claude',
      surface: 'stream-json',
      model: 'glm-5.3',
      events: [
        claudeTerminal({
          session_id: 'resumed-session',
          total_cost_usd: 0.593956,
          modelUsage,
          usage: {
            input_tokens: 6352,
            output_tokens: 2634,
            cache_read_input_tokens: 343616,
            cache_creation_input_tokens: 0
          }
        })
      ]
    }
  ]).read();
  assert.equal(observed.attempts[0].cost.reportedEstimateUsd, 0.593956);
  assert.deepEqual(observed.attempts[0].cost.modelUsage, modelUsage);
  assert.equal(observed.attempts[0].cost.reportedEstimateScope, 'unknown-model-usage-range');
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, null);
  assert.equal(observed.summary.byHost.claude.totalTokens, 352602);
  assert.match(observed.attempts[0].warnings.join('\n'), /model-usage-exceeds-result-usage/);
});

test('worker session references do not create root-session cost overlap and included workers stay excluded', (t) => {
  const f = fixture(t, [
    {
      attemptId: 'parent',
      host: 'claude',
      surface: 'stream-json',
      model: 'glm-5.3',
      usageScope: 'attempt-and-descendants',
      events: [
        claudeTerminal({
          session_id: 'worker-session',
          worker_id: 'worker-1',
          total_cost_usd: 0.02
        }),
        claudeTerminal({ session_id: 'parent-session', total_cost_usd: 0.08 })
      ]
    },
    {
      attemptId: 'worker',
      parentAttemptId: 'parent',
      host: 'claude',
      surface: 'stream-json',
      model: 'glm-5.3',
      resumeSessionId: 'worker-session',
      events: [claudeTerminal({ session_id: 'worker-session', total_cost_usd: 0.02 })]
    }
  ]);
  let observed = f.read();
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, 0.08);
  assert.deepEqual(observed.summary.excludedIncludedWorkerIds, ['worker']);
  assert.deepEqual(observed.attempts[0].hostFields.rootSessionIds, ['parent-session']);
  f.manifest.attempts[0].usageScope = 'attempt';
  f.manifest.attempts[1].resumeSessionId = null;
  f.save();
  observed = f.read();
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, 0.1);
  assert.deepEqual(observed.summary.byHost.claude.nonAdditiveEstimateAttemptIds, []);
  assert.equal(observed.summary.byHost.claude.totalTokens, 128);
});

test('a shared session value in different hosts is not a cross-host cost collision', (t) => {
  const observed = fixture(t, [
    { events: [{ type: 'thread.started', thread_id: 'shared-session' }, codexTerminal()] },
    {
      host: 'claude',
      surface: 'stream-json',
      events: [claudeTerminal({ session_id: 'shared-session' })]
    }
  ]).read();
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, 0.01);
});

test('independent Claude session attempts remain additive even when one retries another', (t) => {
  const observed = fixture(t, [
    {
      host: 'claude',
      surface: 'stream-json',
      events: [claudeTerminal({ session_id: 'first-session', total_cost_usd: 0.03 })]
    },
    {
      host: 'claude',
      surface: 'stream-json',
      retryOf: 'attempt-1',
      resumeSessionId: null,
      events: [claudeTerminal({ session_id: 'second-session', total_cost_usd: 0.05 })]
    }
  ]).read();
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, 0.08);
  assert.equal(observed.summary.byHost.claude.totalTokens, 128);
  assert.deepEqual(observed.summary.byHost.claude.estimateAccountingIssues, []);
});

test('a declared inclusive parent keeps its estimate when an included worker shares the root session', (t) => {
  const observed = fixture(t, [
    {
      attemptId: 'parent',
      host: 'claude',
      surface: 'stream-json',
      usageScope: 'attempt-and-descendants',
      events: [
        claudeTerminal({
          session_id: 'shared-session',
          total_cost_usd: 0.08,
          modelUsage: { 'glm-5.3': { inputTokens: 25, outputTokens: 12 } }
        })
      ]
    },
    {
      attemptId: 'worker',
      parentAttemptId: 'parent',
      host: 'claude',
      surface: 'stream-json',
      resumeSessionId: 'shared-session',
      events: [claudeTerminal({ session_id: 'shared-session', total_cost_usd: 0.02 })]
    }
  ]).read();
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, 0.08);
  assert.equal(observed.summary.byHost.claude.totalTokens, 64);
  assert.equal(observed.attempts[1].cost.reportedEstimateUsd, 0.02);
  assert.deepEqual(observed.summary.excludedIncludedWorkerIds, ['worker']);
  assert.deepEqual(observed.summary.byHost.claude.nonAdditiveEstimateAttemptIds, []);
});

test('a larger model output or cache counter also makes estimate scope unknown without changing result tokens', (t) => {
  for (const [key, value] of [
    ['outputTokens', 5],
    ['cacheReadInputTokens', 21],
    ['cacheCreationInputTokens', 31]
  ]) {
    const observed = fixture(t, [
      {
        host: 'claude',
        surface: 'stream-json',
        events: [
          claudeTerminal({ modelUsage: { first: { [key]: value - 1 }, second: { [key]: 1 } } })
        ]
      }
    ]).read();
    assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, null, key);
    assert.equal(observed.summary.byHost.claude.totalTokens, 64, key);
    assert.deepEqual(
      observed.summary.byHost.claude.estimateAccountingIssues,
      [{ reason: 'unknown-model-usage-range', attemptIds: ['attempt-1'] }],
      key
    );
  }
});

test('a resume with a different observed root keeps uncertain cost and identifies the metadata mismatch', (t) => {
  const observed = fixture(t, [
    {
      host: 'claude',
      surface: 'stream-json',
      resumeSessionId: 'resumed-session',
      events: [claudeTerminal({ session_id: 'different-session' })]
    }
  ]).read();
  assert.equal(observed.summary.byHost.claude.reportedEstimateUsd, null);
  assert.equal(observed.summary.byHost.claude.totalTokens, 64);
  assert.match(
    observed.attempts[0].warnings.join('\n'),
    /declared-resume-session-differs-from-root-session/
  );
});

test('invalid resume metadata is rejected instead of silently ignoring a possible cumulative range', (t) => {
  for (const resumeSessionId of ['', '   ', 'session\nother', 123, {}, false]) {
    const f = fixture(t, [{ resumeSessionId, events: [codexTerminal()] }]);
    assert.throws(() => f.read(), /resumeSessionId/);
  }
});

test('a completed host turn with failed shell execution never becomes tool success or task acceptance', (t) => {
  const f = fixture(t, [
    {
      events: [
        {
          type: 'item.completed',
          item: {
            type: 'command_execution',
            id: 'item-0',
            exit_code: 1,
            status: 'failed',
            aggregated_output: 'bwrap: no user namespaces'
          }
        },
        codexTerminal()
      ]
    }
  ]);
  const observed = f.read();
  assert.equal(observed.attempts[0].hostOutcome, 'succeeded');
  assert.deepEqual(observed.attempts[0].toolResults, { succeeded: 0, failed: 1, unknown: 0 });
  assert.equal(observed.summary.taskAcceptance, 'not-measured');
  assert.match(observed.attempts[0].warnings.join('\n'), /tool-failure-observed/);
});

test('contradictory or unsupported Codex command status keeps tool outcomes unknown', (t) => {
  const f = fixture(t, [
    {
      events: [
        ...[
          { exit_code: 0, status: 'failed' },
          { exit_code: 0, status: 'in_progress' },
          { exit_code: 0, status: 'unrecognized' },
          { exit_code: 1, status: 'completed' }
        ].map((fields, index) => ({
          type: 'item.completed',
          item: { id: 'command-' + index, type: 'command_execution', ...fields }
        })),
        codexTerminal()
      ]
    }
  ]);
  const observed = f.read();
  assert.deepEqual(observed.attempts[0].toolResults, { succeeded: 0, failed: 0, unknown: 4 });
  assert.equal(observed.attempts[0].hostOutcome, 'succeeded');
  assert.equal(observed.summary.taskAcceptance, 'not-measured');
});

test('every declared failed, cancelled, timed out, running, empty and missing-log attempt survives import', (t) => {
  const f = fixture(t, [
    { status: 'failed', exitCode: 1, raw: '' },
    { status: 'cancelled', exitCode: 130, events: [codexTerminal()] },
    { status: 'timed_out', exitCode: null, missingLog: true },
    {
      status: 'running',
      exitCode: null,
      finishedAt: null,
      wallTimeMs: null,
      events: [{ type: 'turn.started' }]
    },
    { missingLog: true },
    { events: [{ type: 'turn.failed', error: { message: 'transport failed' } }] }
  ]);
  const observed = f.read();
  assert.equal(observed.summary.attemptsStarted, 6);
  assert.deepEqual(
    observed.attempts.map((attempt) => attempt.status),
    ['failed', 'cancelled', 'timed_out', 'running', 'unknown', 'failed']
  );
  assert.equal(observed.attempts[0].events.total, 0);
  assert.equal(
    observed.attempts[1].usage.totalTokens,
    105,
    'cancelled attempts retain usage already observed'
  );
  assert.equal(
    observed.summary.byHost.codex.totalTokens,
    null,
    'partial totals must not masquerade as complete cost'
  );
  assert.equal(observed.summary.byHost.codex.missingUsageAttempts, 5);
  assert.match(observed.attempts[4].warnings.join('\n'), /missing-raw-log/);
});

test('process failure cannot be overwritten by a successful host result', (t) => {
  const f = fixture(t, [{ status: 'failed', exitCode: 1, events: [codexTerminal()] }]);
  const attempt = f.read().attempts[0];
  assert.equal(attempt.hostOutcome, 'succeeded');
  assert.equal(attempt.status, 'failed');
  assert.match(attempt.warnings.join('\n'), /declared-process-status-differs/);
});

test('retry attempts are counted independently even when their raw logs are identical', (t) => {
  const f = fixture(t, [
    { attemptId: 'first', status: 'failed', exitCode: 1, events: [codexTerminal()] },
    { attemptId: 'retry', retryOf: 'first', events: [codexTerminal()] }
  ]);
  const observed = f.read();
  assert.equal(observed.summary.attemptsStarted, 2);
  assert.equal(observed.summary.byHost.codex.totalTokens, 210);
  assert.deepEqual(observed.summary.outcomes, {
    succeeded: 1,
    failed: 1,
    cancelled: 0,
    timed_out: 0,
    running: 0,
    unknown: 0
  });
});

test('exact event retransmission is deduplicated after key order normalization without changing raw bytes', (t) => {
  const raw =
    '{"type":"turn.completed","uuid":"same","usage":{"input_tokens":100,"output_tokens":5}}\r\n' +
    '{"usage":{"output_tokens":5,"input_tokens":100},"uuid":"same","type":"turn.completed"}\r\n';
  const f = fixture(t, [{ raw }]);
  const observed = f.persist();
  assert.equal(observed.attempts[0].events.total, 2);
  assert.equal(observed.attempts[0].events.duplicates, 1);
  assert.equal(observed.attempts[0].usage.totalTokens, 105);
  assert.deepEqual(
    fs.readFileSync(path.join(f.runDir, observed.provenance.logs[0].path)),
    Buffer.from(raw)
  );
});

test('conflicting event identities preserve both events and leave completion and usage unknown', (t) => {
  const f = fixture(t, [
    {
      events: [
        { ...codexTerminal(), event_id: 'same' },
        { ...codexTerminal({ input_tokens: 200, output_tokens: 5 }), event_id: 'same' },
        { ...codexTerminal({ input_tokens: 200, output_tokens: 5 }), event_id: 'same' },
        { ...codexTerminal(), event_id: 'same' }
      ]
    }
  ]);
  const attempt = f.read().attempts[0];
  assert.equal(attempt.events.unique, 2);
  assert.equal(attempt.events.duplicates, 2);
  assert.ok(
    attempt.events.entries.filter((entry) => !entry.duplicateOf).every((entry) => entry.ambiguous)
  );
  assert.equal(attempt.status, 'unknown');
  assert.equal(attempt.usage.totalTokens, null);
  assert.match(attempt.warnings.join('\n'), /conflicting-event-identity/);
});

test('non-finite JSON numbers cannot be normalized into a harmless duplicate of null', (t) => {
  const f = fixture(t, [
    {
      raw:
        '{"type":"turn.completed","event_id":"same","usage":{"input_tokens":1e400,"output_tokens":5}}\n' +
        '{"type":"turn.completed","event_id":"same","usage":{"input_tokens":null,"output_tokens":5}}\n'
    }
  ]);
  const attempt = f.read().attempts[0];
  assert.equal(attempt.hostOutcome, 'unknown');
  assert.equal(attempt.events.duplicates, 0);
  assert.equal(attempt.usage.totalTokens, null);
  assert.match(attempt.warnings.join('\n'), /invalid-json-event/);
});

test('out-of-order events still use a single terminal, while distinct terminals remain ambiguous', (t) => {
  const f = fixture(t, [
    {
      events: [
        codexTerminal(),
        { type: 'turn.started' },
        { type: 'thread.started', thread_id: 'thread-1' }
      ]
    },
    { events: [{ type: 'turn.failed' }, codexTerminal()] }
  ]);
  const attempts = f.read().attempts;
  assert.equal(attempts[0].usage.totalTokens, 105);
  assert.equal(attempts[0].usage.sourceLine, 1);
  assert.deepEqual(attempts[0].hostFields.sessionIds, ['thread-1']);
  assert.equal(attempts[1].status, 'unknown');
  assert.equal(attempts[1].usage.totalTokens, null);
  assert.match(attempts[1].warnings.join('\n'), /ambiguous-terminal/);
});

test('unknown events retain their source location and malformed JSON cannot manufacture success', (t) => {
  const f = fixture(t, [
    {
      events: [
        { type: 'future.event', usage: { input_tokens: 999999 }, success: true },
        codexTerminal()
      ]
    },
    { raw: JSON.stringify(codexTerminal()) + '\n{broken\n' },
    { events: [{ type: 'future.event', success: true }] }
  ]);
  const attempts = f.read().attempts;
  assert.deepEqual(attempts[0].events.unknownLines, [1]);
  assert.equal(attempts[0].usage.totalTokens, 105);
  assert.equal(attempts[1].status, 'unknown');
  assert.equal(attempts[1].usage.totalTokens, null);
  assert.equal(attempts[1].events.entries[1].type, 'invalid');
  assert.equal(attempts[2].status, 'unknown');
});

test('missing counters remain null, measured zero remains zero, and assistant-only usage is not an aggregate', (t) => {
  const f = fixture(t, [
    { events: [{ type: 'turn.completed' }] },
    { events: [codexTerminal({ input_tokens: 0, output_tokens: 0 })] },
    {
      host: 'claude',
      surface: 'stream-json',
      model: null,
      hostVersion: null,
      events: [claudeTerminal({ usage: { input_tokens: 2, output_tokens: 3 }, total_cost_usd: 0 })]
    },
    {
      host: 'claude',
      surface: 'stream-json',
      model: null,
      hostVersion: null,
      events: [{ type: 'assistant', message: { usage: { input_tokens: 100, output_tokens: 20 } } }]
    }
  ]);
  const attempts = f.read().attempts;
  assert.equal(attempts[0].usage.totalTokens, null);
  assert.equal(attempts[1].usage.totalTokens, 0);
  assert.equal(attempts[1].usage.cacheReadInputTokens, null);
  assert.equal(
    attempts[2].usage.totalInputTokens,
    null,
    'missing Claude cache counters do not mean zero'
  );
  assert.equal(attempts[2].cost.reportedEstimateUsd, 0);
  assert.equal(attempts[3].usage.inputTokens, null);
  assert.equal(attempts[3].status, 'unknown');
});

test('invalid numeric counters and impossible subsets are warned about and cannot become complete totals', (t) => {
  const f = fixture(t, [
    { events: [codexTerminal({ input_tokens: -1, output_tokens: '5' })] },
    { events: [codexTerminal({ input_tokens: 10, cached_input_tokens: 11, output_tokens: 5 })] },
    { events: [codexTerminal({ input_tokens: 10, output_tokens: 5, reasoning_output_tokens: 6 })] }
  ]);
  const attempts = f.read().attempts;
  for (const attempt of attempts) {
    assert.equal(attempt.usage.totalTokens, null);
    assert.match(attempt.warnings.join('\n'), /invalid-usage/);
  }
});

test('a worker terminal embedded in a parent stream does not add to or replace the parent aggregate', (t) => {
  const f = fixture(t, [
    {
      events: [
        { ...codexTerminal({ input_tokens: 900, output_tokens: 100 }), worker_id: 'worker-1' },
        codexTerminal()
      ],
      usageScope: 'attempt-and-descendants'
    }
  ]);
  const observed = f.read();
  assert.equal(observed.attempts[0].usage.totalTokens, 105);
  assert.deepEqual(observed.attempts[0].hostFields.workerReferences, ['worker-1']);
  assert.equal(observed.summary.byHost.codex.totalTokens, 105);
});

test('worker totals are included once according to an explicit parent aggregate scope', (t) => {
  const f = fixture(t, [
    {
      attemptId: 'parent',
      usageScope: 'attempt-and-descendants',
      events: [codexTerminal({ input_tokens: 120, output_tokens: 15 })]
    },
    {
      attemptId: 'worker',
      parentAttemptId: 'parent',
      events: [codexTerminal({ input_tokens: 20, output_tokens: 10 })]
    }
  ]);
  let observed = f.read();
  assert.equal(observed.summary.attemptsStarted, 2);
  assert.equal(observed.summary.byHost.codex.totalTokens, 135);
  assert.deepEqual(observed.summary.excludedIncludedWorkerIds, ['worker']);
  f.manifest.attempts[0].usageScope = 'attempt';
  f.save();
  observed = f.read();
  assert.equal(observed.summary.byHost.codex.totalTokens, 165);
  f.manifest.attempts[0].usageScope = 'unknown';
  f.save();
  observed = f.read();
  assert.equal(observed.summary.byHost.codex.totalTokens, null);
  assert.equal(observed.summary.accounting, 'unknown-worker-overlap');
});

test('embedded worker references with unknown scope do not yield a supposedly complete resource total', (t) => {
  const f = fixture(t, [
    {
      usageScope: 'unknown',
      events: [{ ...codexTerminal(), worker_id: 'worker-1' }, codexTerminal()]
    }
  ]);
  assert.equal(f.read().summary.byHost.codex.totalTokens, null);
});

test('worker-local tool IDs do not merge independent command outcomes', (t) => {
  const command = {
    type: 'item.completed',
    item: { id: 'item-0', type: 'command_execution', exit_code: 0 }
  };
  const f = fixture(t, [
    { events: [command, { ...command, worker_id: 'worker-1' }, codexTerminal()] }
  ]);
  assert.deepEqual(f.read().attempts[0].toolResults, { succeeded: 2, failed: 0, unknown: 0 });
});

test('Claude tool errors and conflicting tool results remain visible independently of a final success', (t) => {
  const f = fixture(t, [
    {
      host: 'claude',
      surface: 'stream-json',
      model: null,
      hostVersion: null,
      events: [
        {
          type: 'user',
          uuid: 'u1',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1', is_error: true }] }
        },
        {
          type: 'user',
          uuid: 'u2',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tool-2', is_error: false }] }
        },
        {
          type: 'user',
          uuid: 'u3',
          message: { content: [{ type: 'tool_result', tool_use_id: 'tool-2', is_error: true }] }
        },
        claudeTerminal()
      ]
    }
  ]);
  const attempt = f.read().attempts[0];
  assert.deepEqual(attempt.toolResults, { succeeded: 0, failed: 1, unknown: 1 });
  assert.equal(attempt.hostOutcome, 'succeeded');
});

test('a read-only import writes nothing, while explicit persistence is byte-preserving and idempotent', (t) => {
  const f = fixture(t, [{ events: [codexTerminal()] }]);
  f.read();
  assert.deepEqual(fs.readdirSync(f.runDir), []);
  const first = f.persist();
  const bytes = fs.readFileSync(path.join(f.runDir, 'host-observation.json'));
  assert.deepEqual(
    fs.readFileSync(path.join(f.runDir, first.provenance.manifest.path)),
    fs.readFileSync(f.manifestPath)
  );
  assert.deepEqual(f.persist(), first);
  assert.deepEqual(fs.readFileSync(path.join(f.runDir, 'host-observation.json')), bytes);
  assert.equal(readHostObservation(f.runDir).status, 'verified');
  assert.equal(readHostObservation(path.join(f.root, 'absent')), null);
});

test('source hash mismatches and differing existing snapshots fail before changing saved observations', (t) => {
  const f = fixture(t, [{ events: [codexTerminal()] }]);
  f.persist();
  const before = fs.readFileSync(path.join(f.runDir, 'host-observation.json'));
  fs.appendFileSync(path.join(f.input, f.manifest.attempts[0].log.path), '\n');
  assert.throws(f.persist, /SHA-256 mismatch/);
  f.manifest.attempts[0].log.sha256 = hash(
    fs.readFileSync(path.join(f.input, f.manifest.attempts[0].log.path))
  );
  f.save();
  assert.throws(f.persist, /snapshot differs/);
  assert.deepEqual(fs.readFileSync(path.join(f.runDir, 'host-observation.json')), before);
  assert.equal(readHostObservation(f.runDir).status, 'verified');
});

test('verification detects tampered raw data, retained manifest and normalized totals', (t) => {
  for (const target of ['raw', 'manifest', 'derived']) {
    const f = fixture(t, [{ events: [codexTerminal()] }], 'run-tamper-' + target);
    const observed = f.persist();
    if (target === 'raw')
      fs.appendFileSync(path.join(f.runDir, observed.provenance.logs[0].path), '\n');
    if (target === 'manifest')
      fs.appendFileSync(path.join(f.runDir, observed.provenance.manifest.path), '\n');
    if (target === 'derived') {
      observed.summary.byHost.codex.totalTokens = 1;
      fs.writeFileSync(path.join(f.runDir, 'host-observation.json'), JSON.stringify(observed));
    }
    const verified = readHostObservation(f.runDir);
    assert.equal(verified.status, 'invalid', target);
    assert.equal(verified.summary, null);
    assert.match(verified.issues.join('\n'), /hash mismatch|derivation differs/, target);
  }
});

test('missing or duplicate provenance cannot conceal a started attempt', (t) => {
  const f = fixture(t, [{ events: [codexTerminal()] }, { status: 'failed', exitCode: 1, raw: '' }]);
  const observed = f.persist();
  observed.provenance.logs.pop();
  fs.writeFileSync(path.join(f.runDir, 'host-observation.json'), JSON.stringify(observed));
  assert.equal(readHostObservation(f.runDir).status, 'invalid');
});

test('relative source boundaries, run identity, reserved names and unsupported host surfaces are rejected', (t) => {
  const f = fixture(t, [{ events: [codexTerminal()] }]);
  const original = structuredClone(f.manifest);
  for (const mutate of [
    (m) => (m.attempts[0].log.path = '../outside.jsonl'),
    (m) => (m.attempts[0].log.path = 'C:\\outside.jsonl'),
    (m) => (m.attempts[0].attemptId = 'CON'),
    (m) => (m.attempts[0].attemptId = 'trailing.'),
    (m) => (m.attempts[0].surface = 'unmapped-protocol')
  ]) {
    Object.assign(f.manifest, structuredClone(original));
    mutate(f.manifest);
    f.save();
    assert.throws(f.read);
  }
  Object.assign(f.manifest, structuredClone(original));
  f.manifest.runId = 'different-run';
  f.save();
  assert.throws(f.persist, /runId/);
  assert.deepEqual(fs.readdirSync(f.runDir), []);
});

test('symlinked source directories and output directories are refused without touching targets', (t) => {
  const f = fixture(t, [{ events: [codexTerminal()] }]);
  const elsewhere = path.join(f.root, 'elsewhere');
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, 'sentinel'), 'unchanged');
  fs.symlinkSync(elsewhere, path.join(f.runDir, 'host-observation-input'), 'junction');
  assert.throws(f.persist, /link/);
  assert.equal(fs.readFileSync(path.join(elsewhere, 'sentinel'), 'utf8'), 'unchanged');
  fs.symlinkSync(f.input, path.join(f.input, 'linked'), 'junction');
  f.manifest.attempts[0].log.path = 'linked/source-1.jsonl';
  f.save();
  assert.throws(f.read, /link/);
});

test('missing nullable fields, duplicate IDs and cyclic relationships fail with no output', (t) => {
  const f = fixture(t, [
    { attemptId: 'first', events: [codexTerminal()] },
    { attemptId: 'second', events: [codexTerminal()] }
  ]);
  const original = structuredClone(f.manifest);
  for (const mutate of [
    (m) => delete m.attempts[0].hostVersion,
    (m) => delete m.attempts[0].finishedAt,
    (m) => delete m.attempts[0].wallTimeMs,
    (m) => delete m.attempts[0].exitCode,
    (m) => delete m.attempts[0].log,
    (m) => (m.attempts[1].attemptId = 'FIRST'),
    (m) => (m.attempts[0].parentAttemptId = 'absent'),
    (m) => {
      m.attempts[0].retryOf = 'second';
      m.attempts[1].retryOf = 'first';
    },
    (m) => {
      m.attempts[0].parentAttemptId = 'second';
      m.attempts[1].parentAttemptId = 'first';
    },
    (m) => (m.attempts[0].finishedAt = '2026-10-07T11:00:00Z')
  ]) {
    Object.assign(f.manifest, structuredClone(original));
    mutate(f.manifest);
    f.save();
    assert.throws(f.persist);
    assert.deepEqual(fs.readdirSync(f.runDir), []);
  }
});

test('manifest, attempt, line and nesting capacity failures are explicit', (t) => {
  const f = fixture(t, [{ events: [codexTerminal()] }]);
  fs.appendFileSync(f.manifestPath, ' '.repeat(HOST_OBSERVATION_LIMITS.manifestBytes));
  assert.throws(f.read, /capacity/);
  f.manifest.attempts = Array.from({ length: HOST_OBSERVATION_LIMITS.attempts + 1 }, (_, i) => ({
    ...f.manifest.attempts[0],
    attemptId: 'attempt-' + i
  }));
  f.save();
  assert.throws(f.read, /capacity/);
  const line = fixture(t, [
    { raw: JSON.stringify({ type: 'large', value: 'x'.repeat(HOST_OBSERVATION_LIMITS.lineBytes) }) }
  ]);
  assert.throws(line.read, /capacity/);
  let value = {};
  for (let i = 0; i < HOST_OBSERVATION_LIMITS.depth + 1; i++) value = { nested: value };
  const deep = fixture(t, [{ events: [value] }]);
  assert.throws(deep.read, /capacity/);
});

test('per-attempt and total event capacity count duplicated input too', (t) => {
  const row = '{"type":"unknown"}\n';
  const f = fixture(t, [{ raw: row.repeat(HOST_OBSERVATION_LIMITS.eventsPerAttempt + 1) }]);
  assert.throws(f.read, /capacity/);
  const total = fixture(t, [
    ...Array.from({ length: 4 }, () => ({
      raw: row.repeat(HOST_OBSERVATION_LIMITS.eventsPerAttempt)
    })),
    { raw: row }
  ]);
  assert.throws(total.read, /capacity/);
});

test('individual and total raw byte limits are checked before parsing or persistence', (t) => {
  const f = fixture(t, [{ raw: ' '.repeat(HOST_OBSERVATION_LIMITS.logBytes + 1) }]);
  assert.throws(f.persist, /capacity/);
  assert.deepEqual(fs.readdirSync(f.runDir), []);
  const total = fixture(
    t,
    Array.from({ length: 5 }, () => ({ raw: ' '.repeat(HOST_OBSERVATION_LIMITS.logBytes) }))
  );
  assert.throws(total.persist, /capacity/);
  assert.deepEqual(fs.readdirSync(total.runDir), []);
});

test('CLI defaults to read-only JSON and rejects missing or repeated flags', (t) => {
  const f = fixture(t, [{ events: [codexTerminal()] }]);
  const result = spawnSync(process.execPath, [script, '--manifest', f.manifestPath], {
    cwd: f.root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).summary.byHost.codex.totalTokens, 105);
  assert.deepEqual(fs.readdirSync(f.runDir), []);
  for (const args of [
    [],
    ['--manifest'],
    ['--unknown', 'x'],
    ['--manifest', f.manifestPath, '--manifest', f.manifestPath]
  ]) {
    const bad = spawnSync(process.execPath, [script, ...args], { cwd: f.root, encoding: 'utf8' });
    assert.equal(bad.status, 1);
  }
});
