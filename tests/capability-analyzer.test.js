import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { CapabilityAnalyzer, CAPABILITY_DOMAINS } from '../src/todos/capability-analyzer.js';

describe('CapabilityAnalyzer', () => {
  let tempDir;
  let analyzer;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `cap-analyzer-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    // 模拟项目结构
    await fs.ensureDir(path.join(tempDir, 'agents'));
    await fs.ensureDir(path.join(tempDir, 'skills'));
    await fs.ensureDir(path.join(tempDir, 'rules'));

    // 创建模拟 Agent 文件
    await fs.writeFile(
      path.join(tempDir, 'agents', 'tdd-guide.md'),
      `---
name: tdd-guide
description: 测试驱动开发专家 TDD workflow
tools: Read, Grep, Glob
---
# TDD Guide
Content here.
`,
      'utf-8'
    );

    // 创建模拟 Skill 文件
    await fs.writeFile(
      path.join(tempDir, 'skills', 'security-patterns.md'),
      `---
name: security-patterns
description: 安全模式速查 auth xss injection
tags: [security, auth, xss, injection]
---
# Security Patterns
`,
      'utf-8'
    );

    // 创建模拟 Rule 文件
    await fs.writeFile(
      path.join(tempDir, 'rules', 'coding-style.md'),
      `# Coding Style Guide
Best practices for clean code.
`,
      'utf-8'
    );

    analyzer = new CapabilityAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('analyze', () => {
    it('should return capability profile', async () => {
      const profile = await analyzer.analyze();

      expect(profile.projectName).toBeDefined();
      expect(profile.analyzedAt).toBeDefined();
      expect(profile.domains).toBeDefined();
      expect(profile.strengths).toBeDefined();
      expect(profile.gaps).toBeDefined();
      expect(profile.suggestions).toBeDefined();
    });

    it('should detect testing capability from agent', async () => {
      const profile = await analyzer.analyze();

      expect(profile.domains.TESTING.score).toBeGreaterThan(0);
    });

    it('should detect security capability from skill', async () => {
      const profile = await analyzer.analyze();

      expect(profile.domains.SECURITY.score).toBeGreaterThan(0);
    });

    it('should identify strengths and gaps', async () => {
      const profile = await analyzer.analyze();

      expect(Array.isArray(profile.strengths)).toBe(true);
      expect(Array.isArray(profile.gaps)).toBe(true);
      expect(Array.isArray(profile.suggestions)).toBe(true);
    });

    it('should handle empty directories', async () => {
      const emptyDir = path.join(os.tmpdir(), `cap-empty-${Date.now()}`);
      await fs.ensureDir(emptyDir);
      await fs.ensureDir(path.join(emptyDir, 'agents'));
      await fs.ensureDir(path.join(emptyDir, 'skills'));
      await fs.ensureDir(path.join(emptyDir, 'rules'));

      const emptyAnalyzer = new CapabilityAnalyzer(emptyDir);
      const profile = await emptyAnalyzer.analyze();

      expect(profile.domains).toBeDefined();
      expect(profile.strengths.length).toBe(0);

      await fs.remove(emptyDir);
    });

    it('should handle missing directories', async () => {
      const noDir = path.join(os.tmpdir(), `cap-nodir-${Date.now()}`);
      await fs.ensureDir(noDir);

      const noDirAnalyzer = new CapabilityAnalyzer(noDir);
      const profile = await noDirAnalyzer.analyze();

      expect(profile.domains).toBeDefined();

      await fs.remove(noDir);
    });
  });

  describe('toReport', () => {
    it('should generate markdown report', async () => {
      const profile = await analyzer.analyze();
      const report = analyzer.toReport(profile);

      expect(report).toContain('# 能力画像');
      expect(report).toContain('测试');
      expect(report).toContain('安全');
      expect(report).toContain('| 领域 | 评分 | 状态 |');
    });

    it('should include suggestions for gaps', async () => {
      const profile = await analyzer.analyze();
      const report = analyzer.toReport(profile);

      // 至少应该有领域表格
      expect(report).toMatch(/STRONG|MODERATE|WEAK/);
    });
  });

  describe('CAPABILITY_DOMAINS', () => {
    it('should have all expected domains', () => {
      const expectedDomains = [
        'TESTING',
        'SECURITY',
        'ARCHITECTURE',
        'CODE_QUALITY',
        'DOCUMENTATION',
        'BUILD',
        'WORKFLOW',
        'FRONTEND',
        'BACKEND',
        'DEBUGGING'
      ];

      for (const domain of expectedDomains) {
        expect(CAPABILITY_DOMAINS[domain]).toBeDefined();
        expect(CAPABILITY_DOMAINS[domain].name).toBeDefined();
        expect(CAPABILITY_DOMAINS[domain].keywords.length).toBeGreaterThan(0);
      }
    });
  });
});
