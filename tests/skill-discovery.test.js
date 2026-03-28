/**
 * SkillDiscovery 类单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillDiscovery } from '../src/skills/skill-discovery.js';
import { SKILL_DOMAINS } from '../src/skills/skill-types.js';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

// Mock logger
vi.mock('../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('SkillDiscovery', () => {
  let discovery;
  let testDir;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), `auto-cli-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    // Mock 目录路径
    discovery = new SkillDiscovery();
    discovery.vibeSkillsDir = path.join(testDir, 'vibe-skills');
    discovery.indexFile = path.join(testDir, 'skills-index.json');
  });

  afterEach(async () => {
    // 清理测试目录
    if (testDir) {
      await fs.remove(testDir);
    }
  });

  describe('_ensureStructure', () => {
    it('应该创建必要的目录结构', async () => {
      await discovery._ensureStructure();

      const vibeSkillsExists = await fs.pathExists(discovery.vibeSkillsDir);
      const skillsDirExists = await fs.pathExists(path.join(os.homedir(), '.auto', 'skills'));

      expect(vibeSkillsExists).toBe(true);
      expect(skillsDirExists).toBe(true);
    });
  });

  describe('_parseYamlFrontmatter', () => {
    it('应该解析简单的 YAML 键值对', () => {
      const lines = ['name: test-skill', 'description: A test skill', 'version: 1.0.0'];

      const result = discovery._parseYamlFrontmatter(lines);

      expect(result).toEqual({
        name: 'test-skill',
        description: 'A test skill',
        version: '1.0.0'
      });
    });

    it('应该解析数组格式的标签', () => {
      const lines = ['tags: [test, demo, example]'];

      const result = discovery._parseYamlFrontmatter(lines);

      expect(result.tags).toEqual(['test', 'demo', 'example']);
    });

    it('应该处理带引号的值', () => {
      const lines = ['name: "test-skill"', "description: 'A test skill'"];

      const result = discovery._parseYamlFrontmatter(lines);

      expect(result.name).toBe('test-skill');
      expect(result.description).toBe('A test skill');
    });

    it('应该返回空对象对于无效的 YAML', () => {
      const lines = ['invalid line without colon', 'another invalid line'];

      const result = discovery._parseYamlFrontmatter(lines);

      expect(result).toEqual({});
    });
  });

  describe('_matchDomain', () => {
    it('应该根据关键词匹配正确的领域', () => {
      const tests = [
        { name: 'requirement-planner', desc: '需求规划工具', expected: 'requirement' },
        { name: 'code-implementer', desc: '代码生成工具', expected: 'software-engineering' },
        { name: 'debug-helper', desc: '调试助手', expected: 'debug-testing' },
        { name: 'data-visualizer', desc: '数据分析可视化', expected: 'data-analysis' }
      ];

      for (const test of tests) {
        const domain = discovery._matchDomain(test.name, test.desc);
        expect(domain.id).toBe(test.expected);
      }
    });

    it('应该返回默认领域当没有匹配时', () => {
      const domain = discovery._matchDomain('unknown-name', 'unknown description');
      expect(domain.id).toBe(SKILL_DOMAINS[0].id);
    });
  });

  describe('_updateIndex 和 loadIndex', () => {
    it('应该正确保存和加载索引', async () => {
      const skills = [
        {
          name: 'test-skill-1',
          description: 'Test skill 1',
          tags: ['test'],
          domain: 'software-engineering',
          rating: 4.5,
          source: 'vibe-skills'
        },
        {
          name: 'test-skill-2',
          description: 'Test skill 2',
          tags: ['demo'],
          domain: 'debug-testing',
          rating: 4.0,
          source: 'vibe-skills'
        }
      ];

      await discovery._updateIndex(skills);
      const loadedIndex = await discovery.loadIndex();

      expect(loadedIndex).toBeDefined();
      expect(loadedIndex.total).toBe(2);
      expect(loadedIndex.skills).toHaveLength(2);
      expect(loadedIndex.skills[0].name).toBe('test-skill-1');
      expect(loadedIndex.lastSync).toBeDefined();
    });

    it('应该返回 null 当索引文件不存在时', async () => {
      const index = await discovery.loadIndex();
      expect(index).toBeNull();
    });
  });

  describe('searchSkills', () => {
    beforeEach(async () => {
      // 准备测试索引
      const skills = [
        {
          name: 'code-generator',
          description: 'Generate code from description',
          tags: ['code', 'generation', 'ai'],
          domain: 'software-engineering',
          rating: 4.8,
          source: 'vibe-skills'
        },
        {
          name: 'test-helper',
          description: 'Help with testing',
          tags: ['test', 'tdd'],
          domain: 'debug-testing',
          rating: 4.5,
          source: 'vibe-skills'
        },
        {
          name: 'debug-tool',
          description: 'Debug code efficiently',
          tags: ['debug', 'tool'],
          domain: 'debug-testing',
          rating: 4.2,
          source: 'vibe-skills'
        }
      ];

      await discovery._updateIndex(skills);
    });

    it('应该按名称搜索技能', async () => {
      const results = await discovery.searchSkills('code-generator');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('code-generator');
    });

    it('应该按描述搜索技能', async () => {
      const results = await discovery.searchSkills('testing');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('test-helper');
    });

    it('应该按标签搜索技能', async () => {
      const results = await discovery.searchSkills('tdd');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('test-helper');
    });

    it('应该按领域过滤', async () => {
      const results = await discovery.searchSkills('', { domain: 'debug-testing' });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.domain === 'debug-testing')).toBe(true);
    });

    it('应该按最低评分过滤', async () => {
      const results = await discovery.searchSkills('', { minRating: 4.5 });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.rating >= 4.5)).toBe(true);
    });

    it('应该按评分降序排序', async () => {
      const results = await discovery.searchSkills('');

      expect(results[0].rating).toBeGreaterThanOrEqual(results[1].rating);
      expect(results[1].rating).toBeGreaterThanOrEqual(results[2].rating);
    });

    it('应该返回空数组当索引不存在时', async () => {
      const newDiscovery = new SkillDiscovery();
      newDiscovery.indexFile = path.join(testDir, 'nonexistent-index.json');

      const results = await newDiscovery.searchSkills('test');

      expect(results).toEqual([]);
    });
  });

  describe('listSkills', () => {
    it('应该列出所有技能', async () => {
      const skills = [
        {
          name: 'skill-1',
          description: 'Desc 1',
          tags: [],
          domain: 'requirement',
          rating: 4.0,
          source: 'vibe-skills'
        },
        {
          name: 'skill-2',
          description: 'Desc 2',
          tags: [],
          domain: 'software-engineering',
          rating: 4.5,
          source: 'vibe-skills'
        }
      ];

      await discovery._updateIndex(skills);
      const results = await discovery.listSkills();

      expect(results).toHaveLength(2);
    });

    it('应该支持过滤', async () => {
      const skills = [
        {
          name: 'skill-1',
          description: 'Desc 1',
          tags: [],
          domain: 'requirement',
          rating: 4.0,
          source: 'vibe-skills'
        },
        {
          name: 'skill-2',
          description: 'Desc 2',
          tags: [],
          domain: 'software-engineering',
          rating: 4.5,
          source: 'vibe-skills'
        }
      ];

      await discovery._updateIndex(skills);
      const results = await discovery.listSkills({ domain: 'requirement' });

      expect(results).toHaveLength(1);
      expect(results[0].domain).toBe('requirement');
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      const skills = [
        {
          name: 'skill-1',
          description: 'Desc 1',
          tags: [],
          domain: 'requirement',
          rating: 4.0,
          source: 'vibe-skills'
        },
        {
          name: 'skill-2',
          description: 'Desc 2',
          tags: [],
          domain: 'software-engineering',
          rating: 4.5,
          source: 'vibe-skills'
        },
        {
          name: 'skill-3',
          description: 'Desc 3',
          tags: [],
          domain: 'requirement',
          rating: 4.2,
          source: 'vibe-skills'
        }
      ];

      await discovery._updateIndex(skills);
      const stats = await discovery.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byDomain.requirement).toBe(2);
      // 使用正确的领域 ID
      expect(stats.byDomain['software-engineering']).toBe(1);
      expect(stats.lastSync).toBeDefined();
    });

    it('应该返回空统计当索引不存在时', async () => {
      const newDiscovery = new SkillDiscovery();
      newDiscovery.indexFile = path.join(testDir, 'nonexistent-index.json');

      const stats = await newDiscovery.getStats();

      expect(stats.total).toBe(0);
      expect(stats.lastSync).toBeNull();
    });
  });

  describe('installSkill', () => {
    it('应该成功安装技能', async () => {
      // 准备测试索引和技能文件
      const skillDir = path.join(testDir, 'test-skill');
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill\n\nTest content');

      const skills = [
        {
          name: 'test-skill',
          description: 'Test skill',
          tags: [],
          domain: 'software-engineering',
          rating: 4.0,
          path: path.join(skillDir, 'SKILL.md'),
          source: 'vibe-skills'
        }
      ];

      await discovery._updateIndex(skills);

      const projectDir = path.join(testDir, 'project');
      await fs.ensureDir(projectDir);

      const result = await discovery.installSkill('test-skill', projectDir);

      expect(result.success).toBe(true);
      expect(result.skill.name).toBe('test-skill');

      const installedPath = path.join(projectDir, '.claude', 'skills', 'test-skill');
      const exists = await fs.pathExists(installedPath);
      expect(exists).toBe(true);
    });

    it('应该返回错误当技能不存在时', async () => {
      await discovery._updateIndex([]);

      const result = await discovery.installSkill('nonexistent', testDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain('技能不存在');
    });

    it('应该返回错误当索引不存在时', async () => {
      const newDiscovery = new SkillDiscovery();
      newDiscovery.indexFile = path.join(testDir, 'nonexistent-index.json');

      const result = await newDiscovery.installSkill('test', testDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain('技能索引不存在');
    });
  });
});
