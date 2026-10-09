import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'hooks/hooks.json')));
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-hook space-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(path.join(root, 'hooks/lib'), path.join(dir, '.claude/auto-cli/hooks/lib'), {
    recursive: true
  });
  fs.cpSync(path.join(root, 'scripts'), path.join(dir, '.claude/auto-cli/scripts'), {
    recursive: true
  });
  fs.writeFileSync(path.join(dir, '.claude/auto-cli/package.json'), '{"type":"module"}');
  return dir;
}

function hook(dir, event, description, input = {}, envOverride = {}) {
  const entry = config.hooks[event].find((item) => item.description.includes(description));
  assert.ok(entry, `${event}: ${description}`);
  return spawnSync(bash, ['-c', entry.hooks[0].command], {
    cwd: dir,
    input: JSON.stringify({ cwd: dir, hook_event_name: event, ...input }),
    encoding: 'utf8',
    timeout: description.includes('Auto-snapshot') ? 20000 : 8000,
    env: {
      ...process.env,
      HOME: dir,
      USERPROFILE: dir,
      CLAUDE_CONFIG_DIR: path.join(dir, '.claude'),
      CLAUDE_PLUGIN_ROOT: '',
      CLAUDE_TOOL_OUTPUT: '',
      ...envOverride
    }
  });
}

function context(result, event) {
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, event);
  return output.hookSpecificOutput.additionalContext;
}

function controllerBinding(dir, runId) {
  const sessionId = 'installed-session';
  const promptId = 'installed-prompt';
  context(
    hook(dir, 'SessionStart', 'SessionStart', { session_id: sessionId, source: 'startup' }),
    'SessionStart'
  );
  const message = context(
    hook(dir, 'UserPromptSubmit', 'Warn if user prompt', {
      session_id: sessionId,
      prompt_id: promptId,
      prompt: '/auto installed fixture'
    }),
    'UserPromptSubmit'
  );
  const receiptLine = message.split('\n').find((line) => line.startsWith('[Auto host identity] '));
  assert.ok(receiptLine, message);
  const receipt = JSON.parse(receiptLine.slice('[Auto host identity] '.length));
  const result = spawnSync(
    process.execPath,
    [
      path.join(dir, '.claude/auto-cli/hooks/lib/run-bindings.cjs'),
      'bind-controller',
      '--root',
      dir,
      '--run',
      runId,
      '--receipt',
      receipt.receipt
    ],
    { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 8000 }
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const binding = JSON.parse(result.stdout);
  return {
    session_id: sessionId,
    prompt_id: promptId,
    auto_binding: { id: binding.bindingId, generation: binding.generation, proof: binding.proof }
  };
}

test('SessionStart delivers project reminders as model context', (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'project');
  assert.match(context(hook(dir, 'SessionStart', 'SessionStart'), 'SessionStart'), /CLAUDE.md/);
});

test('plugin hook resolves its own helpers before the user configuration directory', (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'project');
  const result = hook(
    dir,
    'SessionStart',
    'SessionStart',
    {},
    {
      CLAUDE_PLUGIN_ROOT: path.join(dir, '.claude/auto-cli'),
      CLAUDE_CONFIG_DIR: path.join(dir, 'absent-host')
    }
  );
  assert.match(context(result, 'SessionStart'), /CLAUDE.md/);
});

test('installed metrics helper targets the caller project without its own scripts directory', (t) => {
  const dir = fixture(t);
  const run = path.join(dir, '.auto/runs/run-installed-metrics');
  fs.mkdirSync(run, { recursive: true });
  const identity = controllerBinding(dir, 'run-installed-metrics');
  const result = hook(dir, 'Stop', 'lacks metrics.json', identity);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(run, 'metrics.json')));
  assert.ok(!fs.existsSync(path.join(dir, '.claude/auto-cli/.auto')));
});

test('PreToolUse warning passes without asking or denying', (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'big.ts'), 'a\n'.repeat(501));
  const result = hook(dir, 'PreToolUse', 'Warn when editing', {
    tool_name: 'Edit',
    tool_input: { file_path: path.join(dir, 'big.ts') }
  });
  assert.match(context(result, 'PreToolUse'), /501/);
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, undefined);
});

test('coverage consumes official tool_response even when tests failed', (t) => {
  const dir = fixture(t);
  const result = hook(dir, 'PostToolUse', 'Coverage check', {
    tool_name: 'Bash',
    tool_input: { command: 'npm test -- --coverage' },
    tool_response: {
      stdout: 'Tests 1 failed\nAll files | 20 | 10 | 30 | 20 |\n',
      stderr: '',
      exitCode: 1
    }
  });
  assert.match(context(result, 'PostToolUse'), /20%/);
});

test('coverage does not invent a percentage for unsupported output', (t) => {
  const dir = fixture(t);
  const result = hook(dir, 'PostToolUse', 'Coverage check', {
    tool_name: 'Bash',
    tool_input: { command: 'npm test' },
    tool_response: { stdout: 'Tests 1 passed\n', stderr: '' }
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('lint and TypeScript checks terminate without package.json for all native path forms', (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'file.ts'), 'const x = 1;\n');
  for (const file of [
    'file.ts',
    path.join(dir, 'file.ts'),
    path.join(dir, 'file.ts').replaceAll('\\', '/')
  ]) {
    for (const description of ['lint', 'TypeScript check']) {
      const result = hook(dir, 'PostToolUse', description, {
        tool_name: 'Edit',
        tool_input: { file_path: file }
      });
      assert.equal(
        result.status,
        0,
        `${description} ${file}: ${result.error?.message || result.stderr}`
      );
    }
  }
});

test('lint checks local tools once, keeps bytes unchanged and reports failed execution', (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  fs.writeFileSync(path.join(dir, 'eslint.config.js'), 'export default [];');
  const file = path.join(dir, 'file.ts');
  fs.writeFileSync(file, 'const x=1\n');
  for (const name of ['eslint', 'prettier']) {
    const pkg = path.join(dir, 'node_modules', name);
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name, bin: 'cli.cjs' }));
    fs.writeFileSync(
      path.join(pkg, 'cli.cjs'),
      `require('fs').appendFileSync(${JSON.stringify(path.join(dir, 'calls.jsonl'))}, JSON.stringify(process.argv.slice(2))+'\\n'); process.stderr.write('fixture check failed'); process.exitCode=1;`
    );
  }
  const result = hook(dir, 'PostToolUse', 'lint', {
    tool_name: 'Edit',
    tool_input: { file_path: file }
  });
  assert.match(context(result, 'PostToolUse'), /fixture check failed/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'const x=1\n');
  const calls = fs
    .readFileSync(path.join(dir, 'calls.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.equal(calls.length, 2);
  assert.ok(calls.flat().includes('--check'));
  assert.ok(!calls.flat().some((arg) => ['--fix', '--write'].includes(arg)));
});

test('Stop warning uses user message without continuing the conversation', (t) => {
  const dir = fixture(t);
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(dir, 'file.js'), '');
  git('add', 'file.js');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'base'
  );
  fs.writeFileSync(path.join(dir, 'file.js'), 'console.log(1);');
  const result = hook(dir, 'Stop', 'Final audit', { stop_hook_active: true });
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.match(output.systemMessage, /console.log/);
  assert.equal(output.hookSpecificOutput, undefined);
  assert.equal(output.decision, undefined);
  assert.equal(output.continue, undefined);
});

test('push warning handles quoted subcommands without matching commit messages', (t) => {
  const dir = fixture(t);
  for (const command of ['git push', 'git "push" origin main', 'git -C "some folder" push']) {
    assert.match(
      context(
        hook(dir, 'PreToolUse', 'before git push', { tool_name: 'Bash', tool_input: { command } }),
        'PreToolUse'
      ),
      /push detected/
    );
  }
  assert.equal(
    hook(dir, 'PreToolUse', 'before git push', {
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "do not git push"' }
    }).stdout,
    ''
  );
});

test('confirmed compaction persists a run reminder and delivers it on the next supported event', (t) => {
  const dir = fixture(t);
  fs.mkdirSync(path.join(dir, '.auto/runs/compact-run'), { recursive: true });
  const identity = controllerBinding(dir, 'compact-run');
  const result = hook(dir, 'PreCompact', 'Persist a reminder', identity);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(
    context(
      hook(dir, 'UserPromptSubmit', 'Warn if user prompt', { ...identity, prompt: 'continue' }),
      'UserPromptSubmit'
    ),
    /Compaction hook ran/
  );
  assert.doesNotMatch(
    hook(dir, 'UserPromptSubmit', 'Warn if user prompt', { ...identity, prompt: 'continue' })
      .stdout,
    /Compaction hook ran/
  );
});

test('native compact without controller role proof cannot create a pending reminder', (t) => {
  const dir = fixture(t);
  const run = path.join(dir, '.auto/runs/compact-run');
  fs.mkdirSync(run, { recursive: true });
  const identity = controllerBinding(dir, 'compact-run');
  const result = hook(dir, 'PreCompact', 'Persist a reminder', {
    session_id: identity.session_id,
    prompt_id: identity.prompt_id
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /unattributed|attribution unavailable/);
  assert.equal(fs.existsSync(path.join(run, 'host-pending')), false);
});

test('coverage supports stderr summaries and does not report passing values', (t) => {
  const dir = fixture(t);
  for (const stderr of ['Statements : 42.5% (17/40)', 'TOTAL    40    23    42%']) {
    assert.match(
      context(
        hook(dir, 'PostToolUse', 'Coverage check', { tool_response: { stdout: '', stderr } }),
        'PostToolUse'
      ),
      /42/
    );
  }
  assert.equal(
    hook(dir, 'PostToolUse', 'Coverage check', {
      tool_response: { stdout: 'All files | 95 | 90 | 90 | 95 |' }
    }).stdout,
    ''
  );
});

test('snapshot hook counts files inside an untracked directory and fails closed on lock conflict', (t) => {
  const dir = fixture(t);
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  git('init', '-q');
  fs.writeFileSync(path.join(dir, '.gitignore'), '/.claude\n');
  git('add', '.gitignore');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'base'
  );
  fs.mkdirSync(path.join(dir, 'new'));
  for (const name of ['a', 'b']) fs.writeFileSync(path.join(dir, 'new', name), name);
  const input = { tool_name: 'Edit', tool_input: { file_path: 'new/a' } };
  assert.equal(hook(dir, 'PreToolUse', 'Auto-snapshot:', input).stdout, '');
  fs.writeFileSync(path.join(dir, 'new/c'), 'c');
  const result = hook(dir, 'PreToolUse', 'Auto-snapshot:', input);
  assert.match(context(result, 'PreToolUse'), /Auto-snapshot created/);
  assert.equal(
    git('for-each-ref', '--format=%(refname)', 'refs/auto-snapshots').trim().split('\n').length,
    1
  );
  fs.writeFileSync(path.join(dir, '.git/index.lock'), 'other writer');
  const failed = hook(dir, 'PreToolUse', 'Auto-snapshot:', input);
  assert.equal(failed.status, 2);
  assert.match(failed.stderr, /Snapshot failed/);
  assert.equal(failed.stdout, '');
});

test('TypeScript reports non-file-specific execution failure and never writes build outputs', (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(dir, 'file.ts'), 'const x = 1;\n');
  const pkg = path.join(dir, 'node_modules/typescript');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(
    path.join(pkg, 'package.json'),
    JSON.stringify({ name: 'typescript', bin: { tsc: 'cli.cjs' } })
  );
  fs.writeFileSync(
    path.join(pkg, 'cli.cjs'),
    `const args=process.argv.slice(2); if(!args.includes('--noEmit') || !args.includes('--incremental') || args[args.indexOf('--incremental')+1]!=='false') require('fs').writeFileSync('output.js', 'unexpected build'); process.stderr.write('Cannot find global type Array'); process.exitCode=2;`
  );
  const result = hook(dir, 'PostToolUse', 'TypeScript check', {
    tool_input: { file_path: 'file.ts' }
  });
  assert.match(context(result, 'PostToolUse'), /Cannot find global type Array/);
  assert.equal(fs.existsSync(path.join(dir, 'output.js')), false);
});

test('optional metrics logger records official tool_name without echoing the input', (t) => {
  const dir = fixture(t);
  const run = path.join(dir, '.auto/runs/fixture');
  fs.mkdirSync(run, { recursive: true });
  const identity = controllerBinding(dir, 'fixture');
  const businessMetrics = '{"scope":"business","tokens":{"total":null}}\n';
  fs.writeFileSync(path.join(run, 'metrics.json'), businessMetrics);
  const result = spawnSync(
    bash,
    [path.join(dir, '.claude/auto-cli/hooks/lib/log-metrics.sh').replaceAll('\\', '/')],
    {
      cwd: dir,
      input: JSON.stringify({
        ...identity,
        cwd: dir,
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_use_id: 'tool-one',
        tool: 'Wrong legacy value'
      }),
      encoding: 'utf8'
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  const event = JSON.parse(
    fs.readFileSync(path.join(run, 'host-tool-events.jsonl'), 'utf8').trim()
  );
  assert.equal(event.tool, 'Edit');
  assert.equal(event.role, 'controller');
  assert.equal(event.toolUseId, 'tool-one');
  assert.equal(event.tokens, null);
  assert.equal(event.cost, null);
  assert.equal(fs.readFileSync(path.join(run, 'metrics.json'), 'utf8'), businessMetrics);
});

test('existing documentation and TDD guards still consume stdin and keep their decisions', (t) => {
  const dir = fixture(t);
  const denied = hook(dir, 'PreToolUse', 'Block creation of random', {
    tool_name: 'Write',
    tool_input: { file_path: 'random-notes.md' }
  });
  assert.equal(denied.status, 2, denied.stderr);
  assert.match(denied.stderr, /BLOCKED/);
  const allowed = hook(dir, 'PreToolUse', 'Block creation of random', {
    tool_name: 'Write',
    tool_input: { file_path: 'README.md' }
  });
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(allowed.stdout, '');
  const tdd = hook(dir, 'PreToolUse', 'TDD Guard:', {
    tool_name: 'Edit',
    tool_input: { file_path: path.join(dir, 'new-source.ts') }
  });
  assert.equal(tdd.status, 0, tdd.stderr);
  assert.equal(JSON.parse(tdd.stdout).hookSpecificOutput.permissionDecision, 'ask');
});
