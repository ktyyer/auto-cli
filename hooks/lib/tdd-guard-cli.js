#!/usr/bin/env node
/**
 * TDD Guard CLI wrapper for Claude Code hooks
 *
 * Usage: node hooks/lib/tdd-guard-cli.js <file-path>
 * Exit 0 = pass, Exit 1 = blocked (no test file found)
 */
import { checkTDD } from './tdd-guard.js';

const filePath = process.argv[2];

if (!filePath) {
  process.exit(0);
}

try {
  const result = await checkTDD(filePath);
  if (result && result.hasTestFile === false) {
    console.error(`[TDD Guard] BLOCKED: No corresponding test file for ${filePath}`);
    console.error(`[TDD Guard] Expected test paths checked: ${result.checkedPaths?.join(', ') || 'N/A'}`);
    console.error('');
    console.error('[TDD Guard] TDD workflow:');
    console.error('[TDD Guard] 1. Write the test first (RED)');
    console.error('[TDD Guard] 2. Write minimal code to pass (GREEN)');
    console.error('[TDD Guard] 3. Refactor (REFACTOR)');
    process.exit(1);
  }
} catch {
  // If guard fails, allow through (fail-open)
}

process.exit(0);
