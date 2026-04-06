/**
 * Phase Verify — PHASE 4: 门禁验证
 *
 * 负责测试运行器检测、测试执行、覆盖率解析、安全扫描路由
 */

import { FLOW_EVENTS } from '../flow/flow-engine.js';
import { CONTEXT_STATUS } from '../budget/context-monitor.js';
import { CanonicalRouter } from '../router/canonical-router.js';
import { compactTrace } from '../utils/trace-compactor.js';
import { updatePhaseContext, EXECUTION_MODES, detectE2ECapability } from './phase-context.js';
import { KnowledgeSteward } from '../knowledge/knowledge-steward.js';
import { logger } from '../logger.js';
import fs from 'fs-extra';
import path from 'node:path';

export class PhaseVerify {
  /**
   * @param {Object} deps
   * @param {import('../memory/memory-manager.js').MemoryManager} deps.memory
   * @param {import('../budget/token-budget.js').TokenBudgetManager} deps.tokenBudget
   * @param {import('../budget/context-monitor.js').ContextMonitor} deps.contextMonitor
   * @param {import('../flow/flow-engine.js').FlowEngine} deps.flowEngine
   * @param {string} deps.projectDir
   * @param {import('../skills/skill-indexer.js').SkillIndexer} [deps.skillIndexer]
   */
  constructor({ memory, tokenBudget, contextMonitor, flowEngine, projectDir, skillIndexer }) {
    this.memory = memory;
    this.tokenBudget = tokenBudget;
    this.contextMonitor = contextMonitor;
    this.flowEngine = flowEngine;
    this.projectDir = projectDir;
    this.skillIndexer = skillIndexer;

    // 懒初始化
    this._canonicalRouter = null;
  }

  /**
   * 执行 PHASE 4: VERIFY
   * @param {Object} phaseContext - 当前阶段上下文
   * @returns {Promise<Object>} 更新后的 phaseContext
   */
  async run(phaseContext) {
    logger.info('[PHASE 4] VERIFY - 门禁验证');

    let ctx = updatePhaseContext(phaseContext, { currentPhase: 4 });

    if (!this.tokenBudget.canAfford('verify', 8000)) {
      throw new Error('Token 预算不足，无法执行 PHASE 4');
    }

    const allFailedQuests = [
      ...(ctx.failedQuests || []),
      ...((ctx.pendingExecution && ctx.pendingExecution.failedQuests) || [])
    ];

    // 验证失败场景处理 — 自动路由到 build-error-resolver
    const verificationActions = [];
    if (allFailedQuests.length > 0) {
      for (const failed of allFailedQuests) {
        const compacted = compactTrace(new Error(failed.error));
        logger.error(`[PHASE 4] Quest ${failed.questId} 验证失败: ${compacted.compacted}`);

        try {
          if (!this._canonicalRouter) {
            this._canonicalRouter = new CanonicalRouter();
            await this._canonicalRouter.initialize();
          }
          const routeResult = await this._canonicalRouter.route(
            `build error: ${compacted.compacted}`,
            { scope: 'on-demand', flags: { failedQuest: true } }
          );
          verificationActions.push({
            questId: failed.questId,
            agentName: routeResult.agent.name,
            score: routeResult.score,
            matchReason: routeResult.matchReason
          });
          logger.info(`[PHASE 4] Quest ${failed.questId} 路由到 ${routeResult.agent.name}`);
        } catch (routeError) {
          logger.warn(`[PHASE 4] 路由失败，使用默认: ${routeError.message}`);
          verificationActions.push({
            questId: failed.questId,
            agentName: 'build-error-resolver',
            score: 0,
            matchReason: 'fallback'
          });
        }
      }
    }

    ctx = updatePhaseContext(ctx, {
      verificationActions: Object.freeze(verificationActions)
    });

    const mode = ctx.mode || EXECUTION_MODES.FULL;
    const isFullMode = mode === EXECUTION_MODES.FULL;

    // 测试运行器检测和执行
    let testResult = null;
    let coverageResult = null;
    let securityResult = null;
    const testRunner = await this._detectTestRunner();
    if (testRunner) {
      logger.info(`[PHASE 4] 检测到测试运行器: ${testRunner.command}`);

      // 所有模式都运行覆盖率（light/micro 只用于信息展示，不阻断）
      testResult = await this._runTests(testRunner, true);
      if (!testResult.passed) {
        logger.error(`[PHASE 4] 测试失败 (exit ${testResult.exitCode})`);
      } else {
        logger.info('[PHASE 4] 测试通过');
      }

      if (testResult.coverage) {
        coverageResult = testResult.coverage;
        if (coverageResult.passing) {
          logger.info(`[PHASE 4] 覆盖率达标: ${coverageResult.overall}%`);
        } else if (isFullMode) {
          // P1-1: FULL 模式下覆盖率门禁强制执行
          logger.error(`[PHASE 4] 覆盖率门禁失败: ${coverageResult.overall}% < 80% (完整模式要求)`);
          ctx = updatePhaseContext(ctx, {
            gateFailed: true,
            gateReason: `覆盖率 ${coverageResult.overall}% < 80%`
          });
        } else {
          logger.info(`[PHASE 4] 覆盖率: ${coverageResult.overall}% (非阻断，信息记录)`);
        }
      }
    } else {
      logger.debug('[PHASE 4] 未检测到测试运行器，跳过测试');
    }

    // 安全扫描路由（仅完整模式）
    if (isFullMode) {
      securityResult = await this._runSecurityScan();
      if (securityResult.scanTriggered) {
        logger.info(`[PHASE 4] 安全扫描已路由到 ${securityResult.agentName}`);
      }

      // P1-5: 对抗性验证路由
      try {
        if (this._canonicalRouter) {
          const verifyRoute = await this._canonicalRouter.route(
            'adversarial verification boundary test edge-case',
            { scope: 'on-demand' }
          );
          if (verifyRoute.agent.name === 'verification') {
            logger.info(
              `[PHASE 4] 对抗性验证已路由到 verification agent (score=${verifyRoute.score})`
            );
          }
        }
      } catch (verifyError) {
        logger.debug(`[PHASE 4] 验证路由跳过: ${verifyError.message}`);
      }

      // P1-5: E2E 测试检测
      if (this._detectE2ECapability()) {
        try {
          if (this._canonicalRouter) {
            const e2eRoute = await this._canonicalRouter.route(
              'end-to-end playwright browser test',
              { scope: 'on-demand' }
            );
            logger.info(
              `[PHASE 4] E2E 测试已路由到 ${e2eRoute.agent.name} (score=${e2eRoute.score})`
            );
          }
        } catch (e2eError) {
          logger.debug(`[PHASE 4] E2E 路由跳过: ${e2eError.message}`);
        }
      }
    }

    // 检查上下文窗口
    const contextStatus = this.contextMonitor.getStatus();
    if (contextStatus === CONTEXT_STATUS.OVERFLOW) {
      logger.error('[PHASE 4] 上下文窗口溢出');
    }

    this.flowEngine.transition(FLOW_EVENTS.REVIEW_DONE);

    this.tokenBudget.consume('verify', 5000, 'PHASE 4 验证');
    this.contextMonitor.record(6000, 'PHASE 4');

    ctx = updatePhaseContext(ctx, {
      contextStatus,
      testResult,
      coverageResult,
      securityResult
    });

    // P2-2: 验证结果持久化到 MemoryManager
    try {
      await this.memory.set(
        'last_verification',
        {
          testPassed: testResult?.passed ?? null,
          coverageOverall: coverageResult?.overall ?? null,
          securityScanTriggered: securityResult?.scanTriggered ?? false,
          failedQuests: [...allFailedQuests].map((f) => f.questId),
          timestamp: Date.now()
        },
        { tier: 'session', tags: ['verification', 'results'] }
      );
    } catch (persistError) {
      logger.debug(`验证结果持久化失败: ${persistError.message}`);
    }

    // P4-1: 知识反馈回路 — 记录 Skill/Insight 使用效果
    try {
      const steward = new KnowledgeSteward(this.projectDir);
      const questSuccess = !ctx.failedQuests || ctx.failedQuests.length === 0;

      // 记录 Skill 使用反馈
      if (ctx.matchedSkills) {
        for (const skill of ctx.matchedSkills) {
          const skillName = skill.name || skill;
          await steward.recordFeedback({
            source: 'skill',
            key: skillName,
            successful: questSuccess
          });
          // 同步到 SkillIndexer 的质量评分
          if (this.skillIndexer) {
            this.skillIndexer.recordSuccess(skillName, questSuccess);
          }
        }
      }

      // 记录 Insight 使用反馈（通过 questMap 中的 insightContents 追溯）
      if (ctx.questMap) {
        for (const quest of ctx.questMap) {
          if (quest.insightContents) {
            for (const insight of quest.insightContents) {
              await steward.recordFeedback({
                source: 'insight',
                key: insight.category,
                successful: questSuccess
              });
            }
          }
        }
      }
    } catch (feedbackError) {
      logger.debug(`[PHASE 4] 知识反馈记录跳过: ${feedbackError.message}`);
    }

    return ctx;
  }

  /**
   * 检测测试运行器
   * @returns {Promise<{command: string, runner: string}|null>}
   * @private
   */
  async _detectTestRunner() {
    try {
      const pkgPath = path.join(this.projectDir, 'package.json');
      if (!(await fs.pathExists(pkgPath))) return null;
      const pkg = await fs.readJson(pkgPath);
      const testScript = pkg.scripts?.test;
      if (!testScript || testScript === 'echo "Error: no test specified" && exit 1') return null;
      return { command: testScript, runner: 'npm' };
    } catch {
      return null;
    }
  }

  /**
   * 执行测试（带覆盖率）
   * @param {Object} _testRunner
   * @param {boolean} [withCoverage=false]
   * @returns {Promise<{passed: boolean, output: string, exitCode?: number, coverage?: Object}>}
   * @private
   */
  async _runTests(_testRunner, withCoverage = false) {
    try {
      const { execSync } = await import('node:child_process');
      const command = withCoverage ? 'npm test -- --coverage 2>&1' : 'npm test 2>&1';
      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: this.projectDir,
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = { passed: true, output: output.slice(-2000) };

      if (withCoverage) {
        result.coverage = this._parseCoverageOutput(output);
      }

      return Object.freeze(result);
    } catch (error) {
      const combinedOutput = ((error.stdout || '') + (error.stderr || '')).slice(-2000);
      const result = {
        passed: false,
        output: combinedOutput,
        exitCode: error.status ?? 1
      };

      if (withCoverage) {
        result.coverage = this._parseCoverageOutput(combinedOutput);
      }

      return Object.freeze(result);
    }
  }

  /**
   * 解析测试覆盖率输出
   * 支持 Vitest、Jest、nyc/c8 格式
   * @param {string} output - 测试输出
   * @returns {Object} 覆盖率数据
   * @private
   */
  _parseCoverageOutput(output) {
    const coverage = { lines: 0, branches: 0, functions: 0, statements: 0, passing: false };

    const summaryLine = output.match(
      /All files[|\s]+(\d+(?:\.\d+)?)\s*[|]\s*(\d+(?:\.\d+)?)\s*[|]\s*(\d+(?:\.\d+)?)\s*[|]\s*(\d+(?:\.\d+)?)/
    );
    if (summaryLine) {
      coverage.statements = parseFloat(summaryLine[1]);
      coverage.branches = parseFloat(summaryLine[2]);
      coverage.functions = parseFloat(summaryLine[3]);
      coverage.lines = parseFloat(summaryLine[4]);
    } else {
      const statements = output.match(/Statements\s*:\s*(\d+(?:\.\d+)?)%/);
      const branches = output.match(/Branches\s*:\s*(\d+(?:\.\d+)?)%/);
      const functions = output.match(/Functions\s*:\s*(\d+(?:\.\d+)?)%/);
      const lines = output.match(/Lines\s*:\s*(\d+(?:\.\d+)?)%/);

      if (statements) coverage.statements = parseFloat(statements[1]);
      if (branches) coverage.branches = parseFloat(branches[1]);
      if (functions) coverage.functions = parseFloat(functions[1]);
      if (lines) coverage.lines = parseFloat(lines[1]);
    }

    const all = [coverage.statements, coverage.branches, coverage.functions, coverage.lines].filter(
      (v) => v > 0
    );
    coverage.overall = all.length > 0 ? Math.min(...all) : 0;
    coverage.passing = coverage.overall >= 80;

    return Object.freeze(coverage);
  }

  /**
   * 运行安全扫描（通过路由到 security-reviewer）
   * @returns {Promise<Object>}
   * @private
   */
  async _runSecurityScan() {
    try {
      if (!this._canonicalRouter) {
        this._canonicalRouter = new CanonicalRouter();
        await this._canonicalRouter.initialize();
      }

      const routeResult = await this._canonicalRouter.route('security scan audit review', {
        scope: 'on-demand',
        flags: { securityReview: true }
      });

      const securityResult = {
        agentName: routeResult.agent.name,
        score: routeResult.score,
        matchReason: routeResult.matchReason,
        scanTriggered: true
      };

      logger.info(
        `[PHASE 4] 安全扫描路由到: ${routeResult.agent.name} (score=${routeResult.score})`
      );

      return Object.freeze(securityResult);
    } catch (error) {
      logger.warn(`[PHASE 4] 安全扫描路由失败: ${error.message}`);
      return Object.freeze({
        agentName: 'security-reviewer',
        score: 0,
        matchReason: 'fallback',
        scanTriggered: false,
        error: error.message
      });
    }
  }

  /**
   * 检测项目是否具备 E2E 测试能力（委托给共享函数）
   * @returns {boolean}
   * @private
   */
  _detectE2ECapability() {
    return detectE2ECapability(this.projectDir);
  }
}
