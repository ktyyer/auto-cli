#!/usr/bin/env node
// Generate metrics.json for a run based on available data

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateMetrics(runId) {
  const runDir = path.join('.auto', 'runs', runId);

  if (!fs.existsSync(runDir)) {
    console.error(`Run directory not found: ${runDir}`);
    process.exit(1);
  }

  const metrics = {
    runId,
    timestamp: new Date().toISOString(),
    strategy: 'unknown',
    status: 'completed',
    duration: {
      total: 0,
      phases: {}
    },
    quests: {
      total: 0,
      completed: 0,
      failed: 0
    },
    gates: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 0
    },
    skills: {
      activated: [],
      count: 0
    },
    agents: {
      primary: 'unknown',
      invoked: [],
      count: 0
    },
    files: {
      read: 0,
      written: 0,
      modified: 0
    }
  };

  // Parse route-decision.md
  const routeFile = path.join(runDir, 'route-decision.md');
  if (fs.existsSync(routeFile)) {
    const content = fs.readFileSync(routeFile, 'utf8');
    const strategyMatch = content.match(/"strategy":\s*"([^"]+)"/);
    if (strategyMatch) metrics.strategy = strategyMatch[1];

    const timestampMatch = content.match(/"timestamp":\s*"([^"]+)"/);
    if (timestampMatch) metrics.timestamp = timestampMatch[1];

    const agentMatch = content.match(/"primaryAgent":\s*"([^"]+)"/);
    if (agentMatch) {
      metrics.agents.primary = agentMatch[1];
      metrics.agents.invoked.push(agentMatch[1]);
      metrics.agents.count = 1;
    }

    const skillsMatch = content.match(/"selectedSkills":\s*\[(.*?)\]/s);
    if (skillsMatch) {
      const skills = skillsMatch[1].match(/"([^"]+)"/g);
      if (skills) {
        metrics.skills.activated = skills.map(s => s.replace(/"/g, ''));
        metrics.skills.count = metrics.skills.activated.length;
      }
    }
  }

  // Parse quest-map.md
  const questMapFile = path.join(runDir, 'quest-map.md');
  if (fs.existsSync(questMapFile)) {
    const content = fs.readFileSync(questMapFile, 'utf8');
    const questMatches = content.match(/"questId":/g);
    if (questMatches) {
      metrics.quests.total = questMatches.length;
    }
  }

  // Parse quest-results.md
  const questResultsFile = path.join(runDir, 'quest-results.md');
  if (fs.existsSync(questResultsFile)) {
    const content = fs.readFileSync(questResultsFile, 'utf8');
    const completedMatches = content.match(/"status":\s*"completed"/g);
    const failedMatches = content.match(/"status":\s*"failed"/g);
    if (completedMatches) metrics.quests.completed = completedMatches.length;
    if (failedMatches) metrics.quests.failed = failedMatches.length;
  }

  // Parse verify-report.md
  const verifyFile = path.join(runDir, 'verify-report.md');
  if (fs.existsSync(verifyFile)) {
    const content = fs.readFileSync(verifyFile, 'utf8');
    const gateMatches = content.match(/"gateId":/g);
    if (gateMatches) metrics.gates.total = gateMatches.length;

    const passedMatches = content.match(/"status":\s*"pass"/g);
    const failedMatches = content.match(/"status":\s*"fail"/g);
    const skippedMatches = content.match(/"status":\s*"skipped"/g);

    if (passedMatches) metrics.gates.passed = passedMatches.length;
    if (failedMatches) metrics.gates.failed = failedMatches.length;
    if (skippedMatches) metrics.gates.skipped = skippedMatches.length;

    if (metrics.gates.total > 0) {
      metrics.gates.passRate = metrics.gates.passed / metrics.gates.total;
    }
  }

  // Parse index.md for file counts
  const indexFile = path.join(runDir, 'index.md');
  if (fs.existsSync(indexFile)) {
    const content = fs.readFileSync(indexFile, 'utf8');
    const filesWritten = content.match(/写入文件|Written files|Write/gi);
    const filesRead = content.match(/读取文件|Read files|Read/gi);
    const filesModified = content.match(/修改文件|Modified files|Edit/gi);

    if (filesWritten) metrics.files.written = filesWritten.length;
    if (filesRead) metrics.files.read = filesRead.length;
    if (filesModified) metrics.files.modified = filesModified.length;
  }

  // Write metrics file
  const metricsFile = path.join(runDir, 'metrics.json');
  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));

  console.log(`Metrics generated: ${metricsFile}`);
  console.log(`Strategy: ${metrics.strategy}`);
  console.log(`Quests: ${metrics.quests.completed}/${metrics.quests.total} completed`);
  console.log(`Gates: ${metrics.gates.passed}/${metrics.gates.total} passed (${(metrics.gates.passRate * 100).toFixed(1)}%)`);
  console.log(`Skills: ${metrics.skills.count} activated`);
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

  const runs = fs.readdirSync(runsDir)
    .filter(f => f.startsWith('run-') && !f.includes('archive'))
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
