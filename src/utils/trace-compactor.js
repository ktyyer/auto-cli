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
