import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODEX_ALLOWED_COMMAND_FILES, CODEX_ALLOWED_COMMAND_SUBDIR_FILES } from './manifest.js';

export const SOURCE_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const RECEIPT = 'auto-cli/install-manifest.json';
export const BLOCK_START = '<!-- auto-cli:managed:start -->';
export const BLOCK_END = '<!-- auto-cli:managed:end -->';
export const CODEX_GLOBAL_BRIDGE = 'scripts/templates/codex-global-bridge.md';

export function listSourceFiles(root, prefix = '') {
  const directory = path.join(root, prefix);
  if (!fs.existsSync(directory)) return [];
  if (fs.lstatSync(directory).isSymbolicLink())
    throw new Error(`Source symlinks are not supported: ${prefix || '.'}`);
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Source symlinks are not supported: ${relative}`);
      if (entry.isDirectory()) return listSourceFiles(root, relative);
      return entry.isFile() ? [relative] : [];
    });
}

export function buildInstallFiles(tool) {
  const files = new Map();
  const add = (source, destination = source) => {
    const contents = fs.readFileSync(path.join(SOURCE_ROOT, source));
    files.set(destination, { source, contents });
  };
  const commands = listSourceFiles(SOURCE_ROOT, 'commands').filter((file) => file.endsWith('.md'));
  for (const source of commands) {
    const relative = source.slice('commands/'.length);
    const target = relative.replace(/\.codex\.md$/, '.md');
    if (tool.name === 'claude' && relative.endsWith('.codex.md')) continue;
    if (tool.name === 'codex') {
      const directory = path.posix.dirname(target);
      const allowed =
        directory === '.'
          ? CODEX_ALLOWED_COMMAND_FILES
          : CODEX_ALLOWED_COMMAND_SUBDIR_FILES[directory] || [];
      if (!allowed.includes(path.posix.basename(target))) continue;
      if (
        !relative.endsWith('.codex.md') &&
        commands.includes(source.replace(/\.md$/, '.codex.md'))
      )
        continue;
    }
    add(source, `${tool.name === 'codex' ? 'prompts' : 'commands'}/${target}`);
  }
  for (const source of listSourceFiles(SOURCE_ROOT, 'skills')) {
    const parts = source.split('/');
    const community = parts[1] === 'community';
    const name = community ? `community-${parts[2]}` : parts[1];
    const skillRoot = community ? `skills/community/${parts[2]}` : `skills/${name}`;
    if (!fs.existsSync(path.join(SOURCE_ROOT, skillRoot, 'SKILL.md'))) continue;
    const relative = source.slice(skillRoot.length + 1);
    if (relative !== 'SKILL.md' && !relative.startsWith('references/')) continue;
    add(source, `skills/${name}/${relative}`);
  }
  if (tool.name === 'claude') {
    for (const directory of ['agents', 'rules', 'hooks']) {
      for (const source of listSourceFiles(SOURCE_ROOT, directory)) add(source);
    }
  }
  for (const directory of ['scripts', 'hooks/lib']) {
    for (const source of listSourceFiles(SOURCE_ROOT, directory)) add(source, `auto-cli/${source}`);
  }
  add('package.json', 'auto-cli/package.json');
  if (tool.name === 'codex') add(CODEX_GLOBAL_BRIDGE, 'AGENTS.md');
  return files;
}

export function parseSettings(contents, label = 'settings.json') {
  if (contents === null) return {};
  let value;
  try {
    value = JSON.parse(contents.toString('utf8'));
  } catch {
    throw new Error(`${label}: invalid JSON (no files changed)`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label}: expected an object`);
  if (value.hooks !== undefined) {
    if (!value.hooks || typeof value.hooks !== 'object' || Array.isArray(value.hooks))
      throw new Error(`${label}: hooks must be an object`);
    for (const entries of Object.values(value.hooks)) {
      if (
        !Array.isArray(entries) ||
        entries.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))
      ) {
        throw new Error(`${label}: hook events must contain arrays of objects`);
      }
    }
  }
  return value;
}

export function updateHooks(settings, sourceHooks = {}) {
  const hooks = {};
  for (const [event, entries] of Object.entries(settings.hooks || {})) {
    const userEntries = entries.filter((entry) => entry._source !== 'auto-cli');
    if (userEntries.length) hooks[event] = userEntries;
  }
  for (const [event, entries] of Object.entries(sourceHooks)) {
    hooks[event] = [
      ...(hooks[event] || []),
      ...entries.map((entry) => ({ ...entry, _source: 'auto-cli' }))
    ];
  }
  if (Object.keys(hooks).length) settings.hooks = hooks;
  else delete settings.hooks;
  return Buffer.from(`${JSON.stringify(settings, null, 2)}\n`);
}

export function managedBlock(contents) {
  const text = contents?.toString('utf8') || '';
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END);
  if (start === -1 && end === -1) return null;
  if (
    start < 0 ||
    end < start ||
    text.indexOf(BLOCK_START, start + 1) !== -1 ||
    text.indexOf(BLOCK_END, end + 1) !== -1
  ) {
    throw new Error('AGENTS.md: malformed auto-cli managed block');
  }
  return { start, end: end + BLOCK_END.length, text: text.slice(start, end + BLOCK_END.length) };
}

export function unmanagedBridgeDiagnostics(contents, bridgeContents) {
  const text = contents.toString('utf8');
  const block = managedBlock(contents);
  const ranges = block
    ? [
        [0, block.start],
        [block.end, text.length]
      ]
    : [[0, text.length]];
  const bridgeLines = new Set(
    bridgeContents.toString('utf8').trim().split(/\r?\n/).filter(Boolean)
  );
  return ranges.flatMap(([start, end]) => {
    const section = text.slice(start, end);
    const headings = [...section.matchAll(/^# Auto CLI For Codex[ \t]*\r?$/gm)];
    return headings.map((heading) => {
      const following = section.slice(heading.index + heading[0].length);
      const nextHeading = following.search(/^# /m);
      const sectionEnd =
        nextHeading === -1 ? section.length : heading.index + heading[0].length + nextHeading;
      const legacy = section.slice(heading.index, sectionEnd).trimEnd();
      const legacyLines = new Set(legacy.split(/\r?\n/).filter(Boolean));
      const startLine = text.slice(0, start + heading.index).split('\n').length;
      return {
        code: 'unmanaged-auto-bridge',
        path: 'AGENTS.md',
        startLine,
        endLine: startLine + legacy.split('\n').length - 1,
        unmanagedOnlyLines: [...legacyLines].filter((line) => !bridgeLines.has(line)).length,
        bridgeOnlyLines: [...bridgeLines].filter((line) => !legacyLines.has(line)).length
      };
    });
  });
}
