#!/usr/bin/env node
// Generate metrics.json for a run based on available data

import fs from 'fs';
import path from 'path';
import { collectRunMetrics } from './run-protocol.js';

function generateMetrics(runId) {
  const runDir = path.join('.auto', 'runs', runId);

  if (!fs.existsSync(runDir)) {
    console.error(`Run directory not found: ${runDir}`);
    process.exit(1);
  }

  const metrics = collectRunMetrics(runDir);

  // Write metrics file with error handling
  const metricsFile = path.join(runDir, 'metrics.json');
  const tempFile = `${metricsFile}.tmp.${Date.now()}`;

  try {
    fs.writeFileSync(tempFile, JSON.stringify(metrics, null, 2));
    fs.renameSync(tempFile, metricsFile); // Atomic operation
  } catch (e) {
    // Clean up temp file if it exists
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    console.error(`❌ Failed to write metrics: ${e.message}`);
    console.error('   Possible causes: disk full, permission denied');
    process.exit(1);
  }

  const displayPath = metricsFile.replace(/\\/g, '/');
  console.log(`Metrics generated: ${displayPath}`);
  console.log(`Strategy: ${metrics.strategy}`);
  const display = (value) => value ?? 'unknown';
  console.log(
    `Quests: ${display(metrics.quests.completed)}/${display(metrics.quests.total)} completed`
  );
  const rate =
    metrics.gates.passRate === null ? 'unknown' : `${(metrics.gates.passRate * 100).toFixed(1)}%`;
  console.log(
    `Gates: ${display(metrics.gates.passed)}/${display(metrics.gates.total)} passed (${rate})`
  );
  console.log(`Skills: ${display(metrics.skills.count)} activated`);
  if (metrics.protocolIssues.length) {
    console.error(metrics.protocolIssues.join('\n'));
    process.exitCode = 1;
  }
}

// CLI
const runId = process.argv[2];
if (!runId) {
  // Find latest run
  const runsDir = path.join('.auto', 'runs');
  if (!fs.existsSync(runsDir)) {
    console.error('No runs directory found');
    process.exit(1);
  }

  // 不限定 run- 前缀：真实 run 目录名多为 <YYYYMMDD>-<desc>，写死前缀会让本分支永不生效
  const runs = fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => e.name)
    .sort()
    .reverse();

  if (runs.length === 0) {
    console.error('No runs found');
    process.exit(1);
  }

  generateMetrics(runs[0]);
} else {
  generateMetrics(runId);
}
