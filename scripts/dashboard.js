#!/usr/bin/env node
// Dashboard: Aggregate execution metrics from recent runs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadMetrics(runDir) {
  const metricsFile = path.join(runDir, 'metrics.json');
  if (!fs.existsSync(metricsFile)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
  } catch (e) {
    return null;
  }
}

function parseRunManually(runDir) {
  // Fallback: parse from protocol files if metrics.json doesn't exist
  const metrics = {
    runId: path.basename(runDir),
    strategy: 'unknown',
    status: 'unknown',
    quests: { total: 0, completed: 0, failed: 0 },
    gates: { total: 0, passed: 0, failed: 0, passRate: 0 },
    skills: { activated: [], count: 0 }
  };

  // Parse route-decision.md
  const routeFile = path.join(runDir, 'route-decision.md');
  if (fs.existsSync(routeFile)) {
    const content = fs.readFileSync(routeFile, 'utf8');
    const strategyMatch = content.match(/"strategy":\s*"([^"]+)"/);
    if (strategyMatch) metrics.strategy = strategyMatch[1];

    const skillsMatch = content.match(/"selectedSkills":\s*\[(.*?)\]/s);
    if (skillsMatch) {
      const skills = skillsMatch[1].match(/"([^"]+)"/g);
      if (skills) {
        metrics.skills.activated = skills.map(s => s.replace(/"/g, ''));
        metrics.skills.count = metrics.skills.activated.length;
      }
    }
  }

  // Parse verify-report.md
  const verifyFile = path.join(runDir, 'verify-report.md');
  if (fs.existsSync(verifyFile)) {
    const content = fs.readFileSync(verifyFile, 'utf8');
    const gateMatches = content.match(/"gateId":/g);
    if (gateMatches) metrics.gates.total = gateMatches.length;

    const passedMatches = content.match(/"status":\s*"pass"/g);
    const failedMatches = content.match(/"status":\s*"fail"/g);

    if (passedMatches) metrics.gates.passed = passedMatches.length;
    if (failedMatches) metrics.gates.failed = failedMatches.length;

    if (metrics.gates.total > 0) {
      metrics.gates.passRate = metrics.gates.passed / metrics.gates.total;
    }
  }

  // Parse quest-results.md
  const questResultsFile = path.join(runDir, 'quest-results.md');
  if (fs.existsSync(questResultsFile)) {
    const content = fs.readFileSync(questResultsFile, 'utf8');
    const questMatches = content.match(/"questId":/g);
    if (questMatches) metrics.quests.total = questMatches.length;

    const completedMatches = content.match(/"status":\s*"completed"/g);
    const failedMatches = content.match(/"status":\s*"failed"/g);

    if (completedMatches) metrics.quests.completed = completedMatches.length;
    if (failedMatches) metrics.quests.failed = failedMatches.length;
  }

  // Parse index.md for status
  const indexFile = path.join(runDir, 'index.md');
  if (fs.existsSync(indexFile)) {
    const content = fs.readFileSync(indexFile, 'utf8');
    if (content.includes('status: completed') || content.includes('COMPLETED')) {
      metrics.status = 'completed';
    } else if (content.includes('status: failed') || content.includes('FAILED')) {
      metrics.status = 'failed';
    } else if (content.includes('status: partial') || content.includes('PARTIAL')) {
      metrics.status = 'partial';
    }
  }

  return metrics;
}

function generateDashboard(limit = 10) {
  const runsDir = path.join('.auto', 'runs');
  if (!fs.existsSync(runsDir)) {
    console.log('No runs directory found. Run `/auto` first to generate data.');
    return;
  }

  const runs = fs.readdirSync(runsDir)
    .filter(f => f.startsWith('run-') && fs.statSync(path.join(runsDir, f)).isDirectory())
    .filter(f => !f.includes('archive'))
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
  const allMetrics = runs.map(runId => {
    const runDir = path.join(runsDir, runId);
    return loadMetrics(runDir) || parseRunManually(runDir);
  }).filter(m => m !== null);

  if (allMetrics.length === 0) {
    console.log('No metrics data available. Generate metrics with:\n');
    console.log('  node scripts/generate-metrics.js\n');
    return;
  }

  // 1. Strategy Distribution
  console.log('## Strategy Distribution\n');
  const strategyCount = {};
  const strategySuccess = {};
  allMetrics.forEach(m => {
    strategyCount[m.strategy] = (strategyCount[m.strategy] || 0) + 1;
    if (m.status === 'completed') {
      strategySuccess[m.strategy] = (strategySuccess[m.strategy] || 0) + 1;
    }
  });

  console.log('| Strategy | Count | Success Rate | Avg Quests |');
  console.log('|----------|-------|--------------|------------|');
  Object.keys(strategyCount).sort().forEach(strategy => {
    const count = strategyCount[strategy];
    const success = strategySuccess[strategy] || 0;
    const successRate = ((success / count) * 100).toFixed(0);
    const avgQuests = (allMetrics
      .filter(m => m.strategy === strategy)
      .reduce((sum, m) => sum + m.quests.total, 0) / count).toFixed(1);
    console.log(`| ${strategy} | ${count} | ${successRate}% | ${avgQuests} |`);
  });
  console.log('');

  // 2. Quality Gates Pass Rate
  console.log('## Quality Gates Pass Rate\n');
  const gateStats = {};
  allMetrics.forEach(m => {
    if (m.gates.total > 0) {
      if (!gateStats.total) gateStats.total = { passed: 0, total: 0 };
      gateStats.total.passed += m.gates.passed;
      gateStats.total.total += m.gates.total;
    }
  });

  if (gateStats.total) {
    const passRate = ((gateStats.total.passed / gateStats.total.total) * 100).toFixed(1);
    console.log(`**Overall Pass Rate**: ${gateStats.total.passed}/${gateStats.total.total} (${passRate}%)\n`);
  }

  // 3. Skill Activation Frequency
  console.log('## Skill Activation Frequency\n');
  const skillCount = {};
  allMetrics.forEach(m => {
    m.skills.activated.forEach(skill => {
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
  allMetrics.forEach(m => {
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
  const avgPassRate = gateStats.total ?
    (gateStats.total.passed / gateStats.total.total) : 1;

  if (avgPassRate < 0.9) {
    console.log(`- ⚠️ Gate pass rate (${(avgPassRate * 100).toFixed(1)}%) below 90% - review failing gates`);
  }

  const neverActivated = 39 - Object.keys(skillCount).length;
  if (neverActivated > 10) {
    console.log(`- 📊 ${neverActivated} skills never activated - consider reviewing trigger conditions`);
  }

  if (strategyCount.explore && strategyCount.explore > allMetrics.length * 0.7) {
    console.log('- 🔍 High proportion of explore strategy - consider more implementation tasks');
  }

  console.log('');
  console.log('---');
  console.log('Generated by `/auto:dashboard`');
  console.log(`Data source: .auto/runs/ (${allMetrics.length} runs with metrics)`);
}

// CLI
const limit = parseInt(process.argv[2]) || 10;
generateDashboard(limit);
