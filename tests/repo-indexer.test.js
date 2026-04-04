import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import {
  extractExports,
  extractClasses,
  extractFunctions,
  extractImports,
  detectLanguage
} from '../src/indexer/patterns.js';
import { RepoIndexer } from '../src/indexer/repo-indexer.js';

// --- 测试 fixtures ---

const FIXTURE_CONFIG = `export const CLAUDE_DIR = '~/.claude';
export const DOCS_URL = 'https://example.com';
export const LOG_LEVEL = 'info';
export const DEFAULT_TIMEOUT = 30000;
export default config;
`;

const FIXTURE_CLASS = `import path from 'node:path';
import fs from 'fs-extra';
import { logger } from '../logger.js';

export class Router {
  constructor(options) {
    this.options = options;
  }

  async initialize() {
    await this._loadConfig();
  }

  route(intent) {
    return this._match(intent);
  }

  diagnose() {
    return { initialized: this._initialized };
  }
}
`;

const FIXTURE_FUNCTIONS = `export async function processData(input, options) {
  return input.map(item => transform(item));
}

export function validateInput(data) {
  return data.length > 0;
}

export const parseConfig = (raw) => {
  return JSON.parse(raw);
};

export const debounce = (value, delay = 300) => {
  let timer;
  return () => clearTimeout(timer);
};
`;

const FIXTURE_MIXED = `import { Router } from './router.js';
import fs from 'fs-extra';
import type { Config } from './types';

export class Service {
  start(config) {}
  stop() {}
}

export function createService(name, options = {}) {
  return new Service(options);
}

export const VERSION = '1.0.0';
export { Service as default };
`;

// --- patterns 测试 ---

describe('patterns', () => {
  describe('extractExports', () => {
    it('should extract named exports', () => {
      const result = extractExports(FIXTURE_CONFIG);

      expect(result.length).toBeGreaterThanOrEqual(4);
      const names = result.map((e) => e.name);
      expect(names).toContain('CLAUDE_DIR');
      expect(names).toContain('DOCS_URL');
      expect(names).toContain('LOG_LEVEL');
      expect(names).toContain('DEFAULT_TIMEOUT');
      const namedExports = result.filter((e) => e.type === 'named');
      expect(namedExports.length).toBeGreaterThanOrEqual(4);
    });

    it('should extract default export', () => {
      const result = extractExports(FIXTURE_CONFIG);

      const defaultExport = result.find((e) => e.type === 'default');
      expect(defaultExport).toBeDefined();
      expect(defaultExport.name).toBe('config');
    });

    it('should extract re-exports', () => {
      const result = extractExports(FIXTURE_MIXED);

      const names = result.map((e) => e.name);
      expect(names).toContain('Service');
      expect(names).toContain('createService');
      expect(names).toContain('VERSION');
    });

    it('should return empty array for no exports', () => {
      const result = extractExports('// no exports\nconst x = 1;');
      expect(result).toHaveLength(0);
    });

    it('should return frozen array', () => {
      const result = extractExports(FIXTURE_CONFIG);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('extractClasses', () => {
    it('should extract class with methods', () => {
      const result = extractClasses(FIXTURE_CLASS);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Router');
      expect(result[0].methods.length).toBeGreaterThanOrEqual(3);

      const methodNames = result[0].methods;
      expect(methodNames.some((m) => m.startsWith('initialize('))).toBe(true);
      expect(methodNames.some((m) => m.startsWith('route('))).toBe(true);
      expect(methodNames.some((m) => m.startsWith('diagnose('))).toBe(true);
    });

    it('should extract class without methods', () => {
      const content = 'export class Empty {}';
      const result = extractClasses(content);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Empty');
      expect(result[0].methods).toHaveLength(0);
    });

    it('should return frozen array', () => {
      const result = extractClasses(FIXTURE_CLASS);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('extractFunctions', () => {
    it('should extract function declarations', () => {
      const result = extractFunctions(FIXTURE_FUNCTIONS);

      expect(result.length).toBeGreaterThanOrEqual(3);
      const processData = result.find((f) => f.name === 'processData');
      expect(processData).toBeDefined();
      expect(processData.isAsync).toBe(true);
      expect(processData.params).toContain('input');
    });

    it('should extract arrow functions', () => {
      const result = extractFunctions(FIXTURE_FUNCTIONS);

      const parseConfig = result.find((f) => f.name === 'parseConfig');
      expect(parseConfig).toBeDefined();
      expect(parseConfig.params).toContain('raw');
    });

    it('should handle sync functions', () => {
      const result = extractFunctions(FIXTURE_FUNCTIONS);

      const validateInput = result.find((f) => f.name === 'validateInput');
      expect(validateInput).toBeDefined();
      expect(validateInput.isAsync).toBe(false);
    });

    it('should return frozen array', () => {
      const result = extractFunctions(FIXTURE_FUNCTIONS);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('extractImports', () => {
    it('should extract named imports', () => {
      const result = extractImports(FIXTURE_MIXED);

      const routerImport = result.find((i) => i.source === './router.js');
      expect(routerImport).toBeDefined();
      expect(routerImport.names).toContain('Router');
      expect(routerImport.isType).toBe(false);
    });

    it('should extract default imports', () => {
      const result = extractImports(FIXTURE_MIXED);

      const fsImport = result.find((i) => i.source === 'fs-extra');
      expect(fsImport).toBeDefined();
      expect(fsImport.names).toContain('fs');
    });

    it('should extract type imports', () => {
      const result = extractImports(FIXTURE_MIXED);

      const typeImport = result.find((i) => i.isType);
      expect(typeImport).toBeDefined();
      expect(typeImport.source).toBe('./types');
      expect(typeImport.names).toContain('Config');
    });

    it('should return frozen array', () => {
      const result = extractImports(FIXTURE_MIXED);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('detectLanguage', () => {
    it('should detect JavaScript files', () => {
      expect(detectLanguage('foo.js')).toBe('javascript');
      expect(detectLanguage('foo.mjs')).toBe('javascript');
      expect(detectLanguage('foo.cjs')).toBe('javascript');
    });

    it('should detect TypeScript files', () => {
      expect(detectLanguage('foo.ts')).toBe('typescript');
      expect(detectLanguage('foo.mts')).toBe('typescript');
    });

    it('should return unknown for other files', () => {
      expect(detectLanguage('foo.py')).toBe('unknown');
      expect(detectLanguage('foo.md')).toBe('unknown');
    });
  });
});

// --- RepoIndexer 测试 ---

describe('RepoIndexer', () => {
  let tempDir;
  let indexer;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `repo-indexer-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    // 创建模拟项目结构
    await fs.ensureDir(path.join(tempDir, 'src'));
    await fs.ensureDir(path.join(tempDir, 'src', 'router'));
    await fs.ensureDir(path.join(tempDir, 'node_modules'));

    await fs.writeFile(path.join(tempDir, 'src', 'config.js'), FIXTURE_CONFIG, 'utf-8');
    await fs.writeFile(path.join(tempDir, 'src', 'router', 'index.js'), FIXTURE_CLASS, 'utf-8');
    await fs.writeFile(path.join(tempDir, 'src', 'utils.js'), FIXTURE_FUNCTIONS, 'utf-8');
    await fs.writeFile(path.join(tempDir, 'src', 'service.js'), FIXTURE_MIXED, 'utf-8');

    // 应被排除的文件
    await fs.writeFile(
      path.join(tempDir, 'node_modules', 'lib.js'),
      'export const lib = true;',
      'utf-8'
    );
    await fs.writeFile(
      path.join(tempDir, 'src', 'main.test.js'),
      'export function testFn() {}',
      'utf-8'
    );

    indexer = new RepoIndexer(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('buildIndex', () => {
    it('should build index from project directory', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      expect(result.totalFiles).toBe(5); // config, router/index, utils, service, main.test
      expect(result.totalSymbols).toBeGreaterThan(0);
      expect(result.entries.length).toBe(5);
    });

    it('should extract exports from indexed files', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      const configEntry = result.entries.find((e) => e.relativePath === 'src/config.js');
      expect(configEntry).toBeDefined();
      expect(configEntry.exports.length).toBeGreaterThanOrEqual(4);
    });

    it('should extract classes with methods', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      const routerEntry = result.entries.find((e) => e.relativePath === 'src/router/index.js');
      expect(routerEntry).toBeDefined();
      expect(routerEntry.classes.length).toBe(1);
      expect(routerEntry.classes[0].name).toBe('Router');
    });

    it('should extract functions with parameters', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      const utilsEntry = result.entries.find((e) => e.relativePath === 'src/utils.js');
      expect(utilsEntry).toBeDefined();
      expect(utilsEntry.functions.length).toBeGreaterThanOrEqual(3);
    });

    it('should extract import relationships', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      const routerEntry = result.entries.find((e) => e.relativePath === 'src/router/index.js');
      expect(routerEntry).toBeDefined();
      expect(routerEntry.imports.length).toBeGreaterThanOrEqual(2);
    });

    it('should group entries by directory (sections)', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      expect(result.sections['src']).toBeDefined();
      expect(result.sections['src/router']).toBeDefined();
      expect(result.sections['src'].length).toBe(4); // config, utils, service, main.test (test files now included)
      expect(result.sections['src/router'].length).toBe(1);
    });

    it('should exclude node_modules but include test files', async () => {
      const result = await indexer.buildIndex({ useCache: false });

      const hasNodeModules = result.entries.some((e) => e.relativePath.includes('node_modules'));
      const hasTestFile = result.entries.some((e) => e.relativePath.includes('.test.'));
      expect(hasNodeModules).toBe(false);
      expect(hasTestFile).toBe(true); // 测试文件纳入索引
    });

    it('should use cache on second call', async () => {
      await indexer.buildIndex({ useCache: false });
      const result = await indexer.buildIndex({ useCache: true });

      expect(result.totalFiles).toBe(5);
    });

    it('should invalidate cache when file changes', async () => {
      const first = await indexer.buildIndex({ useCache: false });

      // 修改一个文件
      await fs.appendFile(
        path.join(tempDir, 'src', 'config.js'),
        '\nexport const NEW_CONST = 42;',
        'utf-8'
      );

      indexer.clearCache();
      const second = await indexer.buildIndex({ useCache: false });

      const configEntry = second.entries.find((e) => e.relativePath === 'src/config.js');
      expect(configEntry.exports.length).toBeGreaterThan(first.entries[0].exports.length);
    });

    it('should handle non-existent directory', async () => {
      const badIndexer = new RepoIndexer('/non/existent/path');
      const result = await badIndexer.buildIndex({ useCache: false });

      expect(result.totalFiles).toBe(0);
      expect(result.entries).toHaveLength(0);
    });
  });

  describe('generateRepoMap', () => {
    it('should write REPO_MAP.md to project directory', async () => {
      const outputPath = await indexer.generateRepoMap();

      expect(await fs.pathExists(outputPath)).toBe(true);
      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('# REPO_MAP.md');
      expect(content).toContain('src/');
    });

    it('should produce valid markdown with headers and sections', async () => {
      const outputPath = await indexer.generateRepoMap();
      const content = await fs.readFile(outputPath, 'utf-8');

      expect(content).toContain('## src/');
      expect(content).toContain('## src/router/');
      expect(content).toContain('---');
    });

    it('should collapse exports on single line per file', async () => {
      const outputPath = await indexer.generateRepoMap();
      const content = await fs.readFile(outputPath, 'utf-8');

      // config.js 的多个 export 应该在同一行
      expect(content).toContain('config.js:');
      expect(content).toContain('CLAUDE_DIR');
      expect(content).toContain('DOCS_URL');
    });

    it('should include class methods inline', async () => {
      const outputPath = await indexer.generateRepoMap();
      const content = await fs.readFile(outputPath, 'utf-8');

      expect(content).toContain('class Router');
    });

    it('should include import chains', async () => {
      const outputPath = await indexer.generateRepoMap();
      const content = await fs.readFile(outputPath, 'utf-8');

      expect(content).toContain('<-');
    });

    it('should include stats footer', async () => {
      const outputPath = await indexer.generateRepoMap();
      const content = await fs.readFile(outputPath, 'utf-8');

      expect(content).toContain('exports');
      expect(content).toContain('classes');
      expect(content).toContain('functions');
      expect(content).toContain('auto codemaps');
    });
  });

  describe('generateSymbolIndex', () => {
    it('should write symbol-index.json to .auto/cache/', async () => {
      const outputPath = await indexer.generateSymbolIndex();

      expect(await fs.pathExists(outputPath)).toBe(true);
      const data = await fs.readJson(outputPath);
      expect(data.totalFiles).toBe(5);
      expect(data.entries).toBeDefined();
    });

    it('should include file hashes for incremental comparison', async () => {
      const outputPath = await indexer.generateSymbolIndex();
      const data = await fs.readJson(outputPath);

      expect(data.fileHashes).toBeDefined();
      expect(data.fileHashes.files).toBeDefined();
      expect(data.fileHashes.files.length).toBeGreaterThan(0);
    });
  });

  describe('search', () => {
    it('should find symbols by name', async () => {
      const results = await indexer.search('Router');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].classes.some((c) => c.name === 'Router')).toBe(true);
    });

    it('should be case-insensitive', async () => {
      const results = await indexer.search('router');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', async () => {
      const results = await indexer.search('nonexistent_symbol_xyz');

      expect(results).toHaveLength(0);
    });
  });

  describe('getSymbolsForFile', () => {
    it('should return indexed data for a specific file', async () => {
      const entry = await indexer.getSymbolsForFile('src/config.js');

      expect(entry).toBeDefined();
      expect(entry.exports.length).toBeGreaterThanOrEqual(4);
    });

    it('should return null for non-existent file', async () => {
      const entry = await indexer.getSymbolsForFile('nonexistent.js');

      expect(entry).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear cache and force rebuild', async () => {
      const first = await indexer.buildIndex({ useCache: false });
      indexer.clearCache();

      expect(indexer._cache).toBeNull();
      expect(indexer._cacheTimestamp).toBe(0);

      const second = await indexer.buildIndex({ useCache: false });
      expect(second.totalFiles).toBe(first.totalFiles);
    });
  });

  describe('_computeFileHashes', () => {
    it('should compute hashes for all source files', async () => {
      const hashes = await indexer._computeFileHashes();

      expect(hashes.length).toBe(5);
      hashes.forEach((h) => {
        expect(h.relativePath).toBeDefined();
        expect(h.hash).toMatch(/^[a-f0-9]{64}$/);
        expect(h.mtime).toBeGreaterThan(0);
      });
    });

    it('should detect file content changes via hash difference', async () => {
      const before = await indexer._computeFileHashes();

      await fs.appendFile(path.join(tempDir, 'src', 'config.js'), '\n// changed', 'utf-8');

      const after = await indexer._computeFileHashes();

      const configBefore = before.find((h) => h.relativePath === 'src/config.js');
      const configAfter = after.find((h) => h.relativePath === 'src/config.js');

      expect(configBefore.hash).not.toBe(configAfter.hash);
    });
  });

  describe('_hashesEqual', () => {
    it('should return true for identical hashes', async () => {
      const hashes = await indexer._computeFileHashes();

      expect(indexer._hashesEqual(hashes, hashes)).toBe(true);
    });

    it('should return false for different count', async () => {
      const hashes = await indexer._computeFileHashes();

      expect(indexer._hashesEqual(hashes, hashes.slice(0, 2))).toBe(false);
    });

    it('should return false for different hash values', async () => {
      const hashes = await indexer._computeFileHashes();
      const modified = hashes.map((h) => ({
        ...h,
        hash: h.hash === hashes[0].hash ? 'changed' : h.hash
      }));

      expect(indexer._hashesEqual(hashes, modified)).toBe(false);
    });

    it('should return true for empty arrays', () => {
      expect(indexer._hashesEqual([], [])).toBe(true);
    });
  });

  describe('_detectIncrementalChanges', () => {
    it('should detect added files', async () => {
      const before = await indexer._computeFileHashes();

      await fs.writeFile(
        path.join(tempDir, 'src', 'new-file.js'),
        'export const NEW = 1;',
        'utf-8'
      );

      const after = await indexer._computeFileHashes();
      const changes = indexer._detectIncrementalChanges(after, before);

      expect(changes.added.length).toBe(1);
      expect(changes.added[0].relativePath).toBe('src/new-file.js');
    });

    it('should detect deleted files', async () => {
      const before = await indexer._computeFileHashes();

      await fs.remove(path.join(tempDir, 'src', 'service.js'));

      const after = await indexer._computeFileHashes();
      const changes = indexer._detectIncrementalChanges(after, before);

      expect(changes.deleted.length).toBe(1);
      expect(changes.deleted[0].relativePath).toBe('src/service.js');
    });

    it('should detect modified files', async () => {
      const before = await indexer._computeFileHashes();

      await fs.appendFile(
        path.join(tempDir, 'src', 'config.js'),
        '\nexport const CHANGED = true;',
        'utf-8'
      );

      const after = await indexer._computeFileHashes();
      const changes = indexer._detectIncrementalChanges(after, before);

      expect(changes.modified.length).toBe(1);
      expect(changes.modified[0].relativePath).toBe('src/config.js');
    });

    it('should detect unchanged files', async () => {
      const hashes = await indexer._computeFileHashes();
      const changes = indexer._detectIncrementalChanges(hashes, hashes);

      expect(changes.unchanged.length).toBe(hashes.length);
      expect(changes.added).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
    });
  });
});
