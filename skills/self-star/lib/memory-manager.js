#!/usr/bin/env node
/**
 * 记忆管理器 - 统一的记忆系统接口
 *
 * 功能：
 * - 整合三大记忆系统（Project Memory, Smart Context, Conversational State Machine）
 * - 整合 Self-* 系统（Self-Aware, Self-Improving, Self-Fixing, Self-Building）
 * - 提供统一的查询和更新接口
 */

import { SelfStarSystem } from './self-star.js';
import fs from 'fs';
import path from 'path';

/**
 * 记忆管理器类
 */
class MemoryManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.selfStar = new SelfStarSystem(projectPath);
    this.memoryDir = path.join(projectPath, '.aimax', 'memory');
    this.ensureMemoryDir();
  }

  /**
   * 确保记忆目录存在
   */
  ensureMemoryDir() {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  // ==================== Project Memory ====================

  /**
   * 获取项目记忆
   */
  getProjectMemory() {
    const memoryFile = path.join(this.memoryDir, 'project.json');
    if (fs.existsSync(memoryFile)) {
      const data = fs.readFileSync(memoryFile, 'utf8');
      return JSON.parse(data);
    }
    return {
      sessions: [],
      patterns: [],
      decisions: [],
      faq: [],
      architecture: null,
      updatedAt: null
    };
  }

  /**
   * 更新项目记忆
   */
  updateProjectMemory(updates) {
    const memory = this.getProjectMemory();
    Object.assign(memory, updates);
    memory.updatedAt = Date.now();

    const memoryFile = path.join(this.memoryDir, 'project.json');
    fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2), 'utf8');
    return memory;
  }

  /**
   * 添加会话记录
   */
  addSession(session) {
    const memory = this.getProjectMemory();
    memory.sessions.push({
      ...session,
      timestamp: Date.now()
    });
    // 只保留最近 50 条
    if (memory.sessions.length > 50) {
      memory.sessions = memory.sessions.slice(-50);
    }
    return this.updateProjectMemory({ sessions: memory.sessions });
  }

  /**
   * 添加决策记录
   */
  addDecision(decision) {
    const memory = this.getProjectMemory();
    memory.decisions.push({
      ...decision,
      timestamp: Date.now()
    });
    return this.updateProjectMemory({ decisions: memory.decisions });
  }

  /**
   * 添加 FAQ
   */
  addFAQ(question, answer) {
    const memory = this.getProjectMemory();
    const existing = memory.faq.find(f => f.question === question);
    if (existing) {
      existing.answer = answer;
      existing.updatedAt = Date.now();
    } else {
      memory.faq.push({ question, answer, createdAt: Date.now() });
    }
    return this.updateProjectMemory({ faq: memory.faq });
  }

  // ==================== Smart Context ====================

  /**
   * 获取智能索引状态
   */
  getSmartContextStatus() {
    const indexFile = path.join(this.memoryDir, 'index-status.json');
    if (fs.existsSync(indexFile)) {
      const data = fs.readFileSync(indexFile, 'utf8');
      return JSON.parse(data);
    }
    return {
      indexed: false,
      lastIndexed: null,
      fileCount: 0,
      chunkCount: 0
    };
  }

  /**
   * 更新索引状态
   */
  updateIndexStatus(status) {
    const indexFile = path.join(this.memoryDir, 'index-status.json');
    const updated = {
      ...this.getSmartContextStatus(),
      ...status,
      lastUpdated: Date.now()
    };
    fs.writeFileSync(indexFile, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  }

  /**
   * 搜索相关代码（RAG）
   */
  searchRelevantCode(query) {
    // 这里可以集成实际的向量数据库
    // 简化版：基于关键词搜索
    const relevantFiles = [];

    // 搜索项目中的相关文件
    const searchInDir = (dir, query) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          searchInDir(filePath, query);
        } else if (file.match(/\.(js|ts|jsx|tsx|java|py|go|rs)$/)) {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            relevantFiles.push({
              path: filePath,
              relevance: this.calculateRelevance(content, query)
            });
          }
        }
      });
    };

    searchInDir(this.projectPath, query);

    return relevantFiles
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10)
      .map(f => f.path);
  }

  /**
   * 计算相关性分数
   */
  calculateRelevance(content, query) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    let score = 0;
    queryWords.forEach(word => {
      const regex = new RegExp(word, 'g');
      const matches = contentLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    });

    return score;
  }

  // ==================== Conversational State Machine ====================

  /**
   * 获取对话状态
   */
  getConversationState(sessionId) {
    const stateFile = path.join(this.memoryDir, `session-${sessionId}.json`);
    if (fs.existsSync(stateFile)) {
      const data = fs.readFileSync(stateFile, 'utf8');
      return JSON.parse(data);
    }
    return {
      sessionId,
      state: 'INTAKE',
      checkpoints: [],
      history: [],
      createdAt: Date.now()
    };
  }

  /**
   * 更新对话状态
   */
  updateConversationState(sessionId, updates) {
    const state = this.getConversationState(sessionId);
    Object.assign(state, updates);
    state.lastUpdated = Date.now();

    const stateFile = path.join(this.memoryDir, `session-${sessionId}.json`);
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
    return state;
  }

  /**
   * 添加检查点
   */
  addCheckpoint(sessionId, step, data) {
    const state = this.getConversationState(sessionId);
    state.checkpoints.push({
      step,
      data,
      timestamp: Date.now()
    });
    return this.updateConversationState(sessionId, { checkpoints: state.checkpoints });
  }

  /**
   * 压缩对话历史
   */
  compressHistory(sessionId) {
    const state = this.getConversationState(sessionId);
    if (state.history.length > 100) {
      // 保留最近 50 条，其他的压缩成摘要
      const recent = state.history.slice(-50);
      const old = state.history.slice(0, -50);

      state.compressedSummary = this.generateSummary(old);
      state.history = recent;
    }
    return this.updateConversationState(sessionId, {
      history: state.history,
      compressedSummary: state.compressedSummary
    });
  }

  /**
   * 生成摘要
   */
  generateSummary(messages) {
    // 简化版摘要生成
    return {
      messageCount: messages.length,
      topics: this.extractTopics(messages),
      timeRange: {
        start: messages[0]?.timestamp,
        end: messages[messages.length - 1]?.timestamp
      }
    };
  }

  /**
   * 提取话题
   */
  extractTopics(messages) {
    const topics = new Set();
    messages.forEach(msg => {
      if (msg.role === 'user') {
        const words = msg.content.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 5) {
            topics.add(word);
          }
        });
      }
    });
    return Array.from(topics).slice(0, 10);
  }

  // ==================== Self-* 系统 ====================

  /**
   * Self-Aware: 获取项目上下文
   */
  getProjectContext() {
    return this.selfStar.aware();
  }

  /**
   * 学习模式
   */
  learnPattern(type, name, description, examples = []) {
    return this.selfStar.learnPattern(type, name, description, examples);
  }

  /**
   * 获取已学习的模式
   */
  getLearnedPatterns(minConfidence = 0.6) {
    return this.selfStar.patternLearner.getConfidentPatterns(minConfidence);
  }

  /**
   * Self-Improving: 记录反馈
   */
  recordFeedback(type, data, success = true) {
    return this.selfStar.recordFeedback(type, data, success);
  }

  /**
   * 获取改进建议
   */
  getImprovements() {
    return this.selfStar.improve();
  }

  // ==================== 统一查询接口 ====================

  /**
   * 智能查询 - 综合所有记忆系统
   */
  query(query) {
    const results = {
      query,
      timestamp: Date.now(),
      patterns: [],
      relevantCode: [],
      faq: [],
      decisions: [],
      suggestions: []
    };

    // 从已学习模式中查询
    const patterns = this.getLearnedPatterns();
    results.patterns = patterns.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase())
    );

    // 从代码中搜索
    results.relevantCode = this.searchRelevantCode(query);

    // 从 FAQ 中查询
    const memory = this.getProjectMemory();
    results.faq = memory.faq.filter(f =>
      f.question.toLowerCase().includes(query.toLowerCase())
    );

    // 从决策记录中查询
    results.decisions = memory.decisions.filter(d =>
      d.topic?.toLowerCase().includes(query.toLowerCase()) ||
      d.description?.toLowerCase().includes(query.toLowerCase())
    );

    // 获取改进建议
    results.suggestions = this.getImprovements();

    return results;
  }

  // ==================== 报告生成 ====================

  /**
   * 生成完整的记忆报告
   */
  generateReport() {
    const projectMemory = this.getProjectMemory();
    const smartContext = this.getSmartContextStatus();
    const learnedPatterns = this.getLearnedPatterns();
    const selfStarReport = this.selfStar.generateReport();

    let report = '🧠 **记忆系统状态报告**\n\n';

    // Project Memory
    report += '**📁 Project Memory**:\n';
    report += `  • 会话数: ${projectMemory.sessions.length}\n`;
    report += `  • 决策数: ${projectMemory.decisions.length}\n`;
    report += `  • FAQ 数: ${projectMemory.faq.length}\n`;
    report += `  • 最后更新: ${projectMemory.updatedAt ? new Date(projectMemory.updatedAt).toLocaleString() : 'N/A'}\n\n`;

    // Smart Context
    report += '**🔍 Smart Context**:\n';
    report += `  • 已索引: ${smartContext.indexed ? '✅' : '❌'}\n`;
    if (smartContext.indexed) {
      report += `  • 文件数: ${smartContext.fileCount}\n`;
      report += `  • 分块数: ${smartContext.chunkCount}\n`;
      report += `  • 最后索引: ${new Date(smartContext.lastIndexed).toLocaleString()}\n`;
    }
    report += '\n';

    // Learned Patterns
    if (learnedPatterns.length > 0) {
      report += '**🎯 已学习的模式**:\n';
      learnedPatterns.slice(0, 5).forEach(p => {
        report += `  • ${p.name} (置信度: ${p.confidence.toFixed(2)}, 使用: ${p.usageCount}次)\n`;
      });
      report += '\n';
    }

    // Self-* System
    report += selfStarReport;

    return report;
  }

  /**
   * 生成统计信息
   */
  getStats() {
    const projectMemory = this.getProjectMemory();
    const smartContext = this.getSmartContextStatus();
    const patternStats = this.selfStar.patternLearner.getStats();

    return {
      projectMemory: {
        sessions: projectMemory.sessions.length,
        decisions: projectMemory.decisions.length,
        faq: projectMemory.faq.length
      },
      smartContext: {
        indexed: smartContext.indexed,
        fileCount: smartContext.fileCount || 0
      },
      patterns: patternStats,
      feedback: this.selfStar.feedback.length
    };
  }
}

// 导出
export { MemoryManager };
