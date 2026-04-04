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

  describe('三模式执行', () => {
    it('should define micro mode conditions', () => {
      expect(content).toContain('微型模式');
    });

    it('should define light mode conditions', () => {
      expect(content).toContain('轻量模式');
    });

    it('should define full mode conditions', () => {
      expect(content).toContain('完整模式');
    });
  });

  describe('PHASE 1 结构', () => {
    it('should have concise scanning steps', () => {
      expect(content).toContain('检测技术栈');
      expect(content).toContain('列出可用能力');
      expect(content).toContain('收集源码结构');
    });

    it('should reference router for agent matching', () => {
      expect(content).toContain('/auto:route');
    });

    it('should not use JavaScript import statements', () => {
      expect(content).not.toContain('import { CanonicalRouter }');
      expect(content).not.toContain('import { AgentRegistry }');
      expect(content).not.toContain('SkillIndexer');
    });

    it('should not contain bash pseudo-code', () => {
      expect(content).not.toContain('mkdir -p .auto/cache');
      expect(content).not.toContain('cat .auto/cache');
    });
  });

  describe('缓存机制', () => {
    it('should not have complex pattern cards mechanism', () => {
      expect(content).not.toContain('head_hash');
      expect(content).not.toContain('workspace_dirty');
      expect(content).not.toContain('7天TTL');
    });
  });

  describe('核心原则', () => {
    it('should have core principles', () => {
      const principles = content.match(/^\d+\.\s+\*\*/gm);
      expect(principles.length).toBeGreaterThanOrEqual(5);
    });

    it('should contain key principles', () => {
      expect(content).toContain('一个入口');
      expect(content).toContain('按规模执行');
      expect(content).toContain('可回溯');
    });
  });

  describe('PHASE 4 门禁', () => {
    it('should have tiered verification by mode', () => {
      expect(content).toContain('微型');
      expect(content).toContain('轻量');
      expect(content).toContain('完整');
    });
  });

  describe('PHASE 6 知识沉淀', () => {
    it('should handle CLI not available gracefully', () => {
      expect(content).toContain('CLI 未安装');
    });

    it('should not use JavaScript import for knowledge saving', () => {
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
