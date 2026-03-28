/**
 * RuleEngine 类单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RuleEngine } from '../src/governance/rule-engine.js';
import { RULE_ACTIONS, RULE_PRIORITIES } from '../src/governance/rule-types.js';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

// Mock logger
vi.mock('../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('RuleEngine', () => {
  let engine;
  let testDir;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), `auto-cli-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    // Mock 目录路径
    engine = new RuleEngine();
    engine.rulesIndexFile = path.join(testDir, 'rules-index.json');
  });

  afterEach(async () => {
    // 清理测试目录
    if (testDir) {
      await fs.remove(testDir);
    }
  });

  describe('loadRules', () => {
    it('应该加载默认规则', async () => {
      const rules = await engine.loadRules();

      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('name');
      expect(rules[0]).toHaveProperty('action');
    });

    it('应该按优先级排序规则', async () => {
      await engine.loadRules();

      // 检查是否按优先级降序排列
      for (let i = 0; i < engine.rules.length - 1; i++) {
        expect(engine.rules[i].priority).toBeGreaterThanOrEqual(engine.rules[i + 1].priority);
      }
    });

    it('应该包含默认的防止强制推送规则', async () => {
      await engine.loadRules();

      const rule = engine.rules.find((r) => r.name === 'prevent-force-push');
      expect(rule).toBeDefined();
      expect(rule.action).toBe(RULE_ACTIONS.BLOCK);
      expect(rule.critical).toBe(true);
    });

    it('应该包含安全审查规则', async () => {
      await engine.loadRules();

      const rule = engine.rules.find((r) => r.name === 'require-security-review');
      expect(rule).toBeDefined();
      expect(rule.action).toBe(RULE_ACTIONS.REQUIRE);
      expect(rule.trigger).toContain('auth');
    });
  });

  describe('validate', () => {
    beforeEach(async () => {
      await engine.loadRules();
    });

    it('应该阻止强制推送操作', async () => {
      const result = await engine.validate('push', {
        message: 'force push to main',
        scope: 'pre-commit'
      });

      expect(result.passed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.rule).toBe('prevent-force-push');
    });

    it('应该要求安全相关代码进行审查', async () => {
      const result = await engine.validate('edit', {
        message: 'implement auth',
        files: ['src/auth/login.js'],
        scope: 'edit'
      });

      expect(result.passed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.rule).toBe('require-security-review');
    });

    it('应该警告但允许继续', async () => {
      const result = await engine.validate('commit', {
        message: 'save changes',
        scope: 'pre-commit'
      });

      expect(result.passed).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('应该通过验证当没有触发规则时', async () => {
      const result = await engine.validate('harmless operation', {
        message: 'just reading',
        scope: 'on-demand'
      });

      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('应该检查前置条件', async () => {
      const result = await engine.validate('implement new feature', {
        message: 'new feature',
        scope: 'pre-commit',
        flags: {},
        executed: []
      });

      // 应该有未满足的 REQUIRE 规则
      const hasUnmetRequire = result.results.some(
        (r) => !r.passed && r.action === RULE_ACTIONS.REQUIRE
      );
      expect(hasUnmetRequire).toBe(true);
    });

    it('应该通过验证当满足前置条件时', async () => {
      const result = await engine.validate('implement new feature', {
        message: 'new feature',
        scope: 'pre-commit',
        flags: { 'tdd-guide': true },
        executed: ['tdd-guide']
      });

      // 应该有满足的前置条件
      const hasMetRequire = result.results.some(
        (r) => r.passed && r.action === RULE_ACTIONS.REQUIRE
      );
      expect(hasMetRequire).toBe(true);
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await engine.loadRules();
    });

    it('应该执行 BLOCK 动作', async () => {
      const result = await engine.execute('prevent-force-push', {});

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });

    it('应该执行 WARN 动作', async () => {
      const result = await engine.execute('code-review-before-commit', {});

      expect(result.success).toBe(true);
      expect(result.warned).toBe(true);
    });

    it('应该执行 RETRY 动作', async () => {
      // 添加一个 RETRY 规则
      await engine.addRule({
        name: 'retry-rule',
        description: '测试重试',
        trigger: ['test'],
        action: RULE_ACTIONS.RETRY,
        priority: 50,
        retryLimit: 3
      });

      const result = await engine.execute('retry-rule', {
        retryCount: 0
      });

      expect(result.success).toBe(true);
      expect(result.retried).toBe(true);
      expect(result.retryCount).toBe(1);
    });

    it('应该达到重试上限', async () => {
      // 添加 retry-rule（确保测试隔离）
      await engine.addRule({
        name: 'retry-rule',
        description: '测试重试',
        trigger: ['test'],
        action: RULE_ACTIONS.RETRY,
        priority: 50,
        retryLimit: 3
      });

      const result = await engine.execute('retry-rule', {
        retryCount: 3
      });

      expect(result.success).toBe(false);
      expect(result.retried).toBe(false);
    });

    it('应该执行 SKIP 动作', async () => {
      // 添加一个 SKIP 规则
      await engine.addRule({
        name: 'skip-rule',
        description: '测试跳过',
        trigger: ['test'],
        action: RULE_ACTIONS.SKIP,
        priority: 50
      });

      const result = await engine.execute('skip-rule', {});

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('应该执行 REQUIRE 动作', async () => {
      const result = await engine.execute('require-security-review', {});

      expect(result.success).toBe(false);
      expect(result.requires).toBeDefined();
    });

    it('应该返回错误对于不存在的规则', async () => {
      const result = await engine.execute('nonexistent-rule', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('规则不存在');
    });
  });

  describe('addRule', () => {
    it('应该添加自定义规则', async () => {
      const rule = {
        name: 'custom-rule',
        description: '自定义测试规则',
        trigger: ['test', 'custom'],
        action: RULE_ACTIONS.WARN,
        priority: 50
      };

      const success = await engine.addRule(rule);

      expect(success).toBe(true);
      expect(engine.rules.find((r) => r.name === 'custom-rule')).toBeDefined();
    });

    it('应该拒绝没有 name 的规则', async () => {
      const rule = {
        description: '无效规则',
        action: RULE_ACTIONS.WARN
      };

      const success = await engine.addRule(rule);

      expect(success).toBe(false);
    });

    it('应该拒绝没有 action 的规则', async () => {
      const rule = {
        name: 'invalid-rule',
        description: '无效规则'
      };

      const success = await engine.addRule(rule);

      expect(success).toBe(false);
    });

    it('应该按优先级排序新规则', async () => {
      await engine.addRule({
        name: 'low-priority',
        description: '低优先级',
        action: RULE_ACTIONS.WARN,
        priority: 10
      });

      await engine.addRule({
        name: 'high-priority',
        description: '高优先级',
        action: RULE_ACTIONS.WARN,
        priority: 90
      });

      const highIndex = engine.rules.findIndex((r) => r.name === 'high-priority');
      const lowIndex = engine.rules.findIndex((r) => r.name === 'low-priority');

      expect(highIndex).toBeLessThan(lowIndex);
    });
  });

  describe('removeRule', () => {
    it('应该删除自定义规则', async () => {
      await engine.addRule({
        name: 'to-remove',
        description: '将被删除',
        action: RULE_ACTIONS.WARN,
        priority: 50
      });

      const success = await engine.removeRule('to-remove');

      expect(success).toBe(true);
      expect(engine.rules.find((r) => r.name === 'to-remove')).toBeUndefined();
    });

    it('应该无法删除默认规则', async () => {
      // 确保默认规则已加载
      await engine.loadRules();

      const success = await engine.removeRule('prevent-force-push');

      expect(success).toBe(false);
      // 默认规则仍在列表中
      expect(engine.rules.find((r) => r.name === 'prevent-force-push')).toBeDefined();
    });

    it('应该返回 false 对于不存在的规则', async () => {
      const success = await engine.removeRule('nonexistent');

      expect(success).toBe(false);
    });
  });

  describe('listRules', () => {
    it('应该返回规则列表摘要', async () => {
      await engine.loadRules();
      const ruleList = engine.listRules();

      expect(Array.isArray(ruleList)).toBe(true);
      expect(ruleList.length).toBeGreaterThan(0);
      expect(ruleList[0]).toHaveProperty('name');
      expect(ruleList[0]).toHaveProperty('description');
      expect(ruleList[0]).toHaveProperty('priority');
      expect(ruleList[0]).toHaveProperty('action');
    });

    it('应该包含 critical 标志', async () => {
      await engine.loadRules();
      const ruleList = engine.listRules();

      const criticalRule = ruleList.find((r) => r.name === 'prevent-force-push');
      expect(criticalRule.critical).toBe(true);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      await engine.loadRules();
      const stats = engine.getStats();

      expect(stats.total).toBe(engine.rules.length);
      expect(stats.byAction).toBeDefined();
      expect(stats.byScope).toBeDefined();
      expect(stats.byPriority).toBeDefined();
      expect(stats.criticalCount).toBeGreaterThanOrEqual(0);
    });

    it('应该正确统计按动作分布', async () => {
      await engine.loadRules();
      const stats = engine.getStats();

      let totalByAction = 0;
      for (const count of Object.values(stats.byAction)) {
        totalByAction += count;
      }

      expect(totalByAction).toBe(stats.total);
    });

    it('应该正确统计按优先级分布', async () => {
      await engine.loadRules();
      const stats = engine.getStats();

      const sum =
        stats.byPriority.critical +
        stats.byPriority.high +
        stats.byPriority.medium +
        stats.byPriority.low +
        stats.byPriority.info;

      expect(sum).toBe(stats.total);
    });
  });

  describe('_extractKeywords', () => {
    it('应该从操作和上下文中提取关键词', async () => {
      await engine.loadRules();

      const keywords = engine._extractKeywords('push force', {
        message: 'to main branch',
        files: ['src/index.js']
      });

      expect(keywords).toContain('push');
      expect(keywords).toContain('force');
      expect(keywords).toContain('to');
      expect(keywords).toContain('main');
      expect(keywords).toContain('branch');
      expect(keywords).toContain('src/index.js');
    });
  });

  describe('_shouldTrigger', () => {
    it('应该根据触发关键词触发规则', async () => {
      await engine.loadRules();

      const rule = engine.rules.find((r) => r.name === 'prevent-force-push');
      const keywords = ['push', 'force'];

      const shouldTrigger = engine._shouldTrigger(rule, keywords, {});

      expect(shouldTrigger).toBe(true);
    });

    it('应该不触发当关键词不匹配时', async () => {
      await engine.loadRules();

      const rule = engine.rules.find((r) => r.name === 'prevent-force-push');
      const keywords = ['pull', 'request'];

      const shouldTrigger = engine._shouldTrigger(rule, keywords, {});

      expect(shouldTrigger).toBe(false);
    });

    it('应该检查额外条件', async () => {
      await engine.loadRules();

      const rule = {
        name: 'test-condition',
        trigger: ['test'],
        conditions: {
          files_include: ['src/']
        }
      };

      const shouldTrigger1 = engine._shouldTrigger(rule, ['test'], {
        files: ['src/index.js']
      });

      const shouldTrigger2 = engine._shouldTrigger(rule, ['test'], {
        files: ['docs/readme.md']
      });

      expect(shouldTrigger1).toBe(true);
      expect(shouldTrigger2).toBe(false);
    });
  });

  describe('_checkRequirement', () => {
    it('应该从 flags 中检查前置条件', async () => {
      await engine.loadRules();

      const hasFlag = engine._checkRequirement('tdd-guide', {
        flags: { 'tdd-guide': true }
      });

      expect(hasFlag).toBe(true);
    });

    it('应该从 executed 中检查前置条件', async () => {
      await engine.loadRules();

      const hasExecuted = engine._checkRequirement('security-review', {
        executed: ['security-review', 'code-reviewer']
      });

      expect(hasExecuted).toBe(true);
    });

    it('应该返回 false 当不满足前置条件时', async () => {
      await engine.loadRules();

      const notMet = engine._checkRequirement('architect', {
        flags: {},
        executed: []
      });

      expect(notMet).toBe(false);
    });
  });
});
