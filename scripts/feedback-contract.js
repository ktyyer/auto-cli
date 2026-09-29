// Read-only feedback validation; writes remain part of the Markdown LEARN workflow.
const VERSION = 'auto-feedback/v1';
const RESERVED = new Set([
  'schemaVersion',
  'version',
  'lastUpdated',
  'portablePatterns',
  'skills',
  'agents'
]);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const isRate = (value) =>
  value === null ||
  (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

/** Summarize evidenced run outcomes, independently of historical activation counts. */
export function summarizeObservations(observations, collection) {
  if (!isRecord(observations)) return { error: 'observations must be an object' };
  let successes = 0;
  let failures = 0;
  let uses = 0;
  let lastUsed = null;
  for (const [runId, observation] of Object.entries(observations)) {
    if (
      !isText(runId) ||
      !isRecord(observation) ||
      !isCount(observation.uses) ||
      observation.uses < 1 ||
      (collection === 'skills' && observation.uses !== 1) ||
      !isDate(observation.date) ||
      !['success', 'failure', 'unknown'].includes(observation.outcome) ||
      !Array.isArray(observation.evidence) ||
      observation.evidence.length === 0 ||
      !observation.evidence.every(isText)
    ) {
      return { error: `invalid observation: ${runId}` };
    }
    uses += observation.uses;
    if (!Number.isSafeInteger(uses)) return { error: 'observation uses exceed safe integer range' };
    if (lastUsed === null || observation.date > lastUsed) lastUsed = observation.date;
    if (observation.outcome === 'success') successes += 1;
    if (observation.outcome === 'failure') failures += 1;
  }
  const measuredCount = successes + failures;
  return {
    uses,
    lastUsed,
    measuredCount,
    successRate: measuredCount === 0 ? null : successes / measuredCount
  };
}

/** Validate one explicit reference. This does not certify unreferenced entries or evidence content. */
export function validateFeedbackReference(data, collection, key) {
  if (!['skills', 'agents'].includes(collection) || !isRecord(data)) return 'invalid feedback data';
  if (RESERVED.has(key)) return `invalid feedback entry: reserved key ${key}`;
  const canonical = Object.hasOwn(data, 'schemaVersion');
  if (
    canonical &&
    (data.schemaVersion !== VERSION ||
      !(data.lastUpdated === null || isDate(data.lastUpdated)) ||
      Object.hasOwn(data, 'skills') ||
      Object.hasOwn(data, 'agents'))
  )
    return 'invalid feedback data: schema or metadata';
  if (canonical && collection === 'skills' && !Array.isArray(data.portablePatterns))
    return 'invalid feedback data: portablePatterns';
  if (Object.hasOwn(data, 'portablePatterns')) {
    if (
      collection !== 'skills' ||
      !Array.isArray(data.portablePatterns) ||
      data.portablePatterns.some(
        (pattern) =>
          !isRecord(pattern) ||
          !['stack', 'universal'].includes(pattern.scope) ||
          !['low', 'medium', 'high'].includes(pattern.confidence) ||
          !['id', 'runId', 'title', 'summary', 'skill'].every((field) => isText(pattern[field]))
      )
    ) {
      return 'invalid feedback data: portablePatterns';
    }
  }
  const flat = Object.hasOwn(data, key);
  const wrapped =
    Object.hasOwn(data, collection) &&
    isRecord(data[collection]) &&
    Object.hasOwn(data[collection], key);
  if (flat && wrapped) return `ambiguous feedback entry: ${key}`;
  if (!flat && !wrapped) return `missing feedback key: ${key}`;
  const entry = flat ? data[key] : data[collection][key];
  const countKey = collection === 'skills' ? 'usageCount' : 'totalCalls';
  if (
    !isRecord(entry) ||
    !isCount(entry[countKey]) ||
    (Object.hasOwn(entry, 'successRate') && !isRate(entry.successRate))
  )
    return `invalid feedback entry: ${key}`;
  if (!canonical && !Object.hasOwn(entry, 'observations')) return null;
  const stats = summarizeObservations(entry.observations, collection);
  if (stats.error) return `invalid feedback entry: ${key}: ${stats.error}`;
  if (
    entry[countKey] < stats.uses ||
    !(entry.lastUsed === null || isDate(entry.lastUsed)) ||
    (stats.lastUsed !== null && (entry.lastUsed === null || entry.lastUsed < stats.lastUsed)) ||
    Object.hasOwn(entry, 'portablePatterns') ||
    (stats.successRate === null
      ? entry.successRate !== null
      : typeof entry.successRate !== 'number' ||
        Math.abs(entry.successRate - stats.successRate) > 1e-12)
  ) {
    return `invalid feedback entry: ${key}: counts, dates, portablePatterns or successRate`;
  }
  return null;
}
