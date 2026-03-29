/**
 * Canonical Router（权威路由器）
 *
 * 核心原则（来自 Vibe-Skills 分析）：
 * - 单一真相源：所有路由决策必须经过这里
 * - 技能隔离：Agent 之间不能直接调用，只能由 Router 调度
 * - 优先级明确：每个 Agent 有明确的触发条件和优先级
 * - 完整回退链：主 Agent 失败 -> 备用 Agent -> 降级处理
 *
 * 路由决策流程：
 * 1. 意图识别（提取关键词 + 复杂度评估）
 * 2. 候选匹配（基于关键词 + 能力 + 优先级）
 * 3. 冲突解决（多个候选时选最优）
 * 4. 执行 + 回退处理
 */
import { logger } from '../logger.js';
import { COMPLEXITY_LEVELS, AGENT_STATES } from './agent-types.js';
import { AgentRegistry } from './agent-registry.js';

/**
 * 默认 Agent（无匹配时的兜底）
 */
const DEFAULT_AGENT = {
  name: 'quest-designer',
  reason: '无精确匹配，回退到闯关设计 Agent'
};

/**
 * 复杂度评估关键词
 */
const COMPLEXITY_INDICATORS = {
  [COMPLEXITY_LEVELS.HIGH]: [
    '重构',
    '架构',
    '系统',
    '迁移',
    '全面',
    'redesign',
    'refactor',
    'microservice',
    '微服务',
    '分布式',
    '整体',
    '批量'
  ],
  [COMPLEXITY_LEVELS.MEDIUM]: [
    '功能',
    '实现',
    '开发',
    '新增',
    '修改',
    'feature',
    'implement',
    '集成',
    '优化',
    'fix',
    '修复'
  ],
  [COMPLEXITY_LEVELS.LOW]: [
    '格式化',
    '格式',
    'rename',
    '重命名',
    '文档',
    '注释',
    '格式',
    'format',
    'lint',
    '简单',
    '快速'
  ]
};

/**
 * 安全敏感关键词（安全相关意图自动提升优先级）
 */
const SECURITY_KEYWORDS = [
  '密码',
  'password',
  '密钥',
  'secret',
  'token',
  '认证',
  'auth',
  '授权',
  '权限',
  'permission',
  '注入',
  'injection',
  'xss',
  'csrf',
  '漏洞',
  'vulnerability',
  '安全',
  'security',
  '加密',
  'encrypt'
];

export class CanonicalRouter {
  /**
   * @param {AgentRegistry} [registry] - Agent 注册表
   */
  constructor(registry) {
    this.registry = registry || new AgentRegistry();
    this.logger = logger;
    this._initialized = false;
  }

  /**
   * 初始化路由器（必须在使用前调用）
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this._initialized) {
      await this.registry.initialize();
      this._initialized = true;
    }
  }

  /**
   * 核心路由方法：唯一的决策入口
   * @param {string} userIntent - 用户意图（自然语言描述）
   * @param {Object} [context] - 上下文
   * @param {string} [context.scope] - 作用域（pre-commit, edit, on-demand）
   * @param {string[]} [context.files] - 涉及的文件列表
   * @param {Object} [context.flags] - 标志位
   * @returns {Promise<import('./agent-types.js').RouteResult>}
   */
  async route(userIntent, context = {}) {
    if (!this._initialized) {
      await this.initialize();
    }

    if (!userIntent || !userIntent.trim()) {
      return this._defaultRoute('空意图');
    }

    // 1. 意图分析
    const intent = this._analyzeIntent(userIntent, context);

    this.logger.info(
      `路由分析: 关键词=[${intent.keywords.slice(0, 5).join(',')}] ` +
        `复杂度=${intent.complexity} 安全敏感=${intent.securitySensitive}`
    );

    // 2. 候选匹配
    const candidates = this.registry.findCandidates(intent.keywords);

    if (candidates.length === 0) {
      return this._defaultRoute('无匹配 Agent');
    }

    // 3. 应用上下文过滤
    const filtered = this._applyContextFilters(candidates, intent, context);

    if (filtered.length === 0) {
      return this._defaultRoute('上下文过滤后无匹配');
    }

    // 4. 安全优先提升
    const ranked = this._applySecurityPriority(filtered, intent);

    // 5. 选择最优候选
    const selected = ranked[0];

    // 6. 构建路由结果
    const result = {
      agent: selected.agent,
      score: selected.score,
      matchReason: this._buildMatchReason(selected),
      fallbackChain: this.registry.getFallbackChain(selected.agent.name),
      isDefault: false
    };

    this.logger.info(
      `路由结果: agent=${result.agent.name} score=${result.score} reason=${result.matchReason}`
    );

    return result;
  }

  /**
   * 分析用户意图
   * @param {string} userIntent
   * @param {Object} context
   * @returns {Object}
   * @private
   */
  _analyzeIntent(userIntent, context) {
    const lowerIntent = userIntent.toLowerCase();

    // 提取关键词
    const keywords = lowerIntent.split(/[\s,，。.、；;！!？?：:]+/).filter((w) => w.length > 1);

    // 评估复杂度
    const complexity = this._assessComplexity(lowerIntent);

    // 检查安全敏感性
    const securitySensitive = SECURITY_KEYWORDS.some((kw) => lowerIntent.includes(kw));

    // 提取文件扩展名作为额外关键词
    const fileExtensions = (context.files || [])
      .map((f) => {
        const ext = f.split('.').pop();
        return ext ? `.${ext}` : '';
      })
      .filter(Boolean);

    return {
      keywords: [...keywords, ...fileExtensions],
      complexity,
      securitySensitive,
      originalIntent: userIntent
    };
  }

  /**
   * 评估任务复杂度
   * @param {string} text
   * @returns {string}
   * @private
   */
  _assessComplexity(text) {
    const scores = {
      [COMPLEXITY_LEVELS.HIGH]: 0,
      [COMPLEXITY_LEVELS.MEDIUM]: 0,
      [COMPLEXITY_LEVELS.LOW]: 0
    };

    for (const [level, indicators] of Object.entries(COMPLEXITY_INDICATORS)) {
      for (const indicator of indicators) {
        if (text.includes(indicator)) {
          scores[level] += 1;
        }
      }
    }

    // 取最高分
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      return COMPLEXITY_LEVELS.MEDIUM; // 默认中等
    }

    for (const [level, score] of Object.entries(scores)) {
      if (score === maxScore) {
        return level;
      }
    }

    return COMPLEXITY_LEVELS.MEDIUM;
  }

  /**
   * 应用上下文过滤器
   * @param {Array} candidates
   * @param {Object} intent
   * @param {Object} context
   * @returns {Array}
   * @private
   */
  _applyContextFilters(candidates, intent, context) {
    let filtered = candidates;

    // 如果上下文指定了安全相关标志，优先安全 Agent
    if (context.flags && context.flags.securityReview) {
      const securityAgent = candidates.find((c) => c.agent.name === 'security-reviewer');
      if (securityAgent) {
        return [securityAgent];
      }
    }

    // 根据复杂度偏好排序（匹配的复杂度优先）
    if (intent.complexity) {
      filtered = candidates.sort((a, b) => {
        const aMatch = a.agent.complexity === intent.complexity ? 10 : 0;
        const bMatch = b.agent.complexity === intent.complexity ? 10 : 0;
        return b.score + bMatch - (a.score + aMatch);
      });
    }

    return filtered;
  }

  /**
   * 安全优先提升
   * @param {Array} candidates
   * @param {Object} intent
   * @returns {Array}
   * @private
   */
  _applySecurityPriority(candidates, intent) {
    if (!intent.securitySensitive) {
      return candidates;
    }

    // 安全敏感时，提升 security-reviewer 的优先级
    return candidates
      .map((c) => {
        if (c.agent.name === 'security-reviewer') {
          return { ...c, score: c.score + 50 };
        }
        return c;
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 构建匹配原因说明
   * @param {Object} selected
   * @returns {string}
   * @private
   */
  _buildMatchReason(selected) {
    const matchedKw = selected.matchedKeywords.join(', ');
    return `匹配关键词: [${matchedKw}], 优先级: ${selected.agent.priority}`;
  }

  /**
   * 返回默认路由
   * @param {string} reason
   * @returns {Object}
   * @private
   */
  _defaultRoute(reason) {
    const defaultAgent = this.registry.getAgent(DEFAULT_AGENT.name);

    if (!defaultAgent) {
      // 终极回退：返回 quest-designer 的信息（即使 registry 为空）
      return {
        agent: {
          name: DEFAULT_AGENT.name,
          displayName: '通用规划',
          description: DEFAULT_AGENT.reason,
          capabilities: ['planning'],
          triggerKeywords: [],
          priority: 0,
          complexity: COMPLEXITY_LEVELS.MEDIUM,
          fallbackAgents: [],
          state: AGENT_STATES.ACTIVE,
          source: 'fallback'
        },
        score: 0,
        matchReason: `默认路由: ${reason}`,
        fallbackChain: [],
        isDefault: true
      };
    }

    return {
      agent: defaultAgent,
      score: 0,
      matchReason: `默认路由: ${reason}`,
      fallbackChain: this.registry.getFallbackChain(defaultAgent.name),
      isDefault: true
    };
  }

  /**
   * 获取路由器的诊断信息
   * @returns {Promise<Object>}
   */
  async diagnose() {
    if (!this._initialized) {
      await this.initialize();
    }

    return {
      initialized: this._initialized,
      agentCount: this.registry.agents.size,
      agents: this.registry.listAgents().map((a) => ({
        name: a.name,
        priority: a.priority,
        state: a.state,
        triggerCount: a.triggerKeywords.length
      }))
    };
  }
}

export default CanonicalRouter;
