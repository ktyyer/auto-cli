/**
 * Error Trace Compactor — Node.js 栈追踪压缩器
 *
 * 将冗长的 Error Stack 压缩为紧凑摘要（250+ token → ~40 token）
 * 借鉴 tarekziade/claude-tools 的 Python 实现，适配 Node.js 栈格式
 *
 * 核心逻辑：
 * - 保留第一行错误消息
 * - 过滤 node_modules 和 node:internal 帧
 * - 只保留项目内的栈帧
 * - 指纹去重：相同错误只保留一次
 */

import { createHash } from 'node:crypto';

/**
 * 栈帧过滤模式
 * @readonly
 */
export const FILTERED_PATTERNS = Object.freeze([
  'node_modules',
  'node:internal',
  'node:',
  '<anonymous>',
  'timers.js',
  'async_hooks'
]);

/**
 * 项目帧匹配模式
 * @readonly
 */
export const PROJECT_PATTERNS = Object.freeze(['src/', 'tests/', 'bin/']);

/**
 * 指纹缓存容量上限
 */
const MAX_FINGERPRINTS = 1000;

/**
 * 已知指纹缓存（去重用，FIFO 淘汰）
 * @type {Map<string, number>}
 */
const _fingerprints = new Map();

/**
 * 解析单行栈帧
 * @param {string} line
 * @returns {{ raw: string, file: string, line: number, isProject: boolean, isFiltered: boolean }}
 */
export function parseFrame(line) {
  const trimmed = line.trim();

  // 匹配 "at functionName (file:line:col)" 或 "at file:line:col"
  const match = trimmed.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+)(?::\d+)?\)?$/);

  if (!match) {
    return { raw: trimmed, file: '', line: 0, isProject: false, isFiltered: true };
  }

  const file = match[2] || '';
  const lineNum = parseInt(match[3], 10);

  const isFiltered = FILTERED_PATTERNS.some((p) => file.includes(p));
  const isProject = !isFiltered && PROJECT_PATTERNS.some((p) => file.includes(p));

  return { raw: trimmed, file, line: lineNum, isProject, isFiltered };
}

/**
 * 生成错误指纹（用于去重）
 * @param {string|Error} input
 * @returns {string} hex fingerprint
 */
export function createFingerprint(input) {
  const stack = input instanceof Error ? input.stack || input.message : String(input);
  const lines = stack.split('\n');

  // 指纹 = 错误消息 + 项目帧文件:行号
  const parts = [lines[0] || ''];
  for (let i = 1; i < lines.length; i++) {
    const frame = parseFrame(lines[i]);
    if (frame.isProject) {
      parts.push(`${frame.file}:${frame.line}`);
    }
  }

  return createHash('md5').update(parts.join('|')).digest('hex').slice(0, 12);
}

/**
 * 压缩栈追踪
 * @param {string|Error} input - Error 对象或 stack trace 字符串
 * @param {Object} [options]
 * @param {boolean} [options.dedupe=true] - 是否去重
 * @param {number} [options.maxProjectFrames=5] - 最多保留的项目帧数
 * @returns {{ compacted: string, fingerprint: string, isDuplicate: boolean, stats: Object }}
 */
export function compactTrace(input, options = {}) {
  const { dedupe = true, maxProjectFrames = 5 } = options;
  const stack = input instanceof Error ? input.stack || input.message : String(input);
  const lines = stack.split('\n');

  // 第一行 = 错误消息
  const errorMessage = lines[0] || 'Unknown Error';

  // 解析所有帧
  const projectFrames = [];
  let filteredCount = 0;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const frame = parseFrame(lines[i]);

    if (frame.isProject) {
      projectFrames.push(frame);
    } else {
      filteredCount++;
    }
  }

  // 指纹 + 去重检查
  const fingerprint = createFingerprint(input);
  const isDuplicate = dedupe && _fingerprints.has(fingerprint);

  if (!isDuplicate) {
    if (_fingerprints.size >= MAX_FINGERPRINTS) {
      const oldest = _fingerprints.keys().next().value;
      _fingerprints.delete(oldest);
    }
    _fingerprints.set(fingerprint, Date.now());
  }

  // 截断项目帧
  const keptFrames = projectFrames.slice(0, maxProjectFrames);
  const truncatedCount = Math.max(0, projectFrames.length - maxProjectFrames);

  // 构建压缩输出
  const parts = [errorMessage];
  for (const frame of keptFrames) {
    parts.push(`  at ${frame.file}:${frame.line}`);
  }

  const summary = [];
  if (truncatedCount > 0) summary.push(`+${truncatedCount} more project frames`);
  if (filteredCount > 0) summary.push(`${filteredCount} filtered`);
  if (isDuplicate) summary.push('duplicate');
  if (summary.length > 0) {
    parts.push(`  (${summary.join(', ')})`);
  }

  return Object.freeze({
    compacted: parts.join('\n'),
    fingerprint,
    isDuplicate,
    stats: Object.freeze({
      totalFrames: projectFrames.length + filteredCount,
      projectFrames: projectFrames.length,
      filteredFrames: filteredCount,
      keptFrames: keptFrames.length
    })
  });
}

/**
 * 清除指纹缓存
 */
export function clearFingerprints() {
  _fingerprints.clear();
}

/**
 * 获取指纹缓存大小
 * @returns {number}
 */
export function getFingerprintCount() {
  return _fingerprints.size;
}

// ============================================================
// 9-Section Structured Compact Template
// ============================================================

/**
 * 压缩模板的 9 个节段定义
 * @readonly
 */
export const COMPACT_SECTIONS = Object.freeze({
  USER_MESSAGE: 'user_message',
  ANALYSIS_SCRATCHPAD: 'analysis_scratchpad',
  PLAN_SUMMARY: 'plan_summary',
  CODE_CHANGES: 'code_changes',
  EXECUTION_STATUS: 'execution_status',
  REVIEW_FEEDBACK: 'review_feedback',
  MEMORY_SNAPSHOT: 'memory_snapshot',
  PENDING_ACTIONS: 'pending_actions',
  CONTEXT_META: 'context_meta'
});

/**
 * 节段描述（用于模板生成时的注释头）
 * @readonly
 */
export const SECTION_DESCRIPTIONS = Object.freeze({
  [COMPACT_SECTIONS.USER_MESSAGE]: 'Verbatim user message (preserved exactly)',
  [COMPACT_SECTIONS.ANALYSIS_SCRATCHPAD]: 'Working analysis notes and reasoning',
  [COMPACT_SECTIONS.PLAN_SUMMARY]: 'Condensed plan with accepted/rejected items',
  [COMPACT_SECTIONS.CODE_CHANGES]: 'Files modified with diff summaries',
  [COMPACT_SECTIONS.EXECUTION_STATUS]: 'Current execution state and progress',
  [COMPACT_SECTIONS.REVIEW_FEEDBACK]: 'Review results and issues found',
  [COMPACT_SECTIONS.MEMORY_SNAPSHOT]: 'Key memory entries (index tier only)',
  [COMPACT_SECTIONS.PENDING_ACTIONS]: 'Remaining tasks and blocked items',
  [COMPACT_SECTIONS.CONTEXT_META]: 'Token budget, compression history, mode'
});

/**
 * 创建空压缩模板
 * @returns {Object} 冻结的空模板对象
 */
export function createCompactTemplate() {
  const sections = {};
  for (const key of Object.values(COMPACT_SECTIONS)) {
    sections[key] = '';
  }
  return Object.freeze(sections);
}

/**
 * 节段填充器 -- 将原始上下文数据映射到 9 个节段
 * @param {Object} params
 * @param {string} [params.userMessage=''] - 用户原始消息（verbatim 保留）
 * @param {string} [params.analysisScratchpad=''] - 分析草稿板
 * @param {string} [params.planSummary=''] - 计划摘要
 * @param {Object[]} [params.codeChanges=[]] - 代码变更列表
 * @param {Object} [params.executionStatus={}] - 执行状态
 * @param {string[]} [params.reviewFeedback=[]] - 审查反馈
 * @param {Object[]} [params.memorySnapshot=[]] - 记忆快照条目
 * @param {string[]} [params.pendingActions=[]] - 待处理事项
 * @param {Object} [params.contextMeta={}] - 上下文元信息
 * @returns {Object} 冻结的填充后模板
 */
export function fillCompactTemplate(params = {}) {
  const codeChangesStr = (params.codeChanges || [])
    .map((c) => {
      const status = c.status ?? 'unknown';
      const summary = c.summary ?? c.path ?? 'no summary';
      return `- [${status}] ${summary}`;
    })
    .join('\n');

  const memoryStr = (params.memorySnapshot || [])
    .map((m) => {
      const key = m.key ?? 'unknown';
      const value = typeof m.value === 'string' ? m.value : JSON.stringify(m.value);
      const truncated = value.length > 150 ? value.slice(0, 147) + '...' : value;
      return `- ${key}: ${truncated.replace(/\n/g, ' ')}`;
    })
    .join('\n');

  const reviewStr = (params.reviewFeedback || [])
    .map((r) =>
      typeof r === 'string' ? `- ${r}` : `- [${r.severity ?? 'info'}] ${r.message ?? r}`
    )
    .join('\n');

  const pendingStr = (params.pendingActions || [])
    .map((a) =>
      typeof a === 'string' ? `- ${a}` : `- [${a.priority ?? 'normal'}] ${a.description ?? a}`
    )
    .join('\n');

  const execStatusStr = params.executionStatus
    ? Object.entries(params.executionStatus)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n')
    : '';

  const contextMetaStr = params.contextMeta
    ? Object.entries(params.contextMeta)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n')
    : '';

  const sections = {
    [COMPACT_SECTIONS.USER_MESSAGE]: params.userMessage ?? '',
    [COMPACT_SECTIONS.ANALYSIS_SCRATCHPAD]: params.analysisScratchpad ?? '',
    [COMPACT_SECTIONS.PLAN_SUMMARY]: params.planSummary ?? '',
    [COMPACT_SECTIONS.CODE_CHANGES]: codeChangesStr,
    [COMPACT_SECTIONS.EXECUTION_STATUS]: execStatusStr,
    [COMPACT_SECTIONS.REVIEW_FEEDBACK]: reviewStr,
    [COMPACT_SECTIONS.MEMORY_SNAPSHOT]: memoryStr,
    [COMPACT_SECTIONS.PENDING_ACTIONS]: pendingStr,
    [COMPACT_SECTIONS.CONTEXT_META]: contextMetaStr
  };

  return Object.freeze(sections);
}

/**
 * 将压缩模板渲染为文本（用于注入上下文）
 * @param {Object} template - fillCompactTemplate 的返回值
 * @param {Object} [options]
 * @param {boolean} [options.includeEmpty=false] - 是否包含空节段
 * @param {boolean} [options.includeDescriptions=true] - 是否包含节段描述注释
 * @returns {string}
 */
export function renderCompactTemplate(template, options = {}) {
  const { includeEmpty = false, includeDescriptions = true } = options;
  const lines = [];

  for (const [key, value] of Object.entries(template)) {
    if (!value && !includeEmpty) continue;

    const sectionName = Object.entries(COMPACT_SECTIONS).find(([, v]) => v === key)?.[0] ?? key;
    const separator = '='.repeat(40);

    lines.push(separator);
    if (includeDescriptions && SECTION_DESCRIPTIONS[key]) {
      lines.push(`# ${sectionName}: ${SECTION_DESCRIPTIONS[key]}`);
    } else {
      lines.push(`# ${sectionName}`);
    }
    lines.push(separator);
    lines.push(value || '(empty)');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 从压缩模板文本反向解析为对象
 * @param {string} text - renderCompactTemplate 的输出
 * @returns {Object} 节段映射
 */
export function parseCompactTemplate(text) {
  const result = {};
  const separatorPattern = /^={40}$/;
  const headerPattern = /^# (\w+)(?::\s*(.+))?$/;

  const lineGroups = [];
  let currentHeader = null;
  let currentLines = [];

  for (const line of text.split('\n')) {
    if (separatorPattern.test(line)) {
      if (currentHeader !== null) {
        lineGroups.push({ header: currentHeader, lines: [...currentLines] });
      }
      currentLines = [];
      continue;
    }
    const headerMatch = line.match(headerPattern);
    if (headerMatch) {
      currentHeader = headerMatch[1];
      continue;
    }
    currentLines.push(line);
  }
  if (currentHeader !== null) {
    lineGroups.push({ header: currentHeader, lines: [...currentLines] });
  }

  for (const group of lineGroups) {
    const sectionKey = COMPACT_SECTIONS[group.header];
    if (sectionKey) {
      const content = group.lines.join('\n').replace(/^\n+|\n+$/g, '');
      result[sectionKey] = content === '(empty)' ? '' : content;
    }
  }

  return Object.freeze(result);
}

/**
 * 估算模板的总字符数
 * @param {Object} template
 * @returns {number}
 */
export function estimateTemplateSize(template) {
  let total = 0;
  for (const value of Object.values(template)) {
    total += typeof value === 'string' ? value.length : 0;
  }
  return total;
}
