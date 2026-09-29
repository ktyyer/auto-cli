#!/usr/bin/env node
// Dashboard: Aggregate execution metrics from recent runs

import fs from 'fs';
import path from 'path';
import { collectRunMetrics } from './run-protocol.js';

function generateDashboard(limit = 10) {
  const runsDir = path.join('.auto', 'runs');
  if (!fs.existsSync(runsDir)) {
    console.log('No runs directory found. Run `/auto` first to generate data.');
    return;
  }

  // 不限定 run- 前缀：历史 run 目录名多为 <YYYYMMDD>-<desc>，写死前缀会让 dashboard 永远无数据
  const runs = fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => e.name)
    .sort()
    .reverse()
    .slice(0, limit);

  if (runs.length === 0) {
    console.log('No runs found. Run `/auto` first to generate data.');
    return;
  }

  console.log('# Auto Dashboard - Execution Trends\n');
  console.log(`**Period**: Last ${runs.length} runs`);
  console.log(`**Total Runs**: ${runs.length}\n`);

  // Collect metrics
  const allMetrics = runs
    .map((runId) => {
      const runDir = path.join(runsDir, runId);
      return collectRunMetrics(runDir);
    })
    .filter((m) => m !== null);

  if (allMetrics.length === 0) {
    console.log('No metrics data available. Generate metrics with:\n');
    console.log('  node scripts/generate-metrics.js\n');
    return;
  }

  // 1. Strategy Distribution
  console.log('## Strategy Distribution\n');
  const strategyCount = {};
  const strategySuccess = {};
  allMetrics.forEach((m) => {
    strategyCount[m.strategy] = (strategyCount[m.strategy] || 0) + 1;
    if (['pass', 'pass-with-warnings'].includes(m.status)) {
      strategySuccess[m.strategy] = (strategySuccess[m.strategy] || 0) + 1;
    }
  });

  console.log('| Strategy | Count | Reported Pass Rate | Avg Quests |');
  console.log('|----------|-------|--------------|------------|');
  Object.keys(strategyCount)
    .sort()
    .forEach((strategy) => {
      const count = strategyCount[strategy];
      const success = strategySuccess[strategy] || 0;
      const group = allMetrics.filter((m) => m.strategy === strategy);
      const knownStatus = group.filter((m) =>
        ['pass', 'pass-with-warnings', 'fail'].includes(m.status)
      );
      const successRate = knownStatus.length
        ? `${((success / knownStatus.length) * 100).toFixed(0)}% (${knownStatus.length} observed)`
        : 'unknown';
      const knownQuests = group.filter((m) => Number.isFinite(m.quests.total));
      const avgQuests = knownQuests.length
        ? (knownQuests.reduce((sum, m) => sum + m.quests.total, 0) / knownQuests.length).toFixed(1)
        : 'unknown';
      console.log(`| ${strategy} | ${count} | ${successRate} | ${avgQuests} |`);
    });
  console.log('');

  // 2. Quality Gates Pass Rate
  console.log('## Quality Gates Pass Rate\n');
  const gateStats = {};
  allMetrics.forEach((m) => {
    if (m.gates.total > 0) {
      if (!gateStats.total) gateStats.total = { passed: 0, total: 0 };
      gateStats.total.passed += m.gates.passed;
      gateStats.total.total += m.gates.total;
    }
  });

  if (gateStats.total) {
    const passRate = ((gateStats.total.passed / gateStats.total.total) * 100).toFixed(1);
    console.log(
      `**Overall Pass Rate**: ${gateStats.total.passed}/${gateStats.total.total} (${passRate}%)\n`
    );
  } else {
    console.log('**Overall Pass Rate**: unknown (no observed gates)\n');
  }

  // 3. Skill Activation Frequency
  console.log('## Skill Activation Frequency\n');
  const skillCount = Object.create(null);
  allMetrics.forEach((m) => {
    (m.skills.activated || []).forEach((skill) => {
      skillCount[skill] = (skillCount[skill] || 0) + 1;
    });
  });

  const topSkills = Object.entries(skillCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('| Rank | Skill | Activations |');
  console.log('|------|-------|-------------|');
  topSkills.forEach(([skill, count], i) => {
    console.log(`| ${i + 1} | ${skill} | ${count} |`);
  });
  console.log('');

  // 4. Status Summary
  console.log('## Execution Summary\n');
  const statusCount = {};
  allMetrics.forEach((m) => {
    statusCount[m.status] = (statusCount[m.status] || 0) + 1;
  });

  console.log('| Status | Count |');
  console.log('|--------|-------|');
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`| ${status} | ${count} |`);
  });
  console.log('');

  // 5. Recommendations
  console.log('## Recommendations\n');
  const avgPassRate = gateStats.total ? gateStats.total.passed / gateStats.total.total : null;

  if (avgPassRate !== null && avgPassRate < 0.9) {
    console.log(
      `- ⚠️ Gate pass rate (${(avgPassRate * 100).toFixed(1)}%) below 90% - review non-passing gates`
    );
  }

  console.log(
    '- Unknown observations are excluded from rates and averages; skill counts describe declared activation, not measured benefit.'
  );
  console.log(
    '- Strategy pass rates use explicit pass/pass-with-warnings/fail reports; other statuses appear in the execution summary.'
  );

  if (strategyCount.explore && strategyCount.explore > allMetrics.length * 0.7) {
    console.log('- 🔍 High proportion of explore strategy - consider more implementation tasks');
  }

  console.log('');
  console.log('---');
  console.log('Generated by `/auto:dashboard`');
  console.log(
    `Data source: .auto/runs/ (${allMetrics.length} runs; current protocol artifacts, unknowns preserved)`
  );
}

// CLI
const limit = parseInt(process.argv[2]) || 10;
generateDashboard(limit);
