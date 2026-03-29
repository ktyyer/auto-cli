/**
 * 运行时系统统一导出
 *
 * 提供 Hook、Agent、Prompt 组装器的统一访问接口
 */

// Hook 系统
export {
  HOOK_PHASES,
  HOOK_MATCH_STRATEGIES,
  HOOK_RESULT_STATES,
  DEFAULT_HOOK_CONFIG,
  validateHookDefinition
} from './hooks/hook-types.js';

export { HookRunner, createHookRunner } from './hooks/hook-runner.js';

// Agent 系统
export {
  AGENT_STATES,
  AGENT_PRIORITY,
  AGENT_MODES,
  DEFAULT_AGENT_CONFIG,
  validateAgentTask,
  canExecuteTask,
  calculateTaskPriority,
  sortTasksByPriority
} from './agents/agent-types.js';

export { AgentExecutor, createAgentExecutor } from './agents/agent-executor.js';

// Prompt 系统
export {
  PROMPT_LAYERS,
  PromptAssembler,
  createPromptAssembler,
  assemblePrompt
} from './prompts/prompt-assembler.js';

/**
 * 创建完整的运行时环境
 * @param {Object} config - 配置
 * @returns {Object}
 */
export function createRuntime(config = {}) {
  return {
    hooks: {
      runner: null, // 延迟初始化
      create: (hookConfig) => {
        const { createHookRunner } = require('./hooks/hook-runner.js');
        return createHookRunner(hookConfig);
      }
    },
    agents: {
      executor: null,
      create: (agentConfig) => {
        const { createAgentExecutor } = require('./agents/agent-executor.js');
        return createAgentExecutor(agentConfig);
      }
    },
    prompts: {
      assembler: null,
      create: (promptConfig) => {
        const { createPromptAssembler } = require('./prompts/prompt-assembler.js');
        return createPromptAssembler(promptConfig);
      }
    },
    config
  };
}

/**
 * 运行时版本
 */
export const RUNTIME_VERSION = '1.0.0';

/**
 * 运行时能力清单
 */
export const RUNTIME_CAPABILITIES = Object.freeze({
  hooks: {
    phases: ['PreToolUse', 'PostToolUse', 'Stop'],
    strategies: ['all', 'regex', 'glob', 'exact'],
    features: ['async_execution', 'timeout', 'error_handling', 'parallel']
  },
  agents: {
    modes: ['sequential', 'parallel', 'team'],
    states: ['idle', 'running', 'completed', 'failed', 'cancelled'],
    features: ['task_scheduling', 'dependency_management', 'retry_logic', 'state_tracking']
  },
  prompts: {
    layers: ['system', 'capabilities', 'project', 'context', 'task', 'constraints'],
    features: ['layering', 'compression', 'attachment_order', 'context_management']
  }
});
