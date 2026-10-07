import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalHome = os.homedir;
const originalCodexHome = process.env.CODEX_HOME;
const originalClaudeRoot = process.env.CLAUDE_CONFIG_DIR;
const originalIsolatedHome = process.env.AUTO_CLI_INSTALL_HOME;

async function importManifestWithHome(homePath) {
  fs.writeFileSync(
    path.join(homePath, '.auto-cli-install-test-root'),
    'auto-cli isolated installation fixture\n'
  );
  os.homedir = () => homePath;
  process.env.AUTO_CLI_INSTALL_HOME = homePath;
  process.env.CODEX_HOME = path.join(homePath, '.codex');
  process.env.CLAUDE_CONFIG_DIR = path.join(homePath, '.claude');
  const moduleUrl = new URL(
    `../../scripts/manifest.js?home=${encodeURIComponent(homePath)}&t=${Date.now()}`,
    import.meta.url
  );
  return import(moduleUrl);
}

test.afterEach(() => {
  os.homedir = originalHome;
  if (originalIsolatedHome === undefined) delete process.env.AUTO_CLI_INSTALL_HOME;
  else process.env.AUTO_CLI_INSTALL_HOME = originalIsolatedHome;
  if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = originalCodexHome;
  if (originalClaudeRoot === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = originalClaudeRoot;
});

test('detectTools returns empty list when no tool directories exist', async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-manifest-empty-'));
  const manifest = await importManifestWithHome(tempHome);

  assert.deepEqual(manifest.detectTools(), []);
});

test('detectTools returns claude and codex tool descriptors when directories exist', async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-manifest-tools-'));
  fs.mkdirSync(path.join(tempHome, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(tempHome, '.codex'), { recursive: true });

  const manifest = await importManifestWithHome(tempHome);
  const tools = manifest.detectTools();

  assert.equal(tools.length, 2);
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['claude', 'codex']
  );
  assert.equal(tools[0].commandsDir, path.join(tempHome, '.claude', 'commands'));
  assert.equal(tools[1].commandsDir, path.join(tempHome, '.codex', 'prompts'));
  assert.equal(tools[1].skillFileName, 'SKILL.md');
});

test('managed file lists expose expected core entries', async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-manifest-managed-'));
  const manifest = await importManifestWithHome(tempHome);

  assert.ok(manifest.CODEX_MANAGED_FILES.prompts.includes('auto.md'));
  assert.ok(manifest.CODEX_MANAGED_FILES.skills.includes('loop-engineering'));
  assert.ok(manifest.CODEX_MANAGED_FILES.skills.includes('world-class-code-standards'));
  // install 会装 community-hello-auto；卸载清单必须同名，否则 Codex 侧泄漏
  assert.ok(manifest.CODEX_MANAGED_FILES.skills.includes('community-hello-auto'));
  assert.ok(
    manifest.MANAGED_FILES.some(
      (entry) =>
        entry.dir === path.join(tempHome, '.claude', 'commands') && entry.files.includes('auto.md')
    )
  );
});

test('test isolation rejects inherited host paths outside its marked root', async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-manifest-boundary-'));
  const manifest = await importManifestWithHome(tempHome);
  assert.throws(
    () =>
      manifest.assertInstallIsolation(
        [{ name: 'codex', dir: path.join(os.tmpdir(), 'outside-codex') }],
        tempHome
      ),
    /outside installation isolation root/
  );
  fs.unlinkSync(path.join(tempHome, '.auto-cli-install-test-root'));
  assert.throws(
    () => manifest.assertInstallIsolation([], tempHome),
    /missing its isolation marker/
  );
  fs.rmdirSync(tempHome);
});

test('host roots reject a junction in an ancestor even outside test isolation checks', async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-manifest-junction-'));
  const manifest = await importManifestWithHome(tempHome);
  const target = path.join(tempHome, 'target');
  fs.mkdirSync(target);
  const link = path.join(tempHome, 'link');
  fs.symlinkSync(target, link, 'junction');
  assert.throws(
    () => manifest.assertSafeHostRoot(path.join(link, '.codex')),
    /cannot traverse a symlink/
  );
  fs.unlinkSync(link);
  fs.rmSync(tempHome, { recursive: true, force: true });
});
