#!/usr/bin/env node
/**
 * Self-* 系统 - 自我进化核心
 *
 * 实现：
 * - Self-Aware: 自我感知，理解项目编码模式
 * - Self-Improving: 自我改进，从反馈中学习
 * - Self-Fixing: 自修复，自动修复构建/测试错误
 * - Self-Building: 自构建，自动构建所需技能
 */

import { PatternLearner, PATTERN_TYPES, CONFIDENCE_LEVELS } from './pattern-learner.js';
import { ProjectScanner } from './project-scanner.js';
import fs from 'fs';
import path from 'path';

/**
 * Self-* 系统主类
 */
class SelfStarSystem {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.patternLearner = new PatternLearner(projectPath);
    this.projectScanner = new ProjectScanner(projectPath);
    this.feedbackFile = path.join(projectPath, '.aimax', 'feedback.json');
    this.feedback = [];
    this.loadFeedback();
  }

  /**
   * 加载反馈历史
   */
  loadFeedback() {
    try {
      if (fs.existsSync(this.feedbackFile)) {
        const data = fs.readFileSync(this.feedbackFile, 'utf8');
        this.feedback = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load feedback:', error.message);
    }
  }

  /**
   * 保存反馈
   */
  saveFeedback() {
    try {
      const dir = path.dirname(this.feedbackFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.feedbackFile,
        JSON.stringify(this.feedback, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save feedback:', error.message);
    }
  }

  // ==================== Self-Aware: 自我感知 ====================

  /**
   * 感知项目上下文
   */
  aware() {
    const scan = this.projectScanner.scan();
    const patterns = this.patternLearner.getConfidentPatterns();

    return {
      language: scan.language,
      framework: scan.framework,
      structure: scan.structure,
      patterns: patterns.map(p => ({
        name: p.name,
        confidence: p.confidence,
        usage: p.usageCount
      }))
    };
  }

  /**
   * 学习编码模式
   */
  learnPattern(type, name, description, examples = []) {
    return this.patternLearner.learnPattern(type, name, description, examples);
  }

  /**
   * 获取建议
   */
  getSuggestions() {
    const aware = this.aware();
    const suggestions = [];

    // 基于项目结构的建议
    if (!aware.structure.hasTests) {
      suggestions.push({
        type: 'testing',
        priority: 'high',
        message: '建议添加测试目录和测试用例'
      });
    }

    if (!aware.structure.hasDocs) {
      suggestions.push({
        type: 'documentation',
        priority: 'medium',
        message: '建议添加项目文档（README.md）'
      });
    }

    if (!aware.structure.hasCI) {
      suggestions.push({
        type: 'ci',
        priority: 'low',
        message: '建议添加 CI/CD 配置'
      });
    }

    return suggestions;
  }

  // ==================== Self-Improving: 自我改进 ====================

  /**
   * 记录反馈
   */
  recordFeedback(type, data, success = true) {
    const feedback = {
      type,
      data,
      success,
      timestamp: Date.now()
    };
    this.feedback.push(feedback);
    this.saveFeedback();
    return feedback;
  }

  /**
   * 从反馈中学习
   */
  improve() {
    const improvements = [];

    // 分析最近的反馈
    const recentFeedback = this.feedback.slice(-20);

    // 统计成功和失败
    const successCount = recentFeedback.filter(f => f.success).length;
    const failureCount = recentFeedback.length - successCount;

    if (failureCount > successCount) {
      improvements.push({
        type: 'strategy',
        message: '最近失败率较高，建议调整策略',
        action: 'review_approach'
      });
    }

    // 分析错误类型
    const errors = recentFeedback.filter(f => !f.success);
    const errorTypes = {};
    errors.forEach(e => {
      errorTypes[e.type] = (errorTypes[e.type] || 0) + 1;
    });

    Object.entries(errorTypes).forEach(([type, count]) => {
      if (count >= 3) {
        improvements.push({
          type: 'pattern',
          message: `检测到重复错误: ${type}`,
          action: 'learn_error_pattern',
          count
        });
      }
    });

    return improvements;
  }

  // ==================== Self-Fixing: 自修复 ====================

  /**
   * 检测构建错误
   */
  detectBuildErrors(buildOutput) {
    const errors = [];

    // 常见错误模式
    const errorPatterns = [
      {
        type: 'typescript',
        regex: /error TS(\d+):/g,
        severity: 'error'
      },
      {
        type: 'eslint',
        regex: /error\s+(.+)/g,
        severity: 'error'
      },
      {
        type: 'test_failure',
        regex: /FAIL\s+(.+)/g,
        severity: 'error'
      }
    ];

    errorPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(buildOutput)) !== null) {
        errors.push({
          type: pattern.type,
          message: match[1] || match[0],
          severity: pattern.severity
        });
      }
    });

    return errors;
  }

  /**
   * 尝试修复错误
   */
  async fixErrors(errors) {
    const fixes = [];

    for (const error of errors) {
      const fix = await this.generateFix(error);
      if (fix) {
        fixes.push(fix);
      }
    }

    return fixes;
  }

  /**
   * 生成修复方案
   */
  async generateFix(error) {
    // 这里可以集成 AI 来生成修复方案
    const fixStrategies = {
      typescript: async (error) => ({
        type: 'typescript',
        strategy: 'add_type_annotation',
        description: '添加类型注解',
        error: error.message
      }),
      eslint: async (error) => ({
        type: 'eslint',
        strategy: 'apply_fix',
        description: '应用 ESLint 修复',
        error: error.message
      }),
      test_failure: async (error) => ({
        type: 'test',
        strategy: 'update_test',
        description: '更新测试用例',
        error: error.message
      })
    };

    const strategy = fixStrategies[error.type];
    if (strategy) {
      return await strategy(error);
    }

    return null;
  }

  // ==================== Self-Building: 自构建 ====================

  /**
   * 自动初始化
   */
  autoInitialize() {
    const aware = this.aware();

    // 根据语言和框架自动学习模式
    const autoPatterns = this.getAutoPatterns(aware.language, aware.framework);
    autoPatterns.forEach(p => {
      this.learnPattern(p.type, p.name, p.description, p.examples);
    });

    return {
      learned: autoPatterns.length,
      patterns: autoPatterns
    };
  }

  /**
   * 获取自动学习模式
   */
  getAutoPatterns(language, framework) {
    const patternMap = {
      'JavaScript/TypeScript': {
        'React': [
          {
            type: PATTERN_TYPES.FRAMEWORK,
            name: 'React Components',
            description: '使用函数组件和 Hooks',
            examples: ['useState', 'useEffect', 'useCallback']
          }
        ],
        'Next.js': [
          {
            type: PATTERN_TYPES.FRAMEWORK,
            name: 'App Router',
            description: '使用 Next.js App Router',
            examples: ['app/page.tsx', 'app/layout.tsx']
          }
        ],
        'default': [
          {
            type: PATTERN_TYPES.CODING_STYLE,
            name: 'ESLint',
            description: '使用 ESLint 进行代码检查',
            examples: ['.eslintrc.js']
          }
        ]
      },
      'Python': {
        'Django': [
          {
            type: PATTERN_TYPES.FRAMEWORK,
            name: 'Django MTV',
            description: 'Model-Template-View 架构',
            examples: ['models.py', 'views.py', 'templates']
          }
        ],
        'FastAPI': [
          {
            type: PATTERN_TYPES.FRAMEWORK,
            name: 'FastAPI Routing',
            description: '使用装饰器定义路由',
            examples: ['@app.get', '@app.post']
          }
        ]
      },
      'Java': {
        'Spring Boot': [
          {
            type: PATTERN_TYPES.FRAMEWORK,
            name: 'Spring Boot Layers',
            description: 'Controller-Service-Mapper 架构',
            examples: ['@Controller', '@Service', '@Mapper']
          },
          {
            type: PATTERN_TYPES.CODING_STYLE,
            name: 'Result<T> Wrapper',
            description: '统一响应包装',
            examples: ['Result.success()', 'Result.fail()']
          }
        ]
      }
    };

    const langPatterns = patternMap[language];
    if (!langPatterns) return [];

    return langPatterns[framework] || langPatterns['default'] || [];
  }

  // ==================== 报告生成 ====================

  /**
   * 生成完整报告
   */
  generateReport() {
    const aware = this.aware();
    const improvements = this.improve();
    const suggestions = this.getSuggestions();
    const stats = this.patternLearner.getStats();

    let report = '🤖 **Self-* 系统状态报告**\n\n';

    // Self-Aware
    report += '**🧠 Self-Aware (自我感知)**:\n\n';
    report += `语言: ${aware.language}\n`;
    report += `框架: ${aware.framework}\n`;
    report += `已学习模式: ${stats.total} (掌握: ${stats.mastered})\n\n`;

    // High confidence patterns
    if (aware.patterns.length > 0) {
      report += '高置信度模式:\n';
      aware.patterns.slice(0, 5).forEach(p => {
        report += `  - ${p.name} (置信度: ${p.confidence.toFixed(2)})\n`;
      });
      report += '\n';
    }

    // Self-Improving
    if (improvements.length > 0) {
      report += '**📈 Self-Improving (自我改进)**:\n\n';
      improvements.forEach(imp => {
        report += `  - ${imp.message}\n`;
      });
      report += '\n';
    }

    // Suggestions
    if (suggestions.length > 0) {
      report += '**💡 建议**:\n\n';
      suggestions.forEach(s => {
        const priority = s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢';
        report += `  ${priority} ${s.message}\n`;
      });
      report += '\n';
    }

    // Statistics
    report += '**📊 统计**:\n\n';
    report += `总反馈数: ${this.feedback.length}\n`;
    report += `最近成功率: ${this.getRecentSuccessRate()}\n`;

    return report;
  }

  /**
   * 获取最近成功率
   */
  getRecentSuccessRate() {
    if (this.feedback.length === 0) return 'N/A';

    const recent = this.feedback.slice(-20);
    const successCount = recent.filter(f => f.success).length;
    const rate = (successCount / recent.length * 100).toFixed(1);
    return `${rate}%`;
  }
}

// 导出
export { SelfStarSystem };
