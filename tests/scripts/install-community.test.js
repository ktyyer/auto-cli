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
  const claudeRoot = path.join(tempHome, '.claude');
  fs.mkdirSync(claudeRoot, { recursive: true });

  const result = spawnSync(process.execPath, [installScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome
    }
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);

  const skillPath = path.join(claudeRoot, 'skills', 'community-hello-auto.md');
  assert.ok(fs.existsSync(skillPath), `missing ${skillPath}\n${result.stdout}`);

  const refPath = path.join(
    claudeRoot,
    'skills',
    'community-hello-auto.references',
    'install-name.md'
  );
  assert.ok(fs.existsSync(refPath), `missing references ${refPath}`);

  // Must not install unprefixed name that could shadow a core skill
  assert.equal(fs.existsSync(path.join(claudeRoot, 'skills', 'hello-auto.md')), false);
});
