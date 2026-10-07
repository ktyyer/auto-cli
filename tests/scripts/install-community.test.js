import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const installScript = path.join(repoRoot, 'scripts', 'install.js');

test('install copies community skill with community- prefix and references', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-install-community-'));
  fs.writeFileSync(
    path.join(tempHome, '.auto-cli-install-test-root'),
    'auto-cli isolated installation fixture\n'
  );
  const claudeRoot = path.join(tempHome, '.claude');
  fs.mkdirSync(claudeRoot, { recursive: true });

  const result = spawnSync(process.execPath, [installScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      AUTO_CLI_INSTALL_HOME: tempHome,
      AUTO_CLI_INSTALL_TEST_MODE: '1',
      HOME: tempHome,
      USERPROFILE: tempHome,
      CODEX_HOME: path.join(tempHome, '.codex'),
      CLAUDE_CONFIG_DIR: path.join(tempHome, '.claude')
    }
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);

  const skillPath = path.join(claudeRoot, 'skills', 'community-hello-auto', 'SKILL.md');
  assert.ok(fs.existsSync(skillPath), `missing ${skillPath}\n${result.stdout}`);

  const refPath = path.join(
    claudeRoot,
    'skills',
    'community-hello-auto',
    'references',
    'install-name.md'
  );
  assert.ok(fs.existsSync(refPath), `missing references ${refPath}`);

  // Must not install unprefixed name that could shadow a core skill
  assert.equal(fs.existsSync(path.join(claudeRoot, 'skills', 'hello-auto')), false);

  // Claude Code 只加载目录形态，扁平 <name>.md 不得再产出
  assert.equal(fs.existsSync(path.join(claudeRoot, 'skills', 'community-hello-auto.md')), false);
});

test('dual-host uninstall removes installed resources and preserves personal configuration', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-reinstall-'));
  const isolationMarker = path.join(tempHome, '.auto-cli-install-test-root');
  fs.writeFileSync(isolationMarker, 'auto-cli isolated installation fixture\n');
  const listFiles = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const location = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(location) : [location];
    });
  const run = (script) => {
    const result = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', script)], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        AUTO_CLI_INSTALL_TEST_MODE: '1',
        AUTO_CLI_INSTALL_HOME: tempHome,
        HOME: tempHome,
        USERPROFILE: tempHome,
        CODEX_HOME: path.join(tempHome, '.codex'),
        CLAUDE_CONFIG_DIR: path.join(tempHome, '.claude')
      }
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  const personal = [isolationMarker];
  for (const host of ['.claude', '.codex']) {
    const file = path.join(tempHome, host, 'skills', 'personal', 'SKILL.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'personal skill\n');
    personal.push(file);
  }
  const settingsPath = path.join(tempHome, '.claude', 'settings.json');
  const settings = {
    theme: 'dark',
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo personal' }] }] }
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
  personal.push(settingsPath);
  run('install.js');
  const installed = new Map(
    listFiles(tempHome)
      .filter((file) => !personal.includes(file))
      .map((file) => [file, fs.readFileSync(file)])
  );
  assert.ok(installed.size > 0);
  run('uninstall.js');
  assert.deepEqual(
    listFiles(tempHome).sort(),
    personal.sort(),
    'only personal files should remain'
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), settings);
  run('install.js');
  for (const [file, contents] of installed) assert.deepEqual(fs.readFileSync(file), contents);
  for (const file of personal.filter((file) => file !== settingsPath && file !== isolationMarker))
    assert.equal(fs.readFileSync(file, 'utf8'), 'personal skill\n');
});
