import fs from 'node:fs';
import path from 'node:path';

export function protocolRun(runId) {
  const common = { runId, correlationId: `corr-${runId}`, status: 'completed', summary: 'fixture' };
  return {
    'route-decision.md': {
      ...common,
      id: 'route',
      userIntent: 'fix metrics',
      strategy: 'fix',
      primaryAgent: 'codex',
      skills: ['protocol-validator', 'spec-driven'],
      next: 'plan'
    },
    'quest-map.md': {
      ...common,
      id: 'plan',
      routeDecisionId: 'route',
      goal: 'accurate metrics',
      executionMode: 'serial',
      quests: [
        { questId: 'Q1', objective: 'fix', ownerAgent: 'codex', acceptance: ['counts match'] }
      ]
    },
    'quest-results.md': [
      { ...common, id: 'result', questId: 'Q1', attempt: 1, ownerAgent: 'codex', changedFiles: [] }
    ],
    'verify-report.md': {
      ...common,
      id: 'verify',
      gateResults: [
        { name: 'test', status: 'pass' },
        { name: 'review', status: 'warning', evidence: { status: 'pass' } }
      ],
      overallStatus: 'pass-with-warnings',
      nextAction: 'learn'
    },
    'learn-cards.md': [
      {
        ...common,
        id: 'learn',
        category: 'pattern',
        title: 'accuracy',
        confidence: 'high',
        targetInsightFile: '.auto/insights/patterns.md',
        scope: 'project'
      }
    ]
  };
}

export function writeProtocolRun(root, runId, documents = protocolRun(runId)) {
  const dir = path.join(root, '.auto', 'runs', runId);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, value] of Object.entries(documents)) {
    fs.writeFileSync(
      path.join(dir, file),
      `# ${file}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`
    );
  }
  fs.writeFileSync(path.join(dir, 'index.md'), '# Run\nRead Write Edit are words, not telemetry.');
  return dir;
}
