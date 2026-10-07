const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readInput, emit } = require('./hook-output.cjs');
const { checks } = require('./hook-checks.cjs');
const { create } = require('./snapshot.cjs');

function git(cwd, args) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_NAMESPACE'
  ])
    delete env[key];
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
    env
  });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message || result.stderr.trim());
  return result.stdout;
}
function repoRoot(cwd) {
  try {
    return git(cwd, ['rev-parse', '--show-toplevel']).trim();
  } catch (error) {
    if (/not a git repository/i.test(error.message)) return null;
    throw error;
  }
}
function dirty(root) {
  const changed = git(root, [
    'ls-files',
    '--modified',
    '--deleted',
    '--others',
    '--exclude-standard',
    '-z'
  ]);
  const staged = git(root, ['diff', '--cached', '--name-only', '-z']);
  return [...new Set(`${changed}${staged}`.split('\0').filter(Boolean))];
}
function latestRun(cwd) {
  const runs = path.join(cwd, '.auto/runs');
  if (!fs.existsSync(runs)) return null;
  const names = fs
    .readdirSync(runs)
    .filter((name) => name !== 'archive' && fs.statSync(path.join(runs, name)).isDirectory());
  names.sort(
    (a, b) => fs.statSync(path.join(runs, b)).mtimeMs - fs.statSync(path.join(runs, a)).mtimeMs
  );
  return names[0] ? path.join(runs, names[0]) : null;
}
function projectContext(cwd) {
  const files = ['CLAUDE.md', '.auto/constitution.md'];
  const latest = latestRun(cwd);
  if (latest) files.push(path.relative(cwd, path.join(latest, 'session-continuity.md')));
  return files.filter((file) => fs.existsSync(path.join(cwd, file)));
}
function coverage(input) {
  const response = input.tool_response;
  const output =
    typeof response === 'string'
      ? response
      : [response?.stdout, response?.stderr]
          .filter((value) => typeof value === 'string')
          .join('\n');
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  const patterns = [
    /^\s*All files\s*\|\s*(\d+(?:\.\d+)?)/im,
    /^\s*Statements\s*:\s*(\d+(?:\.\d+)?)%/im,
    /^TOTAL\s+\d+\s+\d+(?:\s+\d+\s+\d+)?\s+(\d+(?:\.\d+)?)%\s*$/im
  ];
  const match = patterns.map((pattern) => pattern.exec(clean)).find(Boolean);
  if (!match) return '';
  const percent = Number(match[1]);
  return percent >= 0 && percent < 80
    ? `[Hook] Coverage below 80%: ${percent}%. This is a reported coverage value, not proof that tests passed.`
    : '';
}
function pendingContext(cwd, consume) {
  const file = path.join(cwd, '.auto/hook-context.json');
  if (!fs.existsSync(file)) return '';
  const message = JSON.parse(fs.readFileSync(file, 'utf8')).message;
  if (consume) fs.unlinkSync(file);
  return typeof message === 'string' ? message : '';
}
function compactContext(cwd) {
  const directory = path.join(cwd, '.auto');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'hook-context.json');
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(
    temporary,
    JSON.stringify({
      message:
        "[Hook] Compaction hook ran. Read CLAUDE.md, .auto/constitution.md and the latest session-continuity.md if present before continuing. A hook cannot save the model's in-memory progress."
    }),
    { flag: 'wx' }
  );
  fs.renameSync(temporary, file);
}

function handle(name, input, cwd) {
  const file =
    typeof input.tool_input?.file_path === 'string'
      ? path.resolve(cwd, input.tool_input.file_path)
      : '';
  const command = typeof input.tool_input?.command === 'string' ? input.tool_input.command : '';
  if (name === 'coverage') return coverage(input);
  if (name === 'lint' || name === 'tsc') return checks(name, file);
  if (name === 'large-file') {
    if (!/\.(js|ts|jsx|tsx|java|py|go|rs)$/.test(file) || !fs.existsSync(file)) return '';
    const lines = (fs.readFileSync(file, 'utf8').match(/\n/g) || []).length;
    return lines > 500
      ? `[Hook] WARNING: ${file} already has ${lines} lines. Consider splitting into smaller modules (recommended < 400 lines).`
      : '';
  }
  if (name === 'push') {
    // Conservative command-position signal; never authorizes or blocks a push.
    const tokens = command.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s;&|]+|[;&|]+/g) || [];
    const words = tokens.map((token) =>
      /^(['"])[\s\S]*\1$/.test(token) ? token.slice(1, -1) : token
    );
    for (let i = 0; i < words.length; i++) {
      if (words[i] !== 'git' || (i > 0 && !/^[;&|]+$/.test(words[i - 1]))) continue;
      let j = i + 1;
      while (words[j]?.startsWith('-')) {
        const option = words[j++];
        if (['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(option)) j++;
      }
      if (words[j] === 'push')
        return '[Hook] WARNING: git push detected. Review the intended changes and target before pushing.';
    }
    return '';
  }
  if (name === 'tmux-reminder') {
    if (
      !/(npm|pnpm|yarn|bun) (install|test)|cargo build|make|docker|pytest|vitest|playwright/.test(
        command
      ) ||
      process.env.TMUX
    )
      return '';
    const result = spawnSync('tmux', ['-V'], {
      cwd,
      encoding: 'utf8',
      timeout: 2000,
      windowsHide: true
    });
    return result.status === 0
      ? '[Hook] Consider running long commands in tmux for session persistence.'
      : '';
  }
  if (name === 'snapshot') {
    const root = repoRoot(cwd);
    if (
      !root ||
      dirty(root).filter((name) => name !== '.auto' && !name.startsWith('.auto/')).length < 3
    )
      return '';
    const snapshot = create(root);
    return `[Hook] Auto-snapshot created: ${snapshot.ref}. Restore into a new directory outside this worktree with: node "${path.join(__dirname, 'snapshot.cjs')}" restore ${snapshot.ref} <new-directory>. Includes tracked/index state and non-ignored untracked files; ignored files are excluded.`;
  }
  if (name === 'pr') {
    if (!/\bgh\s+pr\s+create\b/.test(command)) return '';
    const response = input.tool_response;
    const output = typeof response === 'string' ? response : response?.stdout || '';
    const url = output.match(/https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/)?.[0];
    return url ? `[Hook] PR created: ${url}. Review the PR and its checks.` : '';
  }
  if (name === 'console') {
    if (!/\.[jt]sx?$/.test(file) || /(^|[/\\])scripts[/\\]/.test(file) || !fs.existsSync(file))
      return '';
    return /console\.log/.test(fs.readFileSync(file, 'utf8'))
      ? `[Hook] WARNING: console.log found in ${file}. Review before committing.`
      : '';
  }
  if (name === 'commit-reminder' || name === 'task-completed' || name === 'stop-console') {
    const root = repoRoot(cwd);
    if (!root) return '';
    const files = dirty(root);
    if (name === 'commit-reminder')
      return files.length >= 5
        ? `[Hook] REMINDER: ${files.length} uncommitted file changes. Consider committing when the change set is ready.`
        : '';
    if (name === 'task-completed')
      return files.length
        ? '[Hook] REMINDER: Uncommitted changes present at task completion. Commit when the change set is ready.'
        : '';
    const logs = files.filter(
      (name) =>
        /\.[jt]sx?$/.test(name) &&
        fs.existsSync(path.join(root, name)) &&
        /console\.log/.test(fs.readFileSync(path.join(root, name), 'utf8'))
    );
    return logs.length
      ? `[Hook] WARNING: console.log found in ${logs.slice(0, 10).join(', ')}. Review before committing.`
      : '';
  }
  if (name === 'skill')
    return /(^|[/\\])skills[/\\].*\.md$|[/\\]SKILL\.md$/.test(file)
      ? `[Hook] Skill edited: ${file}. Consider skill-evaluator health checks.`
      : '';
  if (name === 'session') {
    const files = projectContext(cwd);
    return [
      files.length ? `[Hook] SessionStart: Read project context: ${files.join(', ')}` : '',
      pendingContext(cwd, true)
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (name === 'compact') {
    compactContext(cwd);
    return '';
  }
  if (name === 'prompt') {
    const prompt = typeof input.prompt === 'string' ? input.prompt : '';
    const warning =
      /sk-[a-zA-Z0-9]{20,}|gh[po]_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9-]{20,}|xoxb-[0-9]{10,}|AKIA[0-9A-Z]{16}/.test(
        prompt
      )
        ? '[Hook] WARNING: Potential secret/API key detected. Use environment variables instead of pasting keys.'
        : '';
    return [pendingContext(cwd, true), warning].filter(Boolean).join('\n');
  }
  if (name === 'teammate')
    return `[Hook] Teammate '${input.teammate_name || 'unknown'}' is idle. Check available tasks or conclude the teammate's work.`;
  if (name === 'dirty-list') {
    const latest = latestRun(cwd);
    if (!file || !latest || !/\.(ts|tsx|js|jsx|java|py|go|rs|md)$/.test(file)) return '';
    const target = path.join(latest, 'dirty.txt');
    fs.appendFileSync(target, `${file}\n`);
    return '';
  }
  if (name === 'metrics') {
    const latest = latestRun(cwd);
    const script = path.resolve(__dirname, '../../scripts/generate-metrics.js');
    if (!latest || fs.existsSync(path.join(latest, 'metrics.json')) || !fs.existsSync(script))
      return '';
    const result = spawnSync(process.execPath, [script, path.basename(latest)], {
      cwd,
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true
    });
    if (result.status !== 0)
      return `[Hook] WARNING: metrics generation failed: ${result.error?.message || result.stderr}`;
    return `[Hook] metrics.json generated for ${path.basename(latest)}`;
  }
  throw new Error(`Unknown hook handler: ${name}`);
}

let input;
try {
  input = readInput();
  const cwd = typeof input.cwd === 'string' ? path.resolve(input.cwd) : process.cwd();
  emit(input.hook_event_name, handle(process.argv[2], input, cwd));
} catch (error) {
  // Safety snapshot failures must stop the pending edit, never claim protection.
  if (process.argv[2] === 'snapshot') {
    process.stderr.write(`[Hook] Snapshot failed: ${error.message}\n`);
    process.exitCode = 2;
  } else if (process.argv[2] === 'compact') {
    process.stderr.write(`[Hook] Compaction reminder was not saved: ${error.message}\n`);
    process.exitCode = 1;
  } else if (input)
    emit(input.hook_event_name, `[Hook] ${process.argv[2]} failed: ${error.message}`);
  else {
    process.stderr.write(`[Hook] Invalid input: ${error.message}\n`);
    process.exitCode = 1;
  }
}
