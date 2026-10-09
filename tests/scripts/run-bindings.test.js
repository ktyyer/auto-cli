import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hookPath = path.join(root, 'hooks/lib/hook-cli.cjs');
const binderPath = path.join(root, 'hooks/lib/run-bindings.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-binding-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const name of ['run-a', 'run-b']) {
    const run = path.join(dir, '.auto/runs', name);
    fs.mkdirSync(run, { recursive: true });
    fs.writeFileSync(path.join(run, 'session-continuity.md'), `Continuation for ${name}`);
  }
  const now = Date.now() / 1000;
  fs.utimesSync(path.join(dir, '.auto/runs/run-a'), now - 10, now - 10);
  fs.utimesSync(path.join(dir, '.auto/runs/run-b'), now, now);
  return dir;
}

function invoke(dir, action, event, extra = {}) {
  const result = spawnSync(process.execPath, [hookPath, action], {
    cwd: dir,
    input: JSON.stringify({ cwd: dir, hook_event_name: event, session_id: 'session-a', ...extra }),
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}

function receipt(dir, action, event, extra = {}) {
  const output = JSON.parse(invoke(dir, action, event, extra));
  assert.equal(output.hookSpecificOutput.hookEventName, event);
  const line = output.hookSpecificOutput.additionalContext
    .split('\n')
    .find((item) => item.startsWith('[Auto host identity] '));
  assert.ok(line, output.hookSpecificOutput.additionalContext);
  return JSON.parse(line.slice('[Auto host identity] '.length));
}

function binder(dir, action, options = {}, expectedStatus = 0) {
  const args = Object.entries({ root: dir, ...options }).flatMap(([key, value]) => [
    `--${key}`,
    String(value)
  ]);
  const result = spawnSync(process.execPath, [binderPath, action, ...args], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true
  });
  assert.equal(
    result.status,
    expectedStatus,
    result.stderr || result.error?.message || result.stdout
  );
  return expectedStatus === 0 ? JSON.parse(result.stdout) : result.stderr;
}

function controller(
  dir,
  run = 'run-a',
  session = 'session-a',
  prompt = 'prompt-a',
  source = 'startup'
) {
  receipt(dir, 'session', 'SessionStart', { session_id: session, source });
  const context = receipt(dir, 'prompt', 'UserPromptSubmit', {
    session_id: session,
    prompt_id: prompt,
    prompt: '/auto fixture task'
  });
  return binder(dir, 'bind-controller', { run, receipt: context.receipt });
}

function auth(binding) {
  return { binding: binding.bindingId, generation: binding.generation, proof: binding.proof };
}
function event(binding, prompt = binding.promptIds[0]) {
  return {
    session_id: binding.sessionId,
    agent_id: binding.agentId,
    prompt_id: prompt,
    auto_binding: { id: binding.bindingId, generation: binding.generation, proof: binding.proof }
  };
}
function worker(
  dir,
  parent,
  agent = 'worker-a',
  session = parent.sessionId,
  prompt = parent.promptIds[0],
  workerRoot = dir
) {
  const delegation = binder(dir, 'register-delegation', {
    ...auth(parent),
    quest: `quest-${agent}`,
    'worker-root': workerRoot
  });
  const context = receipt(workerRoot, 'worker-start', 'SubagentStart', {
    session_id: session,
    agent_id: agent,
    agent_type: 'general-purpose',
    prompt_id: prompt
  });
  return binder(dir, 'bind-worker', {
    'worker-root': workerRoot,
    receipt: context.receipt,
    delegation: delegation.delegationId,
    ticket: delegation.ticket
  });
}
function readRun(dir, run = 'run-a') {
  return JSON.parse(
    fs.readFileSync(path.join(dir, '.auto/runs', run, 'host-bindings.json'), 'utf8')
  );
}
function pendingFiles(dir, run = 'run-a') {
  const directory = path.join(dir, '.auto/runs', run, 'host-pending');
  return fs.existsSync(directory) ? fs.readdirSync(directory) : [];
}

test('an unbound session edit cannot be written to the newest unrelated run', (t) => {
  const dir = fixture(t);
  invoke(dir, 'dirty-list', 'PostToolUse', { tool_input: { file_path: 'a.md' } });
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-b/dirty.txt')), false);
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
});

test('an unregistered worker cannot append to an unrelated controller run', (t) => {
  const dir = fixture(t);
  invoke(dir, 'dirty-list', 'PostToolUse', {
    agent_id: 'worker-a',
    agent_type: 'general-purpose',
    tool_input: { file_path: 'a.md' }
  });
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-b/dirty.txt')), false);
});

test('resume never advertises another session latest-run continuation', (t) => {
  const dir = fixture(t);
  const output = invoke(dir, 'session', 'SessionStart', { source: 'resume' });
  assert.doesNotMatch(output, /run-b/);
});

test('unbound compaction cannot create a project-wide pending reminder', (t) => {
  const dir = fixture(t);
  invoke(dir, 'compact', 'PreCompact', { trigger: 'auto' });
  assert.equal(fs.existsSync(path.join(dir, '.auto/hook-context.json')), false);
});

test('another session cannot consume or remove an old project-wide pending reminder', (t) => {
  const dir = fixture(t);
  const pending = path.join(dir, '.auto/hook-context.json');
  const bytes = JSON.stringify({ message: 'Compaction hook ran for session A' });
  fs.writeFileSync(pending, bytes);
  const output = invoke(dir, 'prompt', 'UserPromptSubmit', {
    session_id: 'session-b',
    prompt: 'Continue session B'
  });
  assert.doesNotMatch(output, /Compaction hook ran/);
  assert.equal(fs.readFileSync(pending, 'utf8'), bytes);
});

test('native session and prompt producers bind a controller before attributed consumers run', (t) => {
  const dir = fixture(t);
  const binding = controller(dir);
  assert.equal(binding.role, 'controller');
  assert.equal(binding.runId, 'run-a');
  assert.equal(readRun(dir).bindings[0].identitySource.kind, 'prompt');
  binder(dir, 'record', { ...auth(binding), prompt: 'prompt-a', kind: 'dirty', file: 'a.md' });
  assert.match(fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8'), /a\.md/);
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-b/dirty.txt')), false);
});

test('explicit binding keeps A/B dirty, compaction and recovery isolated despite directory mtimes', (t) => {
  const dir = fixture(t);
  const a = controller(dir);
  const b = controller(dir, 'run-b', 'session-b', 'prompt-b');
  invoke(dir, 'dirty-list', 'PostToolUse', { ...event(a), tool_input: { file_path: 'a.md' } });
  invoke(dir, 'dirty-list', 'PostToolUse', { ...event(b), tool_input: { file_path: 'b.md' } });
  const dirtyA = fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8');
  const dirtyB = fs.readFileSync(path.join(dir, '.auto/runs/run-b/dirty.txt'), 'utf8');
  assert.match(dirtyA, /a\.md/);
  assert.doesNotMatch(dirtyA, /b\.md/);
  assert.match(dirtyB, /b\.md/);
  assert.doesNotMatch(dirtyB, /a\.md/);
  invoke(dir, 'compact', 'PreCompact', event(a));
  assert.equal(pendingFiles(dir).length, 1);
  assert.doesNotMatch(
    invoke(dir, 'prompt', 'UserPromptSubmit', { ...event(b), prompt: 'continue' }),
    /Compaction hook ran/
  );
  assert.equal(pendingFiles(dir).length, 1);
  const resumed = invoke(dir, 'session', 'SessionStart', {
    session_id: a.sessionId,
    source: 'resume'
  });
  assert.match(resumed, /run-a/);
  assert.doesNotMatch(resumed, /run-b/);
  assert.match(resumed, /Compaction hook ran/);
  assert.equal(pendingFiles(dir).length, 0);
});

test('SubagentStart receipt plus a preregistered task binds a worker without guessing parent session', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  const child = worker(dir, parent, 'worker-x', 'different-worker-session', 'worker-prompt');
  assert.equal(child.role, 'worker');
  assert.equal(child.runId, parent.runId);
  invoke(dir, 'dirty-list', 'PostToolUse', {
    session_id: child.sessionId,
    agent_id: child.agentId,
    prompt_id: 'worker-prompt',
    tool_input: { file_path: 'worker.md' }
  });
  assert.match(fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8'), /worker\.md/);
});

test('same-session workers cannot produce/consume controller pending or generate run metrics', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  const one = worker(dir, parent, 'one');
  const two = worker(dir, parent, 'two');
  invoke(dir, 'compact', 'PreCompact', event(parent));
  const before = pendingFiles(dir);
  for (const child of [one, two]) {
    invoke(dir, 'compact', 'PreCompact', event(child));
    assert.doesNotMatch(
      invoke(dir, 'prompt', 'UserPromptSubmit', { ...event(child), prompt: 'continue' }),
      /Compaction hook ran/
    );
    invoke(dir, 'metrics', 'Stop', event(child));
    assert.deepEqual(pendingFiles(dir), before);
    assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/metrics.json')), false);
  }
  assert.match(
    invoke(dir, 'session', 'SessionStart', { session_id: parent.sessionId, source: 'compact' }),
    /Compaction hook ran/
  );
});

test('missing actor or prompt evidence cannot reuse a controller binding', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  for (const extra of [
    { session_id: parent.sessionId, prompt_id: 'prompt-a' },
    { ...event(parent), prompt_id: undefined },
    {
      ...event(parent),
      auto_binding: { ...event(parent).auto_binding, generation: parent.generation + 1 }
    },
    { ...event(parent), auto_binding: { ...event(parent).auto_binding, proof: 'wrong' } }
  ]) {
    invoke(dir, 'dirty-list', 'PostToolUse', { ...extra, tool_input: { file_path: 'missing.md' } });
    invoke(dir, 'compact', 'PreCompact', extra);
  }
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
  assert.equal(pendingFiles(dir).length, 0);
});

test('new native prompts supersede old runs and reject late controller/worker events', (t) => {
  const dir = fixture(t);
  const a = controller(dir);
  const child = worker(dir, a);
  invoke(dir, 'compact', 'PreCompact', event(a));
  const context = receipt(dir, 'prompt', 'UserPromptSubmit', {
    prompt_id: 'prompt-b',
    prompt: '/auto new task'
  });
  const b = binder(dir, 'bind-controller', { run: 'run-b', receipt: context.receipt });
  assert.ok(b.generation > a.generation);
  for (const stale of [event(a), event(child), { ...event(b), prompt_id: 'prompt-a' }]) {
    invoke(dir, 'dirty-list', 'PostToolUse', { ...stale, tool_input: { file_path: 'stale.md' } });
    invoke(dir, 'compact', 'PostCompact', stale);
  }
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-b/dirty.txt')), false);
  assert.equal(pendingFiles(dir, 'run-b').length, 0);
  assert.doesNotMatch(
    invoke(dir, 'session', 'SessionStart', { source: 'resume' }),
    /Compaction hook ran/
  );
});

test('reusing one native prompt for another run is rejected without changing its owner', (t) => {
  const dir = fixture(t);
  const a = controller(dir);
  const context = receipt(dir, 'prompt', 'UserPromptSubmit', {
    prompt_id: 'prompt-a',
    prompt: '/auto another run'
  });
  assert.match(
    binder(dir, 'bind-controller', { run: 'run-b', receipt: context.receipt }, 1),
    /cannot identify two runs/
  );
  assert.equal(readRun(dir).bindings[0].status, 'active');
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-b/host-bindings.json')), false);
  assert.equal(a.runId, 'run-a');
});

test('run-local truth survives cache removal/corruption; clear and fork never inherit a run', (t) => {
  const dir = fixture(t);
  const a = controller(dir);
  const cache = path.join(dir, '.auto/cache/host-sessions');
  fs.rmSync(cache, { recursive: true, force: true });
  assert.equal(binder(dir, 'rebuild').bindings[0].status, 'indexed');
  const index = fs.readdirSync(cache).find((name) => name.startsWith('session-'));
  fs.writeFileSync(path.join(cache, index), '{bad cache');
  assert.match(invoke(dir, 'session', 'SessionStart', { source: 'resume' }), /run-a/);
  for (const source of ['clear', 'fork']) {
    assert.doesNotMatch(invoke(dir, 'session', 'SessionStart', { source }), /session-continuity/);
    invoke(dir, 'dirty-list', 'PostToolUse', { ...event(a), tool_input: { file_path: 'old.md' } });
    assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
  }
});

test('conflicting bindings remain unknown after index rebuilding', (t) => {
  const dir = fixture(t);
  controller(dir);
  const document = readRun(dir);
  document.runId = 'run-b';
  fs.writeFileSync(path.join(dir, '.auto/runs/run-b/host-bindings.json'), JSON.stringify(document));
  assert.equal(binder(dir, 'rebuild').bindings[0].status, 'unattributed');
  assert.doesNotMatch(
    invoke(dir, 'session', 'SessionStart', { source: 'resume' }),
    /session-continuity/
  );
  invoke(dir, 'metrics', 'Stop', { prompt_id: 'prompt-a' });
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/metrics.json')), false);
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-b/metrics.json')), false);
});

test('unregistered/wrong/claimed delegation tickets cannot acquire another run', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  const delegation = binder(dir, 'register-delegation', { ...auth(parent), quest: 'quest-one' });
  const one = receipt(dir, 'worker-start', 'SubagentStart', {
    agent_id: 'one',
    prompt_id: 'prompt-a'
  });
  const two = receipt(dir, 'worker-start', 'SubagentStart', {
    agent_id: 'two',
    prompt_id: 'prompt-a'
  });
  const args = { receipt: one.receipt, delegation: delegation.delegationId, ticket: 'wrong' };
  assert.match(binder(dir, 'bind-worker', args, 1), /did not confirm/);
  assert.equal(readRun(dir).bindings.length, 1);
  binder(dir, 'bind-worker', { ...args, ticket: delegation.ticket });
  assert.match(
    binder(dir, 'bind-worker', { ...args, receipt: two.receipt, ticket: delegation.ticket }, 1),
    /already claimed/
  );
  assert.equal(readRun(dir).bindings.length, 2);
});

test('cross-worktree handshake validates the allowed workspace and rebuilds only with explicit owner', (t) => {
  const dir = fixture(t);
  const other = fixture(t);
  const parent = controller(dir);
  const child = worker(dir, parent, 'remote-worker', 'worker-session', 'worker-prompt', other);
  const input = {
    session_id: child.sessionId,
    agent_id: child.agentId,
    prompt_id: 'worker-prompt',
    tool_input: { file_path: 'remote.md' }
  };
  invoke(other, 'dirty-list', 'PostToolUse', input);
  assert.match(fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8'), /remote\.md/);
  assert.equal(fs.existsSync(path.join(other, '.auto/runs/run-a/dirty.txt')), false);
  fs.rmSync(path.join(other, '.auto/cache/host-sessions'), { recursive: true, force: true });
  invoke(other, 'dirty-list', 'PostToolUse', { ...input, tool_input: { file_path: 'lost.md' } });
  assert.doesNotMatch(
    fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8'),
    /lost\.md/
  );
  binder(other, 'rebuild', { 'owner-root': dir });
  invoke(other, 'dirty-list', 'PostToolUse', {
    ...input,
    tool_input: { file_path: 'restored.md' }
  });
  assert.match(
    fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8'),
    /restored\.md/
  );
});

test('unsafe run/file/receipt paths and malformed input cannot change unrelated run files', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  const before = fs.readFileSync(path.join(dir, '.auto/runs/run-a/host-bindings.json'), 'utf8');
  for (const run of ['../outside', 'run-a/../../run-b', 'archive']) {
    assert.match(
      binder(dir, 'bind-controller', { run, receipt: readRun(dir).bindings[0].receipt }, 1),
      /Invalid run ID/
    );
  }
  assert.match(
    binder(dir, 'bind-controller', { run: 'run-b', receipt: '../run-a/host-bindings' }, 1),
    /Invalid host receipt/
  );
  invoke(dir, 'dirty-list', 'PostToolUse', {
    ...event(parent),
    tool_input: { file_path: '../outside.md' }
  });
  assert.equal(
    fs.readFileSync(path.join(dir, '.auto/runs/run-a/host-bindings.json'), 'utf8'),
    before
  );
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
  for (const input of ['null', '[]', '{invalid']) {
    const result = spawnSync(process.execPath, [hookPath, 'dirty-list'], {
      cwd: dir,
      encoding: 'utf8',
      input
    });
    assert.equal(result.status, 1);
  }
});

test('duplicate dirty events are deduplicated and pending consumption is atomic across processes', async (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  const input = { ...event(parent), tool_input: { file_path: 'one.md' } };
  invoke(dir, 'dirty-list', 'PostToolUse', input);
  invoke(dir, 'dirty-list', 'PostToolUse', input);
  assert.equal(
    fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8').trim().split('\n').length,
    1
  );
  invoke(dir, 'compact', 'PreCompact', event(parent));
  const outputs = await Promise.all(
    Array.from(
      { length: 4 },
      () =>
        new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [hookPath, 'session'], {
            cwd: dir,
            windowsHide: true
          });
          let stdout = '';
          let stderr = '';
          child.stdout.on('data', (data) => {
            stdout += data;
          });
          child.stderr.on('data', (data) => {
            stderr += data;
          });
          child.on('error', reject);
          child.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(stderr))));
          child.stdin.end(
            JSON.stringify({
              cwd: dir,
              session_id: parent.sessionId,
              hook_event_name: 'SessionStart',
              source: 'resume'
            })
          );
        })
    )
  );
  assert.equal(outputs.filter((output) => output.includes('Compaction hook ran')).length, 1);
  assert.equal(pendingFiles(dir).length, 0);
});

test('binding lock conflicts do not modify a run or steal the lock', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  const lock = path.join(dir, '.auto/.host-bindings.lock');
  fs.writeFileSync(lock, 'other live writer');
  invoke(dir, 'dirty-list', 'PostToolUse', {
    ...event(parent),
    tool_input: { file_path: 'locked.md' }
  });
  assert.equal(fs.readFileSync(lock, 'utf8'), 'other live writer');
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
});

test('identity producers reject the wrong native event before issuing a receipt', (t) => {
  const dir = fixture(t);
  for (const [action, eventName, extra] of [
    ['session', 'PostToolUse', { source: 'startup' }],
    ['prompt', 'Stop', { prompt_id: 'prompt-a' }],
    ['worker-start', 'SessionStart', { agent_id: 'worker-a' }]
  ]) {
    const output = invoke(dir, action, eventName, extra);
    assert.match(output, /does not match its producer/);
    assert.doesNotMatch(output, /Auto host identity/);
  }
  const cache = path.join(dir, '.auto/cache/host-sessions');
  assert.equal(fs.readdirSync(cache).filter((name) => name.startsWith('receipt-')).length, 0);
});

test('invalid, future and expired native receipts cannot establish a binding', (t) => {
  const dir = fixture(t);
  receipt(dir, 'session', 'SessionStart', { source: 'startup' });
  const native = receipt(dir, 'prompt', 'UserPromptSubmit', { prompt_id: 'prompt-a' });
  const file = path.join(dir, '.auto/cache/host-sessions', `receipt-${native.receipt}.json`);
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const mutation of [
    { observedAt: 'invalid-date' },
    { observedAt: new Date(Date.now() + 120000).toISOString() },
    { observedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
    { sessionId: null },
    { source: 'SubagentStart' },
    { agentId: 'worker-disguised-as-controller' }
  ]) {
    fs.writeFileSync(file, JSON.stringify({ ...original, ...mutation }));
    binder(dir, 'bind-controller', { run: 'run-a', receipt: native.receipt }, 1);
    assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/host-bindings.json')), false);
  }
  fs.writeFileSync(file, JSON.stringify(original));
  assert.equal(
    binder(dir, 'bind-controller', { run: 'run-a', receipt: native.receipt }).role,
    'controller'
  );
});

test('explicit generation proof supports clients without prompt IDs without enabling native attribution', (t) => {
  const dir = fixture(t);
  receipt(dir, 'session', 'SessionStart', { source: 'startup' });
  const native = receipt(dir, 'prompt', 'UserPromptSubmit');
  const binding = binder(dir, 'bind-controller', { run: 'run-a', receipt: native.receipt });
  assert.deepEqual(binding.promptIds, []);
  invoke(dir, 'dirty-list', 'PostToolUse', { tool_input: { file_path: 'unknown.md' } });
  invoke(dir, 'metrics', 'Stop');
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/metrics.json')), false);
  binder(dir, 'record', { ...auth(binding), kind: 'dirty', file: 'explicit.md' });
  binder(dir, 'record', { ...auth(binding), kind: 'continuity' });
  assert.match(
    fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8'),
    /explicit\.md/
  );
  const output = invoke(dir, 'session', 'SessionStart', { source: 'compact' });
  assert.match(output, /Explicit continuity reminder/);
  assert.equal(pendingFiles(dir).length, 0);
  assert.match(
    binder(
      dir,
      'record',
      { ...auth(binding), prompt: 'invented', kind: 'dirty', file: 'bad.md' },
      1
    ),
    /explicit-prompt-not-bound/
  );
});

test('explicit dirty records retain plain text, configuration and deleted paths exactly once', (t) => {
  const dir = fixture(t);
  const binding = controller(dir);
  const names = ['controller-result.txt', 'settings.json', 'deleted-file'];
  for (const file of [...names, names[0]]) {
    const result = binder(dir, 'record', { ...auth(binding), kind: 'dirty', file });
    assert.equal(result.status, 'recorded');
  }
  const dirty = fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8');
  const realDirectory = fs.realpathSync.native(dir);
  const expectedDirectory =
    process.platform === 'win32' ? realDirectory.toLowerCase() : realDirectory;
  assert.deepEqual(
    dirty.trim().split('\n'),
    names.map((name) => path.join(expectedDirectory, name))
  );
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-b/dirty.txt')), false);
});

test('explicit dirty records reject a missing path and line-breaking paths without reporting success', (t) => {
  const dir = fixture(t);
  const binding = controller(dir);
  binder(dir, 'record', { ...auth(binding), kind: 'dirty' }, 1);
  binder(dir, 'record', { ...auth(binding), kind: 'dirty', file: 'first.md\nother.md' }, 1);
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
});

test('a renewed native receipt without a prompt ID cannot be rebound to another run', (t) => {
  const dir = fixture(t);
  const first = receipt(dir, 'session', 'SessionStart', { source: 'startup' });
  const binding = binder(dir, 'bind-controller', { run: 'run-a', receipt: first.receipt });
  const next = receipt(dir, 'prompt', 'UserPromptSubmit', { prompt: '/auto continue run-a' });
  const continued = binder(dir, 'bind-controller', { run: 'run-a', receipt: next.receipt });
  assert.equal(continued.bindingId, binding.bindingId);
  assert.match(
    binder(dir, 'bind-controller', { run: 'run-b', receipt: next.receipt }, 1),
    /One native receipt cannot identify two runs/
  );
  assert.equal(readRun(dir).bindings[0].status, 'active');
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-b/host-bindings.json')), false);
});

test('resumed workers can bind a fresh native prompt only to their existing delegation', (t) => {
  const dir = fixture(t);
  const other = fixture(t);
  const parent = controller(dir);
  const child = worker(dir, parent, 'resuming-worker', 'worker-session', 'first-prompt', other);
  const delegation = readRun(dir).delegations[0];
  fs.rmSync(path.join(other, '.auto/cache/host-sessions'), { recursive: true, force: true });
  const native = receipt(other, 'worker-start', 'SubagentStart', {
    session_id: child.sessionId,
    agent_id: child.agentId,
    prompt_id: 'second-prompt'
  });
  const resumed = binder(dir, 'bind-worker', {
    'worker-root': other,
    receipt: native.receipt,
    delegation: delegation.id,
    ticket: delegation.ticket
  });
  assert.equal(resumed.bindingId, child.bindingId);
  assert.deepEqual(resumed.promptIds, ['first-prompt', 'second-prompt']);
  invoke(other, 'dirty-list', 'PostToolUse', {
    session_id: child.sessionId,
    agent_id: child.agentId,
    prompt_id: 'second-prompt',
    tool_input: { file_path: 'resumed.md' }
  });
  assert.match(
    fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8'),
    /resumed\.md/
  );
  assert.doesNotMatch(
    invoke(other, 'session', 'SessionStart', {
      session_id: child.sessionId,
      agent_id: child.agentId,
      source: 'resume'
    }),
    /session-continuity/
  );
});

test('delegation handshake rejects a native worker from a different allowed worktree', (t) => {
  const dir = fixture(t);
  const other = fixture(t);
  const parent = controller(dir);
  const delegation = binder(dir, 'register-delegation', {
    ...auth(parent),
    quest: 'local-only',
    'worker-root': dir
  });
  const native = receipt(other, 'worker-start', 'SubagentStart', {
    agent_id: 'wrong-worktree',
    prompt_id: 'prompt-a'
  });
  assert.match(
    binder(
      dir,
      'bind-worker',
      {
        'worker-root': other,
        receipt: native.receipt,
        delegation: delegation.delegationId,
        ticket: delegation.ticket
      },
      1
    ),
    /did not confirm controller\/worktree/
  );
  assert.equal(readRun(dir).bindings.length, 1);
});

test('dangling symlinks in a run cannot redirect pending writes outside the workspace', (t) => {
  const dir = fixture(t);
  const binding = controller(dir);
  const outside = path.join(dir, 'absent-external-target');
  const link = path.join(dir, '.auto/runs/run-a/host-pending');
  fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(fs.existsSync(link), false);
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  assert.match(
    binder(dir, 'record', { ...auth(binding), kind: 'continuity' }, 1),
    /symbolic links/
  );
  assert.equal(fs.existsSync(outside), false);
});

test('linked Git worktrees retain distinct canonical workspace bindings', (t) => {
  const dir = fixture(t);
  const storage = fixture(t);
  const linked = path.join(storage, 'linked');
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result.stdout;
  };
  git('init', '-q');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '--allow-empty',
    '-qm',
    'fixture'
  );
  git('worktree', 'add', '--detach', linked, 'HEAD');
  fs.mkdirSync(path.join(linked, '.auto/runs/run-a'), { recursive: true });
  const nested = path.join(linked, 'nested');
  fs.mkdirSync(nested);
  const main = controller(dir);
  const child = controller(nested);
  const canonicalLinked = fs.realpathSync.native(linked);
  assert.equal(
    child.root,
    process.platform === 'win32' ? canonicalLinked.toLowerCase() : canonicalLinked
  );
  assert.notEqual(child.root, main.root);
  invoke(nested, 'dirty-list', 'PostToolUse', {
    ...event(child),
    tool_input: { file_path: 'local.md' }
  });
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
  assert.match(
    fs.readFileSync(path.join(linked, '.auto/runs/run-a/dirty.txt'), 'utf8'),
    /nested[/\\]local\.md/
  );
});

test('two explicit owners for the same native worker remain conflicting instead of overwriting its index', (t) => {
  const one = fixture(t);
  const two = fixture(t);
  const remote = fixture(t);
  const a = controller(one);
  const b = controller(two);
  const first = worker(one, a, 'shared-worker', 'shared-session', 'shared-prompt', remote);
  worker(two, b, 'shared-worker', 'shared-session', 'shared-prompt', remote);
  const output = invoke(remote, 'dirty-list', 'PostToolUse', {
    session_id: first.sessionId,
    agent_id: first.agentId,
    prompt_id: 'shared-prompt',
    tool_input: { file_path: 'ambiguous.md' }
  });
  assert.match(output, /conflicting-bindings/);
  for (const dir of [one, two, remote])
    assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
});

test('a fresh native prompt consumes pending context only after deliberate rebinding to the same run', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  binder(dir, 'record', { ...auth(parent), kind: 'continuity' });
  const output = invoke(dir, 'prompt', 'UserPromptSubmit', {
    prompt_id: 'continuation-prompt',
    prompt: '/auto continue'
  });
  assert.doesNotMatch(output, /Explicit continuity reminder/);
  assert.equal(pendingFiles(dir).length, 1);
  const contextLine = JSON.parse(output)
    .hookSpecificOutput.additionalContext.split('\n')
    .find((line) => line.startsWith('[Auto host identity] '));
  const native = JSON.parse(contextLine.slice('[Auto host identity] '.length));
  const resumed = binder(dir, 'bind-controller', { run: 'run-a', receipt: native.receipt });
  assert.equal(resumed.bindingId, parent.bindingId);
  assert.match(resumed.pendingContext, /Explicit continuity reminder/);
  assert.equal(pendingFiles(dir).length, 0);
  assert.equal(
    binder(dir, 'bind-controller', { run: 'run-a', receipt: native.receipt }).pendingContext,
    ''
  );
});

test('closed controller bindings also reject late events from registered workers', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  const child = worker(dir, parent, 'closing-worker', 'worker-session', 'worker-prompt');
  binder(dir, 'close', auth(parent));
  assert.ok(readRun(dir).bindings.every((binding) => binding.status === 'closed'));
  for (const identity of [event(parent), event(child)]) {
    invoke(dir, 'dirty-list', 'PostToolUse', { ...identity, tool_input: { file_path: 'late.md' } });
    invoke(dir, 'metrics', 'Stop', identity);
  }
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/metrics.json')), false);
  assert.doesNotMatch(
    invoke(dir, 'session', 'SessionStart', { source: 'resume' }),
    /session-continuity/
  );
});

test('damaged cross-worktree indexes rebuild from an explicit owner without changing run truth', (t) => {
  const dir = fixture(t);
  const remote = fixture(t);
  const parent = controller(dir);
  const child = worker(dir, parent, 'indexed-worker', 'worker-session', 'worker-prompt', remote);
  const truthFile = path.join(dir, '.auto/runs/run-a/host-bindings.json');
  const before = fs.readFileSync(truthFile, 'utf8');
  const cache = path.join(remote, '.auto/cache/host-sessions');
  const ownerHint = path.join(
    cache,
    fs.readdirSync(cache).find((name) => name.startsWith('owner-'))
  );
  fs.writeFileSync(ownerHint, '{broken');
  const input = {
    session_id: child.sessionId,
    agent_id: child.agentId,
    prompt_id: 'worker-prompt',
    tool_input: { file_path: 'after-rebuild.md' }
  };
  invoke(remote, 'dirty-list', 'PostToolUse', input);
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
  binder(remote, 'rebuild', { 'owner-root': dir });
  invoke(remote, 'dirty-list', 'PostToolUse', input);
  assert.match(
    fs.readFileSync(path.join(dir, '.auto/runs/run-a/dirty.txt'), 'utf8'),
    /after-rebuild\.md/
  );
  assert.equal(fs.readFileSync(truthFile, 'utf8'), before);
});

test('oversized dirty lists remain unchanged and report a bounded diagnostic', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  const file = path.join(dir, '.auto/runs/run-a/dirty.txt');
  const prior = 'x'.repeat(1024 * 1024 + 1);
  fs.writeFileSync(file, prior);
  const output = invoke(dir, 'dirty-list', 'PostToolUse', {
    ...event(parent),
    tool_input: { file_path: 'too-many.md' }
  });
  assert.match(output, /capacity/);
  assert.equal(fs.readFileSync(file, 'utf8'), prior);
});

test('many individually valid run documents cannot exceed the total scan capacity', (t) => {
  const dir = fixture(t);
  const parent = controller(dir);
  for (let index = 0; index < 20; index++) {
    const runId = `historical-${index}`;
    const directory = path.join(dir, '.auto/runs', runId);
    fs.mkdirSync(directory);
    fs.writeFileSync(
      path.join(directory, 'host-bindings.json'),
      JSON.stringify({
        schema: 'auto-host-bindings-v1',
        host: 'claude',
        runId,
        workspace: parent.root,
        bindings: [],
        delegations: [],
        historicalDetail: 'x'.repeat(900000)
      })
    );
  }
  const output = invoke(dir, 'dirty-list', 'PostToolUse', {
    ...event(parent),
    tool_input: { file_path: 'over-budget.md' }
  });
  assert.match(output, /Total binding scan exceeds capacity/);
  assert.equal(fs.existsSync(path.join(dir, '.auto/runs/run-a/dirty.txt')), false);
});
