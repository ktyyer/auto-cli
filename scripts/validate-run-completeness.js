#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RUNS_DIR = path.join(ROOT, '.auto', 'runs');
const REQUIRED_FILES = [
  'route-decision.md',
  'quest-map.md',
  'quest-results.md',
  'verify-report.md',
  'index.md'
];
const REQUIRED_CONTENT = {
  'route-decision.md': ['strategy', 'complexity', 'verify'],
  'quest-map.md': ['plan'],
  'quest-results.md': ['execution', 'findings'],
  'verify-report.md': ['command', 'verify'],
  'index.md': ['strategy', 'verification']
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    runId: null,
    latest: false,
    json: false,
    allowMissing: false
  };

  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (value === '--latest') {
      parsed.latest = true;
      continue;
    }
    if (value === '--json') {
      parsed.json = true;
      continue;
    }
    if (value === '--allow-missing') {
      parsed.allowMissing = true;
      continue;
    }
    if (value === '--run' && args[index + 1]) {
      parsed.runId = args[index + 1];
      index++;
    }
  }

  return parsed;
}

function listRuns() {
  if (!fs.existsSync(RUNS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(RUNS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const runPath = path.join(RUNS_DIR, entry.name);
      const stats = fs.statSync(runPath);
      return {
        name: entry.name,
        mtimeMs: stats.mtimeMs
      };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .map((entry) => entry.name);
}

function resolveRunId({ runId, latest }) {
  if (runId) return runId;

  const runs = listRuns();
  if (runs.length === 0) return null;

  if (latest || !runId) {
    return runs[runs.length - 1];
  }

  return null;
}

function validateRun(runId) {
  if (!runId) {
    return {
      ok: false,
      runId: null,
      runPath: RUNS_DIR,
      missingFiles: [],
      presentFiles: [],
      message: '未找到任何 run 目录'
    };
  }

  const runPath = path.join(RUNS_DIR, runId);
  if (!fs.existsSync(runPath)) {
    return {
      ok: false,
      runId,
      runPath,
      missingFiles: REQUIRED_FILES,
      presentFiles: [],
      message: `run 不存在: ${runId}`
    };
  }

  const presentFiles = [];
  const missingFiles = [];
  const invalidFiles = [];

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(runPath, file);
    if (fs.existsSync(filePath)) {
      presentFiles.push(file);
      const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
      const requiredTokens = REQUIRED_CONTENT[file] || [];
      const missingTokens = requiredTokens.filter((token) => !content.includes(token));
      if (missingTokens.length > 0) {
        invalidFiles.push({ file, missingTokens });
      }
    } else {
      missingFiles.push(file);
    }
  }

  return {
    ok: missingFiles.length === 0 && invalidFiles.length === 0,
    runId,
    runPath,
    missingFiles,
    presentFiles,
    invalidFiles,
    message:
      missingFiles.length === 0 && invalidFiles.length === 0
        ? 'run 闭环完整'
        : [
            missingFiles.length > 0
              ? `run 缺少基础工件: ${missingFiles.join(', ')}`
              : null,
            invalidFiles.length > 0
              ? `run 工件缺少最小内容: ${invalidFiles
                  .map(({ file, missingTokens }) => `${file} -> ${missingTokens.join('/')}`)
                  .join(', ')}`
              : null
          ]
            .filter(Boolean)
            .join('；')
  };
}

function printHuman(result) {
  console.log('Run 完整性校验');
  console.log('='.repeat(50));
  console.log(`runId: ${result.runId ?? '(none)'}`);
  console.log(`path: ${path.relative(ROOT, result.runPath)}`);
  console.log(`result: ${result.ok ? 'PASS' : 'FAIL'}`);
  console.log(`message: ${result.message}`);

  console.log('');
  console.log('必需工件:');
  for (const file of REQUIRED_FILES) {
    const hasFile = result.presentFiles.includes(file);
    const invalidEntry = (result.invalidFiles || []).find((entry) => entry.file === file);
    const status = !hasFile ? 'FAIL' : invalidEntry ? 'PARTIAL' : 'PASS';
    console.log(`- ${file}: ${status}`);
    if (invalidEntry) {
      console.log(`  missing content: ${invalidEntry.missingTokens.join(', ')}`);
    }
  }

  if (!result.ok) {
    console.log('');
    console.log('建议:');
    console.log('- 补写缺失的 route / plan / verify / index 工件');
    console.log('- 若这是 /auto 运行结果，检查主流程是否跳过了可见闭环输出');
    console.log('- 确认工件正文含最小语义：route/plan/execution/verify，而不是只创建空文件');
  }
}

function main() {
  const options = parseArgs(process.argv);
  const runId = resolveRunId(options);
  const result = validateRun(runId);
  const shouldAllowMissing = options.allowMissing && result.runId === null;

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
    if (shouldAllowMissing) {
      console.log('');
      console.log('allow-missing: PASS');
      console.log('message: 当前仓库没有本地 run 工件，跳过 run 完整性门禁');
    }
  }

  process.exit(result.ok || shouldAllowMissing ? 0 : 1);
}

main();
