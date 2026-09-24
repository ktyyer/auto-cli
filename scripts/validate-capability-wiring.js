#!/usr/bin/env node

/**
 * Validate the capability-wiring contract.
 *
 * Reconciles hooks/wiring-manifest.json against the real hooks/hooks.json so a
 * documented capability can never silently drift from what is actually wired:
 *
 *   forward  — every manifest entry must match a real hook (declared → wired).
 *              If evidenceIncludes is set, the matched hook's command must
 *              contain that string (guards artifact names like dirty.txt).
 *   backward — every real hook must be claimed by a manifest entry (no orphan
 *              / unregistered hooks). This keeps the manifest itself honest.
 *
 * Core logic is exported as pure functions for unit testing; the CLI wrapper
 * only runs when invoked directly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Flatten a hooks.json object into { event, description, command } records.
export function collectHooks(hooksJson) {
  const root = hooksJson.hooks || hooksJson;
  const out = [];
  for (const [event, arr] of Object.entries(root)) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      const command = (entry.hooks || []).map((h) => h.command || '').join('\n');
      out.push({ event, description: entry.description || '', command });
    }
  }
  return out;
}

// Return an array of human-readable drift failures (empty === contract holds).
export function findWiringDrift(hooks, capabilities) {
  const failures = [];
  const claimed = new Set();

  for (const cap of capabilities) {
    const matches = hooks.filter(
      (h) => h.event === cap.event && h.description.includes(cap.descriptionIncludes)
    );
    if (matches.length === 0) {
      failures.push(
        `declared-but-not-wired: [${cap.event}] "${cap.descriptionIncludes}" (backs: ${cap.backs || '?'}) has no matching hook`
      );
      continue;
    }
    matches.forEach((h) => claimed.add(h));
    if (cap.evidenceIncludes && !matches.some((h) => h.command.includes(cap.evidenceIncludes))) {
      failures.push(
        `evidence-missing: [${cap.event}] "${cap.descriptionIncludes}" wired but command lacks ${JSON.stringify(cap.evidenceIncludes)}`
      );
    }
  }

  for (const h of hooks) {
    if (!claimed.has(h)) {
      failures.push(
        `orphan-hook: [${h.event}] "${h.description || '(no description)'}" is wired but not registered in wiring-manifest.json`
      );
    }
  }

  return failures;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const hooksPath = path.join(root, 'hooks', 'hooks.json');
  const manifestPath = path.join(root, 'hooks', 'wiring-manifest.json');

  for (const [p, label] of [
    [hooksPath, 'hooks.json'],
    [manifestPath, 'wiring-manifest.json'],
  ]) {
    if (!fs.existsSync(p)) {
      console.error(`FAIL: ${label} not found at ${path.relative(root, p)}`);
      process.exit(1);
    }
  }

  const hooks = collectHooks(JSON.parse(fs.readFileSync(hooksPath, 'utf8')));
  const capabilities = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).capabilities || [];
  const failures = findWiringDrift(hooks, capabilities);

  console.log('Capability-wiring validation');
  console.log('='.repeat(50));
  console.log(`hooks in hooks.json:     ${hooks.length}`);
  console.log(`capabilities declared:   ${capabilities.length}`);

  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} wiring drift issue(s)`);
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log('PASS: manifest and hooks.json are consistent (both directions)');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
