/**
 * VCOAdapter 类单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VCOAdapter } from '../src/runtime/vco-adapter.js';
import {
  ORCHESTRATION_MODES,
  STAGE_STATES,
  WORKFLOW_RESULT,
  STAGE_TYPES,
  CONDITION_OPS
} from '../src/runtime/workflow-types.js';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

// Mock logger
vi.mock('../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('VCOAdapter', () => {
  let adapter;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `auto-cli-vco-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    adapter = new VCOAdapter();
    adapter.workflowsIndexFile = path.join(testDir, 'workflows-index.json');
  });

  afterEach(async () => {
    if (testDir) {
      await fs.remove(testDir);
    }
  });

  describe('loadWorkflows', () => {
    it('应该加载默认工作流', async () => {
      const workflows = await adapter.loadWorkflows();

      expect(workflows).toBeDefined();
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows[0]).toHaveProperty('id');
      expect(workflows[0]).toHaveProperty('name');
      expect(workflows[0]).toHaveProperty('mode');
    });

    it('应该包含 TDD 工作流', async () => {
      await adapter.loadWorkflows();

      const workflow = adapter.workflows.find((w) => w.id === 'tdd-workflow');
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('TDD 工作流');
      expect(workflow.mode).toBe(ORCHESTRATION_MODES.SEQUENTIAL);
      expect(workflow.stages.length).toBe(3);
    });

    it('应该包含代码审查工作流', async () => {
      await adapter.loadWorkflows();

      const workflow = adapter.workflows.find((w) => w.id === 'code-review-workflow');
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('代码审查工作流');
      expect(workflow.stages.length).toBe(3);
    });

    it('应该包含探索-规划-编码工作流', async () => {
      await adapter.loadWorkflows();

      const workflow = adapter.workflows.find((w) => w.id === 'explore-plan-code-workflow');
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('探索-规划-编码工作流');
      expect(workflow.mode).toBe(ORCHESTRATION_MODES.SEQUENTIAL);
      expect(workflow.stages.length).toBe(3);
      expect(workflow.tags).toContain('linux-do');
    });

    it('应该包含上下文感知工作流', async () => {
      await adapter.loadWorkflows();

      const workflow = adapter.workflows.find((w) => w.id === 'context-aware-workflow');
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('上下文感知工作流');
      expect(workflow.stages.length).toBe(3);
      expect(workflow.tags).toContain('context-injection');
    });

    it('应该从 JSON 文件加载自定义工作流', async () => {
      const customWorkflow = {
        id: 'custom-test',
        name: '自定义测试工作流',
        mode: ORCHESTRATION_MODES.SEQUENTIAL,
        stages: [
          {
            id: 'stage1',
            name: '阶段1',
            type: STAGE_TYPES.TASK,
            config: { action: 'test' }
          }
        ]
      };

      const customFile = path.join(testDir, 'custom-workflows.json');
      await fs.writeJson(customFile, [customWorkflow]);

      await adapter.loadWorkflows(customFile);

      const custom = adapter.workflows.find((w) => w.id === 'custom-test');
      expect(custom).toBeDefined();
      expect(custom.name).toBe('自定义测试工作流');
    });
  });

  describe('orchestrate', () => {
    beforeEach(async () => {
      await adapter.loadWorkflows();
    });

    it('应该执行顺序工作流', async () => {
      const execution = await adapter.orchestrate('tdd-workflow', {});

      expect(execution).toBeDefined();
      expect(execution.workflowId).toBe('tdd-workflow');
      expect(execution.status).toBe(STAGE_STATES.COMPLETED);
      expect(execution.result).toBe(WORKFLOW_RESULT.SUCCESS);
      expect(execution.id).toBeDefined();
      expect(execution.startTime).toBeDefined();
      expect(execution.endTime).toBeDefined();
      expect(execution.duration).toBeGreaterThanOrEqual(0);
    });

    it('应该按顺序执行所有阶段', async () => {
      const execution = await adapter.orchestrate('tdd-workflow', {});

      expect(Object.keys(execution.stageStates).length).toBe(3);
      expect(execution.stageStates['write-test'].status).toBe(STAGE_STATES.COMPLETED);
      expect(execution.stageStates['implement'].status).toBe(STAGE_STATES.COMPLETED);
      expect(execution.stageStates['refactor'].status).toBe(STAGE_STATES.COMPLETED);
    });

    it('应该支持并行执行模式', async () => {
      const parallelWorkflow = {
        id: 'parallel-test',
        name: '并行测试',
        mode: ORCHESTRATION_MODES.PARALLEL,
        stages: [
          { id: 'task1', name: '任务1', type: STAGE_TYPES.TASK, config: {} },
          { id: 'task2', name: '任务2', type: STAGE_TYPES.TASK, config: {} },
          { id: 'task3', name: '任务3', type: STAGE_TYPES.TASK, config: {} }
        ]
      };

      adapter.workflows.push(parallelWorkflow);
      const execution = await adapter.orchestrate('parallel-test', {});

      expect(execution.status).toBe(STAGE_STATES.COMPLETED);
      expect(execution.result).toBe(WORKFLOW_RESULT.SUCCESS);
      expect(Object.keys(execution.stageStates).length).toBe(3);
    });

    it('应该支持管道执行模式', async () => {
      const pipelineWorkflow = {
        id: 'pipeline-test',
        name: '管道测试',
        mode: ORCHESTRATION_MODES.PIPELINE,
        stages: [
          { id: 'stage1', name: '阶段1', type: STAGE_TYPES.TASK, config: {} },
          { id: 'stage2', name: '阶段2', type: STAGE_TYPES.TASK, config: {} }
        ]
      };

      adapter.workflows.push(pipelineWorkflow);
      const execution = await adapter.orchestrate('pipeline-test', {});

      expect(execution.status).toBe(STAGE_STATES.COMPLETED);
      expect(execution.result).toBe(WORKFLOW_RESULT.SUCCESS);
    });

    it('应该处理不存在的工作流', async () => {
      await expect(adapter.orchestrate('nonexistent-workflow', {})).rejects.toThrow('工作流不存在');
    });

    it('应该传递上下文到工作流', async () => {
      const context = { testData: 'value', userId: 123 };
      const execution = await adapter.orchestrate('tdd-workflow', context);

      expect(execution.context).toBeDefined();
      expect(execution.context.testData).toBe('value');
      expect(execution.context.userId).toBe(123);
    });
  });

  describe('_evaluateCondition', () => {
    it('应该正确评估 EQUALS 条件', () => {
      const condition = { field: 'status', operator: CONDITION_OPS.EQUALS, value: 'active' };
      const context = { status: 'active' };

      expect(adapter._evaluateCondition(condition, context)).toBe(true);
    });

    it('应该正确评估 NOT_EQUALS 条件', () => {
      const condition = { field: 'status', operator: CONDITION_OPS.NOT_EQUALS, value: 'inactive' };
      const context = { status: 'active' };

      expect(adapter._evaluateCondition(condition, context)).toBe(true);
    });

    it('应该正确评估 INCLUDES 条件', () => {
      const condition = { field: 'tags', operator: CONDITION_OPS.INCLUDES, value: 'javascript' };
      const context = { tags: ['javascript', 'nodejs', 'vitest'] };

      expect(adapter._evaluateCondition(condition, context)).toBe(true);
    });

    it('应该正确评估 EXCLUDES 条件', () => {
      const condition = { field: 'tags', operator: CONDITION_OPS.EXCLUDES, value: 'python' };
      const context = { tags: ['javascript', 'nodejs'] };

      expect(adapter._evaluateCondition(condition, context)).toBe(true);
    });

    it('应该正确评估 EXISTS 条件', () => {
      const condition = { field: 'user.email', operator: CONDITION_OPS.EXISTS };
      const context = { user: { email: 'test@example.com' } };

      expect(adapter._evaluateCondition(condition, context)).toBe(true);
    });

    it('应该正确评估 GREATER_THAN 条件', () => {
      const condition = { field: 'count', operator: CONDITION_OPS.GREATER_THAN, value: 5 };
      const context = { count: 10 };

      expect(adapter._evaluateCondition(condition, context)).toBe(true);
    });

    it('应该正确评估 LESS_THAN 条件', () => {
      const condition = { field: 'count', operator: CONDITION_OPS.LESS_THAN, value: 20 };
      const context = { count: 10 };

      expect(adapter._evaluateCondition(condition, context)).toBe(true);
    });

    it('应该处理嵌套字段路径', () => {
      const condition = { field: 'user.profile.age', operator: CONDITION_OPS.EQUALS, value: 30 };
      const context = { user: { profile: { age: 30 } } };

      expect(adapter._evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('_checkDependencies', () => {
    it('应该检查阶段依赖', () => {
      const stage = { id: 'task2', dependsOn: ['task1'] };
      const stageStates = {
        task1: { status: STAGE_STATES.COMPLETED }
      };

      expect(adapter._checkDependencies(stage, stageStates)).toBe(true);
    });

    it('应该阻止依赖未满足的阶段', () => {
      const stage = { id: 'task2', dependsOn: ['task1'] };
      const stageStates = {
        task1: { status: STAGE_STATES.FAILED }
      };

      expect(adapter._checkDependencies(stage, stageStates)).toBe(false);
    });

    it('应该处理无依赖的阶段', () => {
      const stage = { id: 'task1', dependsOn: [] };
      const stageStates = {};

      expect(adapter._checkDependencies(stage, stageStates)).toBe(true);
    });
  });

  describe('validateWorkflow', () => {
    it('应该验证有效的工作流配置', () => {
      const workflow = {
        id: 'valid-workflow',
        name: '有效工作流',
        mode: ORCHESTRATION_MODES.SEQUENTIAL,
        stages: [{ id: 'stage1', name: '阶段1', type: STAGE_TYPES.TASK, config: {} }]
      };

      const result = adapter.validateWorkflow(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺少必需字段', () => {
      const workflow = {
        name: '无效工作流'
      };

      const result = adapter.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必需字段: id');
      expect(result.errors).toContain('缺少必需字段: mode');
    });

    it('应该检测无效的编排模式', () => {
      const workflow = {
        id: 'invalid-workflow',
        name: '无效工作流',
        mode: 'invalid-mode',
        stages: []
      };

      const result = adapter.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('无效的编排模式'))).toBe(true);
    });

    it('应该检测空的阶段列表', () => {
      const workflow = {
        id: 'invalid-workflow',
        name: '无效工作流',
        mode: ORCHESTRATION_MODES.SEQUENTIAL,
        stages: []
      };

      const result = adapter.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('stages 不能为空');
    });

    it('应该检测缺失的阶段 ID', () => {
      const workflow = {
        id: 'invalid-workflow',
        name: '无效工作流',
        mode: ORCHESTRATION_MODES.SEQUENTIAL,
        stages: [{ name: '阶段1' }]
      };

      const result = adapter.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('阶段 0 缺少 id');
    });

    it('应该检测无效的依赖阶段', () => {
      const workflow = {
        id: 'invalid-workflow',
        name: '无效工作流',
        mode: ORCHESTRATION_MODES.SEQUENTIAL,
        stages: [
          { id: 'stage1', name: '阶段1', type: STAGE_TYPES.TASK, dependsOn: ['nonexistent'] }
        ]
      };

      const result = adapter.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('依赖的阶段 nonexistent 不存在'))).toBe(true);
    });

    it('应该返回警告信息', () => {
      const workflow = {
        id: 'warn-workflow',
        name: '警告工作流',
        mode: ORCHESTRATION_MODES.SEQUENTIAL,
        stages: [{ id: 'stage1', name: '阶段1' }]
      };

      const result = adapter.validateWorkflow(workflow);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('listWorkflows', () => {
    beforeEach(async () => {
      await adapter.loadWorkflows();
    });

    it('应该返回工作流摘要列表', () => {
      const list = adapter.listWorkflows();

      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('name');
      expect(list[0]).toHaveProperty('mode');
      expect(list[0]).toHaveProperty('stageCount');
    });

    it('应该包含工作流元数据', () => {
      const list = adapter.listWorkflows();
      const tddWorkflow = list.find((w) => w.id === 'tdd-workflow');

      expect(tddWorkflow).toBeDefined();
      expect(tddWorkflow.description).toBeDefined();
      expect(tddWorkflow.tags).toBeDefined();
      expect(tddWorkflow.version).toBeDefined();
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await adapter.loadWorkflows();
    });

    it('应该返回统计信息', () => {
      const stats = adapter.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalWorkflows).toBeGreaterThan(0);
      expect(stats.totalExecutions).toBe(0);
      expect(stats.modes).toBeDefined();
    });

    it('应该按编排模式分类', () => {
      const stats = adapter.getStats();

      expect(stats.modes.sequential).toBeGreaterThanOrEqual(0);
      expect(stats.modes.parallel).toBeGreaterThanOrEqual(0);
      expect(stats.modes.pipeline).toBeGreaterThanOrEqual(0);
      expect(stats.modes.adaptive).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getExecution', () => {
    it('应该返回执行状态', async () => {
      await adapter.loadWorkflows();
      const execution = await adapter.orchestrate('tdd-workflow', {});

      const retrieved = adapter.getExecution(execution.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(execution.id);
      expect(retrieved.workflowId).toBe(execution.workflowId);
    });

    it('应该对不存在的执行返回 null', () => {
      const retrieved = adapter.getExecution('nonexistent-execution-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('runWorkflow', () => {
    beforeEach(async () => {
      await adapter.loadWorkflows();
    });

    it('应该是 orchestrate 的别名', async () => {
      const execution1 = await adapter.orchestrate('tdd-workflow', {});
      const execution2 = await adapter.runWorkflow('tdd-workflow', {});

      expect(execution2.workflowId).toBe(execution1.workflowId);
      expect(execution2.status).toBe(STAGE_STATES.COMPLETED);
    });
  });

  describe('_getNestedValue', () => {
    it('应该获取嵌套字段值', () => {
      const obj = {
        user: {
          profile: {
            name: 'Test User',
            age: 30
          }
        }
      };

      expect(adapter._getNestedValue(obj, 'user.profile.name')).toBe('Test User');
      expect(adapter._getNestedValue(obj, 'user.profile.age')).toBe(30);
    });

    it('应该处理不存在的路径', () => {
      const obj = { user: { name: 'Test' } };

      expect(adapter._getNestedValue(obj, 'user.profile.email')).toBeUndefined();
    });

    it('应该处理顶级字段', () => {
      const obj = { name: 'Test', count: 42 };

      expect(adapter._getNestedValue(obj, 'name')).toBe('Test');
      expect(adapter._getNestedValue(obj, 'count')).toBe(42);
    });
  });

  describe('_generateExecutionId', () => {
    it('应该生成唯一的执行 ID', () => {
      const id1 = adapter._generateExecutionId();
      const id2 = adapter._generateExecutionId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('应该包含 exec_ 前缀', () => {
      const id = adapter._generateExecutionId();

      expect(id).toMatch(/^exec_/);
    });
  });
});
