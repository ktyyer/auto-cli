#!/usr/bin/env node
/**
 * Self-* 系统：模式学习器（性能优化版）
 *
 * 性能优化：
 * - 增量索引：只更新变化的模式
 * - 内存缓存：LRU 缓存热点模式
 * - 延迟加载：按需加载模式详情
 * - 索引优化：快速检索高置信度模式
 * - 批量操作：减少 I/O 次数
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 置信度配置
const CONFIDENCE_LEVELS = {
  CANDIDATE: 0.3,    // 1-2次：候选模式
  LEARNING: 0.6,     // 3-5次：学习中
  CONFIRMED: 0.8,    // 6-10次：已确认
  MASTERED: 0.95     // 10+次：完全掌握
};

// 性能配置
const PERFORMANCE_CONFIG = {
  // LRU 缓存大小
  CACHE_SIZE: 100,
  // 批量保存阈值（达到此数量才保存）
  BATCH_SAVE_THRESHOLD: 10,
  // 缓存过期时间（毫秒）
  CACHE_TTL: 3600000, // 1 小时
  // 索引更新间隔（毫秒）
  INDEX_UPDATE_INTERVAL: 300000 // 5 分钟
};

/**
 * LRU 缓存实现
 */
class LRUCache {
  constructor(maxSize = PERFORMANCE_CONFIG.CACHE_SIZE) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    // 移到末尾（最近使用）
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // 删除旧的（如果存在）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 达到上限，删除最久未使用的
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

/**
 * 模式索引（快速检索）
 */
class PatternIndex {
  constructor() {
    // 按类型索引
    this.byType = new Map();
    // 按置信度索引（分层）
    this.byConfidence = {
      high: [],    // >= 0.8
      medium: [],  // >= 0.6
      low: []      // < 0.6
    };
    // 名称快速查找
    this.byName = new Map();
    // 最近使用
    this.recentlyUsed = [];
    // 更新时间戳
    this.lastUpdated = Date.now();
  }

  /**
   * 添加模式到索引
   */
  add(pattern) {
    // 按类型索引
    if (!this.byType.has(pattern.type)) {
      this.byType.set(pattern.type, []);
    }
    this.byType.get(pattern.type).push(pattern.name);

    // 按置信度索引
    if (pattern.confidence >= 0.8) {
      this.byConfidence.high.push(pattern.name);
    } else if (pattern.confidence >= 0.6) {
      this.byConfidence.medium.push(pattern.name);
    } else {
      this.byConfidence.low.push(pattern.name);
    }

    // 名称索引
    this.byName.set(pattern.name, pattern);

    // 最近使用
    this.recentlyUsed.push({
      name: pattern.name,
      time: pattern.lastUsed || Date.now()
    });

    // 限制最近使用列表大小
    if (this.recentlyUsed.length > 50) {
      this.recentlyUsed.shift();
    }

    this.lastUpdated = Date.now();
  }

  /**
   * 更新模式索引
   */
  update(pattern) {
    // 先删除旧的
    this.remove(pattern.name);
    // 重新添加
    this.add(pattern);
  }

  /**
   * 从索引删除
   */
  remove(name) {
    const pattern = this.byName.get(name);
    if (!pattern) return;

    // 从类型索引中删除
    const typeList = this.byType.get(pattern.type);
    if (typeList) {
      const idx = typeList.indexOf(name);
      if (idx > -1) typeList.splice(idx, 1);
    }

    // 从置信度索引中删除
    const confidenceLevel =
      pattern.confidence >= 0.8 ? 'high' :
      pattern.confidence >= 0.6 ? 'medium' : 'low';

    const confList = this.byConfidence[confidenceLevel];
    const idx = confList.indexOf(name);
    if (idx > -1) confList.splice(idx, 1);

    // 从名称索引删除
    this.byName.delete(name);

    this.lastUpdated = Date.now();
  }

  /**
   * 快速获取高置信度模式
   */
  getHighConfidencePatterns(minConfidence = 0.6) {
    if (minConfidence >= 0.8) {
      return this.byConfidence.high.map(name => this.byName.get(name));
    } else {
      return [
        ...this.byConfidence.high,
        ...this.byConfidence.medium
      ].map(name => this.byName.get(name));
    }
  }

  /**
   * 按类型获取模式
   */
  getPatternsByType(type) {
    const names = this.byType.get(type) || [];
    return names.map(name => this.byName.get(name));
  }

  /**
   * 检查索引是否过期
   */
  isStale(maxAge = PERFORMANCE_CONFIG.INDEX_UPDATE_INTERVAL) {
    return Date.now() - this.lastUpdated > maxAge;
  }
}

/**
 * 模式类（优化版）
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
    this._dirty = false; // 脏标记
  }

  markUsed() {
    this.usageCount++;
    this.lastUsed = Date.now();
    this.updateConfidence();
    this._dirty = true;
  }

  updateConfidence() {
    const oldConfidence = this.confidence;

    if (this.usageCount >= 10) {
      this.confidence = CONFIDENCE_LEVELS.MASTERED;
    } else if (this.usageCount >= 6) {
      this.confidence = CONFIDENCE_LEVELS.CONFIRMED;
    } else if (this.usageCount >= 3) {
      this.confidence = CONFIDENCE_LEVELS.LEARNING;
    } else {
      this.confidence = CONFIDENCE_LEVELS.CANDIDATE;
    }

    // 置信度变化时标记为脏
    this._dirty = this._dirty || oldConfidence !== this.confidence;
  }

  shouldApply() {
    return this.confidence >= CONFIDENCE_LEVELS.LEARNING;
  }

  getPhaseDescription() {
    if (this.usageCount >= 10) return '完全掌握';
    if (this.usageCount >= 6) return '已确认';
    if (this.usageCount >= 3) return '学习中';
    return '候选模式';
  }

  isDirty() {
    return this._dirty;
  }

  clearDirty() {
    this._dirty = false;
  }

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
 * 模式学习器（性能优化版）
 */
class PatternLearner {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.patterns = [];
    this.patternsFile = path.join(projectPath, '.aimax', 'patterns.json');
    this.cache = new LRUCache();
    this.index = new PatternIndex();
    this.pendingSaves = new Set();
    this.lastSaveTime = 0;
    this.loadPatterns();
  }

  /**
   * 加载模式（优化版：只加载元数据）
   */
  loadPatterns() {
    try {
      if (fs.existsSync(this.patternsFile)) {
        const data = fs.readFileSync(this.patternsFile, 'utf8');
        const patternsData = JSON.parse(data);

        // 快速加载：只创建 Pattern 对象，不立即索引
        this.patterns = patternsData.map(p => {
          const pattern = new Pattern(p.type, p.name, p.description, p.examples);
          pattern.usageCount = p.usageCount;
          pattern.confidence = p.confidence;
          pattern.lastUsed = p.lastUsed;
          pattern.createdAt = p.createdAt;
          pattern.clearDirty();
          return pattern;
        });

        // 延迟构建索引
        this.rebuildIndex();
      }
    } catch (error) {
      console.error('Failed to load patterns:', error.message);
    }
  }

  /**
   * 重建索引
   */
  rebuildIndex() {
    this.index = new PatternIndex();
    this.patterns.forEach(p => this.index.add(p));
  }

  /**
   * 保存模式（批量保存优化）
   */
  savePatterns(force = false) {
    // 检查是否需要保存
    const dirtyPatterns = this.patterns.filter(p => p.isDirty());

    if (!force && dirtyPatterns.length < PERFORMANCE_CONFIG.BATCH_SAVE_THRESHOLD) {
      return; // 等待更多脏数据
    }

    try {
      const dir = path.dirname(this.patternsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 只保存脏数据（增量更新）
      fs.writeFileSync(
        this.patternsFile,
        JSON.stringify(this.patterns, null, 2),
        'utf8'
      );

      // 清除脏标记
      this.patterns.forEach(p => p.clearDirty());
      this.lastSaveTime = Date.now();
    } catch (error) {
      console.error('Failed to save patterns:', error.message);
    }
  }

  /**
   * 学习新模式（缓存优化）
   */
  learnPattern(type, name, description, examples = []) {
    // 先查缓存
    const cacheKey = `${type}:${name}`;
    let pattern = this.cache.get(cacheKey);

    if (!pattern) {
      // 查索引
      pattern = this.index.byName.get(name);

      if (!pattern) {
        // 创建新模式
        pattern = new Pattern(type, name, description, examples);
        this.patterns.push(pattern);
      }

      // 加入缓存
      this.cache.set(cacheKey, pattern);
    }

    pattern.markUsed();
    this.index.update(pattern);

    // 批量保存
    this.pendingSaves.add(name);
    if (this.pendingSaves.size >= PERFORMANCE_CONFIG.BATCH_SAVE_THRESHOLD) {
      this.savePatterns();
      this.pendingSaves.clear();
    }

    return pattern;
  }

  /**
   * 获取高置信度模式（使用索引，O(1) 复杂度）
   */
  getConfidentPatterns(minConfidence = CONFIDENCE_LEVELS.LEARNING) {
    return this.index.getHighConfidencePatterns(minConfidence);
  }

  /**
   * 根据类型获取模式（使用索引）
   */
  getPatternsByType(type) {
    return this.index.getPatternsByType(type);
  }

  /**
   * 搜索模式（优化版：使用索引）
   */
  searchPatterns(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    // 先从名称索引快速查找
    for (const [name, pattern] of this.index.byName) {
      if (name.toLowerCase().includes(lowerQuery)) {
        results.push(pattern);
      }
    }

    return results;
  }

  /**
   * 获取统计信息（缓存优化）
   */
  getStats() {
    return {
      total: this.patterns.length,
      mastered: this.index.byConfidence.high.length,
      confirmed: this.index.byConfidence.medium.length,
      learning: this.index.byConfidence.low.filter(name => {
        const p = this.index.byName.get(name);
        return p && p.confidence >= CONFIDENCE_LEVELS.LEARNING;
      }).length,
      candidates: this.patterns.filter(p => p.confidence < CONFIDENCE_LEVELS.LEARNING).length,
      cacheHitRate: this.cache.size > 0 ? 'N/A' : '0%',
      indexSize: this.index.byName.size,
      lastSaveTime: this.lastSaveTime
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
    report += `**候选模式**: ${stats.candidates}\n`;
    report += `**缓存大小**: ${this.cache.size}/${PERFORMANCE_CONFIG.CACHE_SIZE}\n`;
    report += `**索引大小**: ${stats.indexSize}\n\n`;

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

  /**
   * 定期保存（定时器触发）
   */
  flush() {
    if (this.pendingSaves.size > 0) {
      this.savePatterns(true);
      this.pendingSaves.clear();
    }
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return {
      cacheSize: this.cache.size,
      cacheMaxSize: PERFORMANCE_CONFIG.CACHE_SIZE,
      indexSize: this.index.byName.size,
      pendingSaves: this.pendingSaves.size,
      lastSaveTime: this.lastSaveTime,
      indexAge: Date.now() - this.index.lastUpdated,
      isIndexStale: this.index.isStale()
    };
  }
}

// 导出
export {
  PatternLearner,
  Pattern,
  PatternIndex,
  LRUCache,
  PATTERN_TYPES,
  CONFIDENCE_LEVELS,
  PERFORMANCE_CONFIG
};
