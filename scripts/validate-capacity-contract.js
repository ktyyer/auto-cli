#!/usr/bin/env node

/**
 * Validate the capacity/scalability review contract.
 *
 * Static by design: it protects the evaluation protocol itself without
 * pretending to benchmark an arbitrary application repository.
 *
 * What it actually checks is structural, not a list of literal phrases:
 *   1. each contract file contains the required <!-- capacity-contract: ROLE -->
 *      anchors (assumption = the PLAN-time scale hypothesis, probe = the
 *      VERIFY-time scale attack);
 *   2. the text of every anchored section carries the shared requirement set
 *      (a scale-up counterexample, the unbounded-query failure mode, and the
 *      not-applicable escape hatch).
 *
 * The requirement set lives in ONE place. Rewording a document only fails the
 * check when it drops a requirement, and a document that keeps the old phrases
 * but loses the anchor fails too — so a green light means the contract is
 * present, not merely that some Chinese substrings survived an edit.
 *
 * Core logic is exported as pure functions for unit testing; the CLI wrapper
 * only runs when invoked directly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// role -> how many anchored sections a file must contain.
export const CONTRACT_FILES = [
  { file: 'commands/auto.md', anchors: { assumption: 1, probe: 1 } },
  { file: 'commands/auto.codex.md', anchors: { assumption: 1, probe: 1 } },
  { file: 'skills/quality-gates/SKILL.md', anchors: { probe: 1 } },
  { file: 'agents/verification.md', anchors: { assumption: 1, probe: 1 } }
];

// The single source of truth for what a capacity section must say.
// Each requirement is one idea expressed as alternatives, so the two command
// files may phrase it differently without either maintaining its own list.
export const REQUIREMENTS = [
  { id: 'scale-counterexample', anyOf: ['数据量 ×100', '数据量×100'] },
  { id: 'unbounded-query', anyOf: ['无界查询'] },
  { id: 'not-applicable-escape', anyOf: ['capacity: not-applicable', 'capacity:not-applicable'] }
];

const ANCHOR_RE = /<!--\s*capacity-contract:\s*([a-z-]+)\s*-->/g;
const SECTION_BREAK_RE = /(?:^|\n)[ \t]*(?:#{1,6} |> )/;

// Split a document into the text governed by each capacity-contract anchor:
// from the anchor to the next same-or-higher heading. Returns { role: text[] }.
export function extractAnchoredSections(content) {
  const sections = {};
  for (const match of content.matchAll(ANCHOR_RE)) {
    const start = match.index + match[0].length;
    const rest = content.slice(start);
    const breakAt = rest.search(SECTION_BREAK_RE);
    const text = breakAt === -1 ? rest : rest.slice(0, breakAt);
    (sections[match[1]] ??= []).push(text);
  }
  return sections;
}

// Return human-readable contract failures for one file (empty === holds).
export function findContractDrift(content, spec) {
  const failures = [];
  const sections = extractAnchoredSections(content);

  for (const [role, expected] of Object.entries(spec.anchors)) {
    const found = sections[role]?.length ?? 0;
    if (found !== expected) {
      failures.push(
        `${spec.file}: expected ${expected} "${role}" anchor(s), found ${found}`
      );
    }
  }

  for (const [role, texts] of Object.entries(sections)) {
    if (!(role in spec.anchors)) {
      failures.push(`${spec.file}: unexpected capacity-contract role "${role}"`);
    }
    for (const text of texts) {
      for (const requirement of REQUIREMENTS) {
        if (!requirement.anyOf.some((alt) => text.includes(alt))) {
          failures.push(
            `${spec.file}: "${role}" section missing requirement "${requirement.id}" (need one of ${requirement.anyOf.map((a) => JSON.stringify(a)).join(' / ')})`
          );
        }
      }
    }
  }

  return failures;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const failures = [];
  let filesChecked = 0;

  for (const spec of CONTRACT_FILES) {
    const absolute = path.join(root, spec.file);
    if (!fs.existsSync(absolute)) {
      failures.push(`${spec.file}: file is missing`);
      continue;
    }
    filesChecked += 1;
    failures.push(
      ...findContractDrift(fs.readFileSync(absolute, 'utf8'), spec)
    );
  }

  const anchorCount = CONTRACT_FILES.reduce(
    (total, spec) => total + Object.values(spec.anchors).reduce((a, b) => a + b, 0),
    0
  );

  console.log('Capacity contract validation');
  console.log('='.repeat(50));
  console.log(`files checked:    ${filesChecked}`);
  console.log(`anchors expected: ${anchorCount}`);
  console.log(`requirements:     ${REQUIREMENTS.map((r) => r.id).join(', ')}`);

  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} capacity contract issue(s)`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('PASS: capacity/scalability review contract is structurally present');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
