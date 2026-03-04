#!/usr/bin/env node
/**
 * Self-* 系统：项目扫描器
 *
 * 功能：
 * - 扫描项目结构
 * - 检测编程语言和框架
 * - 识别编码模式
 */

import fs from 'fs';
import path from 'path';

/**
 * 项目扫描器类
 */
class ProjectScanner {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.cacheFile = path.join(projectPath, '.aimax', 'project-cache.json');
    this.cache = null;
    this.loadCache();
  }

  /**
   * 加载缓存
   */
  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf8');
        this.cache = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load cache:', error.message);
    }
  }

  /**
   * 保存缓存
   */
  saveCache() {
    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.cacheFile,
        JSON.stringify(this.cache, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save cache:', error.message);
    }
  }

  /**
   * 扫描项目结构
   */
  scan() {
    if (this.cache && this.isCacheValid()) {
      return this.cache;
    }

    const scanResult = {
      language: this.detectLanguage(),
      framework: this.detectFramework(),
      structure: this.analyzeStructure(),
      patterns: this.detectPatterns(),
      lastScanned: Date.now()
    };

    this.cache = scanResult;
    this.saveCache();

    return scanResult;
  }

  /**
   * 检查缓存是否有效
   */
  isCacheValid() {
    if (!this.cache || !this.cache.lastScanned) return false;
    const age = Date.now() - this.cache.lastScanned;
    // 缓存有效期为 1 小时
    return age < 3600000;
  }

  /**
   * 检测编程语言
   */
  detectLanguage() {
    const languageFiles = {
      'JavaScript/TypeScript': ['tsconfig.json', 'package.json'],
      'Python': ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
      'Java': ['pom.xml', 'build.gradle', 'src/main/java'],
      'Go': ['go.mod'],
      'Rust': ['Cargo.toml'],
      'Ruby': ['Gemfile'],
      'PHP': ['composer.json'],
      'C#': ['.csproj']
    };

    for (const [lang, indicators] of Object.entries(languageFiles)) {
      for (const indicator of indicators) {
        const filePath = path.join(this.projectPath, indicator);
        if (fs.existsSync(filePath)) {
          return lang;
        }
      }
    }

    return 'Unknown';
  }

  /**
   * 检测框架
   */
  detectFramework() {
    const frameworks = {
      // JavaScript/TypeScript
      'React': ['package.json', (pkg) => this.hasDependency(pkg, 'react')],
      'Vue': ['package.json', (pkg) => this.hasDependency(pkg, 'vue')],
      'Next.js': ['package.json', (pkg) => this.hasDependency(pkg, 'next')],
      'Nuxt': ['package.json', (pkg) => this.hasDependency(pkg, 'nuxt')],
      'Express': ['package.json', (pkg) => this.hasDependency(pkg, 'express')],
      'NestJS': ['package.json', (pkg) => this.hasDependency(pkg, '@nestjs/core')],
      'Angular': ['package.json', (pkg) => this.hasDependency(pkg, '@angular/core')],

      // Python
      'Django': ['manage.py'],
      'Flask': ['app.py', (content) => content.includes('Flask')],
      'FastAPI': ['main.py', (content) => content.includes('fastapi')],

      // Java
      'Spring Boot': ['pom.xml', (content) => content.includes('spring-boot-starter')],
      'Spring Cloud': ['pom.xml', (content) => content.includes('spring-cloud')],

      // Go
      'Gin': ['go.mod', (content) => content.includes('gin-gonic')],
      'Echo': ['go.mod', (content) => content.includes('labstack/echo')],
    };

    for (const [framework, [file, check]] of Object.entries(frameworks)) {
      const filePath = path.join(this.projectPath, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (check && check(content)) {
          return framework;
        } else if (!check) {
          return framework;
        }
      }
    }

    return 'Unknown';
  }

  /**
   * 检查 package.json 中的依赖
   */
  hasDependency(pkgJson, depName) {
    if (typeof pkgJson === 'string') {
      try {
        pkgJson = JSON.parse(pkgJson);
      } catch {
        return false;
      }
    }
    return (
      (pkgJson.dependencies && pkgJson.dependencies[depName]) ||
      (pkgJson.devDependencies && pkgJson.devDependencies[depName])
    );
  }

  /**
   * 分析项目结构
   */
  analyzeStructure() {
    const structure = {
      hasTests: false,
      hasDocs: false,
      hasCI: false,
      hasConfig: false,
      directories: [],
      fileCount: 0
    };

    // 检查测试目录
    const testDirs = ['tests', 'test', '__tests__', 'spec'];
    structure.hasTests = testDirs.some(dir =>
      fs.existsSync(path.join(this.projectPath, dir))
    );

    // 检查文档
    const docFiles = ['README.md', 'docs', 'doc'];
    structure.hasDocs = docFiles.some(doc =>
      fs.existsSync(path.join(this.projectPath, doc))
    );

    // 检查 CI
    const ciDirs = ['.github', '.gitlab-ci.yml', '.travis.yml', 'circle.yml'];
    structure.hasCI = ciDirs.some(ci =>
      fs.existsSync(path.join(this.projectPath, ci))
    );

    // 检查配置文件
    const configFiles = ['.eslintrc', '.prettierrc', 'tsconfig.json', 'pyproject.toml'];
    structure.hasConfig = configFiles.some(config =>
      fs.existsSync(path.join(this.projectPath, config))
    );

    return structure;
  }

  /**
   * 检测编码模式
   */
  detectPatterns() {
    const patterns = [];

    // 检测是否使用 TypeScript
    if (fs.existsSync(path.join(this.projectPath, 'tsconfig.json'))) {
      patterns.push({
        type: 'language',
        name: 'TypeScript',
        description: '项目使用 TypeScript',
        confidence: 1.0
      });
    }

    // 检测测试框架
    if (fs.existsSync(path.join(this.projectPath, 'jest.config.js'))) {
      patterns.push({
        type: 'testing',
        name: 'Jest',
        description: '使用 Jest 测试框架',
        confidence: 1.0
      });
    }

    // 检测 ESM 模块
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.type === 'module') {
        patterns.push({
          type: 'module_system',
          name: 'ES Modules',
          description: '使用 ES Modules (import/export)',
          confidence: 1.0
        });
      }
    }

    return patterns;
  }

  /**
   * 生成报告
   */
  generateReport() {
    const scan = this.scan();

    let report = '🔍 **项目上下文检测**\n\n';
    report += `**语言**: ${scan.language}\n`;
    report += `**框架**: ${scan.framework}\n\n`;

    report += '**项目结构**:\n';
    report += `- 测试: ${scan.structure.hasTests ? '✅' : '❌'}\n`;
    report += `- 文档: ${scan.structure.hasDocs ? '✅' : '❌'}\n`;
    report += `- CI/CD: ${scan.structure.hasCI ? '✅' : '❌'}\n`;
    report += `- 配置: ${scan.structure.hasConfig ? '✅' : '❌'}\n\n`;

    if (scan.patterns.length > 0) {
      report += '**检测到的模式**:\n';
      scan.patterns.forEach(p => {
        report += `- ${p.name}: ${p.description}\n`;
      });
    }

    return report;
  }
}

// 导出
export { ProjectScanner };
