/**
 * ContextBudgetManager 模块单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextBudgetManager } from '../src/context/context-budget.js';

describe('ContextBudgetManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ContextBudgetManager({ maxTokens: 1000 });
  });

  describe('基础功能', () => {
    it('应该处理空输入', () => {
      const result = manager.allocate([]);

      expect(result.sections).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.utilization).toBe(0);
    });

    it('应该处理 null 输入', () => {
      const result = manager.allocate(null);

      expect(result.sections).toHaveLength(0);
    });

    it('应该在预算内保留所有段落', () => {
      // 每段约 25 tokens (100 chars / 4)
      const sections = [
        { type: 'claude-md', content: 'A'.repeat(100), required: true },
        { type: 'insights', content: 'B'.repeat(100), required: false }
      ];

      const result = manager.allocate(sections);

      expect(result.sections).toHaveLength(2);
      expect(result.trimmed).toHaveLength(0);
    });

    it('应该在预算不足时裁剪低优先级段落', () => {
      // 总计约 1500 tokens，预算只有 1000
      const sections = [
        { type: 'claude-md', content: 'A'.repeat(1000), required: true }, // 250 tokens
        { type: 'insights', content: 'B'.repeat(2000), required: false }, // 500 tokens
        { type: 'file', content: 'C'.repeat(2000), required: false } // 500 tokens
      ];

      const result = manager.allocate(sections);

      // required 的 claude-md 必须保留，insights 优先级高于 file
      expect(result.sections.some((s) => s.type === 'claude-md')).toBe(true);
      expect(result.trimmed.length).toBeGreaterThan(0);
    });

    it('应该优先保留 required=true 的段落', () => {
      const sections = [
        { type: 'insights', content: 'X'.repeat(3000), required: false }, // 750 tokens
        { type: 'claude-md', content: 'Y'.repeat(2000), required: true } // 500 tokens
      ];

      const result = manager.allocate(sections);

      // claude-md 是 required，必须保留
      const claudeMdSection = result.sections.find((s) => s.type === 'claude-md');
      expect(claudeMdSection).toBeDefined();
    });
  });

  describe('截断逻辑', () => {
    it('应该在单个必需段落超预算时截断内容', () => {
      const smallBudget = new ContextBudgetManager({ maxTokens: 50 });
      const sections = [{ type: 'claude-md', content: 'A'.repeat(1000), required: true }];

      const result = smallBudget.allocate(sections);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].content).toContain('truncated');
      expect(result.trimmed).toHaveLength(1);
      expect(result.trimmed[0].reason).toBe('budget_exceeded_truncated');
    });

    it('应该在预算极度不足时丢弃段落', () => {
      const tinyBudget = new ContextBudgetManager({ maxTokens: 10 });
      const sections = [
        { type: 'claude-md', content: 'A'.repeat(1000), required: true },
        { type: 'insights', content: 'B'.repeat(1000), required: true }
      ];

      const result = tinyBudget.allocate(sections);

      // 第二个 required 段落应该被丢弃（10 tokens 放不下任何有意义的内容）
      expect(result.trimmed.length).toBeGreaterThan(0);
    });
  });

  describe('利用率', () => {
    it('应该正确计算利用率', () => {
      const sections = [{ type: 'claude-md', content: 'A'.repeat(400), required: true }]; // 100 tokens

      const result = manager.allocate(sections);

      expect(result.utilization).toBeGreaterThan(0);
      expect(result.utilization).toBeLessThanOrEqual(1);
      expect(result.budgetTokens).toBe(1000);
    });
  });

  describe('fromPreset', () => {
    it('应该从预设创建配置', () => {
      const preset = {
        maxTokenEstimate: 2500
      };

      const config = ContextBudgetManager.fromPreset(preset);

      expect(config.maxTokens).toBe(2500);
      expect(config.typePriorities).toBeDefined();
      expect(config.typePriorities['claude-md']).toBe(100);
    });

    it('应该对无预设使用默认预算', () => {
      const config = ContextBudgetManager.fromPreset({});

      expect(config.maxTokens).toBe(4000);
    });
  });

  describe('getReport', () => {
    it('应该生成文本报告', () => {
      const sections = [{ type: 'claude-md', content: 'A'.repeat(100), required: true }];

      const result = manager.allocate(sections);
      const report = manager.getReport(result);

      expect(report).toContain('上下文预算报告');
      expect(report).toContain('tokens');
      expect(report).toContain('保留段落');
    });
  });
});
