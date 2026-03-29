/**
 * 生态编排器
 *
 * 核心功能：
 * - 初始化和管理生态系统中所有模块
 * - 执行跨模块工作流
 * - 协同数据流转
 * - 监控生态系统健康状态
 */

import path from 'node:path';
import { logger } from '../logger.js';
import { ModuleRegistry } from './module-registry.js';
import { MODULE_STATES, MODULE_IDS, ECOSYSTEM_EVENTS, DEPENDENCY_TYPES } from './module-types.js';

// 导入各模块类
import { RuleEngine } from '../governance/rule-engine.js';
import { VCOAdapter } from '../runtime/vco-adapter.js';
import { SkillDiscovery } from '../skills/skill-discovery.js';
import { KnowledgeSteward } from '../knowledge/knowledge-steward.js';
import { KnowledgeGraph } from '../graph/knowledge-graph.js';
import { DigitalBrain } from '../brain/digital-brain.js';
import { ContextInjector } from '../context/context-injector.js';

/**
 * 生态编排器类
 */
export class EcosystemOrchestrator {
  constructor() {
    this.registry = new ModuleRegistry();
    this.logger = logger;
    this.initialized = false;
    this.projectDir = process.cwd();
  }

  /**
   * 初始化生态系统
   * @param {Object} options - 初始化选项
   * @returns {Promise<boolean>} 是否初始化成功
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) {
        this.logger.warn('生态系统已经初始化');
        return true;
      }

      this.logger.info('开始初始化生态系统...');

      // 注册所有模块
      await this._registerAllModules();

      // 按依赖顺序初始化模块
      const initOrder = this._getInitializationOrder();
      for (const moduleId of initOrder) {
        await this._initializeModule(moduleId);
      }

      this.initialized = true;

      // 触发生态系统就绪事件
      await this.registry.broadcast(ECOSYSTEM_EVENTS.MODULE_READY, {
        ecosystem: 'ready',
        modules: Array.from(this.registry.modules.keys())
      });

      this.logger.success('生态系统初始化完成');
      return true;
    } catch (error) {
      this.logger.error(`生态系统初始化失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 注册所有模块
   * @returns {Promise<void>}
   * @private
   */
  async _registerAllModules() {
    // 注册 Governance 模块 (v0.7.0)
    await this.registry.register({
      id: MODULE_IDS.GOVERNANCE,
      name: 'Governance Rule Engine',
      version: '0.7.0',
      description: '治理规则引擎 - 规则验证和执行',
      instance: new RuleEngine(),
      capabilities: ['validate', 'execute', 'addRule', 'removeRule'],
      dependencies: {},
      config: {}
    });

    // 注册 Runtime 模块 (v0.8.0)
    await this.registry.register({
      id: MODULE_IDS.RUNTIME,
      name: 'VCO Runtime',
      version: '0.8.0',
      description: 'VCO 工作流编排运行时',
      instance: new VCOAdapter(),
      capabilities: ['orchestrate', 'loadWorkflows', 'validateWorkflow'],
      dependencies: {},
      config: {}
    });

    // 注册 Skills 模块 (v0.6.0)
    await this.registry.register({
      id: MODULE_IDS.SKILLS,
      name: 'Skill Discovery',
      version: '0.6.0',
      description: '技能目录系统',
      instance: new SkillDiscovery(),
      capabilities: ['syncFromVibeSkills', 'searchSkills', 'installSkill'],
      dependencies: {},
      config: {}
    });

    // 注册 Knowledge 模块 (v0.5.0)
    await this.registry.register({
      id: MODULE_IDS.KNOWLEDGE,
      name: 'Knowledge Steward',
      version: '0.5.0',
      description: '个人知识库管理',
      instance: new KnowledgeSteward(this.projectDir),
      capabilities: ['save', 'list', 'search'],
      dependencies: {},
      config: {}
    });

    // 注册 Graph 模块 (v0.5.0)
    await this.registry.register({
      id: MODULE_IDS.GRAPH,
      name: 'Knowledge Graph',
      version: '0.5.0',
      description: '知识图谱',
      instance: new KnowledgeGraph(this.projectDir),
      capabilities: ['extractFromProject', 'query', 'getEntity'],
      dependencies: { [MODULE_IDS.KNOWLEDGE]: DEPENDENCY_TYPES.REQUIRED },
      config: {}
    });

    // 注册 Brain 模块 (v0.5.0)
    await this.registry.register({
      id: MODULE_IDS.BRAIN,
      name: 'Digital Brain',
      version: '0.5.0',
      description: '数字大脑',
      instance: new DigitalBrain(this.projectDir),
      capabilities: ['addIdentity', 'addContact', 'addIdea', 'addReview'],
      dependencies: {},
      config: {}
    });

    // 注册 Context 模块 (v0.10.0)
    await this.registry.register({
      id: MODULE_IDS.CONTEXT,
      name: 'Context Injector',
      version: '0.10.0',
      description: '自动上下文注入 - linux.do 最佳实践',
      instance: new ContextInjector(this.projectDir),
      capabilities: ['collect', 'listPresets', 'recommendPreset'],
      dependencies: {},
      config: {}
    });
  }

  /**
   * 初始化单个模块
   * @param {string} moduleId - 模块 ID
   * @returns {Promise<void>}
   * @private
   */
  async _initializeModule(moduleId) {
    const module = this.registry.getModuleDescriptor(moduleId);
    if (!module) {
      this.logger.warn(`模块不存在: ${moduleId}`);
      return;
    }

    try {
      await this.registry.updateModuleState(moduleId, MODULE_STATES.INITIALIZING);

      // 调用模块的初始化方法（如果存在）
      if (module.instance && typeof module.instance.initialize === 'function') {
        await module.instance.initialize();
      }

      // 加载模块数据
      if (moduleId === MODULE_IDS.GOVERNANCE) {
        await module.instance.loadRules();
      } else if (moduleId === MODULE_IDS.RUNTIME) {
        await module.instance.loadWorkflows();
      } else if (moduleId === MODULE_IDS.SKILLS) {
        await module.instance.loadIndex();
      }

      module.initializedAt = new Date();
      await this.registry.updateModuleState(moduleId, MODULE_STATES.READY);

      this.logger.success(`模块初始化完成: ${module.name}`);
    } catch (error) {
      this.logger.error(`模块初始化失败 ${moduleId}: ${error.message}`);
      await this.registry.updateModuleState(moduleId, MODULE_STATES.ERROR);
      throw error;
    }
  }

  /**
   * 获取模块初始化顺序（基于依赖关系）
   * @returns {Array<string>} 排序后的模块 ID 列表
   * @private
   */
  _getInitializationOrder() {
    const modules = this.registry.listModules();
    const ordered = [];
    const visited = new Set();

    const visit = (moduleId) => {
      if (visited.has(moduleId)) {
        return;
      }

      visited.add(moduleId);
      const module = this.registry.getModuleDescriptor(moduleId);

      // 先访问依赖
      for (const depId of Object.keys(module.dependencies || {})) {
        visit(depId);
      }

      ordered.push(moduleId);
    };

    for (const module of modules) {
      visit(module.id);
    }

    return ordered;
  }

  /**
   * 执行跨模块工作流
   * @param {CrossModuleWorkflow} workflow - 工作流配置
   * @returns {Promise<Object>} 执行结果
   */
  async executeCrossModuleWorkflow(workflow) {
    try {
      this.logger.info(`执行跨模块工作流: ${workflow.name}`);

      const results = [];
      const context = { ...workflow.context };

      for (const step of workflow.steps) {
        const module = this.registry.getModule(step.module);
        if (!module) {
          throw new Error(`模块不存在: ${step.module}`);
        }

        const moduleState = this.registry.getModuleDescriptor(step.module).state;
        if (moduleState !== MODULE_STATES.READY) {
          throw new Error(`模块 ${step.module} 未就绪: ${moduleState}`);
        }

        // 执行模块方法
        const result = await this._executeModuleAction(step.module, step.action, {
          ...step.params,
          context
        });

        results.push({
          module: step.module,
          action: step.action,
          result
        });

        // 更新上下文
        if (result && typeof result === 'object') {
          Object.assign(context, result);
        }
      }

      return {
        success: true,
        results,
        context
      };
    } catch (error) {
      this.logger.error(`跨模块工作流执行失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 执行模块动作
   * @param {string} moduleId - 模块 ID
   * @param {string} action - 动作名称
   * @param {Object} params - 参数
   * @returns {Promise<*>} 执行结果
   * @private
   */
  async _executeModuleAction(moduleId, action, params = {}) {
    const module = this.registry.getModule(moduleId);
    if (!module || typeof module[action] !== 'function') {
      throw new Error(`模块 ${moduleId} 没有方法 ${action}`);
    }

    return await module[action](params);
  }

  /**
   * 同步模块间数据
   * @param {DataFlowConfig} config - 数据流配置
   * @returns {Promise<*>} 数据流结果
   */
  async syncDataBetweenModules(config) {
    try {
      const { fromModule, toModule, type, event, data } = config;

      this.logger.info(`数据流: ${fromModule} -> ${toModule} (${type})`);

      const sourceModule = this.registry.getModule(fromModule);
      if (!sourceModule) {
        throw new Error(`源模块不存在: ${fromModule}`);
      }

      // 获取源模块数据
      const sourceData = await this._getModuleData(fromModule, data);

      // 根据类型传输数据
      if (type === 'sync') {
        return await this._syncData(toModule, event, sourceData);
      } else if (type === 'async') {
        return await this._asyncData(toModule, event, sourceData);
      } else if (type === 'broadcast') {
        return await this._broadcastData(event, sourceData);
      } else if (type === 'request-response') {
        return await this._requestData(toModule, event, sourceData);
      }
    } catch (error) {
      this.logger.error(`数据同步失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取模块数据
   * @param {string} moduleId - 模块 ID
   * @param {Object} params - 参数
   * @returns {Promise<Object>} 模块数据
   * @private
   */
  async _getModuleData(moduleId, params = {}) {
    const module = this.registry.getModule(moduleId);
    if (module && typeof module.getData === 'function') {
      return await module.getData(params);
    }
    return params;
  }

  /**
   * 同步传输数据
   * @param {string} targetModule - 目标模块
   * @param {string} event - 事件名称
   * @param {Object} data - 数据
   * @returns {Promise<Object>} 结果
   * @private
   */
  async _syncData(targetModule, event, data) {
    const module = this.registry.getModule(targetModule);
    if (module && typeof module.handleData === 'function') {
      return await module.handleData(event, data);
    }
    return { received: true };
  }

  /**
   * 异步传输数据
   * @param {string} targetModule - 目标模块
   * @param {string} event - 事件名称
   * @param {Object} data - 数据
   * @returns {Promise<Object>} 结果
   * @private
   */
  async _asyncData(targetModule, event, data) {
    // 触发事件但不等待结果
    this.registry.subscribe(targetModule, event);
    await this.registry.broadcast(event, data);
    return { sent: true };
  }

  /**
   * 广播数据到所有模块
   * @param {string} event - 事件名称
   * @param {Object} data - 数据
   * @returns {Promise<Array>} 广播结果
   * @private
   */
  async _broadcastData(event, data) {
    return await this.registry.broadcast(event, data);
  }

  /**
   * 请求-响应模式
   * @param {string} targetModule - 目标模块
   * @param {string} event - 事件名称
   * @param {Object} data - 数据
   * @returns {Promise<Object>} 响应数据
   * @private
   */
  async _requestData(targetModule, event, data) {
    const results = await this.registry.broadcast(event, data);
    return results.find((r) => r.moduleId === targetModule);
  }

  /**
   * 获取生态系统健康状态
   * @returns {Promise<Object>} 健康状态
   */
  async getEcosystemHealth() {
    const modules = this.registry.listModules();
    const readyModules = modules.filter((m) => m.state === MODULE_STATES.READY);
    const errorModules = modules.filter((m) => m.state === MODULE_STATES.ERROR);

    let status = 'healthy';
    if (errorModules.length > 0) {
      status = 'critical';
    } else if (readyModules.length < modules.length) {
      status = 'degraded';
    }

    const moduleStates = {};
    modules.forEach((m) => {
      moduleStates[m.id] = m.state;
    });

    const issues = [];
    modules.forEach((m) => {
      if (m.state === MODULE_STATES.ERROR) {
        issues.push({
          module: m.id,
          severity: 'error',
          message: `${m.name} 处于错误状态`
        });
      } else if (m.state === MODULE_STATES.INITIALIZING) {
        issues.push({
          module: m.id,
          severity: 'warning',
          message: `${m.name} 正在初始化`
        });
      }
    });

    return {
      status,
      totalModules: modules.length,
      readyModules: readyModules.length,
      errorModules: errorModules.length,
      moduleStates,
      issues,
      checkedAt: new Date()
    };
  }

  /**
   * 关闭生态系统
   * @returns {Promise<boolean>} 是否关闭成功
   */
  async shutdown() {
    try {
      this.logger.info('关闭生态系统...');

      // 按相反顺序关闭模块
      const initOrder = this._getInitializationOrder();
      for (const moduleId of initOrder.reverse()) {
        const module = this.registry.getModule(moduleId);
        if (module && typeof module.shutdown === 'function') {
          await module.shutdown();
        }
      }

      this.registry.clear();
      this.initialized = false;

      this.logger.success('生态系统已关闭');
      return true;
    } catch (error) {
      this.logger.error(`关闭生态系统失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取注册表实例
   * @returns {ModuleRegistry} 注册表
   */
  getRegistry() {
    return this.registry;
  }

  /**
   * 检查是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isInitialized() {
    return this.initialized;
  }
}
