#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { detectTools } from './manifest.js';
import { SOURCE_ROOT } from './install-plan.js';
import { prepareInstall, applyPlans } from './managed-install.js';

try {
  if (!fs.existsSync(path.join(SOURCE_ROOT, 'commands/auto.md')))
    throw new Error('Install requires the complete Auto CLI source package');
  const tools = detectTools();
  if (!tools.length) throw new Error('No Claude Code or Codex configuration directory detected');
  // --clean reconciles only unchanged owned files; user extras and backups stay intact.
  const plans = tools.map(prepareInstall);
  const count = applyPlans(plans);
  console.log(`Installed: ${tools.map((tool) => tool.name).join(' + ')}; ${count} changes`);
  console.log(
    'Ownership/version: <host>/auto-cli/install-manifest.json; originals: <host>/auto-cli/backups/'
  );
} catch (error) {
  console.error(`Install failed: ${error.message}`);
  process.exitCode = 1;
}
