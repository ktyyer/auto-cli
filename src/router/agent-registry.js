/**
 * Agent 注册表
 *
 * 核心功能：
 * - 注册和管理 Agent 清单
 * - 按能力/关键词/优先级查询 Agent
 * - 为 Canonical Router 提供数据源
 * - 从 Agent .md 文件自动提取清单
 */
import path from 'node:path';
import fs from 'fs-extra';
import { logger } from '../logger.js';
import { COMPLEXITY_LEVELS, AGENT_STATES } from './agent-types.js';

const AGENTS_DIR_NAME = 'agents';

/**
 * 内置 Agent 清单定义
 * @type {import('./agent-types.js').AgentManifest[]}
 */
const BUILT_IN_AGENTS = [
  {
    name: 'architect',
    displayName: '系统设计和架构决策',
    description: '架构决策、技术选型、系统边界划分',
    capabilities: ['architecture', 'design', 'tech-selection', 'system-boundary'],
    triggerKeywords: [
      'architecture',
      '架构',
      'design',
      '设计',
      'structure',
      '结构',
      'refactor',
      '重构'
    ],
    priority: 85,
    complexity: COMPLEXITY_LEVELS.HIGH,
    fallbackAgents: ['quest-designer'],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '1.0.0',
    tags: ['core', 'architecture']
  },
  {
    name: 'tdd-guide',
    displayName: '测试驱动开发专家',
    description: '强制 TDD 工作流：红灯-绿灯-重构',
    capabilities: ['testing', 'tdd', 'coverage', 'unit-test', 'integration-test'],
    triggerKeywords: ['test', '测试', 'tdd', 'spec', 'coverage', '覆盖率', 'vitest', 'jest'],
    priority: 75,
    complexity: COMPLEXITY_LEVELS.MEDIUM,
    fallbackAgents: ['code-reviewer'],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '1.0.0',
    tags: ['core', 'testing']
  },
  {
    name: 'code-reviewer',
    displayName: '代码质量审查',
    description: '代码质量、可维护性、最佳实践审查',
    capabilities: ['review', 'quality', 'maintainability', 'best-practices'],
    triggerKeywords: ['review', '审查', 'code-review', '质量', 'quality', 'reviewer'],
    priority: 70,
    complexity: COMPLEXITY_LEVELS.LOW,
    fallbackAgents: [],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '1.0.0',
    tags: ['core', 'review']
  },
  {
    name: 'security-reviewer',
    displayName: '安全漏洞检测',
    description: '安全扫描、漏洞检测、密钥泄露检查',
    capabilities: ['security', 'vulnerability', 'secret-detection', 'xss', 'sql-injection'],
    triggerKeywords: [
      'security',
      '安全',
      '漏洞',
      'vulnerability',
      'auth',
      '认证',
      '密钥',
      'secret'
    ],
    priority: 95,
    complexity: COMPLEXITY_LEVELS.MEDIUM,
    fallbackAgents: ['code-reviewer'],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '1.0.0',
    tags: ['core', 'security']
  },
  {
    name: 'build-error-resolver',
    displayName: '构建错误修复',
    description: '构建失败、TypeScript 错误、依赖冲突修复',
    capabilities: ['build', 'error-fix', 'typescript', 'dependency'],
    triggerKeywords: [
      'build',
      '构建',
      'error',
      '错误',
      'compile',
      '编译',
      'typescript',
      'fail',
      '失败'
    ],
    priority: 90,
    complexity: COMPLEXITY_LEVELS.LOW,
    fallbackAgents: [],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '1.0.0',
    tags: ['core', 'build']
  },
  {
    name: 'e2e-runner',
    displayName: 'E2E 测试管理',
    description: 'Playwright 端到端测试、关键用户流程验证',
    capabilities: ['e2e', 'playwright', 'browser-test', 'user-flow'],
    triggerKeywords: ['e2e', 'end-to-end', '端到端', 'playwright', 'browser', '浏览器测试'],
    priority: 65,
    complexity: COMPLEXITY_LEVELS.MEDIUM,
    fallbackAgents: ['tdd-guide'],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '1.0.0',
    tags: ['core', 'testing']
  },
  {
    name: 'refactor-cleaner',
    displayName: '死代码清理',
    description: '识别和清理死代码、未使用的导入、冗余逻辑',
    capabilities: ['refactor', 'cleanup', 'dead-code', 'unused-imports'],
    triggerKeywords: ['refactor', '清理', 'clean', 'dead-code', 'unused', '冗余', '重构'],
    priority: 55,
    complexity: COMPLEXITY_LEVELS.LOW,
    fallbackAgents: [],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '1.0.0',
    tags: ['core', 'maintenance']
  },
  {
    name: 'doc-updater',
    displayName: '文档更新',
    description: '自动更新项目文档、README、API 文档',
    capabilities: ['documentation', 'readme', 'api-doc', 'changelog'],
    triggerKeywords: ['doc', '文档', 'readme', 'documentation', 'changelog', '更新文档'],
    priority: 50,
    complexity: COMPLEXITY_LEVELS.LOW,
    fallbackAgents: [],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '1.0.0',
    tags: ['core', 'documentation']
  },
  {
    name: 'quest-designer',
    displayName: '闯关大纲设计师 v4',
    description: '完整代码输出的闯关式开发规划',
    capabilities: ['quest', 'planning', 'code-generation', 'step-by-step'],
    triggerKeywords: ['quest', '闯关', '大纲', '蓝图', 'blueprint', 'quest-map'],
    priority: 82,
    complexity: COMPLEXITY_LEVELS.HIGH,
    fallbackAgents: ['architect'],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '4.0.0',
    tags: ['core', 'planning']
  }
];

export class AgentRegistry {
  /**
   * @param {string} [projectDir] - 项目根目录
   */
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.agents = new Map();
    this.logger = logger;
  }

  /**
   * 初始化注册表（加载内置 + 自定义 Agent）
   * @returns {Promise<number>} 注册的 Agent 数量
   */
  async initialize() {
    // 加载内置 Agent
    for (const manifest of BUILT_IN_AGENTS) {
      this.agents.set(manifest.name, { ...manifest });
    }

    // 加载自定义 Agent（从项目 .claude/agents/ 目录）
    await this._loadCustomAgents();

    this.logger.info(`Agent 注册表初始化完成：${this.agents.size} 个 Agent`);
    return this.agents.size;
  }

  /**
   * 获取所有已注册的 Agent 清单
   * @param {Object} [filters] - 过滤条件
   * @param {string} [filters.state] - 按状态过滤
   * @param {string} [filters.complexity] - 按复杂度过滤
   * @param {string[]} [filters.capabilities] - 按能力过滤（任一匹配）
   * @returns {import('./agent-types.js').AgentManifest[]}
   */
  listAgents(filters = {}) {
    let results = Array.from(this.agents.values());

    if (filters.state) {
      results = results.filter((a) => a.state === filters.state);
    }

    if (filters.complexity) {
      results = results.filter((a) => a.complexity === filters.complexity);
    }

    if (filters.capabilities && filters.capabilities.length > 0) {
      results = results.filter((a) =>
        filters.capabilities.some((cap) => a.capabilities.includes(cap))
      );
    }

    return results.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取单个 Agent 清单
   * @param {string} name - Agent 名称
   * @returns {import('./agent-types.js').AgentManifest|null}
   */
  getAgent(name) {
    return this.agents.get(name) || null;
  }

  /**
   * 注册新的 Agent
   * @param {import('./agent-types.js').AgentManifest} manifest
   * @returns {boolean}
   */
  registerAgent(manifest) {
    if (!manifest.name || !manifest.triggerKeywords || !manifest.capabilities) {
      this.logger.error('Agent 清单必须包含 name, triggerKeywords, capabilities');
      return false;
    }

    if (this.agents.has(manifest.name)) {
      this.logger.warn(`Agent "${manifest.name}" 已存在，将被覆盖`);
    }

    this.agents.set(manifest.name, {
      ...manifest,
      source: manifest.source || 'custom',
      state: manifest.state || AGENT_STATES.ACTIVE
    });

    this.logger.info(`Agent 已注册: ${manifest.name}`);
    return true;
  }

  /**
   * 注销 Agent
   * @param {string} name - Agent 名称
   * @returns {boolean}
   */
  unregisterAgent(name) {
    if (!this.agents.has(name)) {
      this.logger.warn(`Agent "${name}" 不存在`);
      return false;
    }

    const agent = this.agents.get(name);
    if (agent.source === 'built-in') {
      this.logger.warn(`无法注销内置 Agent: ${name}`);
      return false;
    }

    this.agents.delete(name);
    this.logger.info(`Agent 已注销: ${name}`);
    return true;
  }

  /**
   * 按关键词查找候选 Agent
   * @param {string[]} keywords - 关键词列表
   * @returns {Array<{agent: import('./agent-types.js').AgentManifest, score: number, matchedKeywords: string[]}>}
   */
  findCandidates(keywords) {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    const candidates = [];

    for (const agent of this.agents.values()) {
      if (agent.state !== AGENT_STATES.ACTIVE) {
        continue;
      }

      const matchedKeywords = agent.triggerKeywords.filter((trigger) =>
        lowerKeywords.some(
          (kw) => kw.includes(trigger.toLowerCase()) || trigger.toLowerCase().includes(kw)
        )
      );

      if (matchedKeywords.length > 0) {
        // 评分：匹配关键词数 * 10 + Agent 优先级
        const score = matchedKeywords.length * 10 + agent.priority;
        candidates.push({ agent, score, matchedKeywords });
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * 获取 Agent 的回退链
   * @param {string} agentName - Agent 名称
   * @returns {import('./agent-types.js').AgentManifest[]}
   */
  getFallbackChain(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent || !agent.fallbackAgents || agent.fallbackAgents.length === 0) {
      return [];
    }

    return agent.fallbackAgents
      .map((name) => this.agents.get(name))
      .filter((a) => a && a.state === AGENT_STATES.ACTIVE);
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    const all = Array.from(this.agents.values());
    const byComplexity = { low: 0, medium: 0, high: 0 };
    const bySource = {};

    for (const agent of all) {
      byComplexity[agent.complexity] = (byComplexity[agent.complexity] || 0) + 1;
      bySource[agent.source] = (bySource[agent.source] || 0) + 1;
    }

    return {
      total: all.length,
      active: all.filter((a) => a.state === AGENT_STATES.ACTIVE).length,
      byComplexity,
      bySource
    };
  }

  /**
   * 加载自定义 Agent
   * @private
   */
  async _loadCustomAgents() {
    const agentsDir = path.join(this.projectDir, AGENTS_DIR_NAME);

    if (!(await fs.pathExists(agentsDir))) {
      return;
    }

    try {
      const files = await fs.readdir(agentsDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(agentsDir, file);
        const name = path.basename(file, '.md');

        // 跳过已注册为内置的 Agent
        if (this.agents.has(name)) {
          const existing = this.agents.get(name);
          existing.filePath = filePath;
          continue;
        }

        const manifest = await this._parseAgentFile(filePath, name);
        if (manifest) {
          this.agents.set(name, manifest);
        }
      }
    } catch (error) {
      this.logger.warn(`加载自定义 Agent 失败: ${error.message}`);
    }
  }

  /**
   * 解析 Agent .md 文件，提取清单
   * @param {string} filePath
   * @param {string} name
   * @returns {Promise<import('./agent-types.js').AgentManifest|null>}
   * @private
   */
  async _parseAgentFile(filePath, name) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const firstLine = content.split('\n')[0] || '';
      const title = firstLine.replace(/^#+\s*/, '').trim() || name;

      return {
        name,
        displayName: title,
        description: content.slice(0, 200).trim(),
        capabilities: [],
        triggerKeywords: [name],
        priority: 50,
        complexity: COMPLEXITY_LEVELS.MEDIUM,
        fallbackAgents: [],
        state: AGENT_STATES.ACTIVE,
        source: 'custom',
        version: '1.0.0',
        filePath,
        tags: []
      };
    } catch (error) {
      this.logger.warn(`解析 Agent 文件失败 ${filePath}: ${error.message}`);
      return null;
    }
  }
}

export default AgentRegistry;
