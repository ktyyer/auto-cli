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
    name: 'verification',
    displayName: '对抗性验证',
    description: '红蓝对抗验证，主动寻找代码漏洞、边界缺陷和并发风险',
    capabilities: [
      'verification',
      'adversarial-testing',
      'boundary-testing',
      'concurrency',
      'idempotency'
    ],
    triggerKeywords: [
      'verify',
      '验证',
      'adversarial',
      '对抗',
      'break',
      '破坏',
      'attack',
      '攻击',
      'edge-case',
      '边界'
    ],
    priority: 72,
    complexity: COMPLEXITY_LEVELS.MEDIUM,
    fallbackAgents: ['code-reviewer'],
    state: AGENT_STATES.ACTIVE,
    source: 'built-in',
    version: '1.0.0',
    tags: ['core', 'verification']
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
    this._lazyQueue = []; // 延迟注册队列
    this._initialized = false;
  }

  /**
   * 初始化注册表（加载内置 + 自定义 Agent）
   * @returns {Promise<number>} 注册的 Agent 数量
   */
  async initialize() {
    if (this._initialized) {
      this.logger.warn('Agent 注册表已初始化，跳过重复调用');
      return this.agents.size;
    }

    // 加载内置 Agent
    for (const manifest of BUILT_IN_AGENTS) {
      this.agents.set(manifest.name, { ...manifest });
    }

    // 加载自定义 Agent（从项目 .claude/agents/ 目录）
    await this._loadCustomAgents();

    // 处理延迟注册队列
    this._flushLazyQueue();

    this._initialized = true;
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
   * 渐进式注册：延迟注册 Agent（初始化前入队，初始化后立即注册）
   * @param {import('./agent-types.js').AgentManifest} manifest
   * @returns {boolean}
   */
  lazyRegister(manifest) {
    if (!manifest.name || !manifest.triggerKeywords || !manifest.capabilities) {
      this.logger.error('延迟注册需要 name, triggerKeywords, capabilities 字段');
      return false;
    }

    if (this._initialized) {
      return this.registerAgent(manifest);
    }

    this._lazyQueue.push(manifest);
    this.logger.debug(`Agent 延迟注册入队: ${manifest.name}`);
    return true;
  }

  /**
   * 组建 Agent 团队（Coordinator-Worker 简化版）
   *
   * 根据任务关键词和复杂度，自动选择一组互补的 Agent：
   * - 主 Agent：评分最高的候选
   * - 辅助 Agent：能力互补的候选（去重）
   * - 回退链：主 Agent 的 fallback
   *
   * @param {Object} params
   * @param {string[]} params.keywords - 任务关键词
   * @param {string} [params.complexity] - 任务复杂度
   * @param {number} [params.maxSize=3] - 团队最大人数
   * @returns {{ lead: Object|null, members: Object[], fallbacks: Object[] }}
   */
  resolveTeam({ keywords, complexity, maxSize = 3 }) {
    const clampedSize = Math.max(1, Math.min(maxSize, 10));
    const candidates = this.findCandidates(keywords);

    if (candidates.length === 0) {
      return { lead: null, members: [], fallbacks: [] };
    }

    // 主 Agent = 评分最高
    const lead = candidates[0].agent;

    // 辅助成员：贪心选择能力互补的候选
    const leadCaps = new Set(lead.capabilities);
    const members = [];

    for (let i = 1; i < candidates.length && members.length < clampedSize - 1; i++) {
      const candidate = candidates[i].agent;

      // 复杂度过滤
      if (complexity && candidate.complexity !== complexity) {
        continue;
      }

      // 检查能力互补性（至少有一个不重叠的能力）
      const hasUniqueCap = candidate.capabilities.some((cap) => !leadCaps.has(cap));
      if (hasUniqueCap) {
        members.push(candidate);
        candidate.capabilities.forEach((cap) => leadCaps.add(cap));
      }
    }

    // 回退链
    const fallbacks = this.getFallbackChain(lead.name);

    return { lead, members, fallbacks };
  }

  /**
   * 处理延迟注册队列
   * @private
   */
  _flushLazyQueue() {
    while (this._lazyQueue.length > 0) {
      const batch = this._lazyQueue;
      this._lazyQueue = [];
      for (const manifest of batch) {
        try {
          this.registerAgent(manifest);
        } catch (error) {
          this.logger.error(`延迟注册失败 ${manifest.name}: ${error.message}`);
        }
      }
    }
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
  /**
   * 解析 Agent .md 文件，提取清单（支持 YAML frontmatter）
   *
   * Frontmatter 格式（--- 包裹）：
   * ---
   * name: agent-name
   * description: Agent 描述
   * capabilities: [cap1, cap2]
   * triggerKeywords: [kw1, kw2]
   * priority: 75
   * complexity: medium
   * fallbackAgents: [other-agent]
   * state: active
   * source: custom
   * version: '1.0.0'
   * tags: [tag1]
   * ---
   *
   * @param {string} filePath
   * @param {string} name
   * @returns {Promise<import('./agent-types.js').AgentManifest|null>}
   * @private
   */
  /**
   * 从 Markdown 内容提取 YAML frontmatter
   * @param {string} content - 文件内容
   * @returns {{ frontmatter: Object|null, bodyStart: number }}
   * @private
   */
  _extractFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) {
      return { frontmatter: null, bodyStart: 0 };
    }

    const yaml = match[1];
    const frontmatter = {};

    for (const line of yaml.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const key = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      // Parse array values: [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
      // Parse numeric values
      else if (/^-?\d+(\.\d+)?$/.test(value)) {
        value = Number(value);
      }
      // Parse boolean values
      else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      }
      // Strip quotes from string values
      else if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }

    // bodyStart = position after closing ---
    const bodyStart = match[0].length + match.index;
    return { frontmatter, bodyStart };
  }

  async _parseAgentFile(filePath, name) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, bodyStart } = this._extractFrontmatter(content);

      // Fallback: first non-heading line as title
      const firstLine = content.split('\n')[0] || '';
      const title = firstLine.replace(/^#+\s*/, '').trim() || name;

      // Build manifest with defaults
      const manifest = {
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

      // Override with frontmatter values if present
      if (frontmatter) {
        if (frontmatter.name) manifest.name = frontmatter.name;
        if (frontmatter.displayName) manifest.displayName = frontmatter.displayName;
        if (frontmatter.description) manifest.description = frontmatter.description;
        if (frontmatter.capabilities) manifest.capabilities = frontmatter.capabilities;
        if (frontmatter.triggerKeywords) {
          manifest.triggerKeywords = frontmatter.triggerKeywords;
        }
        if (typeof frontmatter.priority === 'number') manifest.priority = frontmatter.priority;
        if (frontmatter.complexity) manifest.complexity = frontmatter.complexity;
        if (frontmatter.fallbackAgents) manifest.fallbackAgents = frontmatter.fallbackAgents;
        if (frontmatter.state) manifest.state = frontmatter.state;
        if (frontmatter.source) manifest.source = frontmatter.source;
        if (frontmatter.version) manifest.version = frontmatter.version;
        if (frontmatter.tags) manifest.tags = frontmatter.tags;
      }

      // Extract description from body if not in frontmatter
      if (bodyStart > 0 && !frontmatter?.description) {
        const lines = content
          .split('\n')
          .slice(bodyStart)
          .filter((l) => l.trim());
        const descriptionLines = lines
          .filter((l) => l.length > 0 && l.length < 200)
          .slice(0, 3)
          .join(' ');
        if (descriptionLines.length > 0) {
          manifest.description = descriptionLines;
        }
      }

      return manifest;
    } catch (error) {
      this.logger.warn(`解析 Agent 文件失败 ${filePath}: ${error.message}`);
      return null;
    }
  }
}

export default AgentRegistry;
