/**
 * Phase Learn — PHASE 6: 知识沉淀
 *
 * 负责记忆提取、Auto Dream、KnowledgeSteward、Git 模式分析、
 * 架构变更检测、DELETION_LOG 生成、RepoIndexer 搜索
 */

import { FLOW_EVENTS } from '../flow/flow-engine.js';
import { twoTurnExtract, AutoDreamScheduler } from '../memory/auto-dream.js';
import { CanonicalRouter } from '../router/canonical-router.js';
import { KnowledgeSteward } from '../knowledge/knowledge-steward.js';
import { RepoIndexer } from '../indexer/repo-indexer.js';
import { updatePhaseContext } from './phase-context.js';
import { logger } from '../logger.js';
import fs from 'fs-extra';
import path from 'node:path';

export class PhaseLearn {
  /**
   * @param {Object} deps
   * @param {import('../memory/memory-manager.js').MemoryManager} deps.memory
   * @param {import('../budget/token-budget.js').TokenBudgetManager} deps.tokenBudget
   * @param {import('../flow/flow-engine.js').FlowEngine} deps.flowEngine
   * @param {string} deps.projectDir
   */
  constructor({ memory, tokenBudget, flowEngine, projectDir }) {
    this.memory = memory;
    this.tokenBudget = tokenBudget;
    this.flowEngine = flowEngine;
    this.projectDir = projectDir;

    // 懒初始化
    this._canonicalRouter = null;
    this._knowledgeSteward = null;
    this._repoIndexer = null;

    // 自动记忆整理调度器
    this._dreamScheduler = new AutoDreamScheduler();

    // 消息累加器引用（由 Orchestrator 注入）
    this.messageAccumulator = null;
  }

  /**
   * 设置消息累加器引用
   * @param {Object[]} accumulator
   */
  setMessageAccumulator(accumulator) {
    this.messageAccumulator = accumulator;
  }

  /**
   * 执行 PHASE 6: LEARN
   * @param {Object} phaseContext - 当前阶段上下文
   * @returns {Promise<Object>} 更新后的 phaseContext
   */
  async run(phaseContext) {
    logger.info('[PHASE 6] LEARN - 知识沉淀');

    let ctx = updatePhaseContext(phaseContext, { currentPhase: 6 });

    if (!this.tokenBudget.canAfford('learn', 2000)) {
      logger.warn('[PHASE 6] Token 预算不足，跳过知识沉淀');
      return ctx;
    }

    // 两轮记忆提取
    try {
      const extractResult = await twoTurnExtract(this.memory, this.messageAccumulator || []);
      logger.info(
        `[PHASE 6] 记忆提取: ${extractResult.turn2Writes} 条写入, ${extractResult.extracted.length} 条提取`
      );
    } catch (extractError) {
      logger.warn(`[PHASE 6] 记忆提取失败: ${extractError.message}`);
    }

    // Auto Dream 自动记忆整理
    try {
      this._dreamScheduler.incrementSession();
      const dreamResult = await this._dreamScheduler.run(this.memory);
      if (dreamResult.executed) {
        logger.info(
          `[PHASE 6] AutoDream: ${dreamResult.reason}, 合并=${dreamResult.stats.merged}, 晋升=${dreamResult.stats.promoted}, 清理=${dreamResult.stats.pruned}`
        );
      } else {
        logger.debug(`[PHASE 6] AutoDream 跳过: ${dreamResult.reason}`);
      }
    } catch (dreamError) {
      logger.warn(`[PHASE 6] AutoDream 失败: ${dreamError.message}`);
    }

    // P4-2: 低质量知识清理 — 基于反馈回路淘汰无效经验
    try {
      if (!this._knowledgeSteward) {
        this._knowledgeSteward = new KnowledgeSteward(this.projectDir);
      }
      const lowQuality = await this._knowledgeSteward.getLowQualityEntries(0.3, 3);
      if (lowQuality.length > 0) {
        logger.info(
          `[PHASE 6] 低质量知识检测: ${lowQuality.length} 条 (分数: ${lowQuality.map((e) => `${e.key}=${e.score.toFixed(2)}`).join(', ')})`
        );
        // P1-5 fix: 实际执行清理，不再只记录
        const cleanedCount = await this._knowledgeSteward.cleanupLowQuality(lowQuality);
        if (cleanedCount > 0) {
          logger.info(`[PHASE 6] 已清理 ${cleanedCount} 条低质量知识`);
        }
        await this.memory.set('low_quality_knowledge', lowQuality, {
          tier: 'session',
          tags: ['quality', 'feedback', 'cleanup']
        });
      }
    } catch (qualityError) {
      logger.debug(`[PHASE 6] 知识质量检测跳过: ${qualityError.message}`);
    }

    // KnowledgeSteward: 将执行经验持久化到 .auto/insights/
    try {
      if (!this._knowledgeSteward) {
        this._knowledgeSteward = new KnowledgeSteward(this.projectDir);
      }
      const insightSummary = [
        `任务: ${ctx.task}`,
        `模式: ${ctx.mode}`,
        `完成: ${ctx.completedQuests.length} 关, 失败: ${ctx.failedQuests.length} 关`,
        `变更文件: ${ctx.changedFiles.length} 个`
      ].join('\n');

      await this._knowledgeSteward.save({
        content: insightSummary,
        category: 'pattern',
        tags: ['auto-workflow', 'experience']
      });
      logger.info('[PHASE 6] KnowledgeSteward: 经验已持久化');
    } catch (stewardError) {
      logger.warn(`[PHASE 6] KnowledgeSteward 失败: ${stewardError.message}`);
    }

    // 存储执行经验到 project 层
    const insight = {
      task: ctx.task,
      mode: ctx.mode,
      completedQuests: ctx.completedQuests.length,
      failedQuests: ctx.failedQuests.length,
      totalFiles: ctx.changedFiles.length,
      modelRecommendations: ctx.modelRecommendations,
      timestamp: Date.now()
    };

    await this.memory.set(`insight_${Date.now()}`, insight, {
      tier: 'project',
      tags: ['experience', 'workflow']
    });

    // Git 历史模式分析
    try {
      const gitPatterns = await this._analyzeGitPatterns();
      if (
        gitPatterns &&
        (gitPatterns.commitConventions.length > 0 || gitPatterns.fileCochanges.length > 0)
      ) {
        await this.memory.set('git_patterns', gitPatterns, {
          tier: 'project',
          tags: ['git', 'patterns', 'learn']
        });
        logger.info(
          `[PHASE 6] Git 模式分析: ${gitPatterns.commitConventions.length} 提交约定, ${gitPatterns.fileCochanges.length} 文件联动`
        );
      }
    } catch (gitError) {
      logger.debug(`[PHASE 6] Git 模式分析跳过: ${gitError.message}`);
    }

    // P1-3/P1-6: 架构变更时自动触发 doc-updater
    // P1-2 修复: 不仅记录 invocation，还将调度信息写入待执行队列
    try {
      const isArchitectureChange = this._detectArchitectureChange(ctx.task);
      if (isArchitectureChange) {
        if (!this._canonicalRouter) {
          this._canonicalRouter = new CanonicalRouter();
          await this._canonicalRouter.initialize();
        }
        const docRouteResult = await this._canonicalRouter.route(
          'update documentation and code maps',
          { scope: 'on-demand' }
        );

        const docInvocation = Object.freeze({
          subagent_type: 'doc-updater',
          description: '更新文档和代码地图',
          prompt: `架构变更检测触发文档更新。\n\n变更文件:\n${ctx.changedFiles.map((f) => `- ${f}`).join('\n')}\n\n请:\n1. 更新 REPO_MAP.md 中的相关模块描述\n2. 生成/更新 docs/CODEMAPS/ 下对应的代码地图\n3. 更新 README.md 中过时的描述\n4. 验证所有链接有效`,
          model: 'sonnet',
          trigger: 'architecture-change'
        });

        await this.memory.set(
          'doc_update_invocation',
          {
            invocation: docInvocation,
            agent: docRouteResult.agent.name,
            changedFiles: [...ctx.changedFiles],
            timestamp: Date.now()
          },
          { tier: 'session', tags: ['doc-updater', 'invocation'] }
        );

        // P1-2: 将调度信息写入 .auto/pending-invocations.json 供下次 /auto 消费
        await this._persistPendingInvocation(docInvocation);

        logger.info(
          `[PHASE 6] 架构变更: doc-updater 执行指令已生成 (→ ${docRouteResult.agent.name})`
        );
      }
    } catch (docError) {
      logger.debug(`[PHASE 6] doc-updater 触发跳过: ${docError.message}`);
    }

    // P1-4/P1-6: refactor-cleaner — 生成死代码清理指令
    // P1-2 修复: 不仅记录 invocation，还将调度信息写入待执行队列
    try {
      const deletionLog = await this._generateDeletionLog();
      if (deletionLog.entries.length > 0) {
        const logDir = path.join(this.projectDir, 'docs');
        await fs.ensureDir(logDir);
        await fs.writeJson(path.join(logDir, 'DELETION_LOG.json'), deletionLog, { spaces: 2 });
        logger.info(`[PHASE 6] DELETION_LOG: ${deletionLog.entries.length} 条记录已持久化`);

        const refactorInvocation = Object.freeze({
          subagent_type: 'refactor-cleaner',
          description: '死代码清理',
          prompt: `检测到 ${deletionLog.entries.length} 个可清理项。请:\n1. 运行 npx knip 检测未使用的导出\n2. 运行 npx depcheck 检测未使用的依赖\n3. 按风险分类（安全/谨慎/危险）\n4. 只移除"安全"级别的项目\n5. 记录到 docs/DELETION_LOG.md`,
          model: 'sonnet',
          trigger: 'deletion-log-detected'
        });
        await this.memory.set(
          'refactor_invocation',
          {
            invocation: refactorInvocation,
            entries: deletionLog.entries.length,
            timestamp: Date.now()
          },
          { tier: 'session', tags: ['refactor-cleaner', 'invocation'] }
        );

        // P1-2: 将调度信息写入 .auto/pending-invocations.json 供下次 /auto 消费
        await this._persistPendingInvocation(refactorInvocation);
      }
    } catch (logError) {
      logger.debug(`[PHASE 6] DELETION_LOG 生成跳过: ${logError.message}`);
    }

    // 重置 FlowEngine
    this.flowEngine.transition(FLOW_EVENTS.RESET);

    this.tokenBudget.consume('learn', 1000, 'PHASE 6 知识沉淀');

    ctx = updatePhaseContext(ctx, {
      insights: [...ctx.insights, insight]
    });

    return ctx;
  }

  /**
   * 分析 Git 历史模式（/learn --git 轻量版）
   * @param {number} [commitCount=50]
   * @returns {Promise<Object|null>}
   * @private
   */
  async _analyzeGitPatterns(commitCount = 50) {
    try {
      const { execSync } = await import('node:child_process');

      const logOutput = execSync(`git log --oneline -n ${commitCount} --pretty=format:"%s"`, {
        cwd: this.projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000
      }).toString();

      const messages = logOutput.split('\n').filter(Boolean);
      if (messages.length < 3) return null;

      // 检测提交约定
      const commitConventions = [];
      const conventionPatterns = [
        {
          pattern: /^(feat|fix|refactor|docs|test|chore|perf|ci|build|style)(\(.+\))?:/,
          name: 'conventional-commits'
        },
        { pattern: /^(Merge|Revert)\s/, name: 'merge-revert' }
      ];

      const conventionCounts = {};
      for (const msg of messages) {
        for (const { pattern, name } of conventionPatterns) {
          if (pattern.test(msg)) {
            conventionCounts[name] = (conventionCounts[name] || 0) + 1;
          }
        }
      }

      for (const [name, count] of Object.entries(conventionCounts)) {
        const ratio = count / messages.length;
        if (ratio >= 0.3) {
          commitConventions.push({ name, ratio: Math.round(ratio * 100), sampleCount: count });
        }
      }

      // 获取文件变更频率
      const nameOnlyOutput = execSync(
        `git log --oneline -n ${commitCount} --name-only --pretty=format:""`,
        { cwd: this.projectDir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }
      ).toString();

      const fileChanges = {};
      const fileCochanges = [];
      const lines = nameOnlyOutput.split('\n').filter(Boolean);

      for (const line of lines) {
        const file = line.trim();
        if (!file || file.startsWith('Merge')) continue;
        fileChanges[file] = (fileChanges[file] || 0) + 1;
      }

      // 检测文件联动
      const commits = nameOnlyOutput.split('\n\n').filter(Boolean);
      for (const commit of commits) {
        const files = commit.split('\n').filter((f) => f.trim() && !f.startsWith('Merge'));
        if (files.length >= 2 && files.length <= 10) {
          for (let i = 0; i < files.length - 1; i++) {
            for (let j = i + 1; j < files.length; j++) {
              const pair = [files[i].trim(), files[j].trim()].sort().join(' <-> ');
              const existing = fileCochanges.find((fc) => fc.pair === pair);
              if (existing) {
                existing.count++;
              } else if (fileCochanges.length < 20) {
                fileCochanges.push({ pair, count: 1 });
              }
            }
          }
        }
      }

      const significantCochanges = fileCochanges
        .filter((fc) => fc.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const hotFiles = Object.entries(fileChanges)
        .filter(([, count]) => count >= 3)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([file, count]) => ({ file, changes: count }));

      return Object.freeze({
        analyzedCommits: messages.length,
        commitConventions: Object.freeze(commitConventions),
        fileCochanges: Object.freeze(significantCochanges),
        hotFiles: Object.freeze(hotFiles),
        analyzedAt: Date.now()
      });
    } catch {
      return null;
    }
  }

  /**
   * 检测是否涉及架构变更
   * @param {string} task - 任务描述
   * @returns {boolean}
   * @private
   */
  _detectArchitectureChange(task) {
    const taskLower = (task || '').toLowerCase();
    const architectureKeywords = [
      // 架构级变更
      '架构',
      'architecture',
      '重构',
      'refactor',
      '迁移',
      'migrate',
      '系统',
      'system',
      '模块',
      'module',
      '接口',
      'interface',
      '新增模块',
      '删除模块',
      '合并',
      '拆分',
      '整合',
      // 功能级变更（影响文档/CODEMAPS）
      '新增功能',
      'add feature',
      '实现功能',
      '删除功能',
      'deprecate',
      'endpoint',
      '更新文档',
      'update readme',
      '更新readme',
      'changelog',
      'update codemaps',
      '更新代码地图'
    ];
    return architectureKeywords.some((kw) => taskLower.includes(kw));
  }

  /**
   * 生成 DELETION_LOG（P1-4: refactor-cleaner 日志持久化）
   * @returns {Promise<{entries: Object[], generatedAt: string}>}
   * @private
   */
  async _generateDeletionLog() {
    const entries = [];

    try {
      const deletionEntries = await this.memory.search('deletion remove delete removed clean');
      for (const entry of deletionEntries.slice(0, 20)) {
        if (entry.value?.tags?.includes('deletion') || entry.value?.tags?.includes('cleanup')) {
          entries.push({
            key: entry.key,
            reason: entry.value?.reason || 'auto-cleanup',
            timestamp: entry.value?.timestamp || Date.now()
          });
        }
      }
    } catch {
      // 搜索失败返回空日志
    }

    return Object.freeze({
      entries: Object.freeze(entries),
      generatedAt: new Date().toISOString()
    });
  }

  /**
   * P1-2: 将待执行的 Agent 调度写入持久化队列
   * 写入 .auto/pending-invocations.json，供下次 /auto 消费
   * @param {Object} invocation - Agent 调度描述
   * @private
   */
  async _persistPendingInvocation(invocation) {
    try {
      const queueDir = path.join(this.projectDir, '.auto');
      await fs.ensureDir(queueDir);
      const queuePath = path.join(queueDir, 'pending-invocations.json');

      let queue = [];
      try {
        queue = await fs.readJson(queuePath);
      } catch {
        queue = [];
      }

      const now = Date.now();
      const normalizedInvocation = {
        ...invocation,
        id: invocation.id || `${invocation.subagent_type || 'invocation'}-${now}`,
        enqueuedAt: invocation.enqueuedAt || now,
        status: 'pending',
        attempts: Number.isFinite(invocation.attempts) ? invocation.attempts : 0,
        lastError: invocation.lastError || null
      };

      const duplicateIndex = queue.findIndex((item) => {
        if (item.id && item.id === normalizedInvocation.id) {
          return true;
        }

        return (
          (item.subagent_type || item.type) === normalizedInvocation.subagent_type &&
          item.description === normalizedInvocation.description &&
          item.prompt === normalizedInvocation.prompt &&
          (item.trigger || null) === (normalizedInvocation.trigger || null)
        );
      });

      if (duplicateIndex === -1) {
        queue.push(normalizedInvocation);
      } else {
        const existing = queue[duplicateIndex];
        queue[duplicateIndex] = {
          ...existing,
          ...normalizedInvocation,
          id: existing.id || normalizedInvocation.id,
          enqueuedAt: existing.enqueuedAt || normalizedInvocation.enqueuedAt,
          status: 'pending',
          attempts: 0,
          lastError: null,
          updatedAt: now
        };
      }

      // 保留最近 20 条
      if (queue.length > 20) {
        queue = queue.slice(-20);
      }

      await fs.writeJson(queuePath, queue, { spaces: 2 });
      logger.info(`[PHASE 6] 待执行调度已入队: ${invocation.subagent_type} → ${queuePath}`);
    } catch (persistError) {
      logger.debug(`[PHASE 6] 调度队列持久化跳过: ${persistError.message}`);
    }
  }

  /**
   * 使用 RepoIndexer 搜索符号（P2-3）
   * @param {string} query - 搜索查询
   * @returns {Promise<Object[]>} 符号搜索结果
   */
  async searchRepoIndex(query) {
    try {
      if (!this._repoIndexer) {
        this._repoIndexer = new RepoIndexer(this.projectDir);
        await this._repoIndexer.buildIndex();
      }
      return this._repoIndexer.search(query);
    } catch (indexError) {
      logger.debug(`RepoIndexer 搜索失败: ${indexError.message}`);
      return [];
    }
  }
}
