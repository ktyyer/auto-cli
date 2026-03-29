/**
 * Hook 运行时系统
 *
 * 核心功能：
 * - 加载和管理 Hook 定义
 * - 匹配 Hook 触发条件
 * - 执行 Hook 命令
 * - 处理执行结果和错误
 *
 * 灵感来源：
 * - HitCC Hook Runtime：Event Input 匹配 + Runtime Order + Error Handling
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  HOOK_MATCH_STRATEGIES,
  HOOK_RESULT_STATES,
  DEFAULT_HOOK_CONFIG,
  validateHookDefinition
} from './hook-types.js';

/**
 * Hook 运行时类
 */
export class HookRunner {
  constructor(config = {}) {
    this.config = { ...DEFAULT_HOOK_CONFIG, ...config };
    this.hooks = new Map();
    this.results = [];
  }

  /**
   * 从 JSON 文件加载 Hook 定义
   * @param {string} hookFilePath - Hook 配置文件路径
   */
  async loadHooks(hookFilePath) {
    try {
      const content = await readFile(hookFilePath, 'utf-8');
      const hookDefs = JSON.parse(content);

      if (!Array.isArray(hookDefs)) {
        throw new Error('Hook definitions must be an array');
      }

      for (const hookDef of hookDefs) {
        this.registerHook(hookDef);
      }

      return { loaded: this.hooks.size, errors: [] };
    } catch (error) {
      return { loaded: 0, errors: [error.message] };
    }
  }

  /**
   * 注册单个 Hook
   * @param {Object} hookDef - Hook 定义
   */
  registerHook(hookDef) {
    const validation = validateHookDefinition(hookDef);
    if (!validation.valid) {
      throw new Error(`Invalid hook definition: ${validation.errors.join(', ')}`);
    }

    const hookId = `${hookDef.event}-${hookDef.command}`;
    this.hooks.set(hookId, {
      id: hookId,
      ...hookDef,
      timeout: hookDef.timeout || this.config.timeout
    });
  }

  /**
   * 查找匹配的 Hooks
   * @param {string} phase - 生命周期阶段
   * @param {string} toolName - 工具名称
   * @returns {Array} 匹配的 Hooks
   */
  findMatchingHooks(phase, toolName) {
    const matching = [];

    for (const hook of this.hooks.values()) {
      // 检查阶段匹配
      if (hook.event !== phase) continue;

      // 检查工具匹配
      if (hook.matcher) {
        if (!this.matchesPattern(toolName, hook.matcher)) continue;
      }

      matching.push(hook);
    }

    return matching;
  }

  /**
   * 检查工具名称是否匹配模式
   * @param {string} toolName - 工具名称
   * @param {Object} matcher - 匹配规则
   * @returns {boolean}
   */
  matchesPattern(toolName, matcher) {
    const { strategy, pattern } = matcher;

    switch (strategy) {
      case HOOK_MATCH_STRATEGIES.ALL:
        return true;

      case HOOK_MATCH_STRATEGIES.EXACT:
        return toolName === pattern;

      case HOOK_MATCH_STRATEGIES.REGEX:
        return new RegExp(pattern).test(toolName);

      case HOOK_MATCH_STRATEGIES.GLOB: {
        // 简单的 glob 实现，将 * 转换为 .*
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${regexPattern}$`).test(toolName);
      }

      default:
        return false;
    }
  }

  /**
   * 执行 Hook
   * @param {Object} hook - Hook 定义
   * @param {Object} context - 执行上下文
   * @returns {Promise<Object>} 执行结果
   */
  async executeHook(hook, context) {
    const startTime = Date.now();
    const result = {
      hookId: hook.id,
      status: HOOK_RESULT_STATES.SUCCESS,
      duration: 0,
      error: null,
      output: null
    };

    try {
      // 将上下文作为环境变量传递
      const env = {
        ...process.env,
        HOOK_PHASE: context.phase,
        HOOK_TOOL_NAME: context.toolName || '',
        HOOK_TIMESTAMP: context.timestamp.toString()
      };

      // 如果有工具输入，序列化为 JSON
      if (context.toolInput) {
        env.HOOK_TOOL_INPUT = JSON.stringify(context.toolInput);
      }

      if (context.toolOutput) {
        env.HOOK_TOOL_OUTPUT = JSON.stringify(context.toolOutput);
      }

      // 执行命令
      const output = await this.executeCommand(hook.command, env, hook.timeout);

      result.output = output;
      result.duration = Date.now() - startTime;
    } catch (error) {
      result.status =
        error.code === 'ETIMEDOUT' ? HOOK_RESULT_STATES.TIMEOUT : HOOK_RESULT_STATES.ERROR;
      result.error = error.message;
      result.duration = Date.now() - startTime;
    }

    this.results.push(result);
    return result;
  }

  /**
   * 执行 Shell 命令
   * @param {string} command - 命令字符串
   * @param {Object} env - 环境变量
   * @param {number} timeout - 超时时间
   * @returns {Promise<string>} 命令输出
   */
  executeCommand(command, env, timeout) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        env,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('ETIMEDOUT'));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout || stderr);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * 运行匹配的 Hooks
   * @param {string} phase - 生命周期阶段
   * @param {Object} context - 执行上下文
   * @returns {Promise<Array>} 执行结果数组
   */
  async run(phase, context = {}) {
    const toolName = context.toolName || '';
    const matchingHooks = this.findMatchingHooks(phase, toolName);

    if (matchingHooks.length === 0) {
      return [];
    }

    const enhancedContext = {
      phase,
      timestamp: Date.now(),
      ...context
    };

    // 根据配置决定并行或串行执行
    if (this.config.parallelExecution) {
      return Promise.all(matchingHooks.map((hook) => this.executeHook(hook, enhancedContext)));
    } else {
      const results = [];
      for (const hook of matchingHooks) {
        const result = await this.executeHook(hook, enhancedContext);
        results.push(result);

        // 如果配置为遇到错误停止，且当前 Hook 失败
        if (this.config.stopOnFirstError && result.status !== HOOK_RESULT_STATES.SUCCESS) {
          break;
        }
      }
      return results;
    }
  }

  /**
   * 获取所有执行结果
   * @returns {Array}
   */
  getResults() {
    return [...this.results];
  }

  /**
   * 清除执行历史
   */
  clearResults() {
    this.results = [];
  }

  /**
   * 获取 Hook 统计信息
   * @returns {Object}
   */
  getStats() {
    const stats = {
      total: this.results.length,
      success: 0,
      blocked: 0,
      error: 0,
      timeout: 0,
      skipped: 0
    };

    for (const result of this.results) {
      stats[result.status]++;
    }

    return stats;
  }
}

/**
 * 创建全局 Hook 运行时实例
 * @param {Object} config - 配置
 * @returns {HookRunner}
 */
export function createHookRunner(config) {
  return new HookRunner(config);
}
