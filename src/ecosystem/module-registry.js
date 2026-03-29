/**
 * 模块注册表
 *
 * 核心功能：
 * - 管理生态系统中所有模块的注册和注销
 * - 提供模块发现和查询接口
 * - 广播事件到所有模块
 * - 跟踪模块状态和依赖关系
 */

import { logger } from '../logger.js';
import { MODULE_STATES, MODULE_IDS, ECOSYSTEM_EVENTS } from './module-types.js';

/**
 * 模块注册表类
 */
export class ModuleRegistry {
  constructor() {
    this.modules = new Map(); // moduleId -> ModuleDescriptor
    this.eventListeners = new Map(); // eventName -> Set of listener modules
    this.logger = logger;
  }

  /**
   * 注册模块
   * @param {ModuleDescriptor} descriptor - 模块描述符
   * @returns {Promise<boolean>} 是否注册成功
   */
  async register(descriptor) {
    try {
      if (!descriptor.id || !descriptor.name) {
        throw new Error('模块描述符缺少必需字段: id 或 name');
      }

      if (this.modules.has(descriptor.id)) {
        this.logger.warn(`模块已存在: ${descriptor.id}`);
        return false;
      }

      // 初始化模块状态
      const moduleDescriptor = {
        ...descriptor,
        state: MODULE_STATES.IDLE,
        initializedAt: null,
        lastActivityAt: new Date(),
        capabilities: descriptor.capabilities || [],
        dependencies: descriptor.dependencies || {},
        config: descriptor.config || {}
      };

      this.modules.set(descriptor.id, moduleDescriptor);

      // 触发注册事件
      await this._emitEvent(ECOSYSTEM_EVENTS.MODULE_REGISTERED, {
        moduleId: descriptor.id,
        name: descriptor.name
      });

      this.logger.success(`模块已注册: ${descriptor.name} (${descriptor.id})`);
      return true;
    } catch (error) {
      this.logger.error(`模块注册失败 ${descriptor?.id}: ${error.message}`);
      return false;
    }
  }

  /**
   * 注销模块
   * @param {string} moduleId - 模块 ID
   * @returns {Promise<boolean>} 是否注销成功
   */
  async unregister(moduleId) {
    try {
      if (!this.modules.has(moduleId)) {
        this.logger.warn(`模块不存在: ${moduleId}`);
        return false;
      }

      const module = this.modules.get(moduleId);

      // 检查是否有其他模块依赖此模块
      const dependents = this._getDependents(moduleId);
      if (dependents.length > 0) {
        this.logger.warn(`无法注销模块 ${moduleId}，以下模块依赖它: ${dependents.join(', ')}`);
        return false;
      }

      // 清理事件监听器
      this._removeAllEventListeners(moduleId);

      this.modules.delete(moduleId);

      // 触发注销事件
      await this._emitEvent(ECOSYSTEM_EVENTS.MODULE_UNREGISTERED, {
        moduleId
      });

      this.logger.success(`模块已注销: ${moduleId}`);
      return true;
    } catch (error) {
      this.logger.error(`模块注销失败 ${moduleId}: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取模块实例
   * @param {string} moduleId - 模块 ID
   * @returns {Object|null} 模块实例
   */
  getModule(moduleId) {
    const module = this.modules.get(moduleId);
    return module ? module.instance : null;
  }

  /**
   * 获取模块描述符
   * @param {string} moduleId - 模块 ID
   * @returns {ModuleDescriptor|null} 模块描述符
   */
  getModuleDescriptor(moduleId) {
    return this.modules.get(moduleId) || null;
  }

  /**
   * 列出所有模块
   * @returns {Array<ModuleDescriptor>} 模块列表
   */
  listModules() {
    return Array.from(this.modules.values()).map((module) => ({
      id: module.id,
      name: module.name,
      version: module.version,
      description: module.description,
      state: module.state,
      capabilities: module.capabilities,
      dependencies: Object.keys(module.dependencies),
      initializedAt: module.initializedAt,
      lastActivityAt: module.lastActivityAt
    }));
  }

  /**
   * 按状态列出模块
   * @param {string} state - 模块状态
   * @returns {Array<ModuleDescriptor>} 模块列表
   */
  listModulesByState(state) {
    return Array.from(this.modules.values()).filter((module) => module.state === state);
  }

  /**
   * 更新模块状态
   * @param {string} moduleId - 模块 ID
   * @param {string} newState - 新状态
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateModuleState(moduleId, newState) {
    const module = this.modules.get(moduleId);
    if (!module) {
      this.logger.warn(`模块不存在: ${moduleId}`);
      return false;
    }

    const oldState = module.state;
    module.state = newState;
    module.lastActivityAt = new Date();

    // 触发状态变更事件
    await this._emitEvent(ECOSYSTEM_EVENTS.MODULE_STATE_CHANGED, {
      moduleId,
      oldState,
      newState
    });

    if (newState === MODULE_STATES.ERROR) {
      await this._emitEvent(ECOSYSTEM_EVENTS.MODULE_ERROR, { moduleId });
    } else if (newState === MODULE_STATES.READY) {
      await this._emitEvent(ECOSYSTEM_EVENTS.MODULE_READY, { moduleId });
    }

    return true;
  }

  /**
   * 广播事件到所有模块
   * @param {string} eventName - 事件名称
   * @param {Object} data - 事件数据
   * @returns {Promise<Array>} 处理结果
   */
  async broadcast(eventName, data) {
    const listeners = this.eventListeners.get(eventName) || new Set();
    const results = [];

    for (const moduleId of listeners) {
      const module = this.modules.get(moduleId);
      if (module && module.instance && typeof module.instance.handleEvent === 'function') {
        try {
          const result = await module.instance.handleEvent(eventName, data);
          results.push({ moduleId, result });
        } catch (error) {
          this.logger.error(`模块 ${moduleId} 处理事件失败: ${error.message}`);
          results.push({ moduleId, error: error.message });
        }
      }
    }

    return results;
  }

  /**
   * 订阅事件
   * @param {string} moduleId - 模块 ID
   * @param {string} eventName - 事件名称
   */
  subscribe(moduleId, eventName) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName).add(moduleId);
  }

  /**
   * 取消订阅事件
   * @param {string} moduleId - 模块 ID
   * @param {string} eventName - 事件名称
   */
  unsubscribe(moduleId, eventName) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.delete(moduleId);
    }
  }

  /**
   * 获取模块依赖关系
   * @param {string} moduleId - 模块 ID
   * @returns {Array<string>} 依赖此模块的其他模块
   * @private
   */
  _getDependents(moduleId) {
    const dependents = [];
    for (const [id, module] of this.modules.entries()) {
      if (module.dependencies[moduleId]) {
        dependents.push(id);
      }
    }
    return dependents;
  }

  /**
   * 移除模块的所有事件监听器
   * @param {string} moduleId - 模块 ID
   * @private
   */
  _removeAllEventListeners(moduleId) {
    for (const listeners of this.eventListeners.values()) {
      listeners.delete(moduleId);
    }
  }

  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {Object} data - 事件数据
   * @returns {Promise<void>}
   * @private
   */
  async _emitEvent(eventName, data) {
    await this.broadcast(eventName, data);
  }

  /**
   * 检查模块依赖是否满足
   * @param {string} moduleId - 模块 ID
   * @returns {boolean} 依赖是否满足
   */
  checkDependencies(moduleId) {
    const module = this.modules.get(moduleId);
    if (!module) {
      return false;
    }

    for (const [depId, depType] of Object.entries(module.dependencies)) {
      if (depType === 'required' && !this.modules.has(depId)) {
        this.logger.warn(`模块 ${moduleId} 缺少必需依赖: ${depId}`);
        return false;
      }

      const depModule = this.modules.get(depId);
      if (depModule && depModule.state !== MODULE_STATES.READY) {
        this.logger.warn(`模块 ${moduleId} 的依赖 ${depId} 未就绪`);
        return false;
      }
    }

    return true;
  }

  /**
   * 获取注册表统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const modules = Array.from(this.modules.values());
    const stateCounts = {};
    for (const state of Object.values(MODULE_STATES)) {
      stateCounts[state] = modules.filter((m) => m.state === state).length;
    }

    return {
      totalModules: modules.length,
      stateCounts,
      totalEventListeners: Array.from(this.eventListeners.values()).reduce(
        (sum, set) => sum + set.size,
        0
      )
    };
  }

  /**
   * 清空注册表（用于测试）
   */
  clear() {
    this.modules.clear();
    this.eventListeners.clear();
  }

  /**
   * 检查模块是否已注册
   * @param {string} moduleId - 模块 ID
   * @returns {boolean} 是否已注册
   */
  isRegistered(moduleId) {
    return this.modules.has(moduleId);
  }

  /**
   * 获取所有已注册的模块 ID
   * @returns {Array<string>} 模块 ID 列表
   */
  getRegisteredModuleIds() {
    return Array.from(this.modules.keys());
  }
}
