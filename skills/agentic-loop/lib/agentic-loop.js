#!/usr/bin/env node
/**
 * Agentic 循环系统
 *
 * 实现 ReACT（Reasoning + Acting）模式：
 * Thought → Action → Observation → Reflection → Decision
 *
 * 参考：SWE-agent, Cline, Roo-Code 的最佳实践
 */

/**
 * Agentic 循环步骤类型
 */
const StepType = {
  THOUGHT: 'thought',       // 思考
  ACTION: 'action',         // 行动
  OBSERVATION: 'observation', // 观察
  REFLECTION: 'reflection',  // 反思
  DECISION: 'decision'      // 决策
};

/**
 * Agentic 循环状态
 */
const LoopState = {
  RUNNING: 'running',       // 运行中
  PAUSED: 'paused',         // 暂停
  COMPLETED: 'completed',   // 完成
  FAILED: 'failed',         // 失败
  MAX_ITERATIONS: 'max_iterations' // 达到最大迭代次数
};

/**
 * Agentic 循环步骤
 */
class AgenticStep {
  constructor(type, content, metadata = {}) {
    this.type = type;
    this.content = content;
    this.timestamp = Date.now();
    this.metadata = metadata;
  }

  /**
   * 渲染为 Markdown
   */
  toMarkdown() {
    const icons = {
      [StepType.THOUGHT]: '🧠',
      [StepType.ACTION]: '⚡',
      [StepType.OBSERVATION]: '👀',
      [StepType.REFLECTION]: '🤔',
      [StepType.DECISION]: '✅'
    };

    const icon = icons[this.type] || '📌';
    const title = this.type.charAt(0).toUpperCase() + this.type.slice(1);

    return `${icon} **${title}**: ${this.content}`;
  }
}

/**
 * Agentic 循环轨迹
 */
class AgenticTrajectory {
  constructor() {
    this.steps = [];
    this.iterations = [];
    this.startTime = Date.now();
    this.endTime = null;
  }

  /**
   * 添加步骤
   */
  addStep(type, content, metadata = {}) {
    const step = new AgenticStep(type, content, metadata);
    this.steps.push(step);
    return step;
  }

  /**
   * 开始新的迭代
   */
  startIteration() {
    this.iterations.push({
      index: this.iterations.length + 1,
      startStep: this.steps.length,
      steps: []
    });
  }

  /**
   * 完成迭代
   */
  endIteration() {
    const currentIteration = this.iterations[this.iterations.length - 1];
    if (currentIteration) {
      currentIteration.endStep = this.steps.length;
      currentIteration.steps = this.steps.slice(
        currentIteration.startStep,
        currentIteration.endStep
      );
    }
  }

  /**
   * 获取最新迭代
   */
  getCurrentIteration() {
    return this.iterations[this.iterations.length - 1];
  }

  /**
   * 完成
   */
  complete() {
    this.endTime = Date.now();
  }

  /**
   * 获取耗时
   */
  getDuration() {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  /**
   * 渲染为 Markdown
   */
  toMarkdown() {
    let markdown = `🔄 **Agentic 轨迹** (耗时: ${this.getDuration()}ms)\n\n`;

    // 按迭代分组显示
    this.iterations.forEach((iteration, idx) => {
      markdown += `---\n\n`;
      markdown += `🔄 **Agentic 循环 #${iteration.index}**\n\n`;

      iteration.steps.forEach(step => {
        markdown += step.toMarkdown() + '\n\n';
      });
    });

    return markdown;
  }

  /**
   * 导出为 JSON
   */
  toJSON() {
    return {
      steps: this.steps,
      iterations: this.iterations,
      duration: this.getDuration(),
      startTime: this.startTime,
      endTime: this.endTime
    };
  }
}

/**
 * Agentic 循环配置
 */
const DEFAULT_CONFIG = {
  maxIterations: 5,        // 最大迭代次数
  timeout: 300000,         // 超时时间（5 分钟）
  verbose: true,           // 详细输出
  saveTrajectory: true,    // 保存轨迹
  autoContinue: true,      // 自动继续（无需用户确认）
};

/**
 * Agentic 循环执行器
 */
class AgenticLoop {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = LoopState.RUNNING;
    this.trajectory = new AgenticTrajectory();
    this.currentIteration = 0;
    this.callbacks = {
      onThought: null,
      onAction: null,
      onObservation: null,
      onReflection: null,
      onDecision: null,
      onIteration: null
    };
  }

  /**
   * 注册回调
   */
  on(event, callback) {
    const eventMap = {
      'thought': 'onThought',
      'action': 'onAction',
      'observation': 'onObservation',
      'reflection': 'onReflection',
      'decision': 'onDecision',
      'iteration': 'onIteration'
    };

    const callbackName = eventMap[event];
    if (callbackName) {
      this.callbacks[callbackName] = callback;
    }
  }

  /**
   * 思考
   */
  async thought(content) {
    const step = this.trajectory.addStep(StepType.THOUGHT, content);
    if (this.callbacks.onThought) {
      await this.callbacks.onThought(content);
    }
    return step;
  }

  /**
   * 行动
   */
  async action(content, metadata = {}) {
    const step = this.trajectory.addStep(StepType.ACTION, content, metadata);
    if (this.callbacks.onAction) {
      await this.callbacks.onAction(content, metadata);
    }
    return step;
  }

  /**
   * 观察
   */
  async observation(content, metadata = {}) {
    const step = this.trajectory.addStep(StepType.OBSERVATION, content, metadata);
    if (this.callbacks.onObservation) {
      await this.callbacks.onObservation(content, metadata);
    }
    return step;
  }

  /**
   * 反思
   */
  async reflection(content, metadata = {}) {
    const step = this.trajectory.addStep(StepType.REFLECTION, content, metadata);
    if (this.callbacks.onReflection) {
      await this.callbacks.onReflection(content, metadata);
    }
    return step;
  }

  /**
   * 决策
   */
  async decision(content, shouldContinue = true) {
    const step = this.trajectory.addStep(
      StepType.DECISION,
      content + ` (${shouldContinue ? '继续' : '终止'})`
    );
    if (this.callbacks.onDecision) {
      await this.callbacks.onDecision(content, shouldContinue);
    }
    return shouldContinue;
  }

  /**
   * 运行一次完整循环
   */
  async runCycle(task, context = {}) {
    this.currentIteration++;
    this.trajectory.startIteration();

    if (this.currentIteration > this.config.maxIterations) {
      this.state = LoopState.MAX_ITERATIONS;
      await this.decision('达到最大迭代次数，终止', false);
      this.trajectory.endIteration();
      return { shouldContinue: false, reason: 'max_iterations' };
    }

    try {
      // 1. Thought - 思考
      const thoughtContent = await this._generateThought(task, context);
      await this.thought(thoughtContent);

      // 2. Action - 行动
      const { action, actionMetadata } = await this._generateAction(task, context);
      await this.action(action, actionMetadata);

      // 3. Observation - 观察
      const { observation, observationMetadata } = await this._observe(action, context);
      await this.observation(observation, observationMetadata);

      // 4. Reflection - 反思
      const { reflection, shouldContinue, reflectionMetadata } = await this._reflect(
        task,
        action,
        observation,
        context
      );
      await this.reflection(reflection, reflectionMetadata);

      // 5. Decision - 决策
      await this.decision(reflection, shouldContinue);

      this.trajectory.endIteration();

      if (this.callbacks.onIteration) {
        await this.callbacks.onIteration(this.currentIteration, {
          thought: thoughtContent,
          action,
          observation,
          reflection,
          shouldContinue
        });
      }

      return { shouldContinue, observation, reflection };
    } catch (error) {
      this.state = LoopState.FAILED;
      await this.observation(`错误: ${error.message}`, { error: true });
      this.trajectory.endIteration();
      throw error;
    }
  }

  /**
   * 生成思考内容（可被子类重写）
   */
  async _generateThought(task, context) {
    return `分析任务: ${task}`;
  }

  /**
   * 生成行动（可被子类重写）
   */
  async _generateAction(task, context) {
    return { action: '执行默认操作' };
  }

  /**
   * 观察结果（可被子类重写）
   */
  async _observe(action, context) {
    return { observation: '操作完成' };
  }

  /**
   * 反思与决策（可被子类重写）
   */
  async _reflect(task, action, observation, context) {
    return {
      reflection: '任务完成',
      shouldContinue: false
    };
  }

  /**
   * 完成
   */
  complete() {
    this.state = LoopState.COMPLETED;
    this.trajectory.complete();
    return this.trajectory.toMarkdown();
  }

  /**
   * 获取轨迹
   */
  getTrajectory() {
    return this.trajectory;
  }

  /**
   * 获取状态
   */
  getState() {
    return this.state;
  }
}

/**
 * 导出
 */
export {
  AgenticLoop,
  AgenticTrajectory,
  AgenticStep,
  StepType,
  LoopState,
  DEFAULT_CONFIG
};
