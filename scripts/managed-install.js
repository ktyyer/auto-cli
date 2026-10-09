import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { assertInstallIsolation, assertSafeHostRoot, CODEX_MANAGED_FILES } from './manifest.js';
import {
  BLOCK_START,
  BLOCK_END,
  RECEIPT,
  SOURCE_ROOT,
  buildInstallFiles,
  managedBlock,
  unmanagedBridgeDiagnostics,
  parseSettings,
  updateHooks
} from './install-plan.js';

export const hash = (value) => createHash('sha256').update(value).digest('hex');

function safePath(root, relative) {
  assertSafeHostRoot(root);
  if (
    !relative ||
    /[\\:\0]/.test(relative) ||
    path.posix.isAbsolute(relative) ||
    path.win32.isAbsolute(relative) ||
    relative.split('/').some((part) => !part || part === '..' || part === '.')
  ) {
    throw new Error(`Unsafe managed path: ${relative}`);
  }
  const target = path.resolve(root, relative);
  const boundary = path.relative(path.resolve(root), target);
  if (!boundary || boundary.startsWith('..') || path.isAbsolute(boundary))
    throw new Error(`Path escapes host: ${relative}`);
  let current = path.resolve(root);
  for (const part of ['', ...relative.split('/')]) {
    if (part) current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink())
        throw new Error(`Refusing symlink path: ${relative}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return target;
}

function readFile(root, relative) {
  const target = safePath(root, relative);
  try {
    if (!fs.lstatSync(target).isFile()) throw new Error(`Expected a regular file: ${relative}`);
    return fs.readFileSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function readReceipt(tool) {
  const bytes = readFile(tool.dir, RECEIPT);
  if (bytes === null) return null;
  let receipt;
  try {
    receipt = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${tool.name}: invalid install manifest JSON`);
  }
  if (
    receipt.schemaVersion !== 1 ||
    receipt.package !== 'auto-cli' ||
    !Array.isArray(receipt.files) ||
    receipt.host !== tool.name
  )
    throw new Error(`${tool.name}: invalid install manifest schema`);
  const seen = new Set();
  for (const entry of receipt.files) {
    if (
      !entry ||
      typeof entry.path !== 'string' ||
      !/^[a-f0-9]{64}$/.test(entry.sha256 || '') ||
      seen.has(entry.path)
    )
      throw new Error(`${tool.name}: invalid managed file entry`);
    const namespace = isManagedNamespace(tool, entry);
    if (!namespace) throw new Error(`${tool.name}: invalid managed file namespace`);
    if (namespace === 'preserve') entry.unverified = true;
    readFile(tool.dir, entry.path);
    seen.add(entry.path);
    if (entry.backup) {
      if (
        typeof entry.backup !== 'string' ||
        !entry.backup.startsWith('auto-cli/backups/') ||
        !/^[a-f0-9]{64}$/.test(entry.backupSha256 || '')
      )
        throw new Error(`${tool.name}: invalid backup entry`);
      const backup = readFile(tool.dir, entry.backup);
      if (backup === null || hash(backup) !== entry.backupSha256)
        throw new Error(`${tool.name}: missing or modified backup: ${entry.backup}`);
    }
    if (
      entry.kind === 'block' &&
      (typeof entry.blockText !== 'string' || typeof entry.removeText !== 'string')
    )
      throw new Error(`${tool.name}: invalid managed block entry`);
    if (entry.kind === 'block') {
      const block = managedBlock(Buffer.from(entry.blockText));
      if (
        !block ||
        block.start !== 0 ||
        block.end !== entry.blockText.length ||
        ![`${entry.blockText}\n`, `\n\n${entry.blockText}\n`].includes(entry.removeText)
      )
        throw new Error(`${tool.name}: invalid managed block boundaries`);
    }
  }
  return receipt;
}

function isManagedNamespace(tool, entry) {
  const file = entry.path;
  if (file === 'AGENTS.md') return tool.name === 'codex' && entry.kind === 'block' && !entry.backup;
  if (entry.kind !== undefined && entry.kind !== 'file') return false;
  if (/^auto-cli\/(?:scripts\/.+|hooks\/lib\/.+|package\.json)$/.test(file)) return true;
  if (/^skills\/[a-z0-9-]+\/(?:SKILL\.md|references\/.+)$/.test(file)) {
    const [, name, ...suffix] = file.split('/');
    const expectedSource = name.startsWith('community-')
      ? `skills/community/${name.slice('community-'.length)}/${suffix.join('/')}`
      : file;
    if (entry.source !== expectedSource) return false;
    return CODEX_MANAGED_FILES.skills.includes(name) ? true : 'preserve';
  }
  const commandDirectory = tool.name === 'codex' ? 'prompts' : 'commands';
  if (
    new RegExp(`^${commandDirectory}/(?:auto(?:\\.[a-z]+)?\\.md|auto/[a-z0-9-]+\\.md)$`).test(file)
  )
    return true;
  return (
    tool.name === 'claude' &&
    /^(?:(?:agents|rules)\/[a-z0-9_-]+\.md|hooks\/(?:hooks\.json|wiring-manifest\.json|package\.json|lib\/.+))$/.test(
      file
    )
  );
}

function planFor(tool) {
  return { tool, operations: new Map(), expected: new Map(), retained: [], diagnostics: [] };
}

function setFile(plan, relative, contents) {
  // Preflight includes absent destinations so a later host cannot fail after the first was changed.
  const previous = readFile(plan.tool.dir, relative);
  if (contents === null && previous === null) return;
  if (contents !== null && previous !== null && contents.equals(previous)) return;
  plan.operations.set(relative, contents);
  plan.expected.set(relative, previous);
}

function backupFile(plan, relative, contents) {
  const backup = `auto-cli/backups/${hash(relative).slice(0, 16)}-${hash(contents)}.backup`;
  const existing = readFile(plan.tool.dir, backup);
  if (existing && !existing.equals(contents)) throw new Error(`Backup collision: ${backup}`);
  setFile(plan, backup, contents);
  const metadata = backupMetadata(relative, backup, hash(contents));
  const existingMetadata = readFile(plan.tool.dir, `${backup}.json`);
  if (existingMetadata && !existingMetadata.equals(metadata))
    throw new Error(`Backup metadata was modified: ${backup}.json`);
  setFile(plan, `${backup}.json`, metadata);
  return { backup, backupSha256: hash(contents) };
}

function backupMetadata(relative, backup, sha256) {
  return Buffer.from(`${JSON.stringify({ originalPath: relative, backup, sha256 }, null, 2)}\n`);
}

function removeOwned(plan, entry) {
  if (entry.unverified) {
    plan.retained.push(entry);
    return;
  }
  const current = readFile(plan.tool.dir, entry.path);
  if (entry.kind === 'block' && current) {
    const block = managedBlock(current);
    if (block && block.text !== entry.blockText) {
      plan.retained.push(entry);
      return;
    }
    if (block) {
      const text = current.toString('utf8');
      const remaining = text.includes(entry.removeText)
        ? text.replace(entry.removeText, '')
        : text.replace(block.text, '');
      setFile(plan, entry.path, remaining || entry.preserveEmpty ? Buffer.from(remaining) : null);
    }
    return;
  }
  if (current && hash(current) !== entry.sha256) {
    plan.retained.push(entry);
    return;
  }
  if (entry.backup) {
    setFile(plan, entry.path, readFile(plan.tool.dir, entry.backup));
    setFile(plan, entry.backup, null);
    const metadata = readFile(plan.tool.dir, `${entry.backup}.json`);
    if (metadata?.equals(backupMetadata(entry.path, entry.backup, entry.backupSha256)))
      setFile(plan, `${entry.backup}.json`, null);
  } else setFile(plan, entry.path, null);
}

function settingsOperation(plan, installing) {
  if (plan.tool.name !== 'claude') return;
  const current = readFile(plan.tool.dir, 'settings.json');
  const settings = parseSettings(current);
  if (
    !installing &&
    !Object.values(settings.hooks || {}).some((entries) =>
      entries.some((entry) => entry._source === 'auto-cli')
    )
  )
    return;
  const source = installing
    ? parseSettings(fs.readFileSync(path.join(SOURCE_ROOT, 'hooks/hooks.json')), 'hooks/hooks.json')
        .hooks
    : {};
  setFile(plan, 'settings.json', updateHooks(settings, source));
}

function blockEntry(plan, file, previous) {
  const current = readFile(plan.tool.dir, 'AGENTS.md');
  const block = managedBlock(current);
  const text = current?.toString('utf8') || '';
  const blockText = `${BLOCK_START}\n${file.contents.toString('utf8').trimEnd()}\n${BLOCK_END}`;
  let contents;
  let removeText;
  let preserveEmpty = previous?.preserveEmpty ?? current !== null;
  if (block) {
    if (!previous || block.text !== previous.blockText)
      throw new Error(
        'AGENTS.md: unowned or edited auto-cli block; preserve it before reinstalling'
      );
    contents = Buffer.from(text.slice(0, block.start) + blockText + text.slice(block.end));
    removeText = previous.removeText.replace(previous.blockText, blockText);
  } else {
    // An exact source match proves the legacy whole-file bridge belongs to this package.
    const legacy = current && current.equals(file.contents);
    const prefix = legacy ? '' : text;
    preserveEmpty = legacy ? false : preserveEmpty;
    removeText = `${prefix ? '\n\n' : ''}${blockText}\n`;
    contents = Buffer.from(prefix + removeText);
  }
  plan.diagnostics.push(...unmanagedBridgeDiagnostics(contents, file.contents));
  setFile(plan, 'AGENTS.md', contents);
  return {
    path: 'AGENTS.md',
    kind: 'block',
    sha256: hash(contents),
    source: file.source,
    sourceSha256: hash(file.contents),
    blockText,
    removeText,
    preserveEmpty
  };
}

function legacyCandidates(files) {
  const candidates = new Map(files);
  for (const [relative, file] of files) {
    if (!relative.startsWith('skills/')) continue;
    const [, name, ...rest] = relative.split('/');
    if (rest.join('/') === 'SKILL.md') candidates.set(`skills/${name}.md`, file);
    if (rest[0] === 'references')
      candidates.set(`skills/${name}.references/${rest.slice(1).join('/')}`, file);
  }
  return candidates;
}

export function prepareInstall(tool) {
  assertInstallIsolation([tool], tool.isolationRoot || process.env.AUTO_CLI_INSTALL_HOME);
  const plan = planFor(tool);
  plan.installing = true;
  const receipt = readReceipt(tool);
  settingsOperation(plan, true);
  const previous = new Map((receipt?.files || []).map((entry) => [entry.path, entry]));
  const files = buildInstallFiles(tool);
  const entries = [];
  for (const [relative, file] of files) {
    const prior = previous.get(relative);
    if (relative === 'AGENTS.md') {
      entries.push(blockEntry(plan, file, prior));
      continue;
    }
    const current = readFile(tool.dir, relative);
    const entry = { path: relative, sha256: hash(file.contents) };
    if (file.source)
      Object.assign(entry, { source: file.source, sourceSha256: hash(file.contents) });
    if (prior?.backup)
      Object.assign(entry, { backup: prior.backup, backupSha256: prior.backupSha256 });
    if (
      current &&
      hash(current) !== entry.sha256 &&
      (!prior || prior.unverified || hash(current) !== prior.sha256)
    ) {
      const saved = backupFile(plan, relative, current);
      if (!entry.backup) Object.assign(entry, saved);
    }
    setFile(plan, relative, file.contents);
    entries.push(entry);
  }
  for (const entry of previous.values()) if (!files.has(entry.path)) removeOwned(plan, entry);
  for (const [relative, file] of legacyCandidates(files)) {
    if (files.has(relative) || previous.has(relative)) continue;
    const current = readFile(tool.dir, relative);
    if (current && current.equals(file.contents)) setFile(plan, relative, null);
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, 'package.json'), 'utf8'));
  const manifest = {
    schemaVersion: 1,
    package: 'auto-cli',
    packageVersion: packageJson.version,
    host: tool.name,
    runtimeRoot: 'auto-cli',
    capabilities: {
      skills: 'directory',
      hooks: tool.hasHooks,
      agents: tool.hasAgents,
      runtime: 'node-esm',
      scripts: [...files.keys()].filter((file) => file.startsWith('auto-cli/scripts/'))
    },
    files: [...entries, ...plan.retained].sort((a, b) => a.path.localeCompare(b.path))
  };
  setFile(plan, RECEIPT, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  return plan;
}

export function prepareUninstall(tool) {
  assertInstallIsolation([tool], tool.isolationRoot || process.env.AUTO_CLI_INSTALL_HOME);
  const plan = planFor(tool);
  const receipt = readReceipt(tool);
  settingsOperation(plan, false);
  if (receipt) {
    for (const entry of receipt.files) removeOwned(plan, entry);
    setFile(
      plan,
      RECEIPT,
      plan.retained.length
        ? Buffer.from(`${JSON.stringify({ ...receipt, files: plan.retained }, null, 2)}\n`)
        : null
    );
  } else {
    // Legacy resources require an exact content match; a familiar name alone is not ownership.
    for (const [relative, file] of legacyCandidates(buildInstallFiles(tool))) {
      const current = readFile(tool.dir, relative);
      if (current && current.equals(file.contents)) setFile(plan, relative, null);
    }
  }
  return plan;
}

function pruneEmpty(root, directory) {
  while (
    directory !== root &&
    path.relative(root, directory) &&
    !path.relative(root, directory).startsWith('..')
  ) {
    try {
      fs.rmdirSync(directory);
    } catch (error) {
      if (['ENOTEMPTY', 'ENOENT', 'EEXIST'].includes(error.code)) return;
      throw error;
    }
    directory = path.dirname(directory);
  }
}

function atomicWrite(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.auto-cli-${randomUUID()}.tmp`;
  try {
    const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : 0o600;
    fs.writeFileSync(temporary, contents, { flag: 'wx', mode });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function applyPlans(plans) {
  for (const plan of plans)
    assertInstallIsolation(
      [plan.tool],
      plan.tool.isolationRoot || process.env.AUTO_CLI_INSTALL_HOME
    );
  const applied = [];
  try {
    for (const plan of plans) {
      const operations = [...plan.operations];
      if (plan.installing) {
        const priority = (file) => (file === RECEIPT ? 2 : file === 'settings.json' ? 1 : 0);
        operations.sort(([a], [b]) => priority(a) - priority(b));
      }
      for (const [relative, contents] of operations) {
        const target = safePath(plan.tool.dir, relative);
        const previous = readFile(plan.tool.dir, relative);
        const expected = plan.expected.get(relative);
        if (
          (expected === null) !== (previous === null) ||
          (expected && !expected.equals(previous))
        ) {
          throw new Error(`File changed during installation preflight: ${relative}`);
        }
        applied.push({ root: plan.tool.dir, target, relative, previous, written: contents });
        if (contents === null) fs.unlinkSync(target);
        else atomicWrite(target, contents);
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const { root, target, relative, previous, written } of applied.reverse()) {
      try {
        const current = readFile(root, relative);
        const isWritten =
          (current === null && written === null) || (current && written && current.equals(written));
        const isOriginal =
          (current === null && previous === null) ||
          (current && previous && current.equals(previous));
        if (isOriginal) continue;
        if (!isWritten) {
          rollbackErrors.push(`concurrent edit preserved: ${relative}`);
          continue;
        }
        if (previous === null) fs.unlinkSync(target);
        else atomicWrite(target, previous);
      } catch {
        rollbackErrors.push(`restore failed: ${relative}`);
      }
    }
    if (rollbackErrors.length)
      throw new Error(`${error.message}; rollback incomplete: ${rollbackErrors.join(', ')}`);
    throw error;
  }
  for (const { root, target } of applied) pruneEmpty(root, path.dirname(target));
  return applied.length;
}
