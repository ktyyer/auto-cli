#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RUNS_DIR = path.join(ROOT, '.auto', 'runs');
const INSIGHTS_DIR = path.join(ROOT, '.auto', 'insights');
const FEEDBACK_DIR = path.join(ROOT, '.auto', 'feedback');
const REQUIRED_FILES = [
  'route-decision.md',
  'quest-map.md',
  'quest-results.md',
  'verify-report.md',
  'learn-cards.md',
  'index.md'
];
const REQUIRED_CONTENT = {
  'route-decision.md': ['strategy', 'complexity', 'verify'],
  'quest-map.md': ['plan'],
  'quest-results.md': ['execution', 'findings'],
  'verify-report.md': ['command', 'verify'],
  'learn-cards.md': ['summary', 'recommendedaction', 'confidence'],
  'index.md': ['strategy', 'verification']
};
const KNOWLEDGE_EVIDENCE_PATTERNS = [
  /\[insight:[^\]]+\]/i,
  /\[feedback:skills\.json#[^\]]+\]/i,
  /\[feedback:agents\.json#[^\]]+\]/i,
  /\[run:run-[^\]]+\]/i
];
const KNOWLEDGE_EVIDENCE_REGEX = /\[(insight|feedback:(?:skills|agents)\.json|run):([^\]]+)\]/gi;
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'when',
  'where',
  'what',
  'how',
  'why',
  'then',
  'than',
  'have',
  'has',
  'had',
  'will',
  'would',
  'could',
  'should',
  'must',
  'need',
  'use',
  'used',
  'using',
  'pass',
  'verify',
  'route',
  'plan',
  'auto',
  'run',
  'gate',
  '知识',
  '继续',
  '当前',
  '本次',
  '优化',
  '协议',
  '校验',
  '验证',
  '引用',
  '证据',
  '相关',
  '存在',
  '真实'
]);

function parseMarkdownHeadings(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^#{2,3}\s+/.test(line))
    .map((line) => normalizeMarkdownLabel(line.replace(/^#{2,3}\s+/, '').trim()));
}

function extractKnowledgeMarkers(content) {
  const markers = [];
  let match;

  while ((match = KNOWLEDGE_EVIDENCE_REGEX.exec(content)) !== null) {
    markers.push({
      raw: match[0],
      kind: match[1],
      target: match[2]
    });
  }

  return markers;
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[`*_#:[\]().,;!?'"|/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMarkdownLabel(value) {
  return (value || '')
    .trim()
    .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1')
    .replace(/\s+/g, ' ');
}

function extractKeywords(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  const asciiWords = normalized.match(/[a-z0-9]{4,}/g) || [];
  const chinesePhrases = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const merged = [...asciiWords, ...chinesePhrases];

  return [...new Set(merged.filter((word) => !STOP_WORDS.has(word)))];
}

function inferRunGoal(runId) {
  const indexPath = path.join(RUNS_DIR, runId, 'index.md');
  if (!fs.existsSync(indexPath)) {
    return '';
  }

  const content = fs.readFileSync(indexPath, 'utf-8');
  const match = content.match(/^\s*-\s*goal:\s*(.+)$/im);
  return match ? match[1].trim() : '';
}

function getInsightHeading(marker) {
  const [, heading] = marker.target.split('#');
  return heading ? normalizeMarkdownLabel(heading) : '';
}

function getMarkerRelevanceText(marker) {
  if (marker.kind === 'insight') {
    return getInsightHeading(marker);
  }

  if (marker.kind === 'run') {
    return inferRunGoal(marker.target.trim());
  }

  return '';
}

function hasRelevantKnowledgeReference(taskContext, markers) {
  const taskKeywords = extractKeywords(taskContext);
  if (taskKeywords.length === 0) {
    return false;
  }

  return markers.some((marker) => {
    if (marker.kind !== 'insight' && marker.kind !== 'run') {
      return false;
    }

    const relevanceText = getMarkerRelevanceText(marker);
    if (!relevanceText) {
      return false;
    }

    const relevanceKeywords = extractKeywords(relevanceText);
    return relevanceKeywords.some((keyword) => taskKeywords.includes(keyword));
  });
}

function extractCommandResult(content, commandText) {
  const escapedCommand = commandText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `- command:\\s*\`${escapedCommand}\`[\\s\\S]{0,160}?- result:\\s*([^\\r\\n]+)`,
    'i'
  );
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function extractGateStatus(content, gateName) {
  const escapedGate = gateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`- \`${escapedGate}\`:\\s*([^\\r\\n]+)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim().toLowerCase() : null;
}

function validateVerifyConsistency(verifyReportContent, runId) {
  const issues = [];
  const checkResult = extractCommandResult(verifyReportContent, 'npm run check');
  const runValidationResult = extractCommandResult(
    verifyReportContent,
    `node scripts/validate-run-completeness.js --run ${runId}`
  );
  const lintStatus = extractGateStatus(verifyReportContent, 'lint');
  const regressionStatus = extractGateStatus(verifyReportContent, 'regression');
  const runCompletenessStatus = extractGateStatus(verifyReportContent, 'run-completeness');

  if (checkResult && /pass/i.test(checkResult)) {
    if (lintStatus === 'pending') {
      issues.push('verify-report.md marks `npm run check` as PASS, but `lint` is still pending');
    }
    if (regressionStatus === 'pending') {
      issues.push(
        'verify-report.md marks `npm run check` as PASS, but `regression` is still pending'
      );
    }
  }

  if (runValidationResult && /pass/i.test(runValidationResult) && runCompletenessStatus === 'pending') {
    issues.push(
      'verify-report.md marks current run validation as PASS, but `run-completeness` is still pending'
    );
  }

  return issues;
}

function validateKnowledgeMarker(marker) {
  if (marker.kind === 'run') {
    const runDir = path.join(RUNS_DIR, marker.target.trim());
    return fs.existsSync(runDir)
      ? null
      : `${marker.raw} points to missing run directory: ${marker.target.trim()}`;
  }

  if (marker.kind === 'insight') {
    const [fileName, heading] = marker.target.split('#');
    const resolvedFile = path.join(INSIGHTS_DIR, (fileName || '').trim());
    if (!fileName || !heading) {
      return `${marker.raw} is missing file or heading`;
    }
    if (!fs.existsSync(resolvedFile)) {
      return `${marker.raw} points to missing insight file: ${fileName.trim()}`;
    }
    const headings = parseMarkdownHeadings(fs.readFileSync(resolvedFile, 'utf-8'));
    const normalizedHeading = normalizeMarkdownLabel(heading);
    return headings.includes(normalizedHeading)
      ? null
      : `${marker.raw} points to missing insight heading: ${normalizedHeading}`;
  }

  if (marker.kind === 'feedback:skills.json' || marker.kind === 'feedback:agents.json') {
    const fileName = marker.kind.replace('feedback:', '');
    const resolvedFile = path.join(FEEDBACK_DIR, fileName);
    const key = marker.target.trim();

    if (!fs.existsSync(resolvedFile)) {
      return `${marker.raw} points to missing feedback file: ${fileName}`;
    }

    const parsed = JSON.parse(fs.readFileSync(resolvedFile, 'utf-8'));
    const topLevel = fileName === 'skills.json' ? parsed.skills || {} : parsed.agents || {};
    return Object.prototype.hasOwnProperty.call(topLevel, key)
      ? null
      : `${marker.raw} points to missing feedback key: ${key}`;
  }

  return null;
}

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
    for (let i = runs.length - 1; i >= 0; i--) {
      const runPath = path.join(RUNS_DIR, runs[i]);
      const isComplete = REQUIRED_FILES.every((file) => {
        const filePath = path.join(runPath, file);
        if (!fs.existsSync(filePath)) return false;
        const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
        const tokens = REQUIRED_CONTENT[file] || [];
        return tokens.every((token) => content.includes(token));
      });
      if (isComplete) return runs[i];
    }
    return null;
  }

  return null;
}

function validateRun(runId) {
  if (!runId) {
    const allRuns = listRuns();
    const message =
      allRuns.length > 0
        ? `未找到完整闭环 run（${allRuns.length} 个 in-progress 或不达标 run 已跳过）`
        : '未找到任何 run 目录';
    return {
      ok: false,
      runId: null,
      runPath: RUNS_DIR,
      missingFiles: [],
      presentFiles: [],
      message
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

  const routeDecisionPath = path.join(runPath, 'route-decision.md');
  const verifyReportPath = path.join(runPath, 'verify-report.md');
  const routeDecisionContent = fs.existsSync(routeDecisionPath)
    ? fs.readFileSync(routeDecisionPath, 'utf-8')
    : '';
  const verifyReportContent = fs.existsSync(verifyReportPath)
    ? fs.readFileSync(verifyReportPath, 'utf-8')
    : '';
  const knowledgeReusePassed = /knowledge-reuse[\s\S]{0,160}pass/i.test(verifyReportContent);
  const routeHasKnowledgeEvidence = KNOWLEDGE_EVIDENCE_PATTERNS.some((pattern) =>
    pattern.test(routeDecisionContent)
  );
  const verifyHasKnowledgeEvidence = KNOWLEDGE_EVIDENCE_PATTERNS.some((pattern) =>
    pattern.test(verifyReportContent)
  );
  const routeMarkers = extractKnowledgeMarkers(routeDecisionContent);
  const verifyMarkers = extractKnowledgeMarkers(verifyReportContent);
  const protocolIssues = [];
  const verifyConsistencyIssues = validateVerifyConsistency(verifyReportContent, runId);

  protocolIssues.push(...verifyConsistencyIssues);

  if (knowledgeReusePassed) {
    if (!routeHasKnowledgeEvidence) {
      protocolIssues.push(
        'route-decision.md claims knowledge reuse indirectly, but no [insight:] / [feedback:] / [run:] evidence marker was found'
      );
    }
    if (!verifyHasKnowledgeEvidence) {
      protocolIssues.push(
        'verify-report.md marks knowledge-reuse as PASS, but no [insight:] / [feedback:] / [run:] evidence marker was found'
      );
    }

    for (const marker of [...routeMarkers, ...verifyMarkers]) {
      const issue = validateKnowledgeMarker(marker);
      if (issue) {
        protocolIssues.push(issue);
      }
    }

    const taskContext = [routeDecisionContent, verifyReportContent]
      .map((content) => {
        const lines = content
          .split(/\r?\n/)
          .filter((line) => /userIntent|goal|knowledge inputs|route hints used|knowledge-reuse/i.test(line));
        return lines.join(' ');
      })
      .join(' ');
    const uniqueMarkers = [...routeMarkers, ...verifyMarkers].filter(
      (marker, index, collection) =>
        collection.findIndex((candidate) => candidate.raw === marker.raw) === index
    );
    const relevanceCandidates = uniqueMarkers.filter((marker) => {
      if (validateKnowledgeMarker(marker) !== null) {
        return false;
      }
      return marker.kind === 'insight' || marker.kind === 'run';
    });

    if (relevanceCandidates.length > 0 && !hasRelevantKnowledgeReference(taskContext, relevanceCandidates)) {
      protocolIssues.push(
        'knowledge-reuse is PASS, but no valid [insight:] or [run:] marker has obvious keyword overlap with the current task context'
      );
    }
  }

  return {
    ok: missingFiles.length === 0 && invalidFiles.length === 0 && protocolIssues.length === 0,
    runId,
    runPath,
    missingFiles,
    presentFiles,
    invalidFiles,
    protocolIssues,
    message:
      missingFiles.length === 0 && invalidFiles.length === 0 && protocolIssues.length === 0
        ? 'run 闭环完整'
        : [
            missingFiles.length > 0
              ? `run 缺少基础工件: ${missingFiles.join(', ')}`
              : null,
            invalidFiles.length > 0
              ? `run 工件缺少最小内容: ${invalidFiles
                  .map(({ file, missingTokens }) => `${file} -> ${missingTokens.join('/')}`)
                  .join(', ')}`
              : null,
            protocolIssues.length > 0 ? `run 协议证据缺口: ${protocolIssues.join('; ')}` : null
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
    console.log('- 补写缺失的 route / plan / verify / learn / index 工件');
    console.log('- 若这是 /auto 运行结果，检查主流程是否跳过了可见闭环输出');
    console.log(
      '- 确认工件正文含最小语义：route/plan/execution/verify/learn，而不是只创建空文件'
    );
    console.log(
      '- 若 `knowledge-reuse` 为 PASS，补写至少 1 个 [insight:...] / [feedback:...] / [run:...] 标记到 route-decision 和 verify-report'
    );
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
      console.log(`message: ${result.message}，跳过 run 完整性门禁`);
    }
  }

  process.exit(result.ok || shouldAllowMissing ? 0 : 1);
}

main();
