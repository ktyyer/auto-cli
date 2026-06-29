import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function importInsightIndexModule(cwdPath) {
  const previousCwd = process.cwd();
  process.chdir(cwdPath);
  try {
    return await import(new URL(`../../scripts/rebuild-insight-index.js?cwd=${encodeURIComponent(cwdPath)}&t=${Date.now()}`, import.meta.url));
  } finally {
    process.chdir(previousCwd);
  }
}

test('rebuild-insight-index indexes tags and keywords from insight sections', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-insight-index-'));
  const insightsDir = path.join(tempRoot, '.auto', 'insights');
  fs.mkdirSync(insightsDir, { recursive: true });
  fs.writeFileSync(
    path.join(insightsDir, 'patterns.md'),
    `# Patterns\n\n### Stable cache refresh\n\n**标签**: cache, refresh\n**置信度**: high\n\nKeep cache warm.\n\n### Retry fallback\n\n**标签**: retry\n\nUse fallback path.\n`,
    'utf8'
  );

  await importInsightIndexModule(tempRoot);

  const outputPath = path.join(tempRoot, '.auto', 'cache', 'insight-index.json');
  assert.equal(fs.existsSync(outputPath), true);
  const index = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.ok(index.by_tag.cache.some((entry) => entry.section === 'Stable cache refresh'));
  assert.ok(index.by_tag.retry.some((entry) => entry.section === 'Retry fallback'));
  assert.ok(index.by_keyword.stable.some((entry) => entry.file === 'patterns.md'));
  assert.ok(index.by_keyword.refresh.some((entry) => entry.section === 'Stable cache refresh'));
});
