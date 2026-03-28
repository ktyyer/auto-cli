/**
 * 治理规则引擎
 *
 * 核心功能：
 * - 加载和管理治理规则
 * - 验证操作是否符合规则
 * - 执行规则动作
 * - 优先级管理
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { logger } from '../logger.js';
import { RULE_ACTIONS, RULE_PRIORITIES } from './rule-types.js';

const RULES_INDEX_FILE = path.join(os.homedir(), '.auto', 'rules', 'index.json');

export class RuleEngine {
  constructor() {
    this.rulesIndexFile = RULES_INDEX_FILE;
    this.logger = logger;
    this.rules = [];
  }

  /**
   * 确保目录结构存在
   * @private
   */
  async _ensureStructure() {
    await fs.ensureDir(path.join(os.homedir(), '.auto', 'rules'));
  }

  /**
   * 加载规则定义
   * @param {string} rulesPath - 规则文件路径
   * @returns {Promise<Array>} 规则列表
   */
  async loadRules(rulesPath = null) {
    try {
      await this._ensureStructure();

      // 如果指定了规则文件，从文件加载
      if (rulesPath && (await fs.pathExists(rulesPath))) {
        const customRules = await this._loadRulesFromFile(rulesPath);
        this.rules = [...this._getDefaultRules(), ...customRules];
      } else {
        // 否则使用默认规则
        this.rules = this._getDefaultRules();
      }

      // 从索引文件加载自定义规则
      if (await fs.pathExists(this.rulesIndexFile)) {
        const index = await fs.readJson(this.rulesIndexFile);
        if (index.rules && index.rules.length > 0) {
          this.rules = [...this.rules, ...index.rules];
        }
      }

      // 按优先级排序
      this._sortRules();

      this.logger.info(`已加载 ${this.rules.length} 条治理规则`);
      return this.rules;
    } catch (error) {
      this.logger.warn(`加载规则失败: ${error.message}`);
      this.rules = this._getDefaultRules();
      return this.rules;
    }
  }

  /**
   * 从文件加载规则
   * @private
   * @param {string} rulesPath - 规则文件路径
   * @returns {Promise<Array>} 规则列表
   */
  async _loadRulesFromFile(rulesPath) {
    const ext = path.extname(rulesPath).toLowerCase();

    if (ext === '.json') {
      const data = await fs.readJson(rulesPath);
      return Array.isArray(data) ? data : data.rules || [];
    } else if (ext === '.yaml' || ext === '.yml') {
      // YAML 解析（需要 js-yaml 库，暂时返回空数组）
      this.logger.warn('YAML 规则文件暂不支持');
      return [];
    }

    return [];
  }

  /**
   * 获取默认规则
   * @private
   * @returns {Array} 默认规则列表
   */
  _getDefaultRules() {
    return [
      {
        name: 'prevent-force-push',
        description: '禁止强制推送到主分支',
        trigger: ['push', 'force'],
        priority: RULE_PRIORITIES.CRITICAL,
        action: RULE_ACTIONS.BLOCK,
        scope: 'pre-commit',
        critical: true,
        message: '禁止强制推送到主分支，可能导致数据丢失'
      },
      {
        name: 'require-security-review',
        description: '安全相关代码需要安全审查',
        trigger: ['auth', 'password', 'token', 'api', 'sql', 'input', 'secret', 'key'],
        priority: RULE_PRIORITIES.CRITICAL,
        action: RULE_ACTIONS.REQUIRE,
        scope: 'edit',
        critical: true,
        requires: ['security-review'],
        message: '检测到安全相关代码，建议使用 security-reviewer agent 进行审查'
      },
      {
        name: 'require-test-coverage',
        description: '新功能需要测试覆盖',
        trigger: ['new', 'feature', 'implement', 'function', 'method'],
        priority: RULE_PRIORITIES.HIGH,
        action: RULE_ACTIONS.REQUIRE,
        scope: 'pre-commit',
        critical: false,
        requires: ['tdd-guide'],
        message: '检测到新功能实现，建议使用 TDD 方法确保测试覆盖率 >= 80%'
      },
      {
        name: 'test-before-fix',
        description: 'Bug 修复前先编写测试',
        trigger: ['fix', 'bug', 'error', 'issue'],
        priority: RULE_PRIORITIES.HIGH,
        action: RULE_ACTIONS.WARN,
        scope: 'edit',
        critical: false,
        message: 'Bug 修复建议：先编写失败的测试用例，然后修复代码使其通过'
      },
      {
        name: 'code-review-before-commit',
        description: '提交前进行代码审查',
        trigger: ['commit', 'save'],
        priority: RULE_PRIORITIES.MEDIUM,
        action: RULE_ACTIONS.WARN,
        scope: 'pre-commit',
        critical: false,
        message: '建议提交前使用 code-reviewer agent 进行代码审查'
      },
      {
        name: 'architecture-change-requirement',
        description: '架构变更需要规划',
        trigger: ['architecture', 'structure', 'design', 'refactor', 'pattern'],
        priority: RULE_PRIORITIES.HIGH,
        action: RULE_ACTIONS.REQUIRE,
        scope: 'edit',
        critical: false,
        requires: ['architect'],
        message: '检测到架构相关变更，建议使用 architect agent 进行规划'
      },
      {
        name: 'performance-check',
        description: '性能相关代码需要检查',
        trigger: ['performance', 'optimize', 'slow', 'latency', 'cache', 'async'],
        priority: RULE_PRIORITIES.MEDIUM,
        action: RULE_ACTIONS.WARN,
        scope: 'edit',
        critical: false,
        message: '检测到性能相关代码，注意考虑缓存策略、异步操作、资源释放等'
      },
      {
        name: 'format-check',
        description: '代码格式检查',
        trigger: ['.js', '.ts', '.jsx', '.tsx'],
        priority: RULE_PRIORITIES.LOW,
        action: RULE_ACTIONS.WARN,
        scope: 'edit',
        critical: false,
        message: '建议使用 prettier 和 eslint 格式化代码'
      }
    ];
  }

  /**
   * 按优先级排序规则
   * @private
   */
  _sortRules() {
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * 验证操作是否符合规则
   * @param {string} action - 操作类型
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 验证结果
   */
  async validate(action, context = {}) {
    const results = [];
    const keywords = this._extractKeywords(action, context);

    for (const rule of this.rules) {
      // 检查触发条件
      if (!this._shouldTrigger(rule, keywords, context)) {
        continue;
      }

      // 检查作用域
      if (rule.scope && rule.scope !== 'always' && rule.scope !== context.scope) {
        continue;
      }

      // 执行规则验证
      const result = await this._validateRule(rule, context);
      results.push(result);

      // 如果是关键规则且失败，立即返回
      if (rule.critical && !result.passed) {
        return {
          passed: false,
          blocked: true,
          rule: rule.name,
          message: result.message,
          action: rule.action
        };
      }
    }

    // 检查是否有阻止性规则
    const blocked = results.some((r) => !r.passed && r.blocked);

    return {
      passed: !blocked,
      blocked,
      results,
      warnings: results.filter((r) => r.warned === true)
    };
  }

  /**
   * 提取关键词
   * @private
   * @param {string} action - 操作描述
   * @param {Object} context - 上下文
   * @returns {Array<string>} 关键词列表
   */
  _extractKeywords(action, context) {
    const text = `${action} ${context.message || ''} ${(context.files || []).join(' ')}`;
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((kw) => kw.length > 0);
  }

  /**
   * 检查规则是否应该触发
   * @private
   * @param {Object} rule - 规则配置
   * @param {Array<string>} keywords - 关键词列表
   * @param {Object} context - 上下文
   * @returns {boolean} 是否触发
   */
  _shouldTrigger(rule, keywords, context) {
    // 检查触发关键词
    if (rule.trigger && rule.trigger.length > 0) {
      const triggerLower = rule.trigger.map((t) => t.toLowerCase());
      const hasMatch = keywords.some((kw) =>
        triggerLower.some((t) => kw.includes(t) || t.includes(kw))
      );
      if (!hasMatch) {
        return false;
      }
    }

    // 检查额外条件
    if (rule.conditions) {
      if (rule.conditions.files_include && context.files) {
        const filesStr = context.files.join(' ');
        const hasInclude = rule.conditions.files_include.some((pattern) =>
          filesStr.includes(pattern)
        );
        if (!hasInclude) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 验证单个规则
   * @private
   * @param {Object} rule - 规则配置
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 验证结果
   */
  async _validateRule(rule, context) {
    try {
      // 检查前置条件
      if (rule.requires && rule.requires.length > 0) {
        const missing = rule.requires.filter((req) => !this._checkRequirement(req, context));
        if (missing.length > 0) {
          // REQUIRE 和 BLOCK 类型的规则应该阻止
          const shouldBlock =
            rule.action === RULE_ACTIONS.BLOCK || rule.action === RULE_ACTIONS.REQUIRE;
          return {
            passed: !shouldBlock,
            blocked: shouldBlock,
            rule: rule.name,
            message: `${rule.message}（缺少: ${missing.join(', ')}）`,
            action: rule.action
          };
        }
      }

      // BLOCK 类型的规则：即使没有前置条件，也应该阻止
      if (rule.action === RULE_ACTIONS.BLOCK) {
        return {
          passed: false,
          blocked: true,
          rule: rule.name,
          message: rule.message,
          action: rule.action
        };
      }

      // WARN 类型的规则：通过但标记为警告
      if (rule.action === RULE_ACTIONS.WARN) {
        return {
          passed: true,
          warned: true,
          rule: rule.name,
          message: rule.message,
          action: rule.action
        };
      }

      // 其他类型：通过（包含动作类型）
      return {
        passed: true,
        rule: rule.name,
        message: rule.message,
        action: rule.action || 'none'
      };
    } catch (error) {
      this.logger.warn(`规则验证失败 ${rule.name}: ${error.message}`);
      return {
        passed: true,
        rule: rule.name,
        message: rule.message,
        action: rule.action || 'none'
      };
    }
  }

  /**
   * 检查前置条件
   * @private
   * @param {string} requirement - 前置条件
   * @param {Object} context - 上下文
   * @returns {boolean} 是否满足
   */
  _checkRequirement(requirement, context) {
    // 检查上下文中是否有对应标志
    if (context.flags && context.flags[requirement]) {
      return true;
    }

    // 检查是否已执行过对应的 agent/skill
    if (context.executed && context.executed.includes(requirement)) {
      return true;
    }

    return false;
  }

  /**
   * 执行规则动作
   * @param {string} ruleName - 规则名称
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 执行结果
   */
  async execute(ruleName, context) {
    const rule = this.rules.find((r) => r.name === ruleName);

    if (!rule) {
      return { success: false, error: `规则不存在: ${ruleName}` };
    }

    try {
      switch (rule.action) {
        case RULE_ACTIONS.BLOCK:
          this.logger.error(`🚫 ${rule.message}`);
          return { success: false, blocked: true, message: rule.message };

        case RULE_ACTIONS.WARN:
          this.logger.warn(`⚠️  ${rule.message}`);
          return { success: true, warned: true, message: rule.message };

        case RULE_ACTIONS.RETRY:
          return await this._retry(rule, context);

        case RULE_ACTIONS.SKIP:
          this.logger.info(`⏭️  跳过: ${rule.message}`);
          return { success: true, skipped: true, message: rule.message };

        case RULE_ACTIONS.REQUIRE:
          this.logger.warn(`⚠️  ${rule.message}`);
          return {
            success: false,
            requires: rule.requires,
            message: rule.message
          };

        default:
          return { success: true };
      }
    } catch (error) {
      this.logger.error(`执行规则失败 ${ruleName}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 重试逻辑
   * @private
   * @param {Object} rule - 规则配置
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 重试结果
   */
  async _retry(rule, context) {
    const maxRetries = rule.retryLimit || 3;
    const currentRetry = context.retryCount || 0;

    if (currentRetry >= maxRetries) {
      this.logger.error(`❌ 重试次数已达上限 (${maxRetries})`);
      return { success: false, retried: false, message: `重试失败: ${rule.message}` };
    }

    this.logger.info(`🔄 重试 (${currentRetry + 1}/${maxRetries}): ${rule.message}`);
    return { success: true, retried: true, retryCount: currentRetry + 1 };
  }

  /**
   * 添加自定义规则
   * @param {Object} rule - 规则配置
   * @returns {Promise<boolean>} 是否成功
   */
  async addRule(rule) {
    try {
      await this._ensureStructure();

      // 验证规则结构
      if (!rule.name || !rule.action) {
        this.logger.error('规则必须包含 name 和 action 字段');
        return false;
      }

      // 添加到规则列表
      this.rules.push(rule);
      this._sortRules();

      // 保存到索引文件
      await this._saveIndex();

      this.logger.success(`规则已添加: ${rule.name}`);
      return true;
    } catch (error) {
      this.logger.error(`添加规则失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 删除规则
   * @param {string} ruleName - 规则名称
   * @returns {Promise<boolean>} 是否成功
   */
  async removeRule(ruleName) {
    try {
      const rule = this.rules.find((r) => r.name === ruleName);

      if (!rule) {
        this.logger.warn(`规则不存在: ${ruleName}`);
        return false;
      }

      // 检查是否为默认规则
      if (this._isDefaultRule(rule)) {
        this.logger.warn(`无法删除默认规则: ${ruleName}`);
        return false;
      }

      const index = this.rules.findIndex((r) => r.name === ruleName);
      this.rules.splice(index, 1);
      await this._saveIndex();

      this.logger.success(`规则已删除: ${ruleName}`);
      return true;
    } catch (error) {
      this.logger.error(`删除规则失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 保存规则索引
   * @private
   */
  async _saveIndex() {
    const index = {
      rules: this.rules.filter((r) => !this._isDefaultRule(r)),
      total: this.rules.length,
      lastSync: new Date().toISOString(),
      version: '1.0.0'
    };

    await fs.writeJson(this.rulesIndexFile, index, { spaces: 2 });
  }

  /**
   * 检查是否为默认规则
   * @private
   * @param {Object} rule - 规则配置
   * @returns {boolean} 是否为默认规则
   */
  _isDefaultRule(rule) {
    const defaults = this._getDefaultRules();
    return defaults.some((r) => r.name === rule.name);
  }

  /**
   * 列出所有规则
   * @returns {Array} 规则列表
   */
  listRules() {
    return this.rules.map((rule) => ({
      name: rule.name,
      description: rule.description,
      priority: rule.priority,
      action: rule.action,
      scope: rule.scope,
      critical: rule.critical || false
    }));
  }

  /**
   * 获取规则统计
   * @returns {Object} 统计信息
   */
  getStats() {
    const byAction = {};
    const byScope = {};
    const byPriority = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    for (const rule of this.rules) {
      // 按动作统计
      byAction[rule.action] = (byAction[rule.action] || 0) + 1;

      // 按作用域统计
      if (rule.scope) {
        byScope[rule.scope] = (byScope[rule.scope] || 0) + 1;
      }

      // 按优先级统计
      if (rule.priority >= RULE_PRIORITIES.CRITICAL) {
        byPriority.critical++;
      } else if (rule.priority >= RULE_PRIORITIES.HIGH) {
        byPriority.high++;
      } else if (rule.priority >= RULE_PRIORITIES.MEDIUM) {
        byPriority.medium++;
      } else if (rule.priority >= RULE_PRIORITIES.LOW) {
        byPriority.low++;
      } else {
        byPriority.info++;
      }
    }

    return {
      total: this.rules.length,
      byAction,
      byScope,
      byPriority,
      criticalCount: byPriority.critical
    };
  }
}

export default RuleEngine;
