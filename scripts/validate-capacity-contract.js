#!/usr/bin/env node

/**
 * Validate the capacity/scalability review contract.
 *
 * This is intentionally static: it protects the evaluation protocol itself
 * without pretending to benchmark an arbitrary application repository.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CONTRACTS = [
  {
    file: 'commands/auto.md',
    required: [
      '容量假设（强制）',
      '数据量 ×100',
      'capacity: not-applicable',
      '无界查询',
      '容量/伸缩性探针',
      '容量探针发现无界查询'
    ]
  },
  {
    file: 'commands/auto.codex.md',
    required: [
      '容量假设（强制）',
      '数据量 ×100',
      'capacity: not-applicable',
      '无界查询',
      '容量伸缩性'
    ]
  },
  {
    file: 'skills/quality-gates/SKILL.md',
    required: [
      '容量/伸缩性',
      '数据量 ×100',
      '无界查询',
      '全量加载/累积集合',
      'capacity: not-applicable',
      '"scenario": "capacity-scale"'
    ]
  },
  {
    file: 'agents/verification.md',
    required: [
      '容量/伸缩性假设',
      '数据量 ×100',
      '容量/伸缩性',
      'capacity: not-applicable'
    ]
  }
];

const failures = [];
for (const contract of CONTRACTS) {
  const absolute = path.join(ROOT, contract.file);
  if (!fs.existsSync(absolute)) {
    failures.push(`${contract.file}: file is missing`);
    continue;
  }

  const content = fs.readFileSync(absolute, 'utf8');
  for (const marker of contract.required) {
    if (!content.includes(marker)) {
      failures.push(`${contract.file}: missing marker ${JSON.stringify(marker)}`);
    }
  }
}

console.log('Capacity contract validation');
console.log('='.repeat(50));
console.log(`files checked: ${CONTRACTS.length}`);
console.log(`markers checked: ${CONTRACTS.reduce((total, item) => total + item.required.length, 0)}`);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} missing capacity contract marker(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: capacity/scalability review contract is present');
