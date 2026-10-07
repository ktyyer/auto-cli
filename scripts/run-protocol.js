// Shared contract for run validation and observation tooling (not a workflow runtime).
import fs from 'node:fs';
import path from 'node:path';
import { validateRunEvidence } from './evidence-record.js';

const common = {
  id: 'string',
  runId: 'string',
  correlationId: 'string',
  status: 'string',
  summary: 'string'
};
export const RUN_CONTRACT = {
  'route-decision.md': {
    ...common,
    userIntent: 'string',
    strategy: 'string',
    primaryAgent: 'string',
    skills: 'strings',
    next: 'string'
  },
  'quest-map.md': {
    ...common,
    routeDecisionId: 'string',
    goal: 'string',
    executionMode: 'string',
    quests: 'array'
  },
  'quest-results.md': {
    ...common,
    questId: 'string',
    attempt: 'positiveInteger',
    ownerAgent: 'string',
    changedFiles: 'strings'
  },
  'verify-report.md': {
    ...common,
    gateResults: 'array',
    overallStatus: 'string',
    nextAction: 'string'
  },
  'learn-cards.md': {
    ...common,
    category: 'string',
    title: 'string',
    confidence: 'string',
    targetInsightFile: 'string',
    scope: 'string'
  }
};
const plural = new Set(['quest-results.md', 'learn-cards.md']);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isString = (v) => typeof v === 'string' && v.trim().length > 0;
const types = {
  string: isString,
  array: Array.isArray,
  strings: (v) => Array.isArray(v) && v.every(isString),
  object: isObject,
  positiveInteger: (v) => Number.isInteger(v) && v > 0
};
// Evidence must carry real content: blank strings, nulls and empty containers say nothing.
const hasEvidence = (value) => {
  const pending = [{ value, nested: false }];
  while (pending.length) {
    const current = pending.pop();
    if (isString(current.value)) return true;
    if (current.nested && (typeof current.value === 'number' || typeof current.value === 'boolean'))
      return true;
    if (Array.isArray(current.value)) {
      for (const item of current.value) pending.push({ value: item, nested: true });
    } else if (isObject(current.value)) {
      for (const item of Object.values(current.value)) pending.push({ value: item, nested: true });
    }
  }
  return false;
};

// Status enums. v2 values are additive; v1 values stay valid so old runs keep validating.
const QUEST_STATUSES = [
  'pending',
  'running',
  'completed',
  'succeeded',
  'failed',
  'cancelled',
  'suspended',
  'skipped',
  'blocked'
];
const QUEST_SUCCESS_STATUSES = ['completed', 'succeeded'];
const GATE_STATUSES = ['pass', 'fail', 'warning', 'skipped', 'pending', 'not_applicable'];
const OVERALL_STATUSES = [
  'pass',
  'pass-with-warnings',
  'fail',
  'warning',
  'pending',
  'skipped',
  'blocked',
  'partial',
  'not_applicable'
];

/** Parse raw JSON or protocol fences; distinguish legacy text from malformed structured data. */
export function parseProtocolDocument(content) {
  const source = content.replace(/^\uFEFF/, '');
  const text = source.trim();
  let structured = /^[[{]/.test(text);
  try {
    const blocks = [];
    let fence = null;
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (
          match &&
          match[1][0] === fence.delimiter[0] &&
          match[1].length >= fence.delimiter.length &&
          !match[2].trim()
        ) {
          if (fence.json) blocks.push(fence.lines.join('\n'));
          fence = null;
        } else if (fence.json) fence.lines.push(line);
        continue;
      }
      if (!match) continue;
      const info = match[2].trim();
      const json = /^json\b/i.test(info);
      if (json) {
        structured = true;
        if (!/^json$/i.test(info)) throw new Error('malformed JSON fence');
      }
      // Non-JSON fences shield embedded examples from protocol interpretation.
      if (match[1][0] === '`' && info.includes('`')) continue;
      fence = { delimiter: match[1], json, lines: [] };
    }
    if (fence?.json) throw new Error('unclosed JSON fence');
    if (!structured) return { structured: false, objects: [] };
    const values = (blocks.length ? blocks : [text]).map((s) => JSON.parse(s));
    const objects = values.flatMap((v) => (Array.isArray(v) ? v : [v]));
    if (!objects.every(isObject)) throw new Error('expected JSON objects');
    return { structured: true, objects };
  } catch (error) {
    return { structured: true, objects: [], error: `invalid JSON: ${error.message}` };
  }
}

/** Validate available run objects and links; requireAll also checks missing structured files. */
export function readRunProtocol(runDir, { requireAll = false, requireEvidence = false, cwd } = {}) {
  const documents = {};
  const issues = [];
  const warnings = [];
  const runId = path.basename(runDir);
  for (const file of Object.keys(RUN_CONTRACT)) {
    const location = path.join(runDir, file);
    if (fs.existsSync(location))
      documents[file] = parseProtocolDocument(fs.readFileSync(location, 'utf8'));
  }
  const structured = Object.values(documents).some((d) => d.structured);
  if (!structured) {
    warnings.push(
      'legacy Markdown: limited completeness check only; protocol fields and metrics are unknown'
    );
    const executionEvidence = validateRunEvidence(runDir, {}, { cwd, required: requireEvidence });
    issues.push(...executionEvidence.issues);
    return { mode: 'legacy', documents: {}, issues, warnings, executionEvidence };
  }
  const check = (value, fields, label) => {
    if (!isObject(value)) {
      issues.push(`${label}: expected object`);
      return;
    }
    for (const [field, type] of Object.entries(fields)) {
      if (!types[type](value[field])) issues.push(`${label}.${field}: required ${type}`);
    }
  };
  const unique = (values, label) => {
    if (new Set(values).size !== values.length) issues.push(`${label}: duplicate identifiers`);
  };
  const correlations = new Set();
  const ids = [];
  for (const [file, fields] of Object.entries(RUN_CONTRACT)) {
    const doc = documents[file];
    if (!doc) {
      if (requireAll) issues.push(`${file}: missing protocol document`);
      continue;
    }
    if (!doc.structured) {
      issues.push(`${file}: cannot mix legacy Markdown with structured protocol`);
      continue;
    }
    if (doc.error) {
      issues.push(`${file}: ${doc.error}`);
      continue;
    }
    if (
      (!plural.has(file) && doc.objects.length !== 1) ||
      (plural.has(file) && doc.objects.length === 0)
    ) {
      issues.push(
        `${file}: expected ${plural.has(file) ? 'one or more' : 'one'} protocol object(s)`
      );
    }
    for (const object of doc.objects) {
      check(object, fields, file);
      if (object.runId !== runId) issues.push(`${file}.runId: must equal ${runId}`);
      if (isString(object.correlationId)) correlations.add(object.correlationId);
      if (isString(object.id)) ids.push(object.id);
    }
  }
  if (correlations.size > 1) issues.push('correlationId: must match across all run objects');
  unique(ids, 'id');
  const route = documents['route-decision.md']?.objects[0];
  const plan = documents['quest-map.md']?.objects[0];
  if (route && !['explore', 'fix', 'implement', 'refactor'].includes(route.strategy))
    issues.push('RouteDecision.strategy: invalid strategy');
  if (plan && route && plan.routeDecisionId !== route.id)
    issues.push('QuestMap.routeDecisionId: must reference RouteDecision.id');
  if (plan && ['implement', 'refactor'].includes(route?.strategy)) {
    check(
      plan,
      { assumptions: 'array', alternatives: 'array', riskMatrix: 'array', reflexionNote: 'string' },
      'QuestMap'
    );
  }
  const quests = Array.isArray(plan?.quests) ? plan.quests : [];
  if (plan && quests.length === 0) issues.push('QuestMap.quests: at least one quest required');
  for (const q of quests)
    check(
      q,
      { questId: 'string', objective: 'string', ownerAgent: 'string', acceptance: 'strings' },
      'QuestMap.quests[]'
    );
  const questIds = quests.filter(isObject).map((q) => q.questId);
  unique(questIds, 'QuestMap.quests');
  const results = documents['quest-results.md']?.objects || [];
  unique(
    results.map((q) => `${q.questId}:${q.attempt}`),
    'QuestResult questId/attempt'
  );
  for (const q of results) {
    if (!QUEST_STATUSES.includes(q.status)) issues.push('QuestResult.status: invalid status');
    if (plan && !questIds.includes(q.questId))
      issues.push(`QuestResult.questId: unknown quest ${q.questId}`);
    if (q.status === 'failed') {
      check(q, { failureContext: 'object', retry: 'object' }, 'QuestResult');
      check(q.failureContext, { recommendedNext: 'string' }, 'QuestResult.failureContext');
    }
  }
  for (const v of documents['verify-report.md']?.objects || []) {
    if (!OVERALL_STATUSES.includes(v.overallStatus))
      issues.push('VerifyReport.overallStatus: invalid status');
    const gates = Array.isArray(v.gateResults) ? v.gateResults : [];
    for (const gate of gates) {
      check(gate, { name: 'string', status: 'string' }, 'VerifyReport.gateResults[]');
      if (!isObject(gate)) continue;
      if (!GATE_STATUSES.includes(gate.status)) issues.push('VerifyReport gate: invalid status');
      if (gate.status === 'fail') {
        check(gate, { recommendedNext: 'string' }, 'VerifyReport failed gate');
        if (!hasEvidence(gate.evidence)) issues.push('VerifyReport failed gate: evidence required');
      }
      // Without a stated reason, not_applicable cannot be told apart from a gate nobody ran.
      if (gate.status === 'not_applicable' && !hasEvidence(gate.evidence))
        issues.push('VerifyReport not_applicable gate: evidence (reason) required');
    }
    unique(
      gates.filter(isObject).map((g) => g.name),
      'VerifyReport gate names'
    );
    if (
      ['pass', 'pass-with-warnings'].includes(v.overallStatus) &&
      gates.some((g) => ['fail', 'pending'].includes(g?.status))
    )
      issues.push('VerifyReport.overallStatus: cannot pass with failed or pending gates');
    // Report-level not_applicable must mirror the gates exactly: it would otherwise hide a gate
    // that ran, and any other verdict over all-N/A gates claims a result nobody verified.
    const allGatesNotApplicable =
      gates.length > 0 && gates.every((g) => g?.status === 'not_applicable');
    if (v.overallStatus === 'not_applicable' && !allGatesNotApplicable)
      issues.push('VerifyReport.overallStatus: not_applicable requires all gates not_applicable');
    if (allGatesNotApplicable && v.overallStatus !== 'not_applicable')
      issues.push('VerifyReport.overallStatus: all gates not_applicable requires not_applicable');
  }
  for (const card of documents['learn-cards.md']?.objects || []) {
    for (const [field, allowed] of Object.entries({
      category: ['trap', 'pattern', 'decision', 'prompt', 'feedback'],
      scope: ['project', 'stack', 'universal'],
      confidence: ['low', 'medium', 'high']
    })) {
      if (!allowed.includes(card[field])) issues.push(`LearnCard.${field}: invalid value`);
    }
  }
  const executionEvidence = validateRunEvidence(runDir, documents, {
    cwd,
    required: requireEvidence
  });
  issues.push(...executionEvidence.issues);
  if (executionEvidence.status !== 'not_checked') warnings.push(...executionEvidence.warnings);
  return { mode: 'structured', documents, issues, warnings, executionEvidence };
}

/** Collect declared observations, preserving null for missing data and unmeasured telemetry. */
export function collectRunMetrics(runDir) {
  const protocol = readRunProtocol(runDir);
  const valid = protocol.mode === 'structured' && protocol.issues.length === 0;
  const get = (file) => (valid ? protocol.documents[file]?.objects : undefined);
  const route = get('route-decision.md')?.[0];
  const plan = get('quest-map.md')?.[0];
  const results = get('quest-results.md');
  const verify = get('verify-report.md')?.[0];
  const latest = new Map();
  for (const result of results || []) {
    if (!latest.has(result.questId) || latest.get(result.questId).attempt < result.attempt)
      latest.set(result.questId, result);
  }
  const gates = verify?.gateResults;
  const gateCount = (status) => (gates ? gates.filter((g) => g.status === status).length : null);
  // not_applicable gates are outside this change's scope, so they leave the pass-rate denominator.
  const applicableGates = gates ? gates.length - gateCount('not_applicable') : null;
  const unavailable = [
    ...protocol.warnings,
    'duration, files and agent invocations: no tool telemetry source'
  ];
  if (protocol.issues.length) unavailable.push('protocol-derived metrics: invalid protocol');
  for (const file of Object.keys(RUN_CONTRACT).slice(0, 4))
    if (!get(file)) unavailable.push(`${file}: structured observation unavailable`);
  return {
    schemaVersion: 'auto-metrics/v2',
    runId: path.basename(runDir),
    timestamp: new Date().toISOString(),
    strategy: route?.strategy || 'unknown',
    status: protocol.issues.length ? 'invalid' : verify?.overallStatus || 'unknown',
    duration: { total: null, phases: {} },
    quests: {
      total: plan ? plan.quests.length : null,
      completed: results
        ? [...latest.values()].filter((q) => QUEST_SUCCESS_STATUSES.includes(q.status)).length
        : null,
      failed: results ? [...latest.values()].filter((q) => q.status === 'failed').length : null
    },
    gates: {
      total: gates ? gates.length : null,
      passed: gateCount('pass'),
      failed: gateCount('fail'),
      skipped: gateCount('skipped'),
      warning: gateCount('warning'),
      pending: gateCount('pending'),
      notApplicable: gateCount('not_applicable'),
      applicable: applicableGates,
      passRate: applicableGates ? gateCount('pass') / applicableGates : null
    },
    skills: {
      activated: route ? [...new Set(route.skills)] : null,
      count: route ? new Set(route.skills).size : null
    },
    agents: { primary: route?.primaryAgent || 'unknown', invoked: null, count: null },
    files: { read: null, written: null, modified: null },
    protocolMode: protocol.mode,
    protocolIssues: protocol.issues,
    unavailable
  };
}
