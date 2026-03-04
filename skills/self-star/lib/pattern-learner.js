#!/usr/bin/env node
/**
 * Self-* 系统：模式学习器
 *
 * 功能：
 * - 从项目代码中学习编码模式
 * - 基于使用次数计算置信度
 * - 自动应用已学习的模式
 */

const fs = 'fs';
const path = 'path';

// 置信度配置
const CONFIDENCE_LEVELS = {
  CANDIDATE: 0.3,    // 1-2次：候选模式
  LEARNING: 0.6,     // 3-5次：学习中
  CONFIRMED: 0.8,    // 6-10次：已确认
  MASTERED: 0.95     // 10+次：完全掌握
};

// 模式类型
const PATTERN_TYPES = {
  // 架构模式
  ARCHITECTURE: 'architecture',
  // 编码风格
  CODING_STYLE: 'coding_style',
  // 命名规范
  NAMING: 'naming',
  // 错误处理
  ERROR_HANDLING: 'error_handling',
  // 测试模式
  TESTING: 'testing',
  // 框架使用
  FRAMEWORK: 'framework'
};

/**
 * 模式类
 */
class Pattern {
  constructor(type, name, description, examples = []) {
    this.type = type;
    this.name = name;
    this.description = description;
    this.examples = examples;
    this.usageCount = 0;
    this.confidence = CONFIDENCE_LEVELS.CANDIDATE;
    this.lastUsed = null;
    this.createdAt = Date.now();
  }

  /**
   * 记录使用
   */
  markUsed() {
    this.usageCount++;
    this.lastUsed = Date.now();
    this.updateConfidence();
  }

  /**
   * 更新置信度
   */
  updateConfidence() {
    if (this.usageCount >= 10) {
      this.confidence = CONFIDENCE_LEVELS.MASTERED;
    } else if (this.usageCount >= 6) {
      this.confidence = CONFIDENCE_LEVELS.CONFIRMED;
    } else if (this.usageCount >= 3) {
      this.confidence = CONFIDENCE_LEVELS.LEARNING;
    } else {
      this.confidence = CONFIDENCE_LEVELS.CANDIDATE;
    }
  }

  /**
   * 是否应该应用
   */
  shouldApply() {
    return this.confidence >= CONFIDENCE_LEVELS.LEARNING;
  }

  /**
   * 获取阶段描述
   */
  getPhaseDescription() {
    if (this.usageCount >= 10) return '完全掌握';
    if (this.usageCount >= 6) return '已确认';
    if (this.usageCount >= 3) return '学习中';
    return '候选模式';
  }

  /**
   * 转换为 JSON
   */
  toJSON() {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      usageCount: this.usageCount,
      confidence: this.confidence,
      phase: this.getPhaseDescription(),
      lastUsed: this.lastUsed,
      createdAt: this.createdAt
    };
  }
}

/**
 * 模式学习器类
 */
class PatternLearner {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.patterns = [];
    this.patternsFile = path.join(projectPath, '.aimax', 'patterns.json');
    this.loadPatterns();
  }

  /**
   * 加载已保存的模式
   */
  loadPatterns() {
    try {
      if (fs.existsSync(this.patternsFile)) {
        const data = fs.readFileSync(this.patternsFile, 'utf8');
        const patternsData = JSON.parse(data);
        this.patterns = patternsData.map(p => {
          const pattern = new Pattern(p.type, p.name, p.description, p.examples);
          pattern.usageCount = p.usageCount;
          pattern.confidence = p.confidence;
          pattern.lastUsed = p.lastUsed;
          pattern.createdAt = p.createdAt;
          return pattern;
        });
      }
    } catch (error) {
      console.error('Failed to load patterns:', error.message);
    }
  }

  /**
   * 保存模式到文件
   */
  savePatterns() {
    try {
      const dir = path.dirname(this.patternsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.patternsFile,
        JSON.stringify(this.patterns, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save patterns:', error.message);
    }
  }

  /**
   * 学习新模式
   */
  learnPattern(type, name, description, examples = []) {
    // 检查是否已存在
    let pattern = this.patterns.find(p => p.name === name);
    if (!pattern) {
      pattern = new Pattern(type, name, description, examples);
      this.patterns.push(pattern);
    }
    pattern.markUsed();
    this.savePatterns();
    return pattern;
  }

  /**
   * 获取高置信度模式
   */
  getConfidentPatterns(minConfidence = CONFIDENCE_LEVELS.LEARNING) {
    return this.patterns.filter(p => p.confidence >= minConfidence);
  }

  /**
   * 根据类型获取模式
   */
  getPatternsByType(type) {
    return this.patterns.filter(p => p.type === type);
  }

  /**
   * 搜索模式
   */
  searchPatterns(query) {
    const lowerQuery = query.toLowerCase();
    return this.patterns.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      total: this.patterns.length,
      mastered: this.patterns.filter(p => p.confidence >= CONFIDENCE_LEVELS.MASTERED).length,
      confirmed: this.patterns.filter(p => p.confidence >= CONFIDENCE_LEVELS.CONFIRMED).length,
      learning: this.patterns.filter(p => p.confidence >= CONFIDENCE_LEVELS.LEARNING).length,
      candidates: this.patterns.filter(p => p.confidence < CONFIDENCE_LEVELS.LEARNING).length
    };
  }

  /**
   * 生成状态报告
   */
  generateReport() {
    const stats = this.getStats();
    const confidentPatterns = this.getConfidentPatterns();

    let report = '📊 **项目编码模式统计**\n\n';
    report += `**总模式数**: ${stats.total}\n`;
    report += `**完全掌握**: ${stats.mastered}\n`;
    report += `**已确认**: ${stats.confirmed}\n`;
    report += `**学习中**: ${stats.learning}\n`;
    report += `**候选模式**: ${stats.candidates}\n\n`;

    if (confidentPatterns.length > 0) {
      report += '**✅ 高置信度模式**（置信度 ≥ 0.6）:\n\n';
      confidentPatterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10)
        .forEach(p => {
          report += `- ${p.name} (置信度: ${p.confidence.toFixed(2)}, 使用: ${p.usageCount}次)\n`;
        });
    }

    return report;
  }
}

// 导出
export { PatternLearner, Pattern, PATTERN_TYPES, CONFIDENCE_LEVELS };
