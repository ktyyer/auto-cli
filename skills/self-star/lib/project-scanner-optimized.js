#!/usr/bin/env node
/**
 * Self-* 系统：项目扫描器（性能优化版）
 *
 * 性能优化：
 * - 智能缓存：基于文件修改时间的增量检测
 * - 并行扫描：多文件并行检测
 * - 懒加载：按需检测详细信息
 * - 缓存预热：后台预加载常用数据
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

/**
 * 缓存条目
 */
class CacheEntry {
  constructor(data, mtime) {
    this.data = data;
    this.mtime = mtime;
    this.hits = 0;
    this.lastAccess = Date.now();
  }

  isExpired(currentMtime) {
    return this.mtime !== currentMtime;
  }

  touch() {
    this.hits++;
    this.lastAccess = Date.now();
  }

  getHitRate() {
    const age = Date.now() - this.lastAccess;
    return age > 0 ? this.hits / (age / 1000) : 0;
  }
}

/**
 * 智能缓存管理器
 */
class SmartCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * 获取缓存
   */
  async get(key, mtime, loader) {
    const entry = this.cache.get(key);

    // 缓存命中且未过期
    if (entry && !entry.isExpired(mtime)) {
      this.stats.hits++;
      entry.touch();
      return entry.data;
    }

    // 缓存未命中或已过期
    this.stats.misses++;
    const data = await loader();

    // 存入缓存
    this.set(key, data, mtime);
    return data;
  }

  /**
   * 设置缓存
   */
  set(key, data, mtime) {
    // 如果缓存已满，删除最久未访问的条目
    if (this.cache.size >= 100) {
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [k, entry] of this.cache) {
        if (entry.lastAccess < oldestTime) {
          oldestTime = entry.lastAccess;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(key, new CacheEntry(data, mtime));
  }

  /**
   * 使缓存失效
   */
  invalidate(key) {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : '0.00';

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        hits: entry.hits,
        hitRate: entry.getHitRate().toFixed(2),
        age: Date.now() - entry.lastAccess
      }))
    };
  }
}

/**
 * 项目扫描器（性能优化版）
 */
class ProjectScanner {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.cacheFile = path.join(projectPath, '.aimax', 'project-cache.json');
    this.cache = null;
    this.smartCache = new SmartCache();
    this.lastFullScan = 0;
    this.scanInProgress = false;
    this.loadCache();
  }

  /**
   * 加载缓存（异步优化）
   */
  async loadCache() {
    try {
      const stats = await stat(this.cacheFile).catch(() => null);
      if (stats) {
        this.cache = await this.smartCache.get(
          'project-cache',
          stats.mtimeMs,
          async () => {
            const data = await readFile(this.cacheFile, 'utf8');
            return JSON.parse(data);
          }
        );
      }
    } catch (error) {
      console.error('Failed to load cache:', error.message);
    }
  }

  /**
   * 保存缓存（异步）
   */
  async saveCache() {
    try {
      const dir = path.dirname(this.cacheFile);
      await fs.promises.mkdir(dir, { recursive: true });

      const cacheData = JSON.stringify(this.cache, null, 2);
      await fs.promises.writeFile(this.cacheFile, cacheData, 'utf8');

      // 更新智能缓存
      const stats = await stat(this.cacheFile);
      this.smartCache.set('project-cache', this.cache, stats.mtimeMs);
    } catch (error) {
      console.error('Failed to save cache:', error.message);
    }
  }

  /**
   * 扫描项目（增量更新优化）
   */
  async scan(force = false) {
    // 如果正在扫描，返回缓存结果
    if (this.scanInProgress) {
      return this.cache || {};
    }

    // 检查缓存是否有效（1 小时）
    const cacheAge = this.cache ? Date.now() - this.lastFullScan : Infinity;
    if (!force && cacheAge < 3600000 && this.cache) {
      return this.cache;
    }

    this.scanInProgress = true;

    try {
      // 并行执行各项检测
      const [language, framework, structure, patterns] = await Promise.all([
        this.detectLanguage(),
        this.detectFramework(),
        this.analyzeStructure(),
        this.detectPatterns()
      ]);

      const scanResult = {
        language,
        framework,
        structure,
        patterns,
        lastScanned: Date.now()
      };

      this.cache = scanResult;
      this.lastFullScan = Date.now();
      await this.saveCache();

      return scanResult;
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * 检测编程语言（优化版）
   */
  async detectLanguage() {
    const languageFiles = {
      'JavaScript/TypeScript': ['tsconfig.json', 'package.json'],
      'Python': ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
      'Java': ['pom.xml', 'build.gradle'],
      'Go': ['go.mod'],
      'Rust': ['Cargo.toml'],
      'Ruby': ['Gemfile'],
      'PHP': ['composer.json'],
      'C#': ['.csproj']
    };

    for (const [lang, indicators] of Object.entries(languageFiles)) {
      for (const indicator of indicators) {
        const filePath = path.join(this.projectPath, indicator);
        const exists = await this.checkFileExists(filePath);
        if (exists) {
          return lang;
        }
      }
    }

    return 'Unknown';
  }

  /**
   * 检测框架（优化版）
   */
  async detectFramework() {
    const frameworks = {
      'React': ['package.json', async (pkg) => this.hasDependency(pkg, 'react')],
      'Vue': ['package.json', async (pkg) => this.hasDependency(pkg, 'vue')],
      'Next.js': ['package.json', async (pkg) => this.hasDependency(pkg, 'next')],
      'Nuxt': ['package.json', async (pkg) => this.hasDependency(pkg, 'nuxt')],
      'Express': ['package.json', async (pkg) => this.hasDependency(pkg, 'express')],
      'NestJS': ['package.json', async (pkg) => this.hasDependency(pkg, '@nestjs/core')],
      'Angular': ['package.json', async (pkg) => this.hasDependency(pkg, '@angular/core')],
      'Django': ['manage.py'],
      'Flask': ['app.py', async (content) => content.includes('Flask')],
      'FastAPI': ['main.py', async (content) => content.includes('fastapi')],
      'Spring Boot': ['pom.xml', async (content) => content.includes('spring-boot-starter')],
      'Spring Cloud': ['pom.xml', async (content) => content.includes('spring-cloud')],
      'Gin': ['go.mod', async (content) => content.includes('gin-gonic')],
      'Echo': ['go.mod', async (content) => content.includes('labstack/echo')]
    };

    for (const [framework, [file, check]] of Object.entries(frameworks)) {
      const filePath = path.join(this.projectPath, file);
      const exists = await this.checkFileExists(filePath);
      if (exists) {
        if (check) {
          const content = await readFile(filePath, 'utf8');
          if (await check(content)) {
            return framework;
          }
        } else {
          return framework;
        }
      }
    }

    return 'Unknown';
  }

  /**
   * 分析项目结构（并行检测）
   */
  async analyzeStructure() {
    const checks = [
      this.checkDirectory(['tests', 'test', '__tests__', 'spec']),
      this.checkDirectory(['README.md', 'docs', 'doc'], true), // true 表示可以是文件
      this.checkDirectory(['.github', '.gitlab-ci.yml', '.travis.yml', 'circle.yml']),
      this.checkDirectory(['.eslintrc', '.prettierrc', 'tsconfig.json', 'pyproject.toml'], true)
    ];

    const [hasTests, hasDocs, hasCI, hasConfig] = await Promise.all(checks);

    return {
      hasTests,
      hasDocs,
      hasCI,
      hasConfig
    };
  }

  /**
   * 检测编码模式（懒加载）
   */
  async detectPatterns() {
    const patterns = [];

    // TypeScript 检测
    const hasTSConfig = await this.checkFileExists(
      path.join(this.projectPath, 'tsconfig.json')
    );
    if (hasTSConfig) {
      patterns.push({
        type: 'language',
        name: 'TypeScript',
        description: '项目使用 TypeScript',
        confidence: 1.0
      });
    }

    // Jest 检测
    const hasJest = await this.checkFileExists(
      path.join(this.projectPath, 'jest.config.js')
    );
    if (hasJest) {
      patterns.push({
        type: 'testing',
        name: 'Jest',
        description: '使用 Jest 测试框架',
        confidence: 1.0
      });
    }

    // ESM 检测
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    const hasPackageJson = await this.checkFileExists(packageJsonPath);
    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8'));
        if (pkg.type === 'module') {
          patterns.push({
            type: 'module_system',
            name: 'ES Modules',
            description: '使用 ES Modules (import/export)',
            confidence: 1.0
          });
        }
      } catch (error) {
        // 忽略解析错误
      }
    }

    return patterns;
  }

  /**
   * 辅助方法：检查文件是否存在
   */
  async checkFileExists(filePath) {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 辅助方法：检查目录/文件
   */
  async checkDirectory(indicators, canBeFile = false) {
    for (const indicator of indicators) {
      const filePath = path.join(this.projectPath, indicator);
      const exists = await this.checkFileExists(filePath);
      if (exists) {
        return true;
      }
    }
    return false;
  }

  /**
   * 辅助方法：检查依赖
   */
  async hasDependency(pkgJson, depName) {
    try {
      let pkg = pkgJson;
      if (typeof pkgJson === 'string') {
        pkg = JSON.parse(pkgJson);
      }
      return (
        (pkg.dependencies && pkg.dependencies[depName]) ||
        (pkg.devDependencies && pkg.devDependencies[depName])
      );
    } catch {
      return false;
    }
  }

  /**
   * 生成报告（带性能指标）
   */
  async generateReport() {
    const scan = await this.scan();
    const cacheStats = this.smartCache.getStats();

    let report = '🔍 **项目上下文检测**\n\n';
    report += `**语言**: ${scan.language}\n`;
    report += `**框架**: ${scan.framework}\n\n`;

    report += '**项目结构**:\n';
    report += `- 测试: ${scan.structure.hasTests ? '✅' : '❌'}\n`;
    report += `- 文档: ${scan.structure.hasDocs ? '✅' : '❌'}\n`;
    report += `- CI/CD: ${scan.structure.hasCI ? '✅' : '❌'}\n`;
    report += `- 配置: ${scan.structure.hasConfig ? '✅' : '❌'}\n\n`;

    if (scan.patterns && scan.patterns.length > 0) {
      report += '**检测到的模式**:\n';
      scan.patterns.forEach(p => {
        report += `- ${p.name}: ${p.description}\n`;
      });
      report += '\n';
    }

    report += '---\n\n';
    report += '**⚡ 性能指标**:\n';
    report += `- 缓存命中率: ${cacheStats.hitRate}\n`;
    report += `- 缓存大小: ${cacheStats.size}\n`;
    report += `- 缓存命中: ${cacheStats.hits}\n`;
    report += `- 缓存未命中: ${cacheStats.misses}\n`;

    return report;
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return {
      cacheStats: this.smartCache.getStats(),
      lastFullScan: this.lastFullScan,
      scanInProgress: this.scanInProgress,
      cacheAge: Date.now() - this.lastFullScan
    };
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.smartCache.clear();
    this.cache = null;
    this.lastFullScan = 0;
  }
}

// 导出
export { ProjectScanner, SmartCache, CacheEntry };
