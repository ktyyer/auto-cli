import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTO_MD_PATH = path.join(__dirname, '..', 'commands', 'auto.md');

describe('auto.md integration', () => {
  let content;

  beforeAll(async () => {
    content = await fs.readFile(AUTO_MD_PATH, 'utf-8');
  });

  describe('双模式执行', () => {
    it('should define light mode conditions', () => {
      expect(content).toContain('轻量模式');
    });

    it('should define full mode conditions', () => {
      expect(content).toContain('完整模式');
    });
  });

  describe('PHASE 1 结构', () => {
    it('should have 4 main steps (1.1-1.4)', () => {
      expect(content).toContain('### 1.1 缓存检查');
      expect(content).toContain('### 1.2 并行扫描');
      expect(content).toContain('### 1.3 Router 推荐');
      expect(content).toContain('### 1.4 输出报告');
    });

    it('should use CLI tool for routing instead of JavaScript import', () => {
      expect(content).toContain('auto route');
      expect(content).not.toContain('import { CanonicalRouter }');
      expect(content).not.toContain('import { AgentRegistry }');
    });

    it('should not use SkillIndexer JavaScript import', () => {
      expect(content).not.toContain('SkillIndexer');
    });

    it('should use Glob scans for capability discovery', () => {
      expect(content).toMatch(/Glob.*commands/);
      expect(content).toMatch(/Glob.*agents/);
      expect(content).toMatch(/Glob.*plugins/);
    });
  });

  describe('缓存机制', () => {
    it('should use simple cache snapshot', () => {
      expect(content).toContain('capability-snapshot.json');
    });

    it('should not have complex pattern cards mechanism', () => {
      expect(content).not.toContain('head_hash');
      expect(content).not.toContain('workspace_dirty');
      expect(content).not.toContain('7天TTL');
    });
  });

  describe('核心原则', () => {
    it('should have 7 core principles', () => {
      const principles = content.match(/^\d+\.\s+\*\*/gm);
      expect(principles).toHaveLength(7);
    });

    it('should contain key principles', () => {
      expect(content).toContain('一个入口');
      expect(content).toContain('智能缓存');
      expect(content).toContain('按规模执行');
      expect(content).toContain('可回溯');
      expect(content).toContain('知识沉淀');
    });
  });

  describe('PHASE 6 知识沉淀', () => {
    it('should document Stop Hook automation', () => {
      expect(content).toContain('Stop Hook');
      expect(content).toContain('auto-learn');
    });

    it('should use CLI tools for knowledge saving instead of JavaScript import', () => {
      expect(content).toContain('auto save insight');
      expect(content).toContain('auto save search');
      expect(content).not.toContain('KnowledgeSteward');
    });
  });

  describe('structural integrity', () => {
    it('should have valid frontmatter', () => {
      expect(content).toMatch(/^---/m);
      expect(content).toMatch(/^description:/m);
    });

    it('should preserve all 6 PHASEs', () => {
      expect(content).toContain('## PHASE 1:');
      expect(content).toContain('## PHASE 2:');
      expect(content).toContain('## PHASE 3:');
      expect(content).toContain('## PHASE 4:');
      expect(content).toContain('## PHASE 5:');
      expect(content).toContain('## PHASE 6:');
    });

    it('should preserve PHASE order', () => {
      const phase1Match = content.match(/## PHASE 1:/);
      const phase2Match = content.match(/## PHASE 2:/);
      expect(phase1Match.index).toBeLessThan(phase2Match.index);
    });

    it('should not contain any JavaScript import statements', () => {
      expect(content).not.toMatch(/import\s+\{.*\}\s+from/);
    });
  });
});
