/**
 * 仓库源码索引器
 *
 * 核心功能：
 * - 递归扫描项目目录，提取每个源文件的 exports、classes、functions、imports
 * - 生成压缩格式的 REPO_MAP.md（人类/AI 可读）
 * - 生成 machine-readable 的 symbol-index.json（增量更新用）
 * - TTL 缓存 + SHA-256 文件哈希失效检测
 *
 * 灵感来源：
 * - ai-codex: "一个脚本省掉 50K Token"
 * - SkillIndexer: 缓存和增量更新模式
 *
 * 预期效果：冷启动 Token 从 ~50K 压缩到 ~3K
 */

import path from 'node:path';
import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import { execSync } from 'child_process';
import { logger } from '../logger.js';
import {
  extractExports,
  extractClasses,
  extractFunctions,
  extractImports,
  detectLanguage,
  DEFAULT_INCLUDE_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS
} from './patterns.js';

/**
 * 默认索引器配置
 */
const DEFAULT_INDEXER_CONFIG = Object.freeze({
  includePatterns: DEFAULT_INCLUDE_PATTERNS,
  excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
  outputFile: 'REPO_MAP.md',
  cacheFile: '.auto/cache/symbol-index.json',
  maxFileSize: 100000,
  maxRecursionDepth: 20
});

/**
 * @typedef {Object} FileIndex
 * @property {string} filePath - 绝对路径
 * @property {string} relativePath - 相对项目根目录的路径
 * @property {ReadonlyArray<{name: string, type: string, signature: string}>} exports
 * @property {ReadonlyArray<{name: string, methods: string[]}>} classes
 * @property {ReadonlyArray<{name: string, params: string, isAsync: boolean}>} functions
 * @property {ReadonlyArray<{source: string, names: string[], isType: boolean}>} imports
 * @property {string} language
 * @property {string} hash
 */

/**
 * @typedef {Object} FileHashEntry
 * @property {string} relativePath
 * @property {string} hash
 * @property {number} mtime
 */

/**
 * @typedef {Object} SymbolIndexResult
 * @property {number} totalFiles
 * @property {number} totalSymbols
 * @property {FileIndex[]} entries
 * @property {Record<string, FileIndex[]>} sections - 按目录分组
 * @property {string} headHash
 * @property {{headHash: string, createdAt: number, files: FileHashEntry[]}} fileHashes
 * @property {string} generatedAt
 */

export class RepoIndexer {
  /**
   * @param {string} projectDir - 项目根目录
   * @param {Object} [options] - 配置选项
   */
  constructor(projectDir, options = {}) {
    this.projectDir = path.resolve(projectDir);
    this.logger = logger;
    this._cache = null;
    this._cacheTimestamp = 0;
    this._cacheTTL = 24 * 60 * 60 * 1000; // 24 小时
    this._config = Object.freeze({ ...DEFAULT_INDEXER_CONFIG, ...options });
  }

  /**
   * 构建符号索引
   * @param {Object} [options] - 选项
   * @param {boolean} [options.useCache=true] - 是否使用缓存
   * @returns {Promise<SymbolIndexResult>}
   */
  async buildIndex(options = {}) {
    const useCache = options.useCache ?? true;

    // 缓存检查 + 文件变更检测
    if (useCache && this._cache && Date.now() - this._cacheTimestamp < this._cacheTTL) {
      const currentHashes = await this._computeFileHashes();
      const cachedHashes = this._cache.fileHashes?.files || [];

      if (this._hashesEqual(currentHashes, cachedHashes)) {
        this.logger.debug('RepoIndexer: 使用缓存（文件无变更）');
        return this._cache;
      }
      this.logger.debug('RepoIndexer: 缓存失效（检测到文件变更）');

      // 增量更新：只重新索引变更文件
      return this._incrementalBuild(currentHashes, cachedHashes);
    }

    return this._fullBuild();
  }

  /**
   * 生成 REPO_MAP.md
   * @param {string} [outputPath] - 输出路径（默认: projectDir/REPO_MAP.md）
   * @returns {Promise<string>} 生成的文件路径
   */
  async generateRepoMap(outputPath) {
    const index = await this.buildIndex();
    const targetPath = outputPath || path.join(this.projectDir, this._config.outputFile);
    const content = this._formatRepoMap(index);

    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, content, 'utf-8');

    this.logger.info(
      `REPO_MAP.md 已生成: ${targetPath} (${index.totalFiles} 文件, ${index.totalSymbols} 符号)`
    );
    return targetPath;
  }

  /**
   * 生成 symbol-index.json
   * @param {string} [outputPath] - 输出路径
   * @returns {Promise<string>} 生成的文件路径
   */
  async generateSymbolIndex(outputPath) {
    const index = await this.buildIndex();
    const targetPath = outputPath || path.join(this.projectDir, this._config.cacheFile);

    await fs.ensureDir(path.dirname(targetPath));

    // 排除绝对路径字段，避免泄露本地目录结构
    const stripFilePath = ({ filePath: _fp, ...rest }) => rest;
    const safeEntries = index.entries.map(stripFilePath);
    const safeSections = {};
    for (const [dir, files] of Object.entries(index.sections)) {
      safeSections[dir] = files.map(stripFilePath);
    }

    const safeIndex = {
      ...index,
      entries: safeEntries,
      sections: safeSections
    };

    await fs.writeJson(targetPath, safeIndex, { spaces: 2 });

    this.logger.info(`symbol-index.json 已生成: ${targetPath}`);
    return targetPath;
  }

  /**
   * 搜索符号
   * @param {string} query - 搜索关键词
   * @returns {Promise<FileIndex[]>}
   */
  async search(query) {
    const index = await this.buildIndex();
    const lowerQuery = query.toLowerCase();

    return index.entries.filter((entry) => {
      const searchText = [
        ...entry.exports.map((e) => e.name),
        ...entry.classes.map((c) => c.name),
        ...entry.functions.map((f) => f.name),
        entry.relativePath
      ]
        .join(' ')
        .toLowerCase();

      return searchText.includes(lowerQuery);
    });
  }

  /**
   * 获取指定文件的索引数据
   * @param {string} relativePath - 相对路径
   * @returns {Promise<FileIndex|null>}
   */
  async getSymbolsForFile(relativePath) {
    const index = await this.buildIndex();
    return index.entries.find((e) => e.relativePath === relativePath) || null;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this._cache = null;
    this._cacheTimestamp = 0;
  }

  // --- 私有方法 ---

  /**
   * 全量构建
   * @returns {Promise<SymbolIndexResult>}
   * @private
   */
  async _fullBuild() {
    if (!(await fs.pathExists(this.projectDir))) {
      this.logger.warn(`项目目录不存在: ${this.projectDir}`);
      return this._emptyResult();
    }

    const files = await this._scanFiles();
    const entries = [];

    for (const relativePath of files) {
      const filePath = path.join(this.projectDir, relativePath);
      const entry = await this._indexFile(filePath, relativePath);
      if (entry) {
        entries.push(entry);
      }
    }

    return this._buildResult(entries);
  }

  /**
   * 增量构建
   * @param {FileHashEntry[]} currentHashes
   * @param {FileHashEntry[]} cachedHashes
   * @returns {Promise<SymbolIndexResult>}
   * @private
   */
  async _incrementalBuild(currentHashes, cachedHashes) {
    const changes = this._detectIncrementalChanges(currentHashes, cachedHashes);
    const cachedEntries = this._cache?.entries || [];

    // 复用未变更的条目
    const unchanged = new Set(changes.unchanged.map((e) => e.relativePath));
    const entries = cachedEntries.filter((e) => unchanged.has(e.relativePath));

    // 重新索引变更和新增的文件
    for (const file of [...changes.modified, ...changes.added]) {
      const filePath = path.join(this.projectDir, file.relativePath);
      const entry = await this._indexFile(filePath, file.relativePath);
      if (entry) {
        entries.push(entry);
      }
    }

    this.logger.info(
      `RepoIndexer: 增量更新 +${changes.added.length} ~${changes.modified.length} -${changes.deleted.length}`
    );

    return this._buildResult(entries);
  }

  /**
   * 构建结果对象
   * @param {FileIndex[]} entries
   * @returns {SymbolIndexResult}
   * @private
   */
  async _buildResult(entries) {
    // 按目录分组
    const sections = {};
    for (const entry of entries) {
      const dir = path.dirname(entry.relativePath);
      if (!sections[dir]) {
        sections[dir] = [];
      }
      sections[dir].push(entry);
    }

    // 统计符号数
    const totalSymbols = entries.reduce((sum, e) => {
      return sum + e.exports.length + e.classes.length + e.functions.length;
    }, 0);

    // 获取 git HEAD hash
    let headHash = '';
    try {
      headHash = execSync('git rev-parse --short HEAD', {
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd: this.projectDir
      }).trim();
    } catch {
      // 不在 git 仓库中
    }

    // 复用 entries 中已有的 hash，避免二次扫描
    const fileHashes = entries.map((e) => ({
      relativePath: e.relativePath,
      hash: e.hash,
      mtime: e.mtime || Date.now()
    }));

    const result = {
      totalFiles: entries.length,
      totalSymbols,
      entries,
      sections,
      headHash,
      fileHashes: {
        headHash,
        createdAt: Date.now(),
        files: fileHashes
      },
      generatedAt: new Date().toISOString().slice(0, 10)
    };

    // 更新缓存
    this._cache = result;
    this._cacheTimestamp = Date.now();

    this.logger.info(
      `RepoIndexer: 索引构建完成 - ${entries.length} 文件, ${totalSymbols} 符号, ` +
        `${Object.keys(sections).length} 目录`
    );

    return result;
  }

  /**
   * 空结果
   * @returns {SymbolIndexResult}
   * @private
   */
  _emptyResult() {
    return {
      totalFiles: 0,
      totalSymbols: 0,
      entries: [],
      sections: {},
      headHash: '',
      fileHashes: { headHash: '', createdAt: Date.now(), files: [] },
      generatedAt: new Date().toISOString().slice(0, 10)
    };
  }

  /**
   * 递归扫描文件
   * @returns {Promise<string[]>} 相对路径列表
   * @private
   */
  async _scanFiles() {
    const files = [];
    await this._walkDir(this.projectDir, '', files, 0);
    return files.sort();
  }

  /**
   * 递归遍历目录
   * @param {string} dirPath - 当前绝对路径
   * @param {string} relativeDir - 当前相对路径
   * @param {string[]} results - 收集结果
   * @param {number} depth - 当前深度
   * @private
   */
  async _walkDir(dirPath, relativeDir, results, depth) {
    if (depth > this._config.maxRecursionDepth) return;
    if (!(await fs.pathExists(dirPath))) return;

    let entries;
    try {
      entries = await fs.readdir(dirPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const relPath = relativeDir ? `${relativeDir}/${entry}` : entry;

      // 检查排除规则
      if (this._shouldExclude(entry, relPath)) continue;

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        await this._walkDir(fullPath, relPath, results, depth + 1);
      } else if (stat.isFile() && this._shouldInclude(entry)) {
        if (stat.size <= this._config.maxFileSize) {
          results.push(relPath);
        }
      }
    }
  }

  /**
   * 检查是否应排除
   * @param {string} name - 文件/目录名
   * @param {string} relPath - 相对路径
   * @returns {boolean}
   * @private
   */
  _shouldExclude(name, relPath) {
    const excludePatterns = this._config.excludePatterns;
    for (const pattern of excludePatterns) {
      // 精确匹配目录/文件名
      if (name === pattern) return true;
      // 路径包含排除目录（需完整路径段匹配）
      if (relPath.includes('/' + pattern + '/') || relPath.startsWith(pattern + '/')) return true;
    }
    // 测试文件也纳入索引 — REPO_MAP 需要完整覆盖（包括测试符号）
    return false;
  }

  /**
   * 检查是否应包含
   * @param {string} name - 文件名
   * @returns {boolean}
   * @private
   */
  _shouldInclude(name) {
    return this._config.includePatterns.some((ext) => name.endsWith(ext));
  }

  /**
   * 索引单个文件
   * @param {string} filePath - 绝对路径
   * @param {string} relativePath - 相对路径
   * @returns {Promise<FileIndex|null>}
   * @private
   */
  async _indexFile(filePath, relativePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stat = await fs.stat(filePath);
      const hash = createHash('sha256').update(content).digest('hex');

      return Object.freeze({
        filePath,
        relativePath,
        exports: extractExports(content),
        classes: extractClasses(content),
        functions: extractFunctions(content),
        imports: extractImports(content),
        language: detectLanguage(relativePath),
        hash,
        mtime: stat.mtimeMs
      });
    } catch (error) {
      this.logger.warn(`索引文件失败 ${relativePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * 格式化为压缩 Markdown
   * @param {SymbolIndexResult} index
   * @returns {string}
   * @private
   */
  _formatRepoMap(index) {
    const lines = [];

    // 头部
    lines.push('# REPO_MAP.md');
    lines.push('');
    lines.push(
      `> ${index.generatedAt} | ${index.totalFiles} files, ${index.totalSymbols} symbols | ${index.headHash || 'no-git'}`
    );
    lines.push('');

    // 按目录分组
    const sortedDirs = Object.keys(index.sections).sort();
    let exportCount = 0;
    let classCount = 0;
    let funcCount = 0;

    for (const dir of sortedDirs) {
      lines.push(`## ${dir}/`);
      const entries = index.sections[dir];

      for (const entry of entries) {
        const fileName = path.basename(entry.relativePath);

        // 收集该文件的所有符号
        const symbols = [];

        // exports（压缩为一行）
        if (entry.exports.length > 0) {
          exportCount += entry.exports.length;
          const exportNames = entry.exports.map((e) => e.name);
          symbols.push(exportNames.join(', '));
        }

        // classes（内联方法列表）
        for (const cls of entry.classes) {
          classCount++;
          if (cls.methods.length > 0) {
            symbols.push(`class ${cls.name} { ${cls.methods.join(', ')} }`);
          } else {
            symbols.push(`class ${cls.name}`);
          }
        }

        // functions（带签名）
        for (const fn of entry.functions) {
          funcCount++;
          const prefix = fn.isAsync ? 'async ' : '';
          symbols.push(`${prefix}${fn.name}(${fn.params})`);
        }

        // 文件行：fileName: symbols
        lines.push(`  ${fileName}: ${symbols.join(', ')}`);

        // import 链（如果有，缩进显示）
        if (entry.imports.length > 0) {
          const importSources = entry.imports
            .filter((imp) => imp.source.startsWith('.') || imp.names.length > 0)
            .map((imp) => {
              const base = imp.source.replace(/^\.\//, '').replace(/\.\.\//g, '../');
              return imp.names.length <= 2 ? base : `${base}(${imp.names.length})`;
            });
          if (importSources.length > 0) {
            lines.push(`    <- ${importSources.join(', ')}`);
          }
        }
      }
      lines.push('');
    }

    // 统计尾部
    lines.push('---');
    lines.push(
      `${exportCount} exports, ${classCount} classes, ${funcCount} functions | \`auto codemaps\``
    );

    return lines.join('\n');
  }

  /**
   * 计算文件哈希
   * @returns {Promise<FileHashEntry[]>}
   * @private
   */
  async _computeFileHashes() {
    const hashes = [];
    const files = await this._scanFiles();

    // P4-10: 获取缓存的 hash 用于 mtimeMs 快速预过滤
    const cachedMap = new Map((this._hashCache?.files || []).map((e) => [e.relativePath, e]));

    for (const relativePath of files) {
      const filePath = path.join(this.projectDir, relativePath);
      try {
        const stat = await fs.stat(filePath);
        const cached = cachedMap.get(relativePath);

        // P4-10: mtime 未变则直接复用缓存 hash，跳过文件读取
        if (cached && Math.abs(stat.mtimeMs - cached.mtime) < 100) {
          hashes.push({ relativePath, hash: cached.hash, mtime: stat.mtimeMs });
          continue;
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const hash = createHash('sha256').update(content).digest('hex');
        hashes.push({ relativePath, hash, mtime: stat.mtimeMs });
      } catch {
        // 跳过无法读取的文件
      }
    }

    return hashes;
  }

  /**
   * 比较两组哈希是否相同
   * @param {FileHashEntry[]} current
   * @param {FileHashEntry[]} cached
   * @returns {boolean}
   * @private
   */
  _hashesEqual(current, cached) {
    if (current.length !== cached.length) return false;
    const cachedMap = new Map(cached.map((e) => [e.relativePath, e.hash]));
    for (const entry of current) {
      if (cachedMap.get(entry.relativePath) !== entry.hash) return false;
    }
    return true;
  }

  /**
   * 检测增量变更
   * @param {FileHashEntry[]} current
   * @param {FileHashEntry[]} cached
   * @returns {{added: FileHashEntry[], modified: FileHashEntry[], deleted: FileHashEntry[], unchanged: FileHashEntry[]}}
   * @private
   */
  _detectIncrementalChanges(current, cached) {
    const currentMap = new Map(current.map((e) => [e.relativePath, e]));
    const cachedMap = new Map(cached.map((e) => [e.relativePath, e]));

    const added = [];
    const modified = [];
    const unchanged = [];
    const deleted = [];

    // 查找新增和修改
    for (const [relPath, entry] of currentMap) {
      if (!cachedMap.has(relPath)) {
        added.push(entry);
      } else if (cachedMap.get(relPath).hash !== entry.hash) {
        modified.push(entry);
      } else {
        unchanged.push(entry);
      }
    }

    // 查找删除
    for (const [relPath, entry] of cachedMap) {
      if (!currentMap.has(relPath)) {
        deleted.push(entry);
      }
    }

    return { added, modified, deleted, unchanged };
  }
}

export default RepoIndexer;
