#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { detectTools } from './manifest.js';
import { SOURCE_ROOT } from './install-plan.js';
import { prepareUninstall, applyPlans } from './managed-install.js';

try {
  if (!fs.existsSync(path.join(SOURCE_ROOT, 'commands/auto.md')))
    throw new Error('Uninstall requires the complete Auto CLI source package');
  const plans = detectTools().map(prepareUninstall);
  const count = applyPlans(plans);
  console.log(`Uninstalled: ${count} changes; personal files, backups and configuration preserved`);
  for (const plan of plans) {
    if (plan.retained.length)
      console.log(
        `${plan.tool.name}: retained ${plan.retained.length} modified or unverified files; see auto-cli/install-manifest.json`
      );
  }
} catch (error) {
  console.error(`Uninstall failed: ${error.message}`);
  process.exitCode = 1;
}
