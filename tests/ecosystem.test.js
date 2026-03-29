/**
 * Ecosystem 模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModuleRegistry } from '../src/ecosystem/module-registry.js';
import { EcosystemOrchestrator } from '../src/ecosystem/ecosystem-orchestrator.js';
import {
  MODULE_STATES,
  MODULE_IDS,
  ECOSYSTEM_EVENTS,
  DEPENDENCY_TYPES
} from '../src/ecosystem/module-types.js';

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

describe('ModuleRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('register', () => {
    it('应该注册模块', async () => {
      const descriptor = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        description: '测试模块',
        instance: {},
        capabilities: ['test'],
        dependencies: {},
        config: {}
      };

      const result = await registry.register(descriptor);

      expect(result).toBe(true);
      expect(registry.isRegistered('test-module')).toBe(true);
    });

    it('应该拒绝重复注册', async () => {
      const descriptor = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        instance: {}
      };

      await registry.register(descriptor);
      const result = await registry.register(descriptor);

      expect(result).toBe(false);
    });

    it('应该拒绝无效的描述符', async () => {
      const result = await registry.register({ name: 'No ID' });
      expect(result).toBe(false);
    });
  });

  describe('unregister', () => {
    it('应该注销模块', async () => {
      const descriptor = {
        id: 'test-module',
        name: 'Test Module',
        instance: {}
      };

      await registry.register(descriptor);
      const result = await registry.unregister('test-module');

      expect(result).toBe(true);
      expect(registry.isRegistered('test-module')).toBe(false);
    });

    it('应该拒绝注销有依赖的模块', async () => {
      const parent = {
        id: 'parent',
        name: 'Parent',
        instance: {},
        dependencies: { child: DEPENDENCY_TYPES.REQUIRED }
      };

      const child = {
        id: 'child',
        name: 'Child',
        instance: {}
      };

      await registry.register(child);
      await registry.register(parent);

      const result = await registry.unregister('child');

      expect(result).toBe(false);
    });
  });

  describe('getModule', () => {
    it('应该返回模块实例', async () => {
      const instance = { test: true };
      await registry.register({
        id: 'test-module',
        name: 'Test',
        instance
      });

      const result = registry.getModule('test-module');

      expect(result).toBe(instance);
    });

    it('应该对不存在的模块返回 null', () => {
      const result = registry.getModule('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listModules', () => {
    it('应该列出所有模块', async () => {
      await registry.register({
        id: 'module1',
        name: 'Module 1',
        instance: {}
      });
      await registry.register({
        id: 'module2',
        name: 'Module 2',
        instance: {}
      });

      const list = registry.listModules();

      expect(list).toHaveLength(2);
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('name');
      expect(list[0]).toHaveProperty('state');
    });
  });

  describe('updateModuleState', () => {
    it('应该更新模块状态', async () => {
      await registry.register({
        id: 'test-module',
        name: 'Test',
        instance: {}
      });

      const result = await registry.updateModuleState('test-module', MODULE_STATES.READY);

      expect(result).toBe(true);
      const module = registry.getModuleDescriptor('test-module');
      expect(module.state).toBe(MODULE_STATES.READY);
    });
  });

  describe('getStats', () => {
    it('应该返回统计信息', async () => {
      await registry.register({
        id: 'test-module',
        name: 'Test',
        instance: {}
      });

      const stats = registry.getStats();

      expect(stats.totalModules).toBe(1);
      expect(stats.stateCounts).toBeDefined();
      expect(stats.totalEventListeners).toBe(0);
    });
  });
});

describe('EcosystemOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new EcosystemOrchestrator();
  });

  afterEach(async () => {
    if (orchestrator.isInitialized()) {
      await orchestrator.shutdown();
    }
  });

  describe('initialize', () => {
    it('应该初始化所有模块', async () => {
      const result = await orchestrator.initialize();

      expect(result).toBe(true);
      expect(orchestrator.isInitialized()).toBe(true);

      const registry = orchestrator.getRegistry();
      expect(registry.getRegisteredModuleIds().length).toBeGreaterThan(0);
    });

    it('应该拒绝重复初始化', async () => {
      await orchestrator.initialize();
      const result = await orchestrator.initialize();

      expect(result).toBe(true);
    });
  });

  describe('getEcosystemHealth', () => {
    it('应该返回健康状态', async () => {
      await orchestrator.initialize();

      const health = await orchestrator.getEcosystemHealth();

      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('totalModules');
      expect(health).toHaveProperty('readyModules');
      expect(health).toHaveProperty('moduleStates');
      expect(health).toHaveProperty('checkedAt');
    });

    it('应该标记健康的生态系统', async () => {
      await orchestrator.initialize();

      const health = await orchestrator.getEcosystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.errorModules).toBe(0);
    });
  });

  describe('ContextInjector integration', () => {
    it('应该注册 Context 模块', async () => {
      await orchestrator.initialize();

      const registry = orchestrator.getRegistry();
      expect(registry.isRegistered('context')).toBe(true);
    });

    it('Context 模块应有 collect 能力', async () => {
      await orchestrator.initialize();

      const registry = orchestrator.getRegistry();
      const descriptor = registry.getModuleDescriptor('context');

      expect(descriptor).toBeDefined();
      expect(descriptor.capabilities).toContain('collect');
      expect(descriptor.version).toBe('0.10.0');
    });
  });

  describe('getRegistry', () => {
    it('应该返回注册表实例', () => {
      const registry = orchestrator.getRegistry();

      expect(registry).toBeDefined();
      expect(registry).toBeInstanceOf(ModuleRegistry);
    });
  });
});
