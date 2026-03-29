/**
 * Prompt 上下文组装器
 *
 * 核心功能：
 * - 构建 System Chain（系统指令链）
 * - 管理 Attachment Order（附件顺序）
 * - 实现 Context Layering（上下文分层）
 * - 集成能力清单和项目信息
 *
 * 灵感来源：
 * - HitCC Prompt Assembly：System Chain + Context Layering + Compact Pipeline
 */

import { readFile } from 'node:fs/promises';

/**
 * Prompt 层级
 * @readonly
 * @enum {string}
 */
export const PROMPT_LAYERS = Object.freeze({
  SYSTEM: 'system',
  CAPABILITIES: 'capabilities',
  PROJECT: 'project',
  CONTEXT: 'context',
  TASK: 'task',
  CONSTRAINTS: 'constraints'
});

/**
 * Prompt 组装器类
 */
export class PromptAssembler {
  constructor(config = {}) {
    this.config = {
      maxContextLength: 200000,
      enableCompression: true,
      compressionThreshold: 0.8,
      ...config
    };
    this.layers = new Map();
    this.attachments = [];
  }

  /**
   * 添加系统指令层
   * @param {string} systemPrompt - 系统提示词
   */
  addSystemLayer(systemPrompt) {
    this.layers.set(PROMPT_LAYERS.SYSTEM, systemPrompt);
    return this;
  }

  /**
   * 从文件加载系统指令
   * @param {string} filePath - 文件路径
   */
  async loadSystemLayer(filePath) {
    const content = await readFile(filePath, 'utf-8');
    return this.addSystemLayer(content);
  }

  /**
   * 添加能力清单层
   * @param {Object} capabilities - 能力清单
   */
  addCapabilitiesLayer(capabilities) {
    const prompt = this.formatCapabilities(capabilities);
    this.layers.set(PROMPT_LAYERS.CAPABILITIES, prompt);
    return this;
  }

  /**
   * 格式化能力清单
   * @param {Object} capabilities - 能力清单
   * @returns {string}
   */
  formatCapabilities(capabilities) {
    const sections = [];

    if (capabilities.commands?.length) {
      sections.push('## Commands\n');
      sections.push(
        capabilities.commands.map((cmd) => `- /${cmd.name}: ${cmd.description}`).join('\n')
      );
    }

    if (capabilities.agents?.length) {
      sections.push('\n## Agents\n');
      sections.push(
        capabilities.agents.map((agent) => `- ${agent.name}: ${agent.description}`).join('\n')
      );
    }

    if (capabilities.skills?.length) {
      sections.push('\n## Skills\n');
      sections.push(
        capabilities.skills.map((skill) => `- ${skill.name}: ${skill.description}`).join('\n')
      );
    }

    return sections.join('\n');
  }

  /**
   * 添加项目上下文层
   * @param {Object} projectContext - 项目上下文
   */
  addProjectLayer(projectContext) {
    const prompt = this.formatProjectContext(projectContext);
    this.layers.set(PROMPT_LAYERS.PROJECT, prompt);
    return this;
  }

  /**
   * 格式化项目上下文
   * @param {Object} context - 项目上下文
   * @returns {string}
   */
  formatProjectContext(context) {
    const sections = ['## Project Context\n'];

    if (context.name) {
      sections.push(`**Project**: ${context.name}\n`);
    }

    if (context.description) {
      sections.push(`**Description**: ${context.description}\n`);
    }

    if (context.techStack) {
      sections.push(`**Tech Stack**: ${context.techStack}\n`);
    }

    if (context.structure) {
      sections.push(`\n**Structure**:\n\`\`\`\n${context.structure}\n\`\`\`\n`);
    }

    return sections.join('\n');
  }

  /**
   * 添加对话上下文层
   * @param {Array} messages - 消息历史
   */
  addContextLayer(messages) {
    const prompt = this.formatContext(messages);
    this.layers.set(PROMPT_LAYERS.CONTEXT, prompt);
    return this;
  }

  /**
   * 格式化对话上下文
   * @param {Array} messages - 消息历史
   * @returns {string}
   */
  formatContext(messages) {
    if (!messages || messages.length === 0) {
      return '';
    }

    const sections = ['## Conversation Context\n'];

    for (const msg of messages) {
      const role = msg.role || 'user';
      const content = msg.content || '';
      sections.push(`**${role}**: ${content}\n`);
    }

    return sections.join('\n');
  }

  /**
   * 添加任务描述层
   * @param {string} taskDescription - 任务描述
   */
  addTaskLayer(taskDescription) {
    this.layers.set(PROMPT_LAYERS.TASK, taskDescription);
    return this;
  }

  /**
   * 添加约束条件层
   * @param {Array<string>} constraints - 约束条件列表
   */
  addConstraintsLayer(constraints) {
    const prompt = constraints.map((c, i) => `${i + 1}. ${c}`).join('\n');
    this.layers.set(PROMPT_LAYERS.CONSTRAINTS, prompt);
    return this;
  }

  /**
   * 添加附件
   * @param {Object} attachment - 附件对象
   */
  addAttachment(attachment) {
    this.attachments.push({
      order: this.attachments.length,
      ...attachment
    });
    return this;
  }

  /**
   * 批量添加附件
   * @param {Array<Object>} attachments - 附件数组
   */
  addAttachments(attachments) {
    for (const attachment of attachments) {
      this.addAttachment(attachment);
    }
    return this;
  }

  /**
   * 组装完整的 Prompt
   * @param {Object} options - 选项
   * @returns {string}
   */
  assemble(options = {}) {
    const {
      includeLayers = [
        PROMPT_LAYERS.SYSTEM,
        PROMPT_LAYERS.CAPABILITIES,
        PROMPT_LAYERS.PROJECT,
        PROMPT_LAYERS.CONTEXT,
        PROMPT_LAYERS.TASK
      ],
      includeAttachments = true
    } = options;

    const parts = [];

    // 按顺序添加层级
    for (const layer of includeLayers) {
      if (this.layers.has(layer)) {
        parts.push(this.layers.get(layer));
      }
    }

    // 添加附件
    if (includeAttachments && this.attachments.length > 0) {
      parts.push('\n## Attachments\n');
      for (const attachment of this.attachments) {
        parts.push(`### ${attachment.name || 'Attachment'}\n`);
        if (attachment.content) {
          parts.push(attachment.content);
        }
        if (attachment.path) {
          parts.push(`Path: ${attachment.path}`);
        }
        parts.push('\n');
      }
    }

    let assembled = parts.join('\n\n---\n\n');

    // 检查是否需要压缩
    if (this.config.enableCompression) {
      const currentLength = assembled.length;
      const maxLength = this.config.maxContextLength;

      if (currentLength > maxLength * this.config.compressionThreshold) {
        assembled = this.compressContext(assembled, maxLength);
      }
    }

    return assembled;
  }

  /**
   * 压缩上下文
   * @param {string} context - 上下文
   * @param {number} maxLength - 最大长度
   * @returns {string}
   */
  compressContext(context, maxLength) {
    // 简单的压缩策略：保留系统指令和任务，压缩其他部分
    const lines = context.split('\n');
    const compressed = [];
    let currentLength = 0;

    for (const line of lines) {
      if (currentLength + line.length > maxLength) {
        break;
      }
      compressed.push(line);
      currentLength += line.length + 1; // +1 for newline
    }

    compressed.push('\n[Context compressed due to length]');
    return compressed.join('\n');
  }

  /**
   * 清空所有层级
   */
  clear() {
    this.layers.clear();
    this.attachments = [];
  }

  /**
   * 获取层级内容
   * @param {string} layerName - 层级名称
   * @returns {string|undefined}
   */
  getLayer(layerName) {
    return this.layers.get(layerName);
  }

  /**
   * 移除层级
   * @param {string} layerName - 层级名称
   */
  removeLayer(layerName) {
    this.layers.delete(layerName);
    return this;
  }

  /**
   * 获取 Prompt 统计信息
   * @returns {Object}
   */
  getStats() {
    const assembled = this.assemble();

    return {
      layers: this.layers.size,
      attachments: this.attachments.length,
      totalLength: assembled.length,
      layerNames: Array.from(this.layers.keys())
    };
  }
}

/**
 * 创建 Prompt 组装器实例
 * @param {Object} config - 配置
 * @returns {PromptAssembler}
 */
export function createPromptAssembler(config) {
  return new PromptAssembler(config);
}

/**
 * 快速组装 Prompt（便捷函数）
 * @param {Object} params - 参数
 * @returns {Promise<string>}
 */
export async function assemblePrompt(params) {
  const {
    systemPrompt,
    capabilities,
    projectContext,
    messages,
    taskDescription,
    constraints,
    attachments
  } = params;

  const assembler = new PromptAssembler();

  if (systemPrompt) {
    await assembler.addSystemLayer(systemPrompt);
  }

  if (capabilities) {
    assembler.addCapabilitiesLayer(capabilities);
  }

  if (projectContext) {
    assembler.addProjectLayer(projectContext);
  }

  if (messages) {
    assembler.addContextLayer(messages);
  }

  if (taskDescription) {
    assembler.addTaskLayer(taskDescription);
  }

  if (constraints) {
    assembler.addConstraintsLayer(constraints);
  }

  if (attachments) {
    assembler.addAttachments(attachments);
  }

  return assembler.assemble();
}
