/**
 * Context Compressor — 上下文压缩执行器
 *
 * 填补 ContextMonitor（告警）和实际压缩操作之间的空白：
 * - 5 级压缩策略，从轻到重
 * - 纯函数：所有策略返回新快照，不修改原对象
 * - 状态驱动：根据 CONTEXT_STATUS 自动选择压缩级别
 *
 * 策略链：
 * 1. TRUNCATE — 截断大输出（>阈值 chars 的条目截断到保留长度）
 * 2. SNIP — 移除旧工具输出（Read/Bash/Grep/Glob 的旧结果）
 * 3. MICRO_COMPACT — 保留最近 N 条完整消息
 * 4. COLLAPSE — 合并连续相同标签条目
 * 5. AUTO_COMPACT — 最后手段，返回升级建议（新会话/compact）
 */

import { CONTEXT_STATUS, estimateTokens } from './context-monitor.js';
import { logger } from '../logger.js';

/**
 * 压缩级别（数值越大越激进）
 * @readonly
 */
export const COMPRESSION_LEVELS = Object.freeze({
  TRUNCATE: 1,
  SNIP: 2,
  MICRO_COMPACT: 3,
  COLLAPSE: 4,
  AUTO_COMPACT: 5
});

/**
 * CONTEXT_STATUS → 压缩级别映射
 * @readonly
 */
export const STATUS_TO_LEVEL = Object.freeze({
  [CONTEXT_STATUS.COMPRESS_SUGGESTED]: COMPRESSION_LEVELS.TRUNCATE,
  [CONTEXT_STATUS.ISOLATE_SUGGESTED]: COMPRESSION_LEVELS.SNIP,
  [CONTEXT_STATUS.COMPRESS_REQUIRED]: COMPRESSION_LEVELS.MICRO_COMPACT,
  [CONTEXT_STATUS.OVERFLOW]: COMPRESSION_LEVELS.AUTO_COMPACT
});

/**
 * 压缩级别名称
 * @readonly
 */
export const COMPRESSION_NAMES = Object.freeze({
  [COMPRESSION_LEVELS.TRUNCATE]: 'TRUNCATE',
  [COMPRESSION_LEVELS.SNIP]: 'SNIP',
  [COMPRESSION_LEVELS.MICRO_COMPACT]: 'MICRO_COMPACT',
  [COMPRESSION_LEVELS.COLLAPSE]: 'COLLAPSE',
  [COMPRESSION_LEVELS.AUTO_COMPACT]: 'AUTO_COMPACT'
});

/**
 * 工具输出类型（策略 2 过滤目标）
 * @readonly
 */
export const TOOL_OUTPUT_TYPES = Object.freeze(['Read', 'Bash', 'Grep', 'Glob']);

/**
 * 默认压缩配置
 * @readonly
 */
export const COMPRESSION_DEFAULTS = Object.freeze({
  truncateThreshold: 10000,
  truncateKeep: 2000,
  snipKeepRecent: 5,
  snipToolTypes: [...TOOL_OUTPUT_TYPES],
  microCompactKeepCount: 10,
  collapseWindowSize: 3
});

/**
 * 项目类型自适应压缩配置
 * @readonly
 */
export const ADAPTIVE_PROFILES = Object.freeze({
  frontend: Object.freeze({
    ...COMPRESSION_DEFAULTS,
    truncateThreshold: 8000,
    snipKeepRecent: 8
  }),
  backend: Object.freeze({
    ...COMPRESSION_DEFAULTS,
    truncateThreshold: 12000,
    microCompactKeepCount: 15
  }),
  monorepo: Object.freeze({
    ...COMPRESSION_DEFAULTS,
    truncateThreshold: 6000,
    snipKeepRecent: 3,
    microCompactKeepCount: 8
  }),
  default: COMPRESSION_DEFAULTS
});

/**
 * 选择压缩级别
 * @param {string} contextStatus
 * @returns {number} COMPRESSION_LEVELS 值，未知状态返回 0
 */
export function selectCompressionLevel(contextStatus) {
  return STATUS_TO_LEVEL[contextStatus] ?? 0;
}

/**
 * 创建不可变压缩结果
 * @param {Object} params
 * @returns {Object}
 */
export function createCompressionResult(params) {
  return Object.freeze({
    applied: params.applied ?? false,
    level: params.level ?? 0,
    strategyName: params.strategyName ?? '',
    reason: params.reason ?? '',
    reducedTokens: params.reducedTokens ?? 0,
    originalTokens: params.originalTokens ?? 0,
    newTokens: params.newTokens ?? 0,
    strategiesApplied: Object.freeze(params.strategiesApplied ?? []),
    recommendation: params.recommendation ?? null
  });
}

/**
 * 策略 1：截断大输出
 * 截断 history 中 chars >= threshold 的条目，保留前 keep 字符
 *
 * @param {Object} snapshot - ContextMonitor 快照
 * @param {Object} [config]
 * @param {number} [config.truncateThreshold=10000]
 * @param {number} [config.truncateKeep=2000]
 * @returns {Object} 新快照（不可变）
 */
export function truncateLargeOutputs(snapshot, config = {}) {
  const threshold = config.truncateThreshold ?? COMPRESSION_DEFAULTS.truncateThreshold;
  const keep = config.truncateKeep ?? COMPRESSION_DEFAULTS.truncateKeep;

  let totalReduced = 0;
  const newHistory = snapshot.history.map((entry) => {
    if (entry.chars >= threshold) {
      const originalTokens = estimateTokens(entry.chars);
      const newChars = keep;
      const newTokens = estimateTokens(newChars);
      totalReduced += originalTokens - newTokens;

      return Object.freeze({
        ...entry,
        chars: newChars,
        cumulativeTokens: 0,
        label: `${entry.label || ''}[truncated]`.trim()
      });
    }
    return entry;
  });

  return Object.freeze({
    ...snapshot,
    history: Object.freeze(newHistory),
    currentTokens: Math.max(0, snapshot.currentTokens - totalReduced),
    updatedAt: Date.now()
  });
}

/**
 * 策略 2：移除旧工具输出
 * 移除 snipToolTypes 类型的旧条目，保留最近 snipKeepRecent 条
 *
 * @param {Object} snapshot
 * @param {Object} [config]
 * @param {number} [config.snipKeepRecent=5]
 * @param {string[]} [config.snipToolTypes]
 * @returns {Object} 新快照
 */
export function snipOldToolOutputs(snapshot, config = {}) {
  const keepRecent = config.snipKeepRecent ?? COMPRESSION_DEFAULTS.snipKeepRecent;
  const toolTypes = config.snipToolTypes ?? COMPRESSION_DEFAULTS.snipToolTypes;

  // 从末尾开始计数，保留最近的 N 条工具输出
  let toolCount = 0;
  let totalReduced = 0;
  const newHistory = [];

  // 倒序遍历，保留最近的
  for (let i = snapshot.history.length - 1; i >= 0; i--) {
    const entry = snapshot.history[i];
    const isToolOutput = toolTypes.some((t) => entry.label && entry.label.includes(t));

    if (isToolOutput) {
      toolCount++;
      if (toolCount <= keepRecent) {
        newHistory.unshift(entry);
      } else {
        totalReduced += estimateTokens(entry.chars);
      }
    } else {
      newHistory.unshift(entry);
    }
  }

  return Object.freeze({
    ...snapshot,
    history: Object.freeze(newHistory),
    currentTokens: Math.max(0, snapshot.currentTokens - totalReduced),
    updatedAt: Date.now()
  });
}

/**
 * 策略 3：微压缩历史
 * 只保留最近 microCompactKeepCount 条完整消息
 *
 * @param {Object} snapshot
 * @param {Object} [config]
 * @param {number} [config.microCompactKeepCount=10]
 * @returns {Object} 新快照
 */
export function microCompactHistory(snapshot, config = {}) {
  const keepCount = config.microCompactKeepCount ?? COMPRESSION_DEFAULTS.microCompactKeepCount;

  if (snapshot.history.length <= keepCount) {
    return snapshot;
  }

  const removed = snapshot.history.slice(0, snapshot.history.length - keepCount);
  const totalReduced = removed.reduce((sum, entry) => sum + estimateTokens(entry.chars), 0);
  const newHistory = snapshot.history.slice(-keepCount);

  return Object.freeze({
    ...snapshot,
    history: Object.freeze(newHistory),
    currentTokens: Math.max(0, snapshot.currentTokens - totalReduced),
    updatedAt: Date.now()
  });
}

/**
 * 策略 4：合并连续条目
 * 将连续相同标签的条目合并为一个摘要
 *
 * @param {Object} snapshot
 * @param {Object} [config]
 * @param {number} [config.collapseWindowSize=3]
 * @returns {Object} 新快照
 */
export function collapseConsecutive(snapshot, config = {}) {
  const windowSize = config.collapseWindowSize ?? COMPRESSION_DEFAULTS.collapseWindowSize;

  if (snapshot.history.length <= windowSize) {
    return snapshot;
  }

  const newHistory = [];
  let i = 0;
  let totalReduced = 0;

  while (i < snapshot.history.length) {
    const current = snapshot.history[i];
    const label = current.label || '';

    // 收集连续相同标签
    let j = i + 1;
    while (j < snapshot.history.length && (snapshot.history[j].label || '') === label) {
      j++;
    }

    const groupSize = j - i;

    if (groupSize >= windowSize) {
      // 合并：保留第一条，记录节省的 token
      const collapsedTokens = snapshot.history
        .slice(i + 1, j)
        .reduce((sum, entry) => sum + estimateTokens(entry.chars), 0);

      totalReduced += collapsedTokens;

      newHistory.push(
        Object.freeze({
          ...current,
          label: `${label}[x${groupSize}]`.trim(),
          cumulativeTokens: 0
        })
      );
      i = j;
    } else {
      newHistory.push(current);
      i++;
    }
  }

  return Object.freeze({
    ...snapshot,
    history: Object.freeze(newHistory),
    currentTokens: Math.max(0, snapshot.currentTokens - totalReduced),
    updatedAt: Date.now()
  });
}

/**
 * 策略 5：自动压缩升级建议
 * 当上下文使用率 >= 90%（OVERFLOW）时，返回升级建议
 * 不执行实际压缩，只返回 recommendation 供上层决策
 *
 * @param {Object} snapshot - ContextMonitor 快照
 * @returns {Object} 新快照 + recommendation 字段
 */
export function autoCompactRecommend(snapshot) {
  const ratio = snapshot.currentTokens / snapshot.contextLimit;

  const recommendation = Object.freeze({
    action: ratio >= 0.9 ? 'start_new_session' : 'use_compact',
    message:
      ratio >= 0.9
        ? `上下文已溢出 (${Math.round(ratio * 100)}%)，建议开启新会话以继续工作`
        : `上下文严重不足 (${Math.round(ratio * 100)}%)，建议使用 /compact 或开启新会话`,
    ratio: Math.round(ratio * 100) / 100
  });

  return Object.freeze({
    ...snapshot,
    recommendation,
    updatedAt: Date.now()
  });
}

/**
 * 会话摘要 9 节模板 — 语义层压缩
 *
 * 借鉴 Claude Code 的 conversation-summary 模式：
 * - 生成结构化摘要保留对话意图
 * - 保证每条用户消息都被保留
 * - 用于上下文溢出时的会话续接
 *
 * 9 节结构：
 * 1. Primary Request — 用户原始需求和深层意图
 * 2. Key Concepts — 涉及的技术概念和模式
 * 3. Files and Code — 相关文件、代码片段、修改位置
 * 4. Errors and Fixes — 遇到的错误和解决方式
 * 5. Problem Solving — 推理链、备选方案、调试策略
 * 6. User Messages — 所有非工具输出的用户消息（原文保留）
 * 7. Pending Tasks — 未完成或推迟的工作
 * 8. Current Work — 会话结束时正在处理的工作
 * 9. Next Step — 下一步行动（引用用户最近的明确请求）
 *
 * @param {Object} sessionState - 会话状态
 * @param {string} sessionState.task - 原始任务
 * @param {string[]} [sessionState.userMessages] - 用户消息列表
 * @param {Object[]} [sessionState.errors] - 错误记录
 * @param {string[]} [sessionState.pendingTasks] - 待办任务
 * @param {Object} [sessionState.currentWork] - 当前工作状态
 * @returns {Object} 不可变摘要对象
 */
export function createSessionSummary(sessionState) {
  const userMessages = sessionState.userMessages ?? [];

  return Object.freeze({
    type: 'session-summary',
    version: 2,
    createdAt: Date.now(),
    sections: Object.freeze({
      primaryRequest: sessionState.task ?? '',
      keyConcepts: Object.freeze(sessionState.keyConcepts ?? []),
      filesAndCode: Object.freeze(sessionState.filesAndCode ?? []),
      errorsAndFixes: Object.freeze(
        (sessionState.errors ?? []).map((e) => ({
          error: e.message ?? String(e.error ?? e),
          fix: e.fix ?? ''
        }))
      ),
      problemSolving: Object.freeze(sessionState.problemSolving ?? []),
      userMessages: Object.freeze(userMessages.map((m) => String(m))),
      pendingTasks: Object.freeze(sessionState.pendingTasks ?? []),
      currentWork: Object.freeze(sessionState.currentWork ?? {}),
      nextStep: sessionState.nextStep ?? ''
    }),
    tokenEstimate: estimateTokens(JSON.stringify(sessionState).length)
  });
}

/**
 * 从 session-summary 恢复续接行为指令
 *
 * 借鉴 Claude Code 的续接模式：
 * 收到压缩摘要后立即继续工作，不确认不回顾
 *
 * @param {Object} summary - createSessionSummary 的输出
 * @returns {string} 续接指令文本
 */
export function createResumeDirective(summary) {
  if (!summary || summary.type !== 'session-summary') {
    return '';
  }

  const { sections } = summary;
  const lines = [
    `[会话续接] 上次会话摘要:`,
    `任务: ${sections.primaryRequest}`,
    sections.pendingTasks.length > 0 ? `待办: ${sections.pendingTasks.join('; ')}` : '',
    sections.currentWork && Object.keys(sections.currentWork).length > 0
      ? `当前: ${JSON.stringify(sections.currentWork)}`
      : '',
    `--- 立即继续，不要确认或回顾 ---`
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * 解析 createResumeDirective() 生成的续接指令
 * @param {string} directive
 * @returns {{task: string, pendingTasks: readonly string[], currentWork: Readonly<object>, raw: string}}
 */
export function parseResumeDirective(directive) {
  if (typeof directive !== 'string' || directive.trim() === '') {
    throw new Error('resume directive 不能为空');
  }

  const lines = directive
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const header = lines[0];
  if (header !== '[会话续接] 上次会话摘要:') {
    throw new Error('无效的 resume directive');
  }

  const taskLine = lines.find((line) => line.startsWith('任务: '));
  if (!taskLine) {
    throw new Error('resume directive 缺少任务信息');
  }

  const pendingLine = lines.find((line) => line.startsWith('待办: '));
  const currentLine = lines.find((line) => line.startsWith('当前: '));

  const task = taskLine.slice('任务: '.length).trim();
  if (!task) {
    throw new Error('resume directive 缺少任务信息');
  }

  const pendingTasks = pendingLine
    ? pendingLine
        .slice('待办: '.length)
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  let currentWork = {};
  if (currentLine) {
    const currentRaw = currentLine.slice('当前: '.length).trim();
    try {
      currentWork = currentRaw ? JSON.parse(currentRaw) : {};
    } catch {
      throw new Error('resume directive 当前工作区块不是合法 JSON');
    }
  }

  return Object.freeze({
    task,
    pendingTasks: Object.freeze(pendingTasks),
    currentWork: Object.freeze({ ...currentWork }),
    raw: directive
  });
}

/**
 * 压缩协调器：根据 contextStatus 选择级别，链式执行策略
 *
 * @param {Object} snapshot - ContextMonitor 快照
 * @param {string} contextStatus - CONTEXT_STATUS 值
 * @param {Object} [config] - 压缩配置
 * @returns {Object} CompressionResult
 */
export function compressContext(snapshot, contextStatus, config = {}) {
  const targetLevel = selectCompressionLevel(contextStatus);

  if (targetLevel === 0) {
    return createCompressionResult({
      applied: false,
      reason: '无需压缩',
      originalTokens: snapshot.currentTokens,
      newTokens: snapshot.currentTokens
    });
  }

  const originalTokens = snapshot.currentTokens;
  let current = snapshot;
  const strategiesApplied = [];

  if (targetLevel >= COMPRESSION_LEVELS.TRUNCATE) {
    current = truncateLargeOutputs(current, config);
    strategiesApplied.push('TRUNCATE');
  }

  if (targetLevel >= COMPRESSION_LEVELS.SNIP) {
    current = snipOldToolOutputs(current, config);
    strategiesApplied.push('SNIP');
  }

  if (targetLevel >= COMPRESSION_LEVELS.MICRO_COMPACT) {
    current = microCompactHistory(current, config);
    strategiesApplied.push('MICRO_COMPACT');
  }

  if (targetLevel >= COMPRESSION_LEVELS.COLLAPSE) {
    current = collapseConsecutive(current, config);
    strategiesApplied.push('COLLAPSE');
  }

  let recommendation = null;
  if (targetLevel >= COMPRESSION_LEVELS.AUTO_COMPACT) {
    const upgraded = autoCompactRecommend(current);
    recommendation = upgraded.recommendation;
    strategiesApplied.push('AUTO_COMPACT');
  }

  const reducedTokens = originalTokens - current.currentTokens;

  return createCompressionResult({
    applied: reducedTokens > 0 || recommendation !== null,
    level: targetLevel,
    strategyName: COMPRESSION_NAMES[targetLevel] ?? `LEVEL_${targetLevel}`,
    reducedTokens,
    originalTokens,
    newTokens: current.currentTokens,
    strategiesApplied,
    recommendation
  });
}

/**
 * Context Compressor（有状态包装类）
 *
 * 接受 ContextMonitor 实例，执行压缩并同步更新 monitor
 */
export class ContextCompressor {
  /**
   * @param {Object} [config] - 压缩配置
   */
  constructor(config = {}) {
    // Auto-detect adaptive profile from config
    const profile =
      config.adaptiveProfile && ADAPTIVE_PROFILES[config.adaptiveProfile]
        ? ADAPTIVE_PROFILES[config.adaptiveProfile]
        : COMPRESSION_DEFAULTS;
    this._config = Object.freeze({ ...profile, ...config });
    this._adaptiveProfile = config.adaptiveProfile || 'default';
  }

  /**
   * 执行压缩
   * @param {import('./context-monitor.js').ContextMonitor} monitor
   * @returns {Object} CompressionResult
   */
  compress(monitor) {
    const status = monitor.getStatus();

    if (status === CONTEXT_STATUS.OK) {
      return createCompressionResult({
        applied: false,
        reason: '上下文状态正常',
        originalTokens: monitor.getSummary().tokens,
        newTokens: monitor.getSummary().tokens
      });
    }

    const snapshot = monitor.getSnapshot();
    const result = compressContext(snapshot, status, this._config);

    if (result.applied) {
      monitor.compact(result.reducedTokens);
      logger.info(
        `[Compressor] 压缩完成: ${result.strategyName}, ` +
          `节省 ${result.reducedTokens} tokens, ` +
          `策略: [${result.strategiesApplied.join('→')}]`
      );
    }

    return result;
  }

  /**
   * 获取配置
   * @returns {Object}
   */
  getConfig() {
    return this._config;
  }

  /**
   * 根据项目特征自动检测最佳压缩配置
   * @param {Object} projectInfo - 项目信息
   * @param {string[]} [projectInfo.dependencies] - 项目依赖列表
   * @param {string} [projectInfo.type] - 项目类型提示
   * @returns {{ profile: string, config: Object }}
   */
  detectAdaptiveProfile(projectInfo = {}) {
    const deps = (projectInfo.dependencies || []).join(' ').toLowerCase();

    let profile = 'default';
    if (
      deps.includes('react') ||
      deps.includes('vue') ||
      deps.includes('svelte') ||
      deps.includes('angular')
    ) {
      profile = 'frontend';
    } else if (
      deps.includes('express') ||
      deps.includes('fastify') ||
      deps.includes('spring') ||
      deps.includes('nestjs')
    ) {
      profile = 'backend';
    } else if (deps.includes('turbo') || deps.includes('lerna') || deps.includes('nx')) {
      profile = 'monorepo';
    }

    return {
      profile,
      config: ADAPTIVE_PROFILES[profile]
    };
  }
}

export default ContextCompressor;
