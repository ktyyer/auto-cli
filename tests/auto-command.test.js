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

  describe('SkillIndexer integration', () => {
    it('should reference SkillIndexer in PHASE 1.2', () => {
      expect(content).toContain('SkillIndexer');
    });

    it('should use getIndexSummary for skills listing', () => {
      expect(content).toContain('getIndexSummary');
    });

    it('should import from correct module path', () => {
      expect(content).toContain('src/skills/skill-indexer.js');
    });

    it('should mention on-demand loading', () => {
      expect(content).toContain('loadContent');
    });

    it('should remove direct skills Glob scan', () => {
      // Skills 目录不应再被 Glob 全量扫描
      const skillsGlobPattern = /Glob\(["']\$HOME\/\.claude\/skills\/\*\*\/\*\.md["']\)/;
      expect(skillsGlobPattern.test(content)).toBe(false);
    });

    it('should preserve other Glob scans (commands, agents, plugins)', () => {
      expect(content).toMatch(/Glob\(["']?\$HOME\/\.claude\/commands\/auto\/\*\.md["']?\)/);
      expect(content).toMatch(/Glob\(["']?\$HOME\/\.claude\/agents\/\*\.md["']?\)/);
      expect(content).toMatch(/Glob\(["']?\$HOME\/\.claude\/plugins\/\*\*\/\*\.md["']?\)/);
    });
  });

  describe('compressContext integration', () => {
    it('should reference compressContext in PHASE 1.0a', () => {
      expect(content).toContain('compressContext');
    });

    it('should import from correct module path', () => {
      expect(content).toContain('src/utils.js');
    });

    it('should reference CONTEXT_COMPRESSION config', () => {
      expect(content).toContain('CONTEXT_COMPRESSION');
    });

    it('should have step 1.0a for compression check', () => {
      expect(content).toContain('1.0a');
    });

    it('should mention long conversation threshold', () => {
      expect(content).toContain('MESSAGE_THRESHOLD');
    });

    it('should include compression status in TodoWrite', () => {
      expect(content).toContain('上下文压缩');
    });
  });

  describe('core principles', () => {
    it('should add index mode principle', () => {
      expect(content).toContain('索引模式');
    });

    it('should add context compression principle', () => {
      expect(content).toContain('长对话自动压缩');
    });

    it('should preserve existing principles', () => {
      expect(content).toContain('一个入口');
      expect(content).toContain('智能缓存');
      expect(content).toContain('统筹设计');
      expect(content).toContain('按规模执行');
      expect(content).toContain('原子化验收');
      expect(content).toContain('风格继承');
      expect(content).toContain('动态追加');
      expect(content).toContain('可回溯');
      expect(content).toContain('知识沉淀');
    });

    it('should have 11 principles total', () => {
      const principles = content.match(/^\d+\.\s+\*\*/gm);
      expect(principles).toHaveLength(11);
    });
  });

  describe('structural integrity', () => {
    it('should have valid frontmatter', () => {
      expect(content).toMatch(/---/);
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

    it('should preserve HARD CONSTRAINTS', () => {
      expect(content).toContain('HARD CONSTRAINTS');
      expect(content).toContain('约束 1：顺序锁定');
      expect(content).toContain('约束 2：quest-designer 必须被调用');
      expect(content).toContain('约束 3：代码修改前置条件');
      expect(content).toContain('约束 4：无简单任务豁免');
    });

    it('should have PHASE 1.0a', () => {
      expect(content).toContain('### 1.0a');
    });

    it('should preserve PHASE order', () => {
      const phase1Match = content.match(/## PHASE 1:/);
      const phase2Match = content.match(/## PHASE 2:/);
      expect(phase1Match.index).toBeLessThan(phase2Match.index);
    });
  });
});
