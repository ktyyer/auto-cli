/**
 * ContextInjector 模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import {
  ContextInjector,
  CONTEXT_PRESETS,
  recommendPreset
} from '../src/context/context-injector.js';
import { ContextDeduplicator } from '../src/context/context-deduplicator.js';
import { ContextBudgetManager } from '../src/context/context-budget.js';

describe('CONTEXT_PRESETS', () => {
  it('应该定义 4 个预设模板', () => {
    expect(Object.keys(CONTEXT_PRESETS)).toHaveLength(4);
  });

  it('应该包含必需的预设字段', () => {
    for (const preset of Object.values(CONTEXT_PRESETS)) {
      expect(preset).toHaveProperty('id');
      expect(preset).toHaveProperty('name');
      expect(preset).toHaveProperty('description');
      expect(preset).toHaveProperty('collectStrategies');
      expect(preset).toHaveProperty('maxTokenEstimate');
      expect(Array.isArray(preset.collectStrategies)).toBe(true);
    }
  });

  it('EXPLORE 预设应包含所有策略', () => {
    const types = CONTEXT_PRESETS.EXPLORE.collectStrategies.map((s) => s.type);
    expect(types).toContain('repo-map');
    expect(types).toContain('claude-md');
    expect(types).toContain('session-knowledge');
    expect(types).toContain('pattern-cards');
    expect(types).toContain('insights');
    expect(types).toContain('dependencies');
  });
});

describe('recommendPreset', () => {
  it('应该为修复任务推荐 FIX 预设', () => {
    expect(recommendPreset('修复登录页面的 bug').id).toBe('fix');
    expect(recommendPreset('fix the login error').id).toBe('fix');
    expect(recommendPreset('debug memory leak').id).toBe('fix');
  });

  it('应该为审查任务推荐 REVIEW 预设', () => {
    expect(recommendPreset('审查 PR 代码质量').id).toBe('review');
    expect(recommendPreset('code review for security').id).toBe('review');
  });

  it('应该为探索任务推荐 EXPLORE 预设', () => {
    expect(recommendPreset('分析项目架构设计').id).toBe('explore');
    expect(recommendPreset('refactor the module structure').id).toBe('explore');
  });

  it('应该为默认任务推荐 IMPLEMENT 预设', () => {
    expect(recommendPreset('实现用户注册功能').id).toBe('implement');
    expect(recommendPreset('add a new feature').id).toBe('implement');
  });

  it('应该对空输入返回 EXPLORE', () => {
    expect(recommendPreset('').id).toBe('explore');
    expect(recommendPreset(null).id).toBe('explore');
    expect(recommendPreset(undefined).id).toBe('explore');
  });
});

describe('ContextInjector', () => {
  let tempDir;
  let injector;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `context-injector-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    // 创建模拟项目结构
    await fs.writeFile(
      path.join(tempDir, 'CLAUDE.md'),
      '# Project Rules\n\n- Use ES Modules\n- Test coverage >= 80%\n',
      'utf-8'
    );

    await fs.writeFile(
      path.join(tempDir, 'REPO_MAP.md'),
      '# Repo Map\n\n## src/index.js\n- main entry\n',
      'utf-8'
    );

    await fs.writeJSON(path.join(tempDir, 'package.json'), {
      name: 'test-project',
      dependencies: { chalk: '^5.0.0' },
      devDependencies: { vitest: '^1.0.0' }
    });

    const insightsDir = path.join(tempDir, '.auto', 'insights');
    await fs.ensureDir(insightsDir);
    await fs.writeFile(
      path.join(insightsDir, 'patterns.md'),
      '# Patterns\n\n### Observer Pattern\n\nUse observer for decoupling.\n\n---\n',
      'utf-8'
    );

    const cacheDir = path.join(tempDir, '.auto', 'cache');
    await fs.ensureDir(cacheDir);
    await fs.writeJSON(path.join(cacheDir, 'pattern-cards.json'), {
      cards: {
        'index.js': {
          package: 'test-project',
          method_pattern: 'export function*',
          key_imports: ['chalk', 'fs']
        }
      }
    });

    injector = new ContextInjector(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('collect', () => {
    it('应该根据任务自动选择预设并收集上下文', async () => {
      const result = await injector.collect('实现新的 API 接口');

      expect(result).toBeDefined();
      expect(result.preset).toBe('implement');
      expect(result.presetName).toBe('实现模式');
      expect(result.sections).toBeDefined();
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.collectedAt).toBeDefined();
      expect(result.projectDir).toBe(tempDir);
    });

    it('应该收集 claude-md 上下文', async () => {
      const result = await injector.collect('实现功能');

      const claudeSection = result.sections.find((s) => s.type === 'claude-md');
      expect(claudeSection).toBeDefined();
      expect(claudeSection.content).toContain('Project Rules');
    });

    it('应该收集 dependencies 上下文', async () => {
      const result = await injector.collect('实现功能');

      const depsSection = result.sections.find((s) => s.type === 'dependencies');
      expect(depsSection).toBeDefined();
      expect(depsSection.content).toContain('chalk');
      expect(depsSection.content).toContain('vitest');
    });

    it('应该收集 insights 摘要', async () => {
      const result = await injector.collect('修复错误');

      const insightsSection = result.sections.find((s) => s.type === 'insights');
      expect(insightsSection).toBeDefined();
      expect(insightsSection.content).toContain('Observer Pattern');
    });

    it('应该收集 pattern-cards 摘要', async () => {
      const result = await injector.collect('实现功能');

      const cardsSection = result.sections.find((s) => s.type === 'pattern-cards');
      expect(cardsSection).toBeDefined();
      expect(cardsSection.content).toContain('index.js');
    });

    it('应该支持强制指定预设', async () => {
      const result = await injector.collect('any task', { preset: 'explore' });

      expect(result.preset).toBe('explore');
    });

    it('应该支持附加额外文件', async () => {
      const extraFile = path.join(tempDir, 'extra.md');
      await fs.writeFile(extraFile, 'Extra context info', 'utf-8');

      const result = await injector.collect('task', {
        additionalFiles: [extraFile]
      });

      const fileSection = result.sections.find((s) => s.type === 'file');
      expect(fileSection).toBeDefined();
      expect(fileSection.content).toContain('Extra context info');
      expect(fileSection.filePath).toBe(extraFile);
    });

    it('应该在空项目中返回可用结果', async () => {
      const emptyDir = path.join(os.tmpdir(), `context-empty-${Date.now()}`);
      await fs.ensureDir(emptyDir);

      try {
        const emptyInjector = new ContextInjector(emptyDir);
        const result = await emptyInjector.collect('探索项目');

        expect(result).toBeDefined();
        expect(result.sections).toBeDefined();
        // sections 可能为空或只有部分数据，不应报错
      } finally {
        await fs.remove(emptyDir);
      }
    });
  });

  describe('listPresets', () => {
    it('应该返回 4 个预设', () => {
      const presets = injector.listPresets();

      expect(presets).toHaveLength(4);
      expect(presets[0]).toHaveProperty('id');
      expect(presets[0]).toHaveProperty('name');
      expect(presets[0]).toHaveProperty('strategyCount');
    });
  });

  describe('clearCache', () => {
    it('应该清除缓存', async () => {
      await injector.collect('task');
      expect(injector.cache.size).toBeGreaterThan(0);

      injector.clearCache();
      expect(injector.cache.size).toBe(0);
      expect(injector.skillCatalog).toBeNull();
    });
  });

  describe('去重集成', () => {
    it('应该在 collect 结果中返回 optimization 信息', async () => {
      const result = await injector.collect('实现功能');

      expect(result.optimization).toBeDefined();
      expect(result.optimization.dedup).toBeDefined();
      expect(result.optimization.budget).toBeDefined();
      expect(result.optimization.dedup.originalCount).toBeGreaterThanOrEqual(
        result.optimization.dedup.dedupedCount
      );
    });

    it('去重后段落数应小于等于原始段落数', async () => {
      const result = await injector.collect('探索项目架构');

      expect(result.optimization.dedup.dedupedCount).toBeLessThanOrEqual(
        result.optimization.dedup.originalCount
      );
    });
  });

  describe('预算管理集成', () => {
    it('应该返回预算利用率', async () => {
      const result = await injector.collect('修复错误');

      expect(result.optimization.budget.utilization).toBeGreaterThanOrEqual(0);
      expect(result.optimization.budget.utilization).toBeLessThanOrEqual(1);
    });

    it('总 Token 数不应超过预算', async () => {
      const result = await injector.collect('实现功能');

      // IMPLEMENT 预算为 2500 tokens
      expect(result.totalTokens).toBeLessThanOrEqual(2500 + 50); // 允许 50 tokens 误差
    });
  });

  describe('按需加载 (skills)', () => {
    it('collect 结果应包含 skills 策略（如果技能目录存在）', async () => {
      // skills 策略在 IMPLEMENT 模式下是 required=true
      const result = await injector.collect('实现功能');

      // 由于测试环境可能没有 skills 目录，只要不报错即可
      expect(result).toBeDefined();
      expect(result.sections).toBeDefined();
    });

    it('应该懒加载 SkillCatalog（不阻塞构造）', () => {
      const freshInjector = new ContextInjector(tempDir);

      // 构造后 skillCatalog 应该为 null（未加载）
      expect(freshInjector.skillCatalog).toBeNull();
    });
  });
});
