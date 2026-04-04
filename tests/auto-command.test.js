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
      expect(content).toContain('≤3文件 且 无架构变更');
      expect(content).toContain('轻量模式');
    });

    it('should define full mode conditions', () => {
      expect(content).toContain('>3文件 或 有架构变更');
      expect(content).toContain('完整模式');
    });

    it('should have light mode path', () => {
      expect(content).toContain('PHASE 1 → PHASE 2(轻量) → PHASE 4 → PHASE 6');
    });

    it('should have full mode path', () => {
      expect(content).toContain('完整 6 PHASE');
    });
  });

  describe('PHASE 1 结构', () => {
    it('should have 4 main steps (1.1-1.4)', () => {
      expect(content).toContain('### 1.1 缓存检查');
      expect(content).toContain('### 1.2 并行扫描');
      expect(content).toContain('### 1.3 Router 推荐');
      expect(content).toContain('### 1.4 输出报告');
    });

    it('should not have 1.0a context compression', () => {
      // 上下文压缩已移到 Stop Hook，不再是 PHASE 1 的职责
      expect(content).not.toContain('### 1.0a');
    });

    it('should use SkillIndexer for skills', () => {
      expect(content).toContain('SkillIndexer');
      expect(content).toContain('getIndexSummary');
    });

    it('should not Glob scan skills directory directly', () => {
      const skillsGlobPattern = /Glob\(["']\$HOME\/\.claude\/skills\/\*\*\/\*\.md["']\)/;
      expect(skillsGlobPattern.test(content)).toBe(false);
    });

    it('should preserve other Glob scans', () => {
      expect(content).toMatch(/Glob\(["']?\$HOME\/\.claude\/commands\/auto\/\*\.md["']?\)/);
      expect(content).toMatch(/Glob\(["']?\$HOME\/\.claude\/agents\/\*\.md["']?\)/);
      expect(content).toMatch(/Glob\(["']?\$HOME\/\.claude\/plugins\/\*\*\/\*\.md["']?\)/);
    });
  });

  describe('Router 集成', () => {
    it('should integrate Router in PHASE 1.3', () => {
      expect(content).toContain('### 1.3 Router 推荐');
    });

    it('should pass Router result to quest-designer', () => {
      expect(content).toContain('【Router 推荐】');
    });

    it('should use CanonicalRouter', () => {
      expect(content).toContain('CanonicalRouter');
      expect(content).toContain('AgentRegistry');
    });
  });

  describe('模式卡机制删除', () => {
    it('should document pattern cards removal', () => {
      expect(content).toContain('模式卡已删除');
    });

    it('should use simple cache snapshot', () => {
      expect(content).toContain('capability-snapshot.json');
      expect(content).toContain('file_count');
      expect(content).toContain('hash');
    });

    it('should not have pattern-cards.json mechanism', () => {
      // head_hash + 工作区脏检查 + 7天TTL 机制已删除
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

    it('should remove obsolete principles', () => {
      // 精简后不再单独强调这些
      expect(content).not.toContain('统筹设计');
      expect(content).not.toContain('风格继承');
      expect(content).not.toContain('动态追加');
    });
  });

  describe('PHASE 6 知识沉淀', () => {
    it('should document Stop Hook automation', () => {
      expect(content).toContain('Stop Hook');
      expect(content).toContain('auto-learn');
    });

    it('should provide manual沉淀 option', () => {
      expect(content).toContain('KnowledgeSteward');
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
  });
});
