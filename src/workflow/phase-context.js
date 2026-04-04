/**
 * PHASE Context — 工作流上下文数据流
 *
 * 在 PHASE 1-6 间传递的不可变数据结构，确保：
 * - 不可变性（每次更新返回新对象）
 * - 完整的审计追踪
 * - 类型安全
 */

import { logger } from '../logger.js';

/**
 * PHASE 名称映射
 * @readonly
 */
export const PHASE_NAMES = Object.freeze({
  1: 'discover',
  2: 'reason',
  3: 'execute',
  4: 'verify',
  5: 'commit',
  6: 'learn'
});

/**
 * 执行模式
 * @readonly
 */
export const EXECUTION_MODES = Object.freeze({
  MICRO: 'micro',
  LIGHT: 'light',
  FULL: 'full'
});

/**
 * 创建 PHASE 上下文
 * @param {Object} options
 * @returns {Readonly<Object>} 不可变的上下文对象
 */
export function createPhaseContext(options = {}) {
  return Object.freeze({
    // 执行模式
    mode: options.mode || EXECUTION_MODES.FULL,

    // 任务信息
    task: options.task || '',
    taskComplexity: options.taskComplexity || 'medium',

    // 技术栈
    techStack: Object.freeze(options.techStack || []),

    // 发现的能力
    capabilities: Object.freeze(
      options.capabilities || {
        commands: 0,
        agents: 0,
        skills: 0,
        hooks: 0
      }
    ),

    // Quest 地图
    questMap: options.questMap || null,

    // 当前执行的 Quest
    currentQuest: options.currentQuest || null,

    // 已完成的 Quest 列表
    completedQuests: Object.freeze(options.completedQuests || []),

    // 失败重试的 Quest 列表
    failedQuests: Object.freeze(options.failedQuests || []),

    // 变更的文件列表
    changedFiles: Object.freeze(options.changedFiles || []),

    // 知识沉淀
    insights: Object.freeze(options.insights || []),

    // 模型推荐
    modelRecommendations: Object.freeze(options.modelRecommendations || {}),

    // Token 预算状态
    tokenBudget: Object.freeze(
      options.tokenBudget || {
        total: 0,
        consumed: 0,
        remaining: 0
      }
    ),

    // 上下文窗口状态
    contextStatus: options.contextStatus || 'ok',

    // 错误信息
    error: options.error || null,

    // 时间戳
    timestamp: options.timestamp || Date.now(),

    // 执行阶段
    currentPhase: options.currentPhase || 0
  });
}

/**
 * 更新 PHASE 上下文（返回新对象，保持不可变性）
 * @param {Object} ctx 当前上下文
 * @param {Object} updates 要更新的字段
 * @returns {Readonly<Object>} 新的不可变上下文
 */
export function updatePhaseContext(ctx, updates) {
  if (!ctx || typeof ctx !== 'object') {
    logger.warn('updatePhaseContext: invalid context, creating new');
    return createPhaseContext(updates);
  }

  // 特殊处理需要深冻结的字段
  const processedUpdates = { ...updates };

  if (updates.capabilities) {
    processedUpdates.capabilities = Object.freeze({ ...updates.capabilities });
  }

  if (updates.techStack) {
    processedUpdates.techStack = Object.freeze([...updates.techStack]);
  }

  if (updates.completedQuests) {
    processedUpdates.completedQuests = Object.freeze([...updates.completedQuests]);
  }

  if (updates.failedQuests) {
    processedUpdates.failedQuests = Object.freeze([...updates.failedQuests]);
  }

  if (updates.changedFiles) {
    processedUpdates.changedFiles = Object.freeze([...updates.changedFiles]);
  }

  if (updates.insights) {
    processedUpdates.insights = Object.freeze([...updates.insights]);
  }

  if (updates.modelRecommendations) {
    processedUpdates.modelRecommendations = Object.freeze({ ...updates.modelRecommendations });
  }

  if (updates.tokenBudget) {
    processedUpdates.tokenBudget = Object.freeze({ ...updates.tokenBudget });
  }

  return Object.freeze({
    ...ctx,
    ...processedUpdates,
    timestamp: Date.now()
  });
}

/**
 * 检测执行模式
 * @param {string} task 任务描述
 * @param {Object} options 检测选项
 * @returns {string} micro | light | full
 */
export function detectExecutionMode(task, options = {}) {
  // 显式指定模式
  if (options.mode && Object.values(EXECUTION_MODES).includes(options.mode)) {
    return options.mode;
  }

  const taskLower = task.toLowerCase();

  // 微型模式特征：单文件小改动
  const microPatterns = [
    /fix.*typo/i,
    /update.*readme/i,
    /add.*comment/i,
    /rename.*variable/i,
    /格式.*调整/i,
    /单.*文件/i
  ];

  // 轻量模式特征：少量文件，无架构变更
  const lightPatterns = [
    /add.*error.*handling/i,
    /fix.*bug.*in/i,
    /refactor.*function/i,
    /add.*test/i,
    /小.*改动/i,
    /简单.*修复/i
  ];

  // 检查是否匹配微型模式
  if (microPatterns.some((p) => p.test(taskLower))) {
    return EXECUTION_MODES.MICRO;
  }

  // 检查是否匹配轻量模式
  if (lightPatterns.some((p) => p.test(taskLower))) {
    return EXECUTION_MODES.LIGHT;
  }

  // 架构变更关键词
  const architectureKeywords = [
    '架构',
    '重构',
    'refactor',
    'architecture',
    'system',
    '系统',
    '迁移',
    'migration'
  ];

  if (architectureKeywords.some((k) => taskLower.includes(k))) {
    return EXECUTION_MODES.FULL;
  }

  // 默认完整模式
  return EXECUTION_MODES.FULL;
}

export default {
  PHASE_NAMES,
  EXECUTION_MODES,
  createPhaseContext,
  updatePhaseContext,
  detectExecutionMode
};
