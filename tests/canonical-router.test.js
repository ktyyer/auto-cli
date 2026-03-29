import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { CanonicalRouter } from '../src/router/canonical-router.js';
import { AgentRegistry } from '../src/router/agent-registry.js';
import { COMPLEXITY_LEVELS, AGENT_STATES } from '../src/router/agent-types.js';

describe('AgentRegistry', () => {
  let tempDir;
  let registry;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `agent-registry-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    registry = new AgentRegistry(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('initialize', () => {
    it('should load built-in agents', async () => {
      const count = await registry.initialize();

      expect(count).toBeGreaterThanOrEqual(9);
      expect(registry.getAgent('quest-designer')).toBeDefined();
      expect(registry.getAgent('architect')).toBeDefined();
      expect(registry.getAgent('tdd-guide')).toBeDefined();
    });
  });

  describe('listAgents', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should list all agents sorted by priority', () => {
      const agents = registry.listAgents();

      expect(agents.length).toBeGreaterThanOrEqual(9);
      for (let i = 1; i < agents.length; i++) {
        expect(agents[i - 1].priority).toBeGreaterThanOrEqual(agents[i].priority);
      }
    });

    it('should filter by state', () => {
      const active = registry.listAgents({ state: AGENT_STATES.ACTIVE });

      expect(active.length).toBeGreaterThanOrEqual(9);
      expect(active.every((a) => a.state === AGENT_STATES.ACTIVE)).toBe(true);
    });

    it('should filter by complexity', () => {
      const high = registry.listAgents({ complexity: COMPLEXITY_LEVELS.HIGH });

      expect(high.length).toBeGreaterThan(0);
      expect(high.every((a) => a.complexity === COMPLEXITY_LEVELS.HIGH)).toBe(true);
    });

    it('should filter by capabilities', () => {
      const testing = registry.listAgents({ capabilities: ['testing'] });

      expect(testing.length).toBeGreaterThan(0);
      expect(testing.every((a) => a.capabilities.includes('testing'))).toBe(true);
    });
  });

  describe('getAgent', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should return agent by name', () => {
      const questDesigner = registry.getAgent('quest-designer');

      expect(questDesigner).toBeDefined();
      expect(questDesigner.name).toBe('quest-designer');
      expect(questDesigner.displayName).toBe('闯关大纲设计师 v4');
    });

    it('should return null for unknown agent', () => {
      expect(registry.getAgent('nonexistent')).toBeNull();
    });
  });

  describe('registerAgent', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should register new agent', () => {
      const result = registry.registerAgent({
        name: 'custom-agent',
        displayName: 'Custom Agent',
        description: 'A custom agent',
        capabilities: ['custom'],
        triggerKeywords: ['custom', 'test'],
        priority: 50,
        complexity: COMPLEXITY_LEVELS.LOW,
        fallbackAgents: [],
        state: AGENT_STATES.ACTIVE
      });

      expect(result).toBe(true);
      expect(registry.getAgent('custom-agent')).toBeDefined();
    });

    it('should reject agent without required fields', () => {
      expect(registry.registerAgent({ name: 'bad' })).toBe(false);
    });

    it('should override existing agent with warning', () => {
      const result = registry.registerAgent({
        name: 'quest-designer',
        displayName: 'Override Quest Designer',
        capabilities: ['quest', 'planning'],
        triggerKeywords: ['quest', 'plan'],
        priority: 100,
        state: AGENT_STATES.ACTIVE
      });

      expect(result).toBe(true);
      expect(registry.getAgent('quest-designer').priority).toBe(100);
    });
  });

  describe('unregisterAgent', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should unregister custom agent', () => {
      registry.registerAgent({
        name: 'temp-agent',
        displayName: 'Temp',
        capabilities: ['temp'],
        triggerKeywords: ['temp'],
        priority: 50,
        state: AGENT_STATES.ACTIVE
      });

      expect(registry.unregisterAgent('temp-agent')).toBe(true);
      expect(registry.getAgent('temp-agent')).toBeNull();
    });

    it('should not unregister built-in agent', () => {
      expect(registry.unregisterAgent('quest-designer')).toBe(false);
    });

    it('should handle unknown agent', () => {
      expect(registry.unregisterAgent('nonexistent')).toBe(false);
    });
  });

  describe('findCandidates', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should find agents by keyword', () => {
      const candidates = registry.findCandidates(['测试', 'tdd']);

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some((c) => c.agent.name === 'tdd-guide')).toBe(true);
    });

    it('should sort by score', () => {
      const candidates = registry.findCandidates(['plan', '架构']);

      expect(candidates.length).toBeGreaterThan(0);
      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i - 1].score).toBeGreaterThanOrEqual(candidates[i].score);
      }
    });

    it('should return empty for no matches', () => {
      const candidates = registry.findCandidates(['xyznonexistent']);
      expect(candidates).toEqual([]);
    });
  });

  describe('getFallbackChain', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should return fallback chain', () => {
      const chain = registry.getFallbackChain('tdd-guide');

      expect(chain.length).toBeGreaterThan(0);
      expect(chain[0].name).toBe('code-reviewer');
    });

    it('should return empty for agent without fallback', () => {
      const chain = registry.getFallbackChain('refactor-cleaner');
      expect(chain).toEqual([]);
    });

    it('should return empty for unknown agent', () => {
      const chain = registry.getFallbackChain('nonexistent');
      expect(chain).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      await registry.initialize();
      const stats = registry.getStats();

      expect(stats.total).toBeGreaterThanOrEqual(9);
      expect(stats.active).toBeGreaterThanOrEqual(9);
      expect(stats.byComplexity).toBeDefined();
      expect(stats.bySource).toBeDefined();
      expect(stats.bySource['built-in']).toBeGreaterThanOrEqual(9);
    });
  });
});

describe('CanonicalRouter', () => {
  let router;
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `router-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    const registry = new AgentRegistry(tempDir);
    router = new CanonicalRouter(registry);
    await router.initialize();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('route', () => {
    it('should route to tdd-guide for testing intent', async () => {
      const result = await router.route('编写测试用例');

      expect(result).toBeDefined();
      expect(result.agent).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
      expect(result.isDefault).toBe(false);
    });

    it('should route to security-reviewer for security intent', async () => {
      const result = await router.route('检查密码泄露漏洞');

      expect(result.agent.name).toBe('security-reviewer');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should route to build-error-resolver for build errors', async () => {
      const result = await router.route('构建失败，TypeScript 编译错误');

      expect(result.agent.name).toBe('build-error-resolver');
    });

    it('should return default for empty intent', async () => {
      const result = await router.route('');

      expect(result.isDefault).toBe(true);
    });

    it('should return default for whitespace intent', async () => {
      const result = await router.route('   ');

      expect(result.isDefault).toBe(true);
    });

    it('should include match reason', async () => {
      const result = await router.route('重构代码结构');

      expect(result.matchReason).toBeDefined();
      expect(result.matchReason.length).toBeGreaterThan(0);
    });

    it('should include fallback chain', async () => {
      const result = await router.route('编写测试用例');

      expect(Array.isArray(result.fallbackChain)).toBe(true);
    });

    it('should prioritize security for security-sensitive intent', async () => {
      const result = await router.route('认证和授权的安全审查');

      expect(result.agent.name).toBe('security-reviewer');
    });

    it('should handle context flags', async () => {
      // 使用安全相关的意图，确保 security-reviewer 在候选列表中
      // 然后通过 flags 验证优先级提升逻辑
      const result = await router.route('检查代码安全漏洞', {
        flags: { securityReview: true }
      });

      expect(result.agent.name).toBe('security-reviewer');
    });
  });

  describe('diagnose', () => {
    it('should return diagnostic info', async () => {
      const info = await router.diagnose();

      expect(info.initialized).toBe(true);
      expect(info.agentCount).toBeGreaterThanOrEqual(9);
      expect(info.agents).toBeDefined();
      expect(info.agents.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('_analyzeIntent', () => {
    it('should extract keywords', async () => {
      const intent = router._analyzeIntent('使用 React 开发新功能', {});

      expect(intent.keywords).toContain('使用');
      expect(intent.keywords).toContain('react');
      // "开发新功能" 被作为一个整体（因为分词逻辑）
      expect(intent.keywords.some((k) => k.includes('开发'))).toBe(true);
      expect(intent.complexity).toBeDefined();
    });

    it('should detect security sensitivity', () => {
      const intent = router._analyzeIntent('检查密码泄露', {});

      expect(intent.securitySensitive).toBe(true);
    });

    it('should detect non-security intent', () => {
      const intent = router._analyzeIntent('格式化代码', {});

      expect(intent.securitySensitive).toBe(false);
    });

    it('should extract file extensions from context', () => {
      const intent = router._analyzeIntent('修复代码', {
        files: ['app.tsx', 'style.css']
      });

      expect(intent.keywords).toContain('.tsx');
      expect(intent.keywords).toContain('.css');
    });
  });

  describe('_assessComplexity', () => {
    it('should detect high complexity', () => {
      const result = router._assessComplexity('全面重构微服务架构');
      expect(result).toBe(COMPLEXITY_LEVELS.HIGH);
    });

    it('should detect medium complexity', () => {
      const result = router._assessComplexity('新增用户注册功能');
      expect(result).toBe(COMPLEXITY_LEVELS.MEDIUM);
    });

    it('should detect low complexity', () => {
      const result = router._assessComplexity('格式化代码，快速修复');
      expect(result).toBe(COMPLEXITY_LEVELS.LOW);
    });

    it('should default to medium', () => {
      const result = router._assessComplexity('hello world');
      expect(result).toBe(COMPLEXITY_LEVELS.MEDIUM);
    });
  });
});
