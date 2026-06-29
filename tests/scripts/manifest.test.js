import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalHome = os.homedir;

async function importManifestWithHome(homePath) {
  os.homedir = () => homePath;
  const moduleUrl = new URL(`../../scripts/manifest.js?home=${encodeURIComponent(homePath)}&t=${Date.now()}`, import.meta.url);
  return import(moduleUrl);
}

test.afterEach(() => {
  os.homedir = originalHome;
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
  assert.ok(
    manifest.MANAGED_FILES.some(
      (entry) => entry.dir === path.join(tempHome, '.claude', 'commands') && entry.files.includes('auto.md')
    )
  );
});
