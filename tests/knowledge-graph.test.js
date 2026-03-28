import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { KnowledgeGraph } from '../src/graph/knowledge-graph.js';
import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  extractEntities,
  inferEntityType
} from '../src/graph/entity-types.js';

describe('entity-types', () => {
  describe('ENTITY_TYPES', () => {
    it('should define 6 entity types', () => {
      expect(Object.keys(ENTITY_TYPES)).toHaveLength(6);
    });

    it('should have required types', () => {
      expect(ENTITY_TYPES.TECH_STACK).toBe('tech_stack');
      expect(ENTITY_TYPES.PATTERN).toBe('pattern');
      expect(ENTITY_TYPES.PRACTICE).toBe('practice');
      expect(ENTITY_TYPES.TRAP).toBe('trap');
      expect(ENTITY_TYPES.TOOL).toBe('tool');
      expect(ENTITY_TYPES.CONCEPT).toBe('concept');
    });
  });

  describe('extractEntities', () => {
    it('should extract tech stack entities', () => {
      const text = '使用 React 和 TypeScript 开发，通过 Vite 构建';
      const entities = extractEntities(text);

      expect(entities.length).toBeGreaterThan(0);
      expect(entities.some((e) => e.name === 'React')).toBe(true);
      expect(entities.some((e) => e.name === 'TypeScript')).toBe(true);
      expect(entities.some((e) => e.name === 'Vite')).toBe(true);
    });

    it('should extract pattern entities', () => {
      const text = '使用观察者模式和解耦模块';
      const entities = extractEntities(text);

      expect(entities.length).toBeGreaterThan(0);
    });

    it('should extract practice entities', () => {
      const text = '遵循 TDD 开发，测试覆盖率要达到 80%';
      const entities = extractEntities(text);

      expect(entities.length).toBeGreaterThan(0);
      expect(entities.some((e) => e.type === ENTITY_TYPES.PRACTICE)).toBe(true);
    });

    it('should extract trap entities', () => {
      const text = '踩坑：React 依赖泄露导致性能问题';
      const entities = extractEntities(text);

      expect(entities.length).toBeGreaterThan(0);
      expect(entities.some((e) => e.type === ENTITY_TYPES.TRAP)).toBe(true);
    });
  });

  describe('inferEntityType', () => {
    it('should infer tech_stack type', () => {
      expect(inferEntityType('使用 React 开发')).toBe(ENTITY_TYPES.TECH_STACK);
    });

    it('should infer practice type', () => {
      expect(inferEntityType('采用 TDD 开发模式')).toBe(ENTITY_TYPES.PRACTICE);
    });

    it('should infer trap type', () => {
      expect(inferEntityType('避免常见的陷阱')).toBe(ENTITY_TYPES.TRAP);
    });

    it('should return null for unknown text', () => {
      expect(inferEntityType('这是一段普通文本')).toBeNull();
    });
  });
});

describe('KnowledgeGraph', () => {
  let tempDir;
  let graph;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `graph-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    // 创建测试用的 insights 文件
    const insightsDir = path.join(tempDir, '.auto', 'insights');
    await fs.ensureDir(insightsDir);

    await fs.writeFile(
      path.join(insightsDir, 'patterns.md'),
      `# 有效 Prompt 和对话模板

### React Hooks 最佳实践

**日期**: 2026-03-29 12:00:00

使用 React 和 TypeScript 开发时，遵循观察者模式可以解耦模块。通过 Vite 构建项目，测试覆盖率达到 80% 以上。

---

### 使用 TDD 开发

**日期**: 2026-03-29 13:00:00

采用 TDD 开发模式，先写测试再实现功能。使用 Vitest 进行测试，确保代码质量。

---
`,
      'utf-8'
    );

    graph = new KnowledgeGraph(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('ensureStructure', () => {
    it('should create graph directory', async () => {
      const dir = await graph.ensureStructure();
      expect(dir).toBe(path.join(tempDir, '.auto', 'graph'));
    });
  });

  describe('extractFromProject', () => {
    it('should extract entities from insights', async () => {
      const graphData = await graph.extractFromProject('test-project');

      expect(graphData.entities).toBeDefined();
      expect(Object.keys(graphData.entities).length).toBeGreaterThan(0);
      expect(graphData.relations).toBeDefined();
      expect(graphData.projectIndex['test-project']).toBeDefined();
    });

    it('should recognize React as tech_stack', async () => {
      const graphData = await graph.extractFromProject('test-project');
      const reactEntity = graphData.entities['React'];

      expect(reactEntity).toBeDefined();
      expect(reactEntity.type).toBe(ENTITY_TYPES.TECH_STACK);
      expect(reactEntity.projects).toContain('test-project');
    });

    it('should recognize TDD as practice', async () => {
      const graphData = await graph.extractFromProject('test-project');
      const tddEntity = graphData.entities['TDD'];

      expect(tddEntity).toBeDefined();
      expect(tddEntity.type).toBe(ENTITY_TYPES.PRACTICE);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await graph.extractFromProject('test-project');
    });

    it('should find entities by keyword', async () => {
      const results = await graph.query('React');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entity.name).toBe('React');
    });

    it('should return empty for no matches', async () => {
      const results = await graph.query('Nonexistent');

      expect(results).toEqual([]);
    });

    it('should filter by entity type', async () => {
      const results = await graph.query('React', { type: ENTITY_TYPES.PRACTICE });

      expect(results).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty graph', async () => {
      const stats = await graph.getStats();

      expect(stats.totalEntities).toBe(0);
      expect(stats.totalRelations).toBe(0);
      expect(stats.totalProjects).toBe(0);
    });

    it('should return stats after extraction', async () => {
      await graph.extractFromProject('test-project');
      const stats = await graph.getStats();

      expect(stats.totalEntities).toBeGreaterThan(0);
      expect(stats.totalProjects).toBe(1);
      expect(stats.entitiesByType).toBeDefined();
    });
  });
});
