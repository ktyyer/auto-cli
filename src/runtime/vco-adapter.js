/**
 * 可变上下文编排（VCO）适配器
 *
 * 核心功能：
 * - 工作流编排和执行
 * - 支持 4 种编排模式（顺序、并行、管道、自适应）
 * - 条件评估和路径选择
 * - 状态管理和错误处理
 * - Token 成本优化（渐进式上下文展开）
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { logger } from '../logger.js';
import {
  ORCHESTRATION_MODES,
  STAGE_STATES,
  WORKFLOW_RESULT,
  STAGE_TYPES,
  CONDITION_OPS
} from './workflow-types.js';

const WORKFLOWS_INDEX_FILE = path.join(os.homedir(), '.auto', 'workflows', 'index.json');

/**
 * VCO 适配器类
 */
export class VCOAdapter {
  constructor() {
    this.workflowsIndexFile = WORKFLOWS_INDEX_FILE;
    this.logger = logger;
    this.workflows = [];
    this.executions = new Map(); // 存储执行状态 {executionId: WorkflowExecution}
  }

  /**
   * 确保目录结构存在
   * @private
   */
  async _ensureStructure() {
    await fs.ensureDir(path.join(os.homedir(), '.auto', 'workflows'));
  }

  /**
   * 加载工作流定义
   * @param {string} workflowsPath - 工作流文件路径
   * @returns {Promise<Array>} 工作流列表
   */
  async loadWorkflows(workflowsPath = null) {
    try {
      await this._ensureStructure();

      if (workflowsPath && (await fs.pathExists(workflowsPath))) {
        const customWorkflows = await this._loadWorkflowsFromFile(workflowsPath);
        this.workflows = [...this._getDefaultWorkflows(), ...customWorkflows];
      } else {
        this.workflows = this._getDefaultWorkflows();
      }

      if (await fs.pathExists(this.workflowsIndexFile)) {
        const index = await fs.readJson(this.workflowsIndexFile);
        if (index.workflows && index.workflows.length > 0) {
          this.workflows = [...this.workflows, ...index.workflows];
        }
      }

      this.logger.info(`已加载 ${this.workflows.length} 个工作流`);
      return this.workflows;
    } catch (error) {
      this.logger.warn(`加载工作流失败: ${error.message}`);
      this.workflows = this._getDefaultWorkflows();
      return this.workflows;
    }
  }

  /**
   * 从文件加载工作流
   * @private
   * @param {string} workflowsPath - 工作流文件路径
   * @returns {Promise<Array>} 工作流列表
   */
  async _loadWorkflowsFromFile(workflowsPath) {
    const ext = path.extname(workflowsPath).toLowerCase();

    if (ext === '.json') {
      const data = await fs.readJson(workflowsPath);
      return Array.isArray(data) ? data : data.workflows || [];
    } else if (ext === '.yaml' || ext === '.yml') {
      this.logger.warn('YAML 工作流文件暂不支持');
      return [];
    }

    return [];
  }

  /**
   * 获取默认工作流
   * @private
   * @returns {Array} 默认工作流列表
   */
  _getDefaultWorkflows() {
    return [
      {
        id: 'tdd-workflow',
        name: 'TDD 工作流',
        description: '测试驱动开发工作流：测试先行 -> 实现 -> 重构',
        mode: ORCHESTRATION_MODES.SEQUENTIAL,
        stages: [
          {
            id: 'write-test',
            name: '编写测试',
            type: STAGE_TYPES.TASK,
            description: '先编写失败的测试用例',
            config: { action: 'write-test' }
          },
          {
            id: 'implement',
            name: '实现功能',
            type: STAGE_TYPES.TASK,
            description: '编写最小代码使测试通过',
            config: { action: 'implement' },
            dependsOn: ['write-test']
          },
          {
            id: 'refactor',
            name: '重构代码',
            type: STAGE_TYPES.TASK,
            description: '优化代码结构和质量',
            config: { action: 'refactor' },
            dependsOn: ['implement']
          }
        ],
        version: '1.0.0',
        tags: ['tdd', 'testing', 'development']
      },
      {
        id: 'code-review-workflow',
        name: '代码审查工作流',
        description: '代码审查流程：安全审查 -> 质量审查 -> 测试验证',
        mode: ORCHESTRATION_MODES.SEQUENTIAL,
        stages: [
          {
            id: 'security-review',
            name: '安全审查',
            type: STAGE_TYPES.TASK,
            description: '检查安全问题（SQL注入、XSS等）',
            config: { action: 'security-review' }
          },
          {
            id: 'quality-review',
            name: '质量审查',
            type: STAGE_TYPES.TASK,
            description: '检查代码质量（可读性、可维护性）',
            config: { action: 'quality-review' },
            dependsOn: ['security-review']
          },
          {
            id: 'test-verification',
            name: '测试验证',
            type: STAGE_TYPES.TASK,
            description: '运行测试套件验证',
            config: { action: 'test-verification' },
            dependsOn: ['quality-review']
          }
        ],
        version: '1.0.0',
        tags: ['review', 'quality', 'security']
      }
    ];
  }

  /**
   * 主编排方法 - 根据模式执行工作流
   * @param {string} workflowId - 工作流 ID
   * @param {Object} context - 执行上下文
   * @param {Object} options - 执行选项
   * @returns {Promise<Object>} 执行结果
   */
  async orchestrate(workflowId, context = {}, options = {}) {
    try {
      const workflow = this.workflows.find((w) => w.id === workflowId);
      if (!workflow) {
        throw new Error(`工作流不存在: ${workflowId}`);
      }

      this.logger.info(`开始执行工作流: ${workflow.name} (${workflow.mode})`);

      const executionId = options.executionId || this._generateExecutionId();
      const execution = {
        id: executionId,
        workflowId,
        status: STAGE_STATES.RUNNING,
        result: null,
        stageStates: {},
        context: { ...context, variables: workflow.variables || {} },
        startTime: new Date(),
        metadata: { workflowMode: workflow.mode }
      };

      this.executions.set(executionId, execution);

      let result;
      switch (workflow.mode) {
        case ORCHESTRATION_MODES.SEQUENTIAL:
          result = await this._executeSequential(workflow, execution, options);
          break;
        case ORCHESTRATION_MODES.PARALLEL:
          result = await this._executeParallel(workflow, execution, options);
          break;
        case ORCHESTRATION_MODES.PIPELINE:
          result = await this._executePipeline(workflow, execution, options);
          break;
        case ORCHESTRATION_MODES.ADAPTIVE:
          result = await this._executeAdaptive(workflow, execution, options);
          break;
        default:
          throw new Error(`不支持的编排模式: ${workflow.mode}`);
      }

      execution.endTime = new Date();
      execution.duration = execution.endTime - execution.startTime;
      execution.result = result.result;
      execution.status = result.status;

      this.logger.info(`工作流执行完成: ${workflow.name} -> ${result.result}`);

      return execution;
    } catch (error) {
      this.logger.error(`工作流执行失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 顺序执行工作流
   * @private
   */
  async _executeSequential(workflow, execution, options) {
    let failedStages = 0;
    let completedStages = 0;

    for (const stage of workflow.stages) {
      if (!this._checkDependencies(stage, execution.stageStates)) {
        this.logger.warn(`阶段 ${stage.id} 依赖未满足，跳过`);
        execution.stageStates[stage.id] = { status: STAGE_STATES.BLOCKED, result: null };
        continue;
      }

      const stageResult = await this._executeStage(stage, execution.context, options);
      execution.stageStates[stage.id] = stageResult;

      if (stageResult.status === STAGE_STATES.COMPLETED) {
        completedStages++;
        if (stageResult.output) {
          execution.context = { ...execution.context, ...stageResult.output };
        }
      } else if (stageResult.status === STAGE_STATES.FAILED) {
        failedStages++;
        if (!workflow.continueOnError && !stage.continueOnError) {
          this.logger.error(`阶段 ${stage.id} 失败，终止工作流`);
          return {
            result: WORKFLOW_RESULT.FAILED,
            status: STAGE_STATES.FAILED,
            completedStages,
            failedStages
          };
        }
      }
    }

    const result =
      failedStages === 0
        ? WORKFLOW_RESULT.SUCCESS
        : completedStages > 0
          ? WORKFLOW_RESULT.PARTIAL
          : WORKFLOW_RESULT.FAILED;
    return {
      result,
      status: result === WORKFLOW_RESULT.SUCCESS ? STAGE_STATES.COMPLETED : STAGE_STATES.FAILED,
      completedStages,
      failedStages
    };
  }

  /**
   * 并行执行工作流
   * @private
   */
  async _executeParallel(workflow, execution, options) {
    const promises = workflow.stages.map((stage) =>
      this._executeStage(stage, execution.context, options).then((result) => ({
        stageId: stage.id,
        result
      }))
    );

    const results = await Promise.allSettled(promises);
    let completedStages = 0;
    let failedStages = 0;

    results.forEach((outcome, index) => {
      const stageId = workflow.stages[index].id;
      if (outcome.status === 'fulfilled') {
        execution.stageStates[stageId] = outcome.value.result;
        if (outcome.value.result.status === STAGE_STATES.COMPLETED) {
          completedStages++;
          if (outcome.value.result.output) {
            execution.context = { ...execution.context, ...outcome.value.result.output };
          }
        } else if (outcome.value.result.status === STAGE_STATES.FAILED) {
          failedStages++;
        }
      } else {
        execution.stageStates[stageId] = {
          status: STAGE_STATES.FAILED,
          error: outcome.reason.message
        };
        failedStages++;
      }
    });

    const result =
      failedStages === 0
        ? WORKFLOW_RESULT.SUCCESS
        : completedStages > 0
          ? WORKFLOW_RESULT.PARTIAL
          : WORKFLOW_RESULT.FAILED;
    return {
      result,
      status: result === WORKFLOW_RESULT.SUCCESS ? STAGE_STATES.COMPLETED : STAGE_STATES.FAILED,
      completedStages,
      failedStages
    };
  }

  /**
   * 管道执行工作流
   * @private
   */
  async _executePipeline(workflow, execution, options) {
    let pipelineOutput = execution.context;

    for (const stage of workflow.stages) {
      const stageContext = { ...execution.context, input: pipelineOutput };
      const stageResult = await this._executeStage(stage, stageContext, options);
      execution.stageStates[stage.id] = stageResult;

      if (stageResult.status === STAGE_STATES.COMPLETED) {
        pipelineOutput = stageResult.output || pipelineOutput;
      } else if (stageResult.status === STAGE_STATES.FAILED) {
        if (!workflow.continueOnError && !stage.continueOnError) {
          return {
            result: WORKFLOW_RESULT.FAILED,
            status: STAGE_STATES.FAILED,
            output: pipelineOutput
          };
        }
      }
    }

    return {
      result: WORKFLOW_RESULT.SUCCESS,
      status: STAGE_STATES.COMPLETED,
      output: pipelineOutput
    };
  }

  /**
   * 自适应执行工作流
   * @private
   */
  async _executeAdaptive(workflow, execution, options) {
    let currentStageIndex = 0;
    let completedStages = 0;
    let failedStages = 0;

    while (currentStageIndex < workflow.stages.length) {
      const stage = workflow.stages[currentStageIndex];

      if (stage.type === STAGE_TYPES.CONDITION) {
        const conditionResult = this._evaluateCondition(stage.condition, execution.context);
        const nextStageId = conditionResult ? stage.config.then : stage.config.else;
        const nextStageIndex = workflow.stages.findIndex((s) => s.id === nextStageId);
        if (nextStageIndex >= 0) {
          currentStageIndex = nextStageIndex;
          continue;
        }
      }

      const stageResult = await this._executeStage(stage, execution.context, options);
      execution.stageStates[stage.id] = stageResult;

      if (stageResult.status === STAGE_STATES.COMPLETED) {
        completedStages++;
        if (stageResult.output) {
          execution.context = { ...execution.context, ...stageResult.output };
        }
        currentStageIndex++;
      } else if (stageResult.status === STAGE_STATES.FAILED) {
        failedStages++;
        if (stage.retry && stage.retry.maxRetries > 0) {
          let retryCount = 0;
          let success = false;
          while (retryCount < stage.retry.maxRetries && !success) {
            this.logger.info(`重试阶段 ${stage.id} (${retryCount + 1}/${stage.retry.maxRetries})`);
            const retryResult = await this._executeStage(stage, execution.context, options);
            if (retryResult.status === STAGE_STATES.COMPLETED) {
              success = true;
              execution.stageStates[stage.id] = retryResult;
              if (retryResult.output) {
                execution.context = { ...execution.context, ...retryResult.output };
              }
            }
            retryCount++;
          }
          if (!success && !workflow.continueOnError && !stage.continueOnError) {
            return {
              result: WORKFLOW_RESULT.FAILED,
              status: STAGE_STATES.FAILED,
              completedStages,
              failedStages
            };
          }
        } else if (!workflow.continueOnError && !stage.continueOnError) {
          return {
            result: WORKFLOW_RESULT.FAILED,
            status: STAGE_STATES.FAILED,
            completedStages,
            failedStages
          };
        }
        currentStageIndex++;
      }
    }

    const result =
      failedStages === 0
        ? WORKFLOW_RESULT.SUCCESS
        : completedStages > 0
          ? WORKFLOW_RESULT.PARTIAL
          : WORKFLOW_RESULT.FAILED;
    return {
      result,
      status: result === WORKFLOW_RESULT.SUCCESS ? STAGE_STATES.COMPLETED : STAGE_STATES.FAILED,
      completedStages,
      failedStages
    };
  }

  /**
   * 执行单个阶段
   * @private
   */
  async _executeStage(stage, context, options) {
    try {
      this.logger.info(`执行阶段: ${stage.name} (${stage.type})`);
      const output = await this._processStage(stage, context, options);
      return { status: STAGE_STATES.COMPLETED, result: WORKFLOW_RESULT.SUCCESS, output };
    } catch (error) {
      this.logger.error(`阶段执行失败 ${stage.id}: ${error.message}`);
      return { status: STAGE_STATES.FAILED, result: WORKFLOW_RESULT.FAILED, error: error.message };
    }
  }

  /**
   * 处理阶段（模拟实现）
   * @private
   */
  async _processStage(stage, context, options) {
    this.logger.debug(`处理阶段: ${stage.id}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      stageId: stage.id,
      timestamp: new Date().toISOString(),
      message: `阶段 ${stage.name} 执行完成`
    };
  }

  /**
   * 评估条件
   */
  _evaluateCondition(condition, context) {
    if (!condition) return true;
    const { field, operator, value } = condition;
    const fieldValue = this._getNestedValue(context, field);

    switch (operator) {
      case CONDITION_OPS.EQUALS:
        return fieldValue === value;
      case CONDITION_OPS.NOT_EQUALS:
        return fieldValue !== value;
      case CONDITION_OPS.INCLUDES:
        return Array.isArray(fieldValue) && fieldValue.includes(value);
      case CONDITION_OPS.EXCLUDES:
        return Array.isArray(fieldValue) && !fieldValue.includes(value);
      case CONDITION_OPS.EXISTS:
        return fieldValue !== undefined && fieldValue !== null;
      case CONDITION_OPS.GREATER_THAN:
        return typeof fieldValue === 'number' && fieldValue > value;
      case CONDITION_OPS.LESS_THAN:
        return typeof fieldValue === 'number' && fieldValue < value;
      case CONDITION_OPS.MATCHES:
        return new RegExp(value).test(fieldValue);
      default:
        return true;
    }
  }

  /**
   * 获取嵌套字段的值
   * @private
   */
  _getNestedValue(obj, path) {
    return path
      .split('.')
      .reduce(
        (current, key) => (current && current[key] !== undefined ? current[key] : undefined),
        obj
      );
  }

  /**
   * 检查依赖
   * @private
   */
  _checkDependencies(stage, stageStates) {
    if (!stage.dependsOn || stage.dependsOn.length === 0) return true;
    return stage.dependsOn.every((depId) => {
      const depState = stageStates[depId];
      return depState && depState.status === STAGE_STATES.COMPLETED;
    });
  }

  /**
   * 生成执行 ID
   * @private
   */
  _generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 运行工作流（orchestrate 的别名）
   */
  async runWorkflow(workflowId, context = {}, options = {}) {
    return this.orchestrate(workflowId, context, options);
  }

  /**
   * 获取工作流列表
   */
  listWorkflows() {
    return this.workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      mode: w.mode,
      stageCount: w.stages.length,
      tags: w.tags || [],
      version: w.version || '1.0.0'
    }));
  }

  /**
   * 验证工作流配置
   */
  validateWorkflow(workflow) {
    const errors = [];
    const warnings = [];

    if (!workflow.id) errors.push('缺少必需字段: id');
    if (!workflow.name) errors.push('缺少必需字段: name');
    if (!workflow.mode) {
      errors.push('缺少必需字段: mode');
    } else if (!Object.values(ORCHESTRATION_MODES).includes(workflow.mode)) {
      errors.push(`无效的编排模式: ${workflow.mode}`);
    }
    if (!workflow.stages || !Array.isArray(workflow.stages)) {
      errors.push('缺少必需字段: stages (必须是数组)');
    } else if (workflow.stages.length === 0) {
      errors.push('stages 不能为空');
    }

    if (workflow.stages) {
      workflow.stages.forEach((stage, index) => {
        if (!stage.id) errors.push(`阶段 ${index} 缺少 id`);
        if (!stage.name) errors.push(`阶段 ${index} 缺少 name`);
        if (!stage.type) warnings.push(`阶段 ${stage.id} 缺少 type，将使用默认值`);

        if (stage.dependsOn) {
          stage.dependsOn.forEach((depId) => {
            const depExists = workflow.stages.some((s) => s.id === depId);
            if (!depExists) errors.push(`阶段 ${stage.id} 依赖的阶段 ${depId} 不存在`);
          });
        }
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 获取执行状态
   */
  getExecution(executionId) {
    return this.executions.get(executionId) || null;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalWorkflows: this.workflows.length,
      totalExecutions: this.executions.size,
      modes: {
        sequential: this.workflows.filter((w) => w.mode === ORCHESTRATION_MODES.SEQUENTIAL).length,
        parallel: this.workflows.filter((w) => w.mode === ORCHESTRATION_MODES.PARALLEL).length,
        pipeline: this.workflows.filter((w) => w.mode === ORCHESTRATION_MODES.PIPELINE).length,
        adaptive: this.workflows.filter((w) => w.mode === ORCHESTRATION_MODES.ADAPTIVE).length
      }
    };
  }
}
