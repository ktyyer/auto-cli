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
import { COMPLEXITY_LEVELS, AGENT_STATES, COMPLEXITY_INDICATORS } from './agent-types.js';
import { AgentRegistry } from './agent-registry.js';

/**
 * 默认 Agent（无匹配时的兜底）
 */
const DEFAULT_AGENT = {
  name: 'quest-designer',
  reason: '无精确匹配，回退到闯关设计 Agent'
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

/**
 * CJK 关键词字典 — 用于中文分词
 * 按领域分类，覆盖常见开发术语
 */
const CJK_KEYWORDS = [
  // 架构
  '重构',
  '架构',
  '系统',
  '微服务',
  '分布式',
  '迁移',
  '整体',
  // 开发
  '功能',
  '实现',
  '开发',
  '新增',
  '修改',
  '集成',
  '优化',
  '修复',
  '测试',
  '单元测试',
  '集成测试',
  '端到端',
  // 操作
  '格式化',
  '重命名',
  '文档',
  '注释',
  '简单',
  '快速',
  '批量',
  // 安全
  '密码',
  '密钥',
  '认证',
  '授权',
  '权限',
  '注入',
  '加密',
  '安全',
  '漏洞',
  '泄露',
  '审查',
  '检查',
  // 质量
  '代码审查',
  '代码质量',
  '性能',
  '缓存',
  '死代码',
  '清理',
  // 流程
  '提交',
  '部署',
  '发布',
  '回滚',
  '分支',
  // 构建
  '构建',
  '编译',
  '类型',
  '错误',
  '失败'
];

/**
 * 对中文文本进行简单分词（基于词典匹配）
 * @param {string} text - 输入文本
 * @returns {string[]} 分词结果
 */
function segmentCJK(text) {
  const keywords = [];

  // 正向最大匹配：从长词到短词
  const sortedDict = [...CJK_KEYWORDS].sort((a, b) => b.length - a.length);

  let remaining = text;
  while (remaining.length > 0) {
    let matched = false;
    for (const word of sortedDict) {
      if (remaining.startsWith(word)) {
        keywords.push(word);
        remaining = remaining.slice(word.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 跳过单字符
      remaining = remaining.slice(1);
    }
  }

  return keywords;
}

export class CanonicalRouter {
  /**
   * @param {AgentRegistry} [registry] - Agent 注册表
   */
  constructor(registry) {
    this.registry = registry || new AgentRegistry();
    this.logger = logger;
    this._initialized = false;

    // 路由反馈回路：记录路由历史和成功率
    this._routingHistory = new Map();
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
    const feedbackId = `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = {
      agent: selected.agent,
      score: selected.score,
      matchReason: this._buildMatchReason(selected),
      fallbackChain: this.registry.getFallbackChain(selected.agent.name),
      isDefault: false,
      feedbackId
    };

    // 记录路由历史用于反馈回路
    this._recordRoutingAttempt(selected.agent.name, intent.keywords, feedbackId);

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

    // 提取英文关键词（基于 match 揾比 split更可靠)
    const englishKeywords = (lowerIntent.match(/[a-z0-9._-]+|[\u4e00-\u9fff]+/g) || []).filter(
      (t) => /^[a-z0-9._-]+$/.test(t) && t.length > 1
    );

    // 提取中文关键词（基于词典分词）
    const cjkKeywords = segmentCJK(userIntent);

    // 合并去重
    const allKeywords = [...new Set([...englishKeywords, ...cjkKeywords])];

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
      keywords: [...allKeywords, ...fileExtensions],
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

    // 根据复杂度偏好排序（匹配的复杂度优先）+ 历史成功率加权
    if (intent.complexity) {
      filtered = candidates.sort((a, b) => {
        const aMatch = a.agent.complexity === intent.complexity ? 10 : 0;
        const bMatch = b.agent.complexity === intent.complexity ? 10 : 0;

        // 反馈回路：历史成功率加权（至少 3 次记录才生效）
        const aPerf = this.getAgentPerformance(a.agent.name);
        const bPerf = this.getAgentPerformance(b.agent.name);
        const aFeedback = aPerf.total >= 3 ? (aPerf.successRate - 0.5) * 20 : 0;
        const bFeedback = bPerf.total >= 3 ? (bPerf.successRate - 0.5) * 20 : 0;

        return b.score + bMatch + bFeedback - (a.score + aMatch + aFeedback);
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
   * 记录路由尝试（反馈回路基础数据）
   * @param {string} agentName - 路由到的 Agent 名称
   * @param {string[]} keywords - 触发关键词
   * @param {string} feedbackId - 反馈 ID
   * @private
   */
  _recordRoutingAttempt(agentName, keywords, feedbackId) {
    this._routingHistory.set(feedbackId, {
      agentName,
      keywords: keywords.slice(0, 10),
      timestamp: Date.now(),
      outcome: null
    });
  }

  /**
   * 记录路由反馈（成功/失败）
   * 反馈回路：根据历史成功率调整未来路由决策
   * @param {string} feedbackId - 路由结果中的 feedbackId
   * @param {Object} feedback
   * @param {'success'|'failure'|'timeout'} feedback.outcome - 执行结果
   * @param {string} [feedback.reason] - 失败原因
   */
  recordFeedback(feedbackId, feedback) {
    const entry = this._routingHistory.get(feedbackId);
    if (!entry) {
      this.logger.debug(`路由反馈未找到: ${feedbackId}`);
      return;
    }

    entry.outcome = feedback.outcome;
    entry.reason = feedback.reason || null;

    // 清理旧历史（保留最近 100 条）
    if (this._routingHistory.size > 100) {
      const oldest = [...this._routingHistory.entries()].sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      );
      for (let i = 0; i < 20; i++) {
        this._routingHistory.delete(oldest[i][0]);
      }
    }

    this.logger.debug(`路由反馈: ${feedbackId} → ${feedback.outcome} for ${entry.agentName}`);
  }

  /**
   * 获取 Agent 的历史成功率（反馈回路核心）
   * @param {string} agentName
   * @returns {{ total: number, successes: number, failures: number, successRate: number }}
   */
  getAgentPerformance(agentName) {
    let total = 0;
    let successes = 0;
    let failures = 0;

    for (const entry of this._routingHistory.values()) {
      if (entry.agentName === agentName && entry.outcome) {
        total++;
        if (entry.outcome === 'success') successes++;
        else failures++;
      }
    }

    return Object.freeze({
      total,
      successes,
      failures,
      successRate: total > 0 ? successes / total : 0
    });
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
