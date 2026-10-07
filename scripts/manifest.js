// Installation mappings. Actual ownership lives in each host's install manifest.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ISOLATED_HOME = process.env.AUTO_CLI_INSTALL_HOME;
const CLAUDE_DIR = path.resolve(
  ISOLATED_HOME
    ? path.join(ISOLATED_HOME, '.claude')
    : process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
);
const CODEX_DIR = path.resolve(
  ISOLATED_HOME
    ? path.join(ISOLATED_HOME, '.codex')
    : process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
);
const CODEX_ALLOWED_COMMAND_FILES = ['auto.md'];
const CODEX_ALLOWED_COMMAND_SUBDIR_FILES = {
  auto: ['dashboard.md', 'doctor.md', 'learn.md', 'route.md', 'status.md']
};
const CODEX_MANAGED_ROOT_FILES = ['AGENTS.md'];

export function assertSafeHostRoot(directory) {
  let ancestor = path.resolve(directory);
  while (true) {
    try {
      if (fs.lstatSync(ancestor).isSymbolicLink())
        throw new Error('Host directory cannot traverse a symlink');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
}

export function assertInstallIsolation(tools, isolatedHome = process.env.AUTO_CLI_INSTALL_HOME) {
  for (const tool of tools) assertSafeHostRoot(tool.dir);
  const testing =
    process.env.NODE_TEST_CONTEXT ||
    process.env.AUTO_CLI_TEST_ROOT ||
    process.env.AUTO_CLI_INSTALL_TEST_MODE;
  if (!testing && !isolatedHome) return;
  if (!isolatedHome || !path.isAbsolute(isolatedHome))
    throw new Error('Test installation requires an absolute AUTO_CLI_INSTALL_HOME');
  const root = path.resolve(isolatedHome);
  const marker = path.join(root, '.auto-cli-install-test-root');
  if (
    testing &&
    (!fs.existsSync(marker) ||
      fs.lstatSync(marker).isSymbolicLink() ||
      fs.readFileSync(marker, 'utf8') !== 'auto-cli isolated installation fixture\n')
  ) {
    throw new Error('Test installation root is missing its isolation marker');
  }
  assertSafeHostRoot(root);
  for (const tool of tools) {
    const expected = path.join(root, `.${tool.name}`);
    if (path.resolve(tool.dir) !== expected)
      throw new Error(`Host path is outside installation isolation root: ${tool.name}`);
    const relative = path.relative(root, path.resolve(tool.dir));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error(`Unsafe isolated host path: ${tool.name}`);
  }
}

function sourceDirectories(relative) {
  const directory = path.join(ROOT, relative);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && fs.existsSync(path.join(directory, entry.name, 'SKILL.md'))
    )
    .map((entry) => entry.name)
    .sort();
}

const ALL_SKILL_DIRS = [
  ...sourceDirectories('skills'),
  ...sourceDirectories('skills/community').map((name) => `community-${name}`)
];

export function detectTools() {
  const tools = [
    {
      name: 'claude',
      dir: CLAUDE_DIR,
      commandsDir: path.join(CLAUDE_DIR, 'commands'),
      agentsDir: path.join(CLAUDE_DIR, 'agents'),
      skillsDir: path.join(CLAUDE_DIR, 'skills'),
      rulesDir: path.join(CLAUDE_DIR, 'rules'),
      hooksDir: path.join(CLAUDE_DIR, 'hooks'),
      skillFileName: 'SKILL.md',
      hasAgents: true,
      hasRules: true,
      hasHooks: true
    },
    {
      name: 'codex',
      dir: CODEX_DIR,
      commandsDir: path.join(CODEX_DIR, 'prompts'),
      agentsDir: null,
      skillsDir: path.join(CODEX_DIR, 'skills'),
      rulesDir: null,
      hooksDir: null,
      skillFileName: 'SKILL.md',
      hasAgents: false,
      hasRules: false,
      hasHooks: false
    }
  ];
  assertInstallIsolation(tools);
  return tools.filter((tool) => {
    try {
      const stat = fs.lstatSync(tool.dir);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw new Error(`Invalid host directory: ${tool.name}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  });
}

export const COMPONENTS = ['commands', 'agents', 'skills', 'rules', 'hooks'].map((src) => ({
  src,
  dest: path.join(CLAUDE_DIR, src)
}));

export const CODEX_MANAGED_FILES = {
  rootFiles: CODEX_MANAGED_ROOT_FILES,
  prompts: CODEX_ALLOWED_COMMAND_FILES,
  promptDirs: Object.keys(CODEX_ALLOWED_COMMAND_SUBDIR_FILES),
  skills: ALL_SKILL_DIRS
};

// Compatibility index for readers. A directory name is never proof of ownership.
export const MANAGED_FILES = COMPONENTS.map(({ src, dest }) => {
  const directory = path.join(ROOT, src);
  const entries = fs.existsSync(directory)
    ? fs.readdirSync(directory, { withFileTypes: true })
    : [];
  return {
    dir: dest,
    files: entries
      .filter((entry) => entry.isFile() && !entry.name.endsWith('.codex.md'))
      .map((entry) => entry.name),
    subdirs:
      src === 'skills'
        ? ALL_SKILL_DIRS
        : entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  };
});

export {
  CLAUDE_DIR,
  CODEX_DIR,
  CODEX_ALLOWED_COMMAND_FILES,
  CODEX_ALLOWED_COMMAND_SUBDIR_FILES,
  CODEX_MANAGED_ROOT_FILES
};
