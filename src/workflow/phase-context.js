/**
 * PHASE Context — 工作流上下文数据流
 *
 * 在 PHASE 1-6 间传递的不可变数据结构，确保：
 * - 不可变性（每次更新返回新对象）
 * - 完整的审计追踪
 * - 类型安全
 */

import { logger } from '../logger.js';
import { COMPLEXITY_LEVELS, assessComplexity } from '../router/agent-types.js';
import fs from 'fs-extra';
import nodePath from 'node:path';

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
function freezeSnapshot(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeSnapshot(item)));
  }

  if (value && typeof value === 'object') {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, freezeSnapshot(nested)])
      )
    );
  }

  return value;
}

function freezeObjectArray(items = []) {
  return Object.freeze(items.map((item) => freezeSnapshot(item)));
}

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

    // 项目编程语言（P1-4: 用于自动注入语言特定 Skill）
    projectLanguages: Object.freeze(options.projectLanguages || []),

    // P0-1: discover 阶段已加载的 Skill 内容
    discoverSkills: Object.freeze(options.discoverSkills || []),

    // REPO_MAP 检查快照（只读）
    repoMapStatus: Object.freeze(options.repoMapStatus || null),

    // P0-2: 从上次 /auto 读取的待执行调度快照（只读）
    pendingInvocations: freezeObjectArray(options.pendingInvocations || []),

    // pending-only 执行结果（隔离于主任务结果）
    pendingExecution: options.pendingExecution ? freezeSnapshot(options.pendingExecution) : null,

    // Quest 地图
    questMap: options.questMap ? Object.freeze(options.questMap) : null,

    // PHASE 2 匹配的 Skills
    matchedSkills: Object.freeze(options.matchedSkills || []),

    // 当前执行的 Quest
    currentQuest: options.currentQuest || null,

    // 已完成的 Quest 列表
    completedQuests: Object.freeze(options.completedQuests || []),

    // 失败重试的 Quest 列表
    failedQuests: Object.freeze(options.failedQuests || []),

    // 验证阶段的智能体路由结果
    verificationActions: Object.freeze(options.verificationActions || []),

    // 覆盖率检查结果
    coverageResult: Object.freeze(options.coverageResult || null),

    // 安全扫描结果
    securityResult: Object.freeze(options.securityResult || null),

    // Doctor 快检结果
    doctorResult: Object.freeze(options.doctorResult || null),

    // 变更的文件列表
    changedFiles: Object.freeze(options.changedFiles || []),

    // Quest 执行结果
    executionResults: Object.freeze(options.executionResults || []),

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

  if (updates.executionResults) {
    processedUpdates.executionResults = Object.freeze(
      updates.executionResults.map((result) => Object.freeze({ ...result }))
    );
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

  if (updates.verificationActions) {
    processedUpdates.verificationActions = Object.freeze([...updates.verificationActions]);
  }

  if (updates.coverageResult) {
    processedUpdates.coverageResult = Object.freeze({ ...updates.coverageResult });
  }

  if (updates.securityResult) {
    processedUpdates.securityResult = Object.freeze({ ...updates.securityResult });
  }

  if (updates.doctorResult) {
    processedUpdates.doctorResult = Object.freeze({ ...updates.doctorResult });
  }

  if (updates.matchedSkills) {
    processedUpdates.matchedSkills = Object.freeze([...updates.matchedSkills]);
  }

  if (updates.questMap) {
    processedUpdates.questMap = Object.freeze(updates.questMap.map((q) => Object.freeze({ ...q })));
  }

  if (updates.repoMapStatus) {
    processedUpdates.repoMapStatus = Object.freeze({ ...updates.repoMapStatus });
  }

  if (updates.pendingInvocations) {
    processedUpdates.pendingInvocations = freezeObjectArray(updates.pendingInvocations);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'pendingExecution')) {
    processedUpdates.pendingExecution =
      updates.pendingExecution === null ? null : freezeSnapshot(updates.pendingExecution);
  }

  return Object.freeze({
    ...ctx,
    ...processedUpdates,
    timestamp: Date.now()
  });
}

/**
 * 检测执行模式（基于共享的 assessComplexity 评估体系）
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

  // 复用复杂度评估（与 CanonicalRouter 共享同一指标体系）
  const complexity = assessComplexity(taskLower);

  // LOW 复杂度直接映射为微型模式
  if (complexity === COMPLEXITY_LEVELS.LOW) {
    return EXECUTION_MODES.MICRO;
  }

  // HIGH 复杂度直接映射为完整模式
  if (complexity === COMPLEXITY_LEVELS.HIGH) {
    return EXECUTION_MODES.FULL;
  }

  // MEDIUM 复杂度：根据文件数量细化
  // 有文件信息时，按数量降级
  if (options.files) {
    const fileCount = options.files.length;
    if (fileCount <= 1) {
      return EXECUTION_MODES.MICRO;
    }
    if (fileCount <= 3) {
      return EXECUTION_MODES.LIGHT;
    }
    return EXECUTION_MODES.FULL;
  }

  // 无文件信息时：MEDIUM 中按任务语义二次分类
  // 微型模式特征词（在 MEDIUM 基础上进一步缩小范围）
  const microHints = ['typo', 'readme', 'comment', 'rename', 'update'];
  if (microHints.some((h) => taskLower.includes(h))) {
    return EXECUTION_MODES.MICRO;
  }

  // 轻量模式特征词
  const lightHints = ['error', 'handling', 'bug', 'test', 'add'];
  if (lightHints.some((h) => taskLower.includes(h))) {
    return EXECUTION_MODES.LIGHT;
  }

  return EXECUTION_MODES.FULL;
}

/**
 * Phase-Skill 映射表 — 每个 Phase 自动注入的 Skill
 * @readonly
 */
export const PHASE_SKILL_MAP = Object.freeze({
  discover: ['dependency-analyzer'],
  reason: ['workflow-patterns'],
  execute: ['performance-patterns'],
  verify: ['code-style-enforcer', 'error-patterns', 'dependency-analyzer'],
  commit: ['git-workflow']
});

/**
 * 检测项目是否具备 E2E 测试能力
 * @param {string} projectDir - 项目目录
 * @returns {boolean}
 */
export function detectE2ECapability(projectDir) {
  try {
    const pkgPath = nodePath.join(projectDir, 'package.json');
    if (!fs.pathExistsSync(pkgPath)) return false;
    const pkg = fs.readJsonSync(pkgPath);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return !!(deps['@playwright/test'] || deps['playwright']);
  } catch {
    return false;
  }
}

/**
 * 检测项目类型 profile（用于自适应压缩策略）
 * @param {string} projectDir - 项目目录
 * @returns {'frontend'|'backend'|'monorepo'|'default'}
 */
export function detectProjectProfile(projectDir) {
  try {
    const pkgPath = nodePath.join(projectDir, 'package.json');
    if (!fs.pathExistsSync(pkgPath)) return 'default';
    const pkg = fs.readJsonSync(pkgPath);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // monorepo: workspaces 或 lerna/nx/turbo
    if (pkg.workspaces || deps['lerna'] || deps['@nrwl/cli'] || deps['turbo']) {
      return 'monorepo';
    }

    // frontend: react/vue/angular/svelte/next/nuxt
    const frontendDeps = ['react', 'vue', 'angular', '@angular/core', 'svelte', 'next', 'nuxt'];
    if (frontendDeps.some((d) => deps[d])) {
      return 'frontend';
    }

    // backend: express/koa/fastify/nest/hapi
    const backendDeps = ['express', 'koa', 'fastify', '@nestjs/core', '@hapi/hapi'];
    if (backendDeps.some((d) => deps[d])) {
      return 'backend';
    }

    return 'default';
  } catch {
    return 'default';
  }
}

export default {
  PHASE_NAMES,
  EXECUTION_MODES,
  PHASE_SKILL_MAP,
  createPhaseContext,
  updatePhaseContext,
  detectExecutionMode,
  detectE2ECapability,
  detectProjectProfile
};
