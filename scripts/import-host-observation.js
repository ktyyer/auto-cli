#!/usr/bin/env node
// Observation only: this module never starts a model or treats host completion as a test verdict.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const HOST_OBSERVATION_SCHEMA = 'auto-host-observation/v1';
export const HOST_ATTEMPTS_SCHEMA = 'auto-host-attempts/v1';
export const HOST_OBSERVATION_LIMITS = Object.freeze({
  manifestBytes: 256 * 1024,
  logBytes: 8 * 1024 * 1024,
  totalLogBytes: 32 * 1024 * 1024,
  lineBytes: 1024 * 1024,
  observationBytes: 32 * 1024 * 1024,
  attempts: 256,
  eventsPerAttempt: 25000,
  events: 100000,
  depth: 64
});
const STATUSES = ['succeeded', 'failed', 'cancelled', 'timed_out', 'running', 'unknown'];
const SURFACES = { codex: 'exec-json', claude: 'stream-json' };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const reserved = (value) => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
const identifier = (value) =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9][\w.-]{0,127}$/.test(value) &&
  !value.endsWith('.') &&
  !reserved(value);
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const numeric = (value) => (finite(value) ? value : null);
const token = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
const sum = (values) =>
  values.length &&
  values.every((value) => value !== null) &&
  Number.isSafeInteger(values.reduce((total, value) => total + value, 0))
    ? values.reduce((total, value) => total + value, 0)
    : null;
const unique = (values) => [...new Set(values.filter(text))].sort();
const fail = (message) => {
  throw new Error(message);
};

function canonical(value, depth = 0) {
  if (depth > HOST_OBSERVATION_LIMITS.depth) fail('JSON nesting exceeds observation capacity');
  if (typeof value === 'number' && !Number.isFinite(value)) fail('Non-finite JSON number');
  if (Array.isArray(value)) return value.map((entry) => canonical(entry, depth + 1));
  if (object(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key], depth + 1)])
    );
  return value;
}
const encode = (value) => JSON.stringify(canonical(value));
const decode = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const eventScope = (value) => [
  value.session_id ?? value.thread_id ?? null,
  value.parent_tool_use_id ?? null,
  value.worker_id ?? null
];

function exists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function regularPath(file, directory = false) {
  const absolute = path.resolve(file);
  let current = path.parse(absolute).root;
  for (const part of path.relative(current, absolute).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) fail('Observation path traverses a link: ' + file);
  }
  const stat = fs.statSync(absolute);
  if (!(directory ? stat.isDirectory() : stat.isFile()))
    fail('Not a regular observation path: ' + file);
  return absolute;
}

function inside(root, relative) {
  if (
    !text(relative) ||
    path.isAbsolute(relative) ||
    path.win32.isAbsolute(relative) ||
    /[:<>"|?*\x00]/.test(relative)
  )
    fail('Expected a portable relative source path');
  const parts = relative.split(/[\\/]/);
  if (
    parts.some((part) => part === '..' || (part !== '.' && (/[. ]$/.test(part) || reserved(part))))
  )
    fail('Observation source path escapes its directory or uses a reserved name: ' + relative);
  const target = path.resolve(root, ...parts);
  const boundary = path.relative(root, target);
  if (
    !boundary ||
    boundary === '..' ||
    boundary.startsWith('..' + path.sep) ||
    path.isAbsolute(boundary)
  )
    fail('Observation source path escapes its directory: ' + relative);
  return target;
}

function readBounded(file, limit) {
  regularPath(file);
  const fd = fs.openSync(file, 'r');
  const chunks = [];
  let bytes = 0;
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > limit) fail('Observation file exceeds capacity: ' + file);
    for (;;) {
      const chunk = Buffer.alloc(Math.min(65536, limit + 1 - bytes));
      const count = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!count) break;
      bytes += count;
      if (bytes > limit) fail('Observation file exceeds capacity: ' + file);
      chunks.push(chunk.subarray(0, count));
    }
    return Buffer.concat(chunks);
  } finally {
    fs.closeSync(fd);
  }
}

function parseManifest(bytes) {
  const manifest = JSON.parse(decode(bytes));
  canonical(manifest);
  if (
    !object(manifest) ||
    manifest.schemaVersion !== HOST_ATTEMPTS_SCHEMA ||
    !identifier(manifest.runId)
  )
    fail('Invalid host-attempt manifest schema or runId');
  if (
    !Array.isArray(manifest.attempts) ||
    !manifest.attempts.length ||
    manifest.attempts.length > HOST_OBSERVATION_LIMITS.attempts
  )
    fail('Attempt count is outside observation capacity');
  const ids = new Set();
  const timestamp = (value) =>
    text(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  for (const attempt of manifest.attempts) {
    if (
      !object(attempt) ||
      !identifier(attempt.attemptId) ||
      ids.has(attempt.attemptId.toLowerCase())
    )
      fail('Missing or duplicate attemptId');
    ids.add(attempt.attemptId.toLowerCase());
    if (
      !['codex', 'claude'].includes(attempt.host) ||
      SURFACES[attempt.host] !== attempt.surface ||
      !('hostVersion' in attempt) ||
      !(attempt.hostVersion === null || text(attempt.hostVersion)) ||
      !('model' in attempt) ||
      !(attempt.model === null || text(attempt.model))
    )
      fail(
        'Each attempt requires a supported host/surface, hostVersion and model (unknown values are null)'
      );
    if (
      !STATUSES.includes(attempt.status) ||
      !timestamp(attempt.startedAt) ||
      !(attempt.finishedAt === null || timestamp(attempt.finishedAt)) ||
      !(attempt.wallTimeMs === null || finite(attempt.wallTimeMs)) ||
      !(attempt.exitCode === null || Number.isSafeInteger(attempt.exitCode))
    )
      fail('Each attempt requires explicit status, timing and nullable exitCode');
    if (
      attempt.finishedAt !== null &&
      Date.parse(attempt.finishedAt) < Date.parse(attempt.startedAt)
    )
      fail('Attempt finishedAt precedes startedAt');
    if (!['attempt', 'attempt-and-descendants', 'unknown'].includes(attempt.usageScope))
      fail('Each attempt requires an explicit usageScope');
    if (
      !(
        attempt.log === null ||
        (object(attempt.log) && text(attempt.log.path) && sha(attempt.log.sha256))
      )
    )
      fail('Each attempt requires a log path and SHA-256, or explicit null for a missing log');
    if (attempt.log) inside('.', attempt.log.path);
    for (const key of ['parentAttemptId', 'retryOf']) {
      if (attempt[key] !== undefined && attempt[key] !== null && !identifier(attempt[key]))
        fail('Invalid attempt relationship: ' + key);
    }
    if (
      attempt.resumeSessionId !== undefined &&
      attempt.resumeSessionId !== null &&
      (!text(attempt.resumeSessionId) || /[\x00-\x1f\x7f]/.test(attempt.resumeSessionId))
    )
      fail('Invalid resumeSessionId');
  }
  const byId = new Map(manifest.attempts.map((attempt) => [attempt.attemptId, attempt]));
  for (const attempt of manifest.attempts) {
    for (const relation of ['parentAttemptId', 'retryOf']) {
      const visited = new Set([attempt.attemptId]);
      let current = attempt;
      while (current[relation]) {
        if (!byId.has(current[relation]) || visited.has(current[relation]))
          fail('Unknown or cyclic ' + relation);
        visited.add(current[relation]);
        current = byId.get(current[relation]);
      }
    }
  }
  return manifest;
}

function parseEvents(bytes, attemptId) {
  const warnings = [];
  const entries = [];
  const seen = new Map();
  let ambiguous = false;
  const source = bytes === null ? '' : decode(bytes);
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    if (
      Buffer.byteLength(line) > HOST_OBSERVATION_LIMITS.lineBytes ||
      entries.length >= HOST_OBSERVATION_LIMITS.eventsPerAttempt
    )
      fail('Event input exceeds observation capacity');
    const entry = {
      line: index + 1,
      type: 'invalid',
      id: null,
      duplicateOf: null,
      ambiguous: false,
      value: null
    };
    try {
      const value = JSON.parse(line);
      if (!object(value)) fail('Expected a JSON object');
      const fingerprint = hash(encode(value));
      entry.value = value;
      entry.type = text(value.type) ? value.type : 'unknown';
      entry.id = text(value.uuid) ? value.uuid : text(value.event_id) ? value.event_id : null;
      const key =
        entry.id === null
          ? 'content:' + fingerprint
          : 'id:' + encode([...eventScope(value), entry.id]);
      const variants = seen.get(key) || new Map();
      const previous = variants.get(fingerprint);
      if (previous) {
        entry.duplicateOf = previous.line;
        entry.ambiguous = previous.ambiguous;
      } else {
        if (variants.size) {
          ambiguous = entry.ambiguous = true;
          for (const variant of variants.values()) variant.ambiguous = true;
          warnings.push(
            'conflicting-event-identity at lines ' +
              variants.values().next().value.line +
              ' and ' +
              entry.line
          );
        }
        variants.set(fingerprint, entry);
        seen.set(key, variants);
      }
    } catch (error) {
      if (/capacity/.test(error.message)) throw error;
      ambiguous = true;
      warnings.push('invalid-json-event at line ' + entry.line);
    }
    entries.push(entry);
  }
  return { entries, warnings, ambiguous, attemptId };
}

function toolObservations(events, host) {
  const results = new Map();
  const add = (id, status, value, scope) => {
    const key = encode([...scope, text(id) ? id : 'unidentified:' + results.size]);
    const previous = results.get(key);
    if (previous && previous.fingerprint !== encode(value))
      results.set(key, { status: 'unknown', fingerprint: null });
    else if (!previous) results.set(key, { status, fingerprint: encode(value) });
  };
  for (const { value } of events) {
    const scope = eventScope(value);
    if (
      host === 'codex' &&
      value.type === 'item.completed' &&
      value.item?.type === 'command_execution'
    ) {
      const code = value.item.exit_code;
      const expectedStatus = code === 0 ? 'completed' : 'failed';
      const consistent = value.item.status === undefined || value.item.status === expectedStatus;
      add(
        value.item.id,
        Number.isSafeInteger(code) && consistent
          ? code === 0
            ? 'succeeded'
            : 'failed'
          : 'unknown',
        value.item,
        scope
      );
    }
    if (host === 'claude' && value.type === 'user') {
      for (const result of Array.isArray(value.message?.content) ? value.message.content : []) {
        if (result?.type !== 'tool_result') continue;
        add(
          result.tool_use_id,
          result.is_error === true ? 'failed' : result.is_error === false ? 'succeeded' : 'unknown',
          result,
          scope
        );
      }
    }
  }
  return Object.fromEntries(
    ['succeeded', 'failed', 'unknown'].map((status) => [
      status,
      [...results.values()].filter((result) => result.status === status).length
    ])
  );
}

function normalizeAttempt(attempt, bytes, hasDeclaredWorkers) {
  const parsed = parseEvents(bytes, attempt.attemptId);
  const warnings = [...parsed.warnings];
  const events = parsed.entries.filter((entry) => !entry.duplicateOf && entry.value);
  const rootEvents = events.filter(({ value }) => !value.parent_tool_use_id && !value.worker_id);
  const terminals = rootEvents.filter(({ value }) =>
    attempt.host === 'claude'
      ? value.type === 'result'
      : ['turn.completed', 'turn.failed'].includes(value.type)
  );
  if (terminals.length > 1)
    warnings.push('ambiguous-terminal-events: no terminal aggregate selected');
  const selected = terminals.length === 1 && !parsed.ambiguous ? terminals[0] : null;
  const terminal = selected?.value;
  const hostOutcome =
    attempt.host === 'claude'
      ? terminal?.is_error === true
        ? 'failed'
        : terminal?.subtype === 'success' && terminal?.is_error === false
          ? 'succeeded'
          : 'unknown'
      : terminal?.type === 'turn.completed'
        ? 'succeeded'
        : terminal?.type === 'turn.failed'
          ? 'failed'
          : 'unknown';
  let status = attempt.status;
  if (status === 'succeeded') status = hostOutcome;
  if (
    attempt.exitCode !== null &&
    attempt.exitCode !== 0 &&
    !['cancelled', 'timed_out'].includes(status)
  )
    status = 'failed';
  if (hostOutcome !== 'unknown' && hostOutcome !== attempt.status)
    warnings.push('declared-process-status-differs-from-host-terminal');
  if (attempt.status === 'succeeded' && hostOutcome === 'unknown')
    warnings.push('host-completion-unconfirmed');
  if (attempt.log === null) warnings.push('missing-raw-log');
  if (terminal && hostOutcome === 'unknown') warnings.push('unmapped-host-terminal');
  const usage = object(terminal?.usage) ? terminal.usage : {};
  let validUsage = true;
  const invalidUsage = (reason) => {
    validUsage = false;
    warnings.push('invalid-usage: ' + reason);
  };
  if (terminal?.usage !== undefined && terminal?.usage !== null && !object(terminal.usage))
    invalidUsage('expected an object');
  const readToken = (container, key) => {
    const value = container?.[key];
    const mapped = token(value);
    if (value !== undefined && value !== null && mapped === null) invalidUsage(key);
    return mapped;
  };
  const inputTokens = readToken(usage, 'input_tokens');
  const outputTokens = readToken(usage, 'output_tokens');
  const cacheReadInputTokens = readToken(
    usage,
    attempt.host === 'codex' ? 'cached_input_tokens' : 'cache_read_input_tokens'
  );
  const cacheWriteInputTokens = readToken(
    usage,
    attempt.host === 'codex' ? 'cache_write_input_tokens' : 'cache_creation_input_tokens'
  );
  const reasoningOutputTokens =
    attempt.host === 'codex'
      ? readToken(usage, 'reasoning_output_tokens')
      : readToken(usage.output_tokens_details, 'thinking_tokens');
  if (
    attempt.host === 'codex' &&
    inputTokens !== null &&
    (cacheReadInputTokens > inputTokens ||
      cacheWriteInputTokens > inputTokens ||
      (cacheReadInputTokens !== null &&
        cacheWriteInputTokens !== null &&
        cacheReadInputTokens + cacheWriteInputTokens > inputTokens))
  )
    invalidUsage('cache subsets exceed inclusive input');
  if (
    outputTokens !== null &&
    reasoningOutputTokens !== null &&
    reasoningOutputTokens > outputTokens
  )
    invalidUsage('reasoning subset exceeds output');
  const mappedInputTotal =
    attempt.host === 'codex'
      ? inputTokens
      : sum([inputTokens, cacheReadInputTokens, cacheWriteInputTokens]);
  const totalInputTokens = validUsage ? mappedInputTotal : null;
  const knownTypes =
    attempt.host === 'codex'
      ? [
          'thread.started',
          'turn.started',
          'turn.completed',
          'turn.failed',
          'item.started',
          'item.updated',
          'item.completed',
          'error'
        ]
      : ['assistant', 'user', 'result', 'stream_event', 'system'];
  const unknownEvents = events
    .filter(
      ({ value }) =>
        !knownTypes.includes(value.type) ||
        (value.type === 'system' && !['init', 'thinking_tokens'].includes(value.subtype)) ||
        (attempt.host === 'codex' &&
          value.type.startsWith('item.') &&
          !['command_execution', 'reasoning', 'agent_message'].includes(value.item?.type))
    )
    .map((entry) => entry.line);
  if (unknownEvents.length) warnings.push('unmapped-events-retained');
  const modelUsage =
    attempt.host === 'claude' && object(terminal?.modelUsage) ? terminal.modelUsage : null;
  const models = unique(
    events.flatMap(({ value }) => [
      value.type === 'system' && value.subtype === 'init' ? value.model : null,
      value.message?.model,
      ...Object.keys(object(value.modelUsage) ? value.modelUsage : {})
    ])
  );
  const versions = unique(events.map(({ value }) => value.claude_code_version));
  if (attempt.model !== null && models.length && !models.includes(attempt.model))
    warnings.push('declared-model-differs-from-observed-model');
  if (attempt.hostVersion !== null && versions.length && !versions.includes(attempt.hostVersion))
    warnings.push('declared-version-differs-from-observed-version');
  const costBases = unique(Object.values(modelUsage || {}).map((value) => value?.costBasis));
  if (
    attempt.host === 'claude' &&
    terminal?.total_cost_usd !== undefined &&
    terminal?.total_cost_usd !== null &&
    numeric(terminal.total_cost_usd) === null
  )
    warnings.push('invalid-cost-estimate');
  const toolResults = toolObservations(
    events.filter((entry) => !entry.ambiguous),
    attempt.host
  );
  if (toolResults.failed)
    warnings.push('tool-failure-observed: host completion is not task acceptance');
  const workerReferences = unique(
    events.flatMap(({ value }) => [value.parent_tool_use_id, value.worker_id])
  );
  const rootSessionIds = unique(rootEvents.map(({ value }) => value.session_id || value.thread_id));
  const includesWorkers =
    attempt.usageScope === 'attempt-and-descendants' &&
    (hasDeclaredWorkers || workerReferences.length > 0);
  const modelUsageExceedsResult =
    !includesWorkers &&
    [
      ['inputTokens', inputTokens],
      ['outputTokens', outputTokens],
      ['cacheReadInputTokens', cacheReadInputTokens],
      ['cacheCreationInputTokens', cacheWriteInputTokens]
    ].some(([key, resultValue]) => {
      const modelTotal = sum(Object.values(modelUsage || {}).map((value) => token(value?.[key])));
      return resultValue !== null && modelTotal !== null && modelTotal > resultValue;
    });
  if (modelUsageExceedsResult)
    warnings.push('model-usage-exceeds-result-usage: estimate range is not known to be additive');
  if (
    attempt.resumeSessionId &&
    rootSessionIds.length &&
    !rootSessionIds.includes(attempt.resumeSessionId)
  )
    warnings.push('declared-resume-session-differs-from-root-session');
  return {
    attemptId: attempt.attemptId,
    host: attempt.host,
    surface: attempt.surface,
    hostVersion: attempt.hostVersion,
    observedVersions: versions,
    declaredModel: attempt.model,
    observedModels: models,
    parentAttemptId: attempt.parentAttemptId || null,
    retryOf: attempt.retryOf || null,
    resumeSessionId: attempt.resumeSessionId || null,
    usageScope: attempt.usageScope,
    declaredStatus: attempt.status,
    status,
    hostOutcome,
    exitCode: attempt.exitCode,
    timing: {
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      wallTimeMs: attempt.wallTimeMs,
      hostDurationMs: numeric(terminal?.duration_ms),
      hostApiDurationMs: numeric(terminal?.duration_api_ms)
    },
    usage: {
      source: selected
        ? attempt.host === 'claude'
          ? 'claude.result'
          : 'codex.turn-terminal'
        : null,
      sourceLine: selected?.line ?? null,
      inputIncludesCache: attempt.host === 'codex',
      inputTokens,
      cacheReadInputTokens,
      cacheWriteInputTokens,
      outputTokens,
      reasoningOutputTokens,
      totalInputTokens,
      totalTokens: sum([totalInputTokens, outputTokens])
    },
    cost: {
      billedUsd: null,
      reportedEstimateUsd: attempt.host === 'claude' ? numeric(terminal?.total_cost_usd) : null,
      reportedEstimateScope:
        attempt.host !== 'claude'
          ? 'unknown'
          : attempt.resumeSessionId
            ? 'session-cumulative'
            : modelUsageExceedsResult
              ? 'unknown-model-usage-range'
              : 'descriptor-scope',
      costBasis: costBases.length === 1 ? costBases[0] : 'unknown',
      modelUsage
    },
    hostFields: {
      sessionIds: unique(events.map(({ value }) => value.session_id || value.thread_id)),
      rootSessionIds,
      reportedTurns: token(terminal?.num_turns),
      workerReferences,
      subagentStats: terminal?.subagent_stats ?? null,
      rawUsage: terminal?.usage ?? null
    },
    toolResults,
    modelInvocations: null,
    events: {
      total: parsed.entries.length,
      unique: events.length,
      duplicates: parsed.entries.filter((entry) => entry.duplicateOf).length,
      unknownLines: unknownEvents,
      entries: parsed.entries.map(({ line, type, id, duplicateOf, ambiguous }) => ({
        line,
        type,
        id,
        duplicateOf,
        ambiguous
      }))
    },
    warnings
  };
}

function summarize(attempts) {
  const byId = new Map(attempts.map((attempt) => [attempt.attemptId, attempt]));
  const excluded = new Set();
  let accountingUnknown = attempts.some(
    (attempt) => attempt.usageScope === 'unknown' && attempt.hostFields.workerReferences.length
  );
  for (const attempt of attempts) {
    let parent = byId.get(attempt.parentAttemptId);
    while (parent) {
      if (parent.usageScope === 'attempt-and-descendants') {
        excluded.add(attempt.attemptId);
        if (parent.host !== attempt.host) accountingUnknown = true;
      }
      if (parent.usageScope === 'unknown') accountingUnknown = true;
      parent = byId.get(parent.parentAttemptId);
    }
  }
  const byHost = {};
  for (const host of unique(attempts.map((attempt) => attempt.host))) {
    const accounted = attempts.filter(
      (attempt) => attempt.host === host && !excluded.has(attempt.attemptId)
    );
    const estimates = accounted.map((attempt) => attempt.cost.reportedEstimateUsd);
    const estimateSum = estimates.reduce((total, value) => total + (value ?? 0), 0);
    const estimateAccountingIssues = [];
    const sessions = new Map();
    if (host === 'claude') {
      for (const attempt of accounted) {
        if (attempt.cost.reportedEstimateScope !== 'descriptor-scope')
          estimateAccountingIssues.push({
            reason: attempt.cost.reportedEstimateScope,
            attemptIds: [attempt.attemptId]
          });
        for (const sessionId of attempt.hostFields.rootSessionIds) {
          const ids = sessions.get(sessionId) || [];
          ids.push(attempt.attemptId);
          sessions.set(sessionId, ids);
        }
      }
      for (const [sessionId, attemptIds] of sessions) {
        if (attemptIds.length > 1)
          estimateAccountingIssues.push({ reason: 'reused-root-session', sessionId, attemptIds });
      }
    }
    const sessionOverlap = estimateAccountingIssues.some(
      (issue) => issue.reason === 'reused-root-session'
    );
    const nonAdditiveEstimateAttemptIds = unique(
      estimateAccountingIssues.flatMap((issue) => issue.attemptIds)
    );
    byHost[host] = {
      attemptsStarted: attempts.filter((attempt) => attempt.host === host).length,
      accountedAttemptIds: accounted.map((attempt) => attempt.attemptId),
      totalTokens: accountingUnknown
        ? null
        : sum(accounted.map((attempt) => attempt.usage.totalTokens)),
      reportedEstimateUsd:
        !accountingUnknown &&
        !nonAdditiveEstimateAttemptIds.length &&
        estimates.length &&
        estimates.every((value) => value !== null) &&
        finite(estimateSum)
          ? estimateSum
          : null,
      estimateAccounting: accountingUnknown
        ? 'unknown-worker-overlap'
        : sessionOverlap
          ? 'unknown-session-overlap'
          : nonAdditiveEstimateAttemptIds.length
            ? 'unknown-estimate-scope'
            : 'descriptor-scopes',
      estimateAccountingIssues,
      nonAdditiveEstimateAttemptIds,
      billedUsd: null,
      missingUsageAttempts: accounted.filter((attempt) => attempt.usage.totalTokens === null)
        .length,
      missingEstimateAttempts: accounted.filter(
        (attempt) => attempt.cost.reportedEstimateUsd === null
      ).length
    };
  }
  return {
    attemptsStarted: attempts.length,
    outcomes: Object.fromEntries(
      STATUSES.map((status) => [
        status,
        attempts.filter((attempt) => attempt.status === status).length
      ])
    ),
    accounting: accountingUnknown ? 'unknown-worker-overlap' : 'descriptor-scopes',
    excludedIncludedWorkerIds: [...excluded].sort(),
    byHost,
    modelInvocations: null,
    taskAcceptance: 'not-measured'
  };
}

function buildObservation(manifest, logs, provenance) {
  const attempts = [];
  let eventCount = 0;
  const parents = new Set(manifest.attempts.map((attempt) => attempt.parentAttemptId));
  for (const attempt of manifest.attempts) {
    const observed = normalizeAttempt(
      attempt,
      logs.get(attempt.attemptId) ?? null,
      parents.has(attempt.attemptId)
    );
    eventCount += observed.events.total;
    if (eventCount > HOST_OBSERVATION_LIMITS.events)
      fail('Total event count exceeds observation capacity');
    attempts.push(observed);
  }
  return {
    schemaVersion: HOST_OBSERVATION_SCHEMA,
    runId: manifest.runId,
    coverage: 'manifest-declared-process-attempts',
    provenance,
    attempts,
    summary: summarize(attempts)
  };
}

const descriptor = (file, bytes) => ({ path: file, bytes: bytes.length, sha256: hash(bytes) });

/** Import explicit attempts; a runDir opt-in saves copies without overwriting a previous import. */
export function importHostObservation({ manifestPath, runDir } = {}) {
  if (!text(manifestPath)) fail('--manifest is required');
  manifestPath = regularPath(manifestPath);
  const manifestBytes = readBounded(manifestPath, HOST_OBSERVATION_LIMITS.manifestBytes);
  const manifest = parseManifest(manifestBytes);
  if (runDir) {
    runDir = regularPath(runDir, true);
    if (path.basename(runDir) !== manifest.runId)
      fail('Manifest runId does not match run directory');
  }
  const sourceRoot = path.dirname(manifestPath);
  const logs = new Map();
  const sources = [];
  let totalBytes = 0;
  for (const attempt of manifest.attempts) {
    if (attempt.log === null) continue;
    const source = inside(sourceRoot, attempt.log.path);
    const bytes = readBounded(source, HOST_OBSERVATION_LIMITS.logBytes);
    totalBytes += bytes.length;
    if (totalBytes > HOST_OBSERVATION_LIMITS.totalLogBytes)
      fail('Total log bytes exceed observation capacity');
    if (hash(bytes) !== attempt.log.sha256)
      fail('Raw log SHA-256 mismatch for ' + attempt.attemptId);
    logs.set(attempt.attemptId, bytes);
    sources.push({
      attemptId: attempt.attemptId,
      ...descriptor(
        runDir ? 'host-observation-input/' + attempt.attemptId + '.jsonl' : source,
        bytes
      )
    });
  }
  const provenance = {
    level: 'local-consistency-only',
    storage: runDir ? 'run-local' : 'source-files',
    manifest: descriptor(
      runDir ? 'host-observation-input/manifest.json' : manifestPath,
      manifestBytes
    ),
    logs: sources
  };
  const observation = buildObservation(manifest, logs, provenance);
  const observationBytes = Buffer.from(JSON.stringify(observation, null, 2) + '\n');
  if (observationBytes.length > HOST_OBSERVATION_LIMITS.observationBytes)
    fail('Observation output exceeds capacity');
  if (runDir) {
    const writes = [
      [provenance.manifest.path, manifestBytes],
      ...sources.map((source) => [source.path, logs.get(source.attemptId)]),
      ['host-observation.json', observationBytes]
    ];
    const inputDir = path.join(runDir, 'host-observation-input');
    if (exists(inputDir)) regularPath(inputDir, true);
    // Preflight every destination before writing; existing snapshots are never replaced.
    for (const [relative, bytes] of writes) {
      const target = inside(runDir, relative);
      if (
        exists(target) &&
        !readBounded(target, HOST_OBSERVATION_LIMITS.observationBytes).equals(bytes)
      )
        fail('Existing observation snapshot differs; use a new run directory: ' + relative);
    }
    fs.mkdirSync(inputDir, { recursive: true });
    for (const [relative, bytes] of writes) {
      const target = inside(runDir, relative);
      if (!exists(target)) fs.writeFileSync(target, bytes, { flag: 'wx' });
    }
  }
  return observation;
}

/** Re-read hashes and recompute summaries; this proves local consistency, not billing or acceptance. */
export function readHostObservation(runDir) {
  const file = path.join(runDir, 'host-observation.json');
  try {
    if (!exists(file)) return null;
    regularPath(runDir, true);
    const observation = JSON.parse(
      decode(readBounded(file, HOST_OBSERVATION_LIMITS.observationBytes))
    );
    if (
      observation.schemaVersion !== HOST_OBSERVATION_SCHEMA ||
      observation.runId !== path.basename(runDir) ||
      observation.provenance?.level !== 'local-consistency-only' ||
      observation.provenance?.storage !== 'run-local'
    )
      fail('Invalid run-local host observation');
    const provenance = observation.provenance;
    const load = (source, limit) => {
      if (
        !object(source) ||
        !sha(source.sha256) ||
        !Number.isSafeInteger(source.bytes) ||
        source.bytes < 0
      )
        fail('Invalid provenance descriptor');
      const bytes = readBounded(inside(runDir, source.path), limit);
      if (bytes.length !== source.bytes || hash(bytes) !== source.sha256)
        fail('Observation provenance hash mismatch');
      return bytes;
    };
    const manifest = parseManifest(
      load(provenance.manifest, HOST_OBSERVATION_LIMITS.manifestBytes)
    );
    if (manifest.runId !== observation.runId || !Array.isArray(provenance.logs))
      fail('Observation manifest mismatch');
    const expected = new Map(
      manifest.attempts
        .filter((attempt) => attempt.log !== null)
        .map((attempt) => [attempt.attemptId, attempt])
    );
    const logs = new Map();
    let totalBytes = 0;
    for (const source of provenance.logs) {
      if (
        !expected.has(source.attemptId) ||
        logs.has(source.attemptId) ||
        source.sha256 !== expected.get(source.attemptId).log.sha256
      )
        fail('Observation log provenance mismatch');
      const bytes = load(source, HOST_OBSERVATION_LIMITS.logBytes);
      totalBytes += bytes.length;
      if (totalBytes > HOST_OBSERVATION_LIMITS.totalLogBytes)
        fail('Total log bytes exceed observation capacity');
      logs.set(source.attemptId, bytes);
    }
    if (logs.size !== expected.size) fail('Missing observation provenance');
    if (encode(buildObservation(manifest, logs, provenance)) !== encode(observation))
      fail('Observation derivation differs from retained sources');
    return {
      status: 'verified',
      file: 'host-observation.json',
      level: 'local-consistency-only',
      summary: observation.summary,
      warnings: observation.attempts.flatMap((attempt) =>
        attempt.warnings.map((warning) => attempt.attemptId + ': ' + warning)
      ),
      issues: []
    };
  } catch (error) {
    return {
      status: 'invalid',
      file: 'host-observation.json',
      summary: null,
      warnings: [],
      issues: [error.message]
    };
  }
}

function main(args) {
  const options = {};
  const keys = { '--manifest': 'manifestPath', '--run-dir': 'runDir' };
  for (let index = 0; index < args.length; index++) {
    const key = keys[args[index]];
    const value = args[++index];
    if (!key || !value || value.startsWith('--') || options[key])
      fail('Usage: import-host-observation.js --manifest <file> [--run-dir <existing run>]');
    options[key] = value;
  }
  const observation = importHostObservation(options);
  console.log(
    JSON.stringify(
      options.runDir
        ? { runId: observation.runId, file: 'host-observation.json', summary: observation.summary }
        : observation,
      null,
      2
    )
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
