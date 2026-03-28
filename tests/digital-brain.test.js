import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { DigitalBrain } from '../src/brain/digital-brain.js';

describe('DigitalBrain', () => {
  let brain;
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `brain-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    brain = new DigitalBrain(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('ensureStructure', () => {
    it('should create brain directory with all files', async () => {
      const dir = await brain.ensureStructure();

      expect(dir).toBe(path.join(tempDir, '.auto', 'brain'));

      const files = ['identity.json', 'network.json', 'ideas.json', 'reviews.json'];
      for (const file of files) {
        const filePath = path.join(dir, file);
        const exists = await fs.pathExists(filePath);
        expect(exists).toBe(true);
      }
    });
  });

  describe('addIdentity', () => {
    it('should add identity with skills and goals', async () => {
      const identity = await brain.addIdentity('高级前端架构师', {
        skills: ['React', 'TypeScript', 'Node.js'],
        goals: '成为技术专家'
      });

      expect(identity).toBeDefined();
      expect(identity.title).toBe('高级前端架构师');
      expect(identity.skills).toEqual(['React', 'TypeScript', 'Node.js']);
      expect(identity.goals).toBe('成为技术专家');
    });
  });

  describe('addContact', () => {
    it('should add contact with role and company', async () => {
      const contact = await brain.addContact('李四', {
        role: '产品经理',
        company: 'ABC 公司',
        tags: ['frontend', 'agile']
      });

      expect(contact).toBeDefined();
      expect(contact.name).toBe('李四');
      expect(contact.role).toBe('产品经理');
      expect(contact.company).toBe('ABC 公司');
      expect(contact.tags).toEqual(['frontend', 'agile']);
    });
  });

  describe('addIdea', () => {
    it('should add idea with description and tags', async () => {
      const idea = await brain.addIdea('开发 AI CLI 工具', {
        description: '使用 Claude API 构建智能 CLI',
        tags: ['startup', 'ai', 'cli'],
        status: 'idea'
      });

      expect(idea).toBeDefined();
      expect(idea.title).toBe('开发 AI CLI 工具');
      expect(idea.tags).toEqual(['startup', 'ai', 'cli']);
      expect(idea.status).toBe('idea');
    });
  });

  describe('addReview', () => {
    it('should add review with achievements', async () => {
      const review = await brain.addReview('2026-Q1', {
        summary: '完成了 3 个重点项目',
        achievements: ['完成 v0.3.1', '完成 v0.4.0'],
        improvements: ['加强测试覆盖', '优化文档']
      });

      expect(review).toBeDefined();
      expect(review.period).toBe('2026-Q1');
      expect(review.achievements).toHaveLength(2);
    });
  });

  describe('searchContacts', () => {
    beforeEach(async () => {
      await brain.addContact('张三', {
        role: '前端工程师',
        company: 'XYZ 公司',
        tags: ['react', 'vue']
      });
      await brain.addContact('李四', {
        role: '产品经理',
        company: 'ABC 公司',
        tags: ['frontend', 'agile']
      });
    });

    it('should find contacts by name', async () => {
      const results = await brain.searchContacts('李四');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('李四');
    });

    it('should find contacts by role', async () => {
      const results = await brain.searchContacts('产品经理');

      expect(results).toHaveLength(1);
      expect(results[0].role).toBe('产品经理');
    });

    it('should find contacts by tag', async () => {
      const results = await brain.searchContacts('react');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('张三');
    });
  });

  describe('searchIdeas', () => {
    beforeEach(async () => {
      await brain.addIdea('AI 项目', {
        description: '使用 AI 技术',
        tags: ['ai', 'ml']
      });
      await brain.addIdea('Web 应用', {
        description: '现代 Web 开发',
        tags: ['web', 'frontend']
      });
    });

    it('should find ideas by title', async () => {
      const results = await brain.searchIdeas('AI');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('AI 项目');
    });

    it('should find ideas by tag', async () => {
      const results = await brain.searchIdeas('ai');

      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('ai');
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty brain', async () => {
      await brain.ensureStructure();
      const stats = await brain.getStats();

      expect(stats.total).toBe(0);
      expect(stats.identities).toBe(0);
      expect(stats.network).toBe(0);
      expect(stats.ideas).toBe(0);
      expect(stats.reviews).toBe(0);
    });

    it('should return correct stats after adding items', async () => {
      await brain.addIdentity('高级工程师', {});
      await brain.addContact('王五', {});
      await brain.addIdea('新想法', {});
      await brain.addReview('2026-Q2', {});

      const stats = await brain.getStats();

      expect(stats.identities).toBe(1);
      expect(stats.network).toBe(1);
      expect(stats.ideas).toBe(1);
      expect(stats.reviews).toBe(1);
      expect(stats.total).toBe(4);
    });
  });
});
