#!/usr/bin/env node
/**
 * Self-* 系统测试脚本
 *
 * 测试 Self-* 系统的核心功能：
 * - Self-Aware: 模式学习
 * - Self-Improving: 反馈学习
 * - Self-Fixing: 自动修复
 * - Self-Building: 自动初始化
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');
const fs = require('fs');

// 简化版测试 - 测试核心逻辑而不依赖完整导入

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(colors.green, `✅ ${message}`);
}

function error(message) {
  log(colors.red, `❌ ${message}`);
}

function info(message) {
  log(colors.blue, `ℹ️  ${message}`);
}

function warn(message) {
  log(colors.yellow, `⚠️  ${message}`);
}

// 测试用例
const tests = {
  async 'Self-Aware: 项目上下文检测'() {
    const projectPath = process.cwd();
    const selfStar = new SelfStarSystem(projectPath);

    const context = selfStar.aware();

    if (!context.language) {
      throw new Error('无法检测项目语言');
    }

    if (!context.framework) {
      throw new Error('无法检测项目框架');
    }

    success(`检测到项目: ${context.language} / ${context.framework}`);
    info(`结构: 测试=${context.structure.hasTests ? '✅' : '❌'}, 文档=${context.structure.hasDocs ? '✅' : '❌'}`);

    return context;
  },

  async 'Self-Aware: 模式学习'() {
    const projectPath = process.cwd();
    const selfStar = new SelfStarSystem(projectPath);

    // 学习一个测试模式
    const pattern = selfStar.learnPattern(
      'coding_style',
      'Test Pattern',
      '这是一个测试模式',
      ['example 1', 'example 2']
    );

    if (pattern.usageCount !== 1) {
      throw new Error('模式使用次数应该为 1');
    }

    if (pattern.confidence < 0.3) {
      throw new Error('模式置信度应该至少为 0.3');
    }

    success(`学习模式: ${pattern.name} (置信度: ${pattern.confidence})`);

    // 再次使用，提升置信度
    pattern.markUsed();
    pattern.markUsed();
    pattern.markUsed();

    if (pattern.usageCount !== 4) {
      throw new Error('模式使用次数应该为 4');
    }

    if (pattern.confidence < 0.6) {
      throw new Error('4 次使用后，置信度应该至少为 0.6');
    }

    success(`提升置信度: ${pattern.confidence} (${pattern.getPhaseDescription()})`);

    return pattern;
  },

  async 'Self-Improving: 反馈记录'() {
    const projectPath = process.cwd();
    const selfStar = new SelfStarSystem(projectPath);

    // 记录成功反馈
    const feedback1 = selfStar.recordFeedback('task', { type: 'feature' }, true);
    if (!feedback1.success) {
      throw new Error('反馈应该标记为成功');
    }

    // 记录失败反馈
    const feedback2 = selfStar.recordFeedback('build', { error: 'TS2345' }, false);
    if (feedback2.success) {
      throw new Error('反馈应该标记为失败');
    }

    // 检查反馈数量
    if (selfStar.feedback.length !== 2) {
      throw new Error('应该有 2 条反馈');
    }

    success(`记录反馈: ${selfStar.feedback.length} 条`);

    // 获取改进建议
    const improvements = selfStar.improve();
    success(`改进建议: ${improvements.length} 条`);

    return { feedback1, feedback2, improvements };
  },

  async 'Self-Fixing: 错误检测'() {
    const projectPath = process.cwd();
    const selfStar = new SelfStarSystem(projectPath);

    // 模拟 TypeScript 错误
    const buildOutput = `
src/main.ts:5:10 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/main.ts:8:5 - error TS2322: Type 'string' is not assignable to type 'boolean'.
    `;

    const errors = selfStar.detectBuildErrors(buildOutput);

    if (errors.length !== 2) {
      throw new Error(`应该检测到 2 个错误，实际检测到 ${errors.length} 个`);
    }

    success(`检测到 ${errors.length} 个错误:`);
    errors.forEach(err => {
      info(`  - ${err.type}: ${err.message}`);
    });

    return errors;
  },

  async 'Self-Building: 自动初始化'() {
    const projectPath = process.cwd();
    const selfStar = new SelfStarSystem(projectPath);

    const result = selfStar.autoInitialize();

    if (!result.learned) {
      throw new Error('应该学习到一些模式');
    }

    success(`自动学习: ${result.learned} 个模式`);
    result.patterns.forEach(p => {
      info(`  - ${p.name}: ${p.description}`);
    });

    return result;
  },

  async 'MemoryManager: 统一接口'() {
    const projectPath = process.cwd();
    const memoryManager = new MemoryManager(projectPath);

    // 测试查询
    const results = memoryManager.query('测试');

    if (!results.patterns) {
      throw new Error('查询结果应该包含 patterns');
    }

    if (!results.relevantCode) {
      throw new Error('查询结果应该包含 relevantCode');
    }

    success('统一查询接口正常工作');
    info(`  - 相关模式: ${results.patterns.length} 个`);
    info(`  - 相关代码: ${results.relevantCode.length} 个文件`);
    info(`  - FAQ: ${results.faq.length} 条`);
    info(`  - 决策: ${results.decisions.length} 条`);

    return results;
  },

  async 'MemoryManager: 记忆管理'() {
    const projectPath = process.cwd();
    const memoryManager = new MemoryManager(projectPath);

    // 添加会话
    const session = memoryManager.addSession({
      task: '测试任务',
      result: 'success',
      duration: 60000
    });

    const memory = memoryManager.getProjectMemory();
    if (memory.sessions.length === 0) {
      throw new Error('应该有会话记录');
    }

    success('添加会话记录');

    // 添加决策
    memoryManager.addDecision({
      topic: '测试决策',
      decision: '使用测试框架',
      rationale: '提高代码质量'
    });

    const updatedMemory = memoryManager.getProjectMemory();
    if (updatedMemory.decisions.length === 0) {
      throw new Error('应该有决策记录');
    }

    success('添加决策记录');

    // 添加 FAQ
    memoryManager.addFAQ('如何测试？', '使用测试框架');
    const finalMemory = memoryManager.getProjectMemory();
    if (finalMemory.faq.length === 0) {
      throw new Error('应该有 FAQ 记录');
    }

    success('添加 FAQ');

    return { session, memory };
  },

  async 'MemoryManager: 报告生成'() {
    const projectPath = process.cwd();
    const memoryManager = new MemoryManager(projectPath);

    const report = memoryManager.generateReport();

    if (!report.includes('记忆系统状态报告')) {
      throw new Error('报告应该包含标题');
    }

    success('生成状态报告');
    info('\n' + report);

    return report;
  }
};

// 运行测试
async function runTests() {
  log(colors.cyan, '\n🧪 Self-* 系统测试\n');

  let passed = 0;
  let failed = 0;

  for (const [name, test] of Object.entries(tests)) {
    try {
      info(`运行: ${name}`);
      await test();
      passed++;
    } catch (err) {
      error(`${name}: ${err.message}`);
      failed++;
    }
  }

  log(colors.cyan, '\n📊 测试结果\n');
  success(`通过: ${passed}`);
  if (failed > 0) {
    error(`失败: ${failed}`);
  }

  log(colors.cyan, `\n总计: ${passed + failed} 个测试\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// 运行
runTests().catch(err => {
  error(`测试运行失败: ${err.message}`);
  console.error(err);
  process.exit(1);
});
