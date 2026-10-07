// Local consistency checks, not an attestation service. A writer with access to the
// records, tests and validator can forge a consistent set; CI must own its trust boundary.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const EVIDENCE_POLICY = 'local-execution-v1';
export const EVIDENCE_LEVEL = 'local-consistency-only';
const OMITTED = new Set(['.git', '.auto', 'node_modules']);
const digest = (data) => createHash('sha256').update(data).digest('hex');
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function snapshotTree(cwd) {
  const files = [];
  function walk(relative) {
    const dir = path.join(cwd, relative);
    for (const name of fs.readdirSync(dir).sort()) {
      if (OMITTED.has(name)) continue;
      const location = path.join(dir, name);
      const entry = path.join(relative, name).split(path.sep).join('/');
      const stat = fs.lstatSync(location);
      // Bind the link itself without reading or recursing into its target.
      // Target contents, like external dependencies, remain outside this snapshot.
      if (stat.isSymbolicLink())
        files.push({
          path: entry,
          kind: 'symlink',
          target: fs.readlinkSync(location),
          mode: stat.mode & 0o777
        });
      else if (stat.isDirectory()) walk(entry);
      else if (stat.isFile())
        files.push({
          path: entry,
          sha256: digest(fs.readFileSync(location)),
          mode: stat.mode & 0o777
        });
      else throw new Error(`unsupported file in evidence scope: ${entry}`);
    }
  }
  walk('');
  return {
    scope: 'cwd-tree',
    excludedNames: [...OMITTED],
    files,
    sha256: digest(JSON.stringify(files))
  };
}

export function collectorSource() {
  const names = ['evidence-collect.js', 'evidence-record.js'];
  return {
    kind: 'local-process',
    collectorSha256: digest(
      Buffer.concat(
        names.map((name) => fs.readFileSync(fileURLToPath(new URL(name, import.meta.url))))
      )
    ),
    nodeVersion: process.version
  };
}

// This parser accepts the built-in Node TAP reporter only, including its final
// summary and test points. It is deliberately not a generic TAP/JUnit adapter.
export function parseNodeTap(output, { cwd = '', tests = [] } = {}) {
  const issues = [];
  const counts = {};
  const lines = output.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== 'TAP version 13') issues.push('missing Node TAP header');
  for (const key of ['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const entries = lines.filter((line) => new RegExp(`^# ${key} \\d+$`).test(line));
    if (entries.length !== 1) issues.push(`missing or duplicate Node TAP ${key} count`);
    else counts[key] = Number(entries[0].split(' ')[2]);
  }
  const plans = lines.filter((line) => /^1\.\.\d+(?: #.*)?$/.test(line));
  const points = lines.filter((line) => /^(?:not )?ok \d+ - /.test(line));
  if (plans.length !== 1 || Number(plans[0]?.match(/^1\.\.(\d+)/)?.[1]) !== points.length)
    issues.push('missing or inconsistent Node TAP plan');
  const allPoints = lines.filter((line) => /^\s*(?:not )?ok \d+ - /.test(line));
  if (allPoints.length !== counts.tests + counts.suites)
    issues.push('Node TAP test points disagree with summary');
  if (counts.tests !== counts.pass + counts.fail + counts.cancelled + counts.skipped + counts.todo)
    issues.push('Node TAP counts do not sum to discovered tests');
  if (!lines.some((line) => /^# duration_ms \d+(?:\.\d+)?$/.test(line)))
    issues.push('missing Node TAP completion');
  // Node reports an empty file as a passing synthetic file subtest. It is not
  // discovery of an assertion-bearing test and must not turn zero tests green.
  const selected = tests.map((file) => path.resolve(cwd, file));
  const wrappers = points.filter((line) => {
    const name = line.replace(/^(?:not )?ok \d+ - /, '').replace(/ # (?:SKIP|TODO).*$/, '');
    return selected.includes(path.resolve(cwd, name));
  }).length;
  return {
    adapter: 'node-test-tap',
    discovered: counts.tests - wrappers,
    executed: counts.tests - counts.skipped - counts.todo - wrappers,
    passed: counts.pass - wrappers,
    failed: counts.fail,
    cancelled: counts.cancelled,
    skipped: counts.skipped,
    todo: counts.todo,
    suites: counts.suites,
    fileWrappers: wrappers,
    issues
  };
}

export function validateSelection(cwd, tests) {
  if (!Array.isArray(tests) || !tests.length || tests.some((file) => !nonempty(file)))
    throw new Error('at least one explicit --test file is required');
  const result = tests.map((file) => {
    const relative = path.relative(cwd, path.resolve(cwd, file));
    if (
      !relative ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative) ||
      relative === '..' ||
      relative.split(path.sep).some((part) => OMITTED.has(part))
    )
      throw new Error(`test must be inside the bound cwd tree: ${file}`);
    const absolute = path.resolve(cwd, relative);
    let ancestor = path.parse(absolute).root;
    for (const part of path.relative(ancestor, absolute).split(path.sep)) {
      ancestor = path.join(ancestor, part);
      if (fs.lstatSync(ancestor).isSymbolicLink())
        throw new Error(`test path traverses a symbolic link: ${file}`);
    }
    if (!fs.lstatSync(absolute).isFile()) throw new Error(`test is not a file: ${file}`);
    return relative.split(path.sep).join('/');
  });
  if (new Set(result).size !== result.length) throw new Error('duplicate selected test files');
  return result;
}

export function logDescriptor(file, content) {
  return { path: file, bytes: content.length, sha256: digest(content) };
}

export function validateEvidence(recordPath, expected = {}) {
  const issues = [];
  let record;
  try {
    record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    if (!record || Array.isArray(record) || typeof record !== 'object')
      throw new Error('expected evidence object');
    if (record.schemaVersion !== EVIDENCE_POLICY) issues.push('unsupported evidence schema');
    if (
      record.level !== EVIDENCE_LEVEL ||
      record.trust !== undefined ||
      record.source?.trust !== undefined
    )
      issues.push('local records cannot declare a higher trust level');
    if (!same(record.source, collectorSource()))
      issues.push('collector source or Node version changed');
    for (const field of ['runId', 'questId']) {
      if (!nonempty(record[field]) || (expected[field] && record[field] !== expected[field]))
        issues.push(`${field} mismatch`);
    }
    if (!path.isAbsolute(record.cwd || '') || !fs.existsSync(record.cwd))
      throw new Error('invalid evidence cwd');
    if (record.snapshotError !== null) issues.push('final file state collection failed');
    const cwd = fs.realpathSync(record.cwd);
    if (expected.cwd && fs.realpathSync(expected.cwd) !== cwd) issues.push('cwd mismatch');
    if (!same(record.before, record.after)) issues.push('file state changed during execution');
    if (!same(record.after, snapshotTree(cwd))) issues.push('file state changed since execution');
    const tests = validateSelection(cwd, record.selection);
    // Shells can spell the same executable differently (for example node.EXE).
    // Compare canonical identity while preserving the original recorded invocation.
    const command =
      nonempty(record.command?.executable) && path.isAbsolute(record.command.executable)
        ? { ...record.command, executable: fs.realpathSync.native(record.command.executable) }
        : record.command;
    if (
      !same(command, {
        executable: fs.realpathSync.native(process.execPath),
        args: ['--test', '--test-reporter=tap', '--', ...tests]
      })
    )
      issues.push('command does not match the supported Node test adapter');
    const start = Date.parse(record.startedAt);
    const end = Date.parse(record.finishedAt);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end < start ||
      !Number.isFinite(record.durationMs) ||
      record.durationMs < 0
    )
      issues.push('invalid execution timing');
    const logs = {};
    for (const stream of ['stdout', 'stderr']) {
      const descriptor = record.logs?.[stream];
      if (!nonempty(descriptor?.path) || path.basename(descriptor.path) !== descriptor.path)
        throw new Error(`invalid ${stream} log path`);
      const location = path.join(path.dirname(recordPath), descriptor.path);
      if (fs.lstatSync(location).isSymbolicLink())
        throw new Error(`symbolic ${stream} log not allowed`);
      const content = fs.readFileSync(location);
      if (!same(descriptor, logDescriptor(descriptor.path, content)))
        issues.push(`${stream} log changed`);
      logs[stream] = content.toString('utf8');
    }
    const parsed = parseNodeTap(logs.stdout, { cwd, tests });
    issues.push(...parsed.issues);
    if (!same(record.tests, parsed))
      issues.push('test discovery/execution counts disagree with log');
    if (!(parsed.discovered > 0) || !(parsed.executed > 0))
      issues.push('no executed tests discovered');
    if (
      record.exitCode !== 0 ||
      record.signal !== null ||
      record.spawnError !== null ||
      parsed.failed ||
      parsed.cancelled
    )
      issues.push('test command failed; baseline failures remain failures');
    if (parsed.skipped || parsed.todo)
      issues.push('skipped or TODO tests require separate review; not a full pass');
  } catch (error) {
    issues.push(`unusable execution evidence: ${error.message}`);
  }
  return { passed: issues.length === 0, level: EVIDENCE_LEVEL, issues, record };
}

export function validateRunEvidence(runDir, documents, { cwd, required = false } = {}) {
  const verify = documents['verify-report.md']?.objects?.[0];
  const active = required || verify?.evidencePolicy !== undefined;
  const issues = [];
  const warnings = [
    'Execution records are locally writable audit evidence, not independent attestation or proof of business correctness.'
  ];
  if (!active) return { status: 'not_checked', level: EVIDENCE_LEVEL, issues, warnings };
  if (verify?.evidencePolicy !== undefined && verify.evidencePolicy !== EVIDENCE_POLICY)
    issues.push('unsupported VerifyReport.evidencePolicy');
  if (!verify) issues.push('structured VerifyReport required for execution evidence');
  const rawQuests = documents['quest-map.md']?.objects?.[0]?.quests;
  const quests = Array.isArray(rawQuests) ? rawQuests : [];
  const gates = Array.isArray(verify?.gateResults) ? verify.gateResults : [];
  if (verify && !gates.some((gate) => gate?.name === 'test' || gate?.evidenceKind === 'test'))
    issues.push('strict execution evidence requires a test gate, or not_applicable with a reason');
  let passed = 0;
  let applicable = 0;
  let unpassed = 0;
  for (const gate of gates) {
    if (!gate) continue;
    if (gate.status === 'not_applicable') {
      if (!nonempty(gate.evidence) && !nonempty(gate.evidence?.reason))
        issues.push(`${gate.name}: not_applicable needs a textual reason`);
      continue;
    }
    const isTest = gate.name === 'test' || gate.evidenceKind === 'test';
    if (!isTest && !gate.evidenceRefs) continue;
    applicable++;
    if (gate.status !== 'pass') {
      unpassed++;
      if (['pass', 'pass-with-warnings'].includes(verify.overallStatus))
        issues.push(`${gate.name}: successful overall status requires passing execution evidence`);
      continue;
    }
    if (!Array.isArray(gate.evidenceRefs) || !gate.evidenceRefs.length) {
      issues.push(`${gate.name}: pass requires evidenceRefs to collected execution records`);
      continue;
    }
    for (const reference of gate.evidenceRefs) {
      if (
        !nonempty(reference) ||
        path.basename(reference) !== reference ||
        !/^evidence-[\w-]+\.json$/.test(reference)
      ) {
        issues.push(`${gate.name}: invalid evidence reference`);
        continue;
      }
      const result = validateEvidence(path.join(runDir, reference), {
        cwd,
        runId: path.basename(runDir)
      });
      if (!quests.some((quest) => quest?.questId === result.record?.questId))
        issues.push(`${gate.name}: evidence references unknown quest`);
      issues.push(...result.issues.map((issue) => `${gate.name}/${reference}: ${issue}`));
      if (result.passed) passed++;
    }
  }
  return {
    status: issues.length
      ? 'invalid'
      : unpassed
        ? 'not_passed'
        : passed
          ? 'local-consistent'
          : applicable
            ? 'not_passed'
            : 'not_applicable',
    level: EVIDENCE_LEVEL,
    issues,
    warnings
  };
}
