const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function git(cwd, args, options = {}) {
  const env = { ...process.env };
  // A caller's Git routing variables must never redirect recovery into its source repository.
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
  return execFileSync(
    'git',
    ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args],
    {
      cwd,
      maxBuffer: 128 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 30000,
      ...options,
      env: { ...env, GIT_OPTIONAL_LOCKS: '0', ...options.env }
    }
  );
}
function text(cwd, args, options) {
  return git(cwd, args, options).toString('utf8').trim();
}
function optional(cwd, args) {
  try {
    return text(cwd, args);
  } catch (error) {
    if (error.status === 1 || error.status === 128) return null;
    throw error;
  }
}
function blob(root, data) {
  return text(root, ['hash-object', '-w', '--stdin'], { input: data });
}
function safePath(name) {
  if (
    !name ||
    name.includes('\\') ||
    name
      .split('/')
      .some((part) => !part || part === '.' || part === '..' || /^\.git$/i.test(part)) ||
    path.isAbsolute(name) ||
    /^[a-z]:/i.test(name)
  ) {
    throw new Error(`Unsupported snapshot path: ${JSON.stringify(name)}`);
  }
  if (
    process.platform === 'win32' &&
    name
      .split('/')
      .some(
        (part) =>
          /[<>:"|?*]|[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
      )
  ) {
    throw new Error(`Unsupported Windows snapshot path: ${JSON.stringify(name)}`);
  }
  return name;
}
function names(buffer) {
  const value = buffer.toString('utf8');
  if (!Buffer.from(value).equals(buffer)) throw new Error('Non-UTF-8 file names are unsupported');
  return value.split('\0').filter(Boolean).map(safePath);
}
function assertLocalFile(root, name) {
  let directory = root;
  for (const part of name.split('/').slice(0, -1)) {
    directory = path.join(directory, part);
    const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) throw new Error(`Snapshot path traverses a symbolic link: ${name}`);
  }
}
function commit(root, tree, parent, message) {
  return text(
    root,
    [
      '-c',
      'user.name=Auto CLI Snapshot',
      '-c',
      'user.email=snapshot@example.invalid',
      'commit-tree',
      tree,
      ...(parent ? ['-p', parent] : [])
    ],
    { input: message }
  );
}
function buildTree(root, entries, index) {
  const env = { GIT_INDEX_FILE: index };
  git(root, ['read-tree', '--empty'], { env });
  if (entries.length) {
    git(root, ['update-index', '-z', '--index-info'], {
      env,
      input: entries.map(({ mode, sha, name }) => `${mode} ${sha}\t${name}\0`).join('')
    });
  }
  return text(root, ['write-tree'], { env });
}
function capture(root, indexPath, temp) {
  const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath) : null;
  const copy = path.join(temp, 'index-copy');
  fs.rmSync(copy, { force: true });
  if (index) fs.writeFileSync(copy, index);
  const env = { GIT_INDEX_FILE: copy };
  if (!index) git(root, ['read-tree', '--empty'], { env });
  git(root, ['update-index', '--no-split-index'], { env });
  const indexTree = text(root, ['write-tree'], { env });
  names(git(root, ['ls-files', '-z'], { env }));
  const staged = git(root, ['ls-files', '--stage', '-z'], { env })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const modes = new Map();
  for (const entry of staged) {
    const match = /^(\d+) [a-f0-9]+ (\d)\t([\s\S]+)$/.exec(entry);
    if (!match || match[2] !== '0' || match[1] === '160000')
      throw new Error('Unmerged indexes and submodules are unsupported');
    modes.set(safePath(match[3]), match[1]);
  }
  const head = optional(root, ['rev-parse', '--verify', 'HEAD']);
  const tracked = head ? names(git(root, ['ls-tree', '-r', '--name-only', '-z', head])) : [];
  const files = [
    ...new Set([
      ...modes.keys(),
      ...tracked,
      ...names(git(root, ['ls-files', '--others', '--exclude-standard', '-z']))
    ])
  ].sort();
  const entries = [];
  for (const name of files) {
    assertLocalFile(root, name);
    const location = path.join(root, name);
    if (!fs.existsSync(location) && !fs.lstatSync(location, { throwIfNoEntry: false })) continue;
    const stat = fs.lstatSync(location);
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error(`Unsupported file type: ${name}`);
    if (stat.size > 64 * 1024 * 1024)
      throw new Error(`Snapshot file exceeds the 64 MiB recovery limit: ${name}`);
    const mode = stat.isSymbolicLink()
      ? '120000'
      : process.platform === 'win32'
        ? modes.get(name) === '100755'
          ? '100755'
          : '100644'
        : stat.mode & 0o111
          ? '100755'
          : '100644';
    let sha = null;
    if (stat.isSymbolicLink()) {
      const contents = fs.readlinkSync(location, { encoding: 'buffer' });
      if (!Buffer.from(contents.toString('utf8')).equals(contents))
        throw new Error('Non-UTF-8 symlink targets are unsupported');
      sha = blob(root, contents);
    }
    entries.push({ mode, sha, name });
  }
  const regular = entries.filter((entry) => !entry.sha);
  while (regular.length) {
    const batch = [];
    let size = 0;
    while (regular.length && (batch.length === 0 || size + regular[0].name.length < 12000)) {
      const entry = regular.shift();
      batch.push(entry);
      size += entry.name.length + 3;
    }
    const hashes = text(root, [
      'hash-object',
      '-w',
      '--no-filters',
      '--',
      ...batch.map((entry) => entry.name)
    ]).split('\n');
    if (hashes.length !== batch.length)
      throw new Error('Incomplete file hashing; no snapshot created');
    batch.forEach((entry, index) => {
      entry.sha = hashes[index];
    });
  }
  const configs = {};
  for (const key of ['core.autocrlf', 'core.filemode', 'core.symlinks', 'core.ignorecase']) {
    const value = optional(root, ['config', '--get', key]);
    if (value !== null) configs[key] = value;
  }
  const tree = buildTree(root, entries, path.join(temp, 'worktree-index'));
  const portableIndex = fs.readFileSync(copy);
  return { head, indexTree, tree, index, portableIndex, entries, configs };
}
function fingerprint(state) {
  return JSON.stringify({
    head: state.head,
    index: state.index?.toString('base64'),
    entries: state.entries,
    configs: state.configs
  });
}
function create(cwd = process.cwd()) {
  const root = text(cwd, ['rev-parse', '--show-toplevel']);
  if (optional(root, ['config', '--bool', '--get', 'core.sparseCheckout']) === 'true')
    throw new Error('Sparse checkouts are unsupported');
  const indexPath = text(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']);
  const lock = `${indexPath}.lock`;
  let handle;
  let temp;
  try {
    handle = fs.openSync(lock, 'wx');
    temp = fs.mkdtempSync(path.join(path.dirname(indexPath), 'auto-snapshot-'));
    const state = capture(root, indexPath, temp);
    const second = capture(root, indexPath, temp);
    if (fingerprint(state) !== fingerprint(second))
      throw new Error('Workspace changed during snapshot; retry after edits settle');
    const meta = {
      version: 1,
      head: state.head,
      hasIndex: state.index !== null,
      configs: state.configs,
      objectFormat: text(root, ['rev-parse', '--show-object-format'])
    };
    const tree = text(root, ['mktree'], {
      input: `040000 tree ${state.tree}\tworktree\n040000 tree ${state.indexTree}\tindex\n100644 blob ${blob(root, state.portableIndex)}\tindex-file\n100644 blob ${blob(root, JSON.stringify(meta))}\tmetadata\n`
    });
    const sha = commit(root, tree, state.head, 'Auto CLI non-destructive workspace snapshot\n');
    const ref = `refs/auto-snapshots/${Date.now()}-${crypto.randomUUID()}`;
    git(root, ['update-ref', ref, sha, '0'.repeat(sha.length)]);
    return { ref, sha, files: state.entries.length, root };
  } finally {
    try {
      if (temp) fs.rmSync(temp, { recursive: true, force: true });
    } finally {
      if (handle !== undefined) {
        fs.closeSync(handle);
        fs.unlinkSync(lock);
      }
    }
  }
}
function restore(ref, destination, cwd = process.cwd()) {
  if (!ref || !destination) throw new Error('Usage: snapshot.cjs restore <ref> <new-directory>');
  const root = fs.realpathSync(text(cwd, ['rev-parse', '--show-toplevel']));
  const target = path.resolve(destination);
  const parent = fs.realpathSync(path.dirname(target));
  const resolved = path.join(parent, path.basename(target));
  const relation = path.relative(root, resolved);
  if (
    !relation ||
    (!relation.startsWith(`..${path.sep}`) && relation !== '..' && !path.isAbsolute(relation))
  )
    throw new Error('Recovery target must be outside the source worktree');
  if (fs.existsSync(resolved))
    throw new Error('Recovery target must not exist; use a new directory');
  const sha = text(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
  const meta = JSON.parse(text(root, ['show', `${sha}:metadata`]));
  if (meta.version !== 1 || !['sha1', 'sha256'].includes(meta.objectFormat))
    throw new Error('Unsupported snapshot format');
  const entries = git(root, ['ls-tree', '-r', '-z', `${sha}:worktree`])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const match = /^(100644|100755|120000) blob ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
      if (!match) throw new Error('Unsupported snapshot tree entry');
      return { mode: match[1], sha: match[2], name: safePath(match[3]) };
    });
  const seen = new Set();
  const directories = new Map();
  for (const entry of entries) {
    const key = process.platform === 'win32' ? entry.name.toLowerCase() : entry.name;
    if (seen.has(key)) throw new Error(`Case-colliding snapshot path: ${entry.name}`);
    seen.add(key);
    const parts = entry.name.split('/');
    for (let count = 1; count < parts.length; count++) {
      const directory = parts.slice(0, count).join('/');
      const folded = process.platform === 'win32' ? directory.toLowerCase() : directory;
      if (directories.has(folded) && directories.get(folded) !== directory)
        throw new Error(`Case-colliding snapshot directory: ${directory}`);
      directories.set(folded, directory);
    }
  }
  for (const name of directories.keys())
    if (seen.has(name)) throw new Error(`Snapshot file/directory collision: ${name}`);
  fs.mkdirSync(resolved);
  git(resolved, ['init', '-q', `--object-format=${meta.objectFormat}`]);
  git(resolved, ['fetch', '--no-tags', root, sha]);
  git(resolved, ['update-ref', 'refs/auto-snapshots/recovered', sha]);
  if (meta.head) git(resolved, ['update-ref', 'HEAD', meta.head]);
  for (const [key, value] of Object.entries(meta.configs)) {
    if (
      !['core.autocrlf', 'core.filemode', 'core.symlinks', 'core.ignorecase'].includes(key) ||
      typeof value !== 'string'
    )
      throw new Error('Unsupported snapshot configuration');
    git(resolved, ['config', key, value]);
  }
  // Symlinks are written last, so no subsequent file write follows a restored link.
  for (const entry of entries.sort((a, b) => (a.mode === '120000') - (b.mode === '120000'))) {
    const location = path.join(resolved, entry.name);
    fs.mkdirSync(path.dirname(location), { recursive: true });
    const contents = git(resolved, ['cat-file', 'blob', entry.sha]);
    if (entry.mode === '120000') fs.symlinkSync(contents.toString('utf8'), location);
    else {
      fs.writeFileSync(location, contents, { flag: 'wx' });
      fs.chmodSync(location, entry.mode === '100755' ? 0o755 : 0o644);
    }
  }
  if (meta.hasIndex)
    fs.writeFileSync(
      path.join(resolved, '.git/index'),
      git(resolved, ['show', `${sha}:index-file`]),
      { flag: 'wx' }
    );
  return { restored: resolved, snapshot: sha };
}

if (require.main === module) {
  try {
    const [command, ref, target] = process.argv.slice(2);
    if (!['create', 'restore'].includes(command))
      throw new Error('Usage: snapshot.cjs create | restore <ref> <new-directory>');
    process.stdout.write(JSON.stringify(command === 'create' ? create() : restore(ref, target)));
  } catch (error) {
    process.stderr.write(`[Snapshot] ${error.message}\n`);
    process.exitCode = 1;
  }
}
module.exports = { create, restore };
