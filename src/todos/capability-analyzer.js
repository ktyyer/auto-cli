/**
 * Agent 能力分析器
 *
 * 核心功能：
 * - 分析当前项目的 Agent/Skill/Rule 配置
 * - 生成能力画像（哪些领域强、哪些领域弱）
 * - 为 Reflection 提供数据基础
 * - 检测能力缺口并给出建议
 *
 * 灵感来源：
 * - PHASE 1 DISCOVER 的能力清单收集
 * - linux.do 社区："知道自己的弱点比知道强项更重要"
 */
import path from 'node:path';
import fs from 'fs-extra';
import { logger } from '../logger.js';

/**
 * 能力领域定义
 * @readonly
 */
export const CAPABILITY_DOMAINS = Object.freeze({
  TESTING: {
    name: '测试',
    keywords: ['test', 'tdd', 'vitest', 'jest', 'coverage', 'e2e', 'playwright']
  },
  SECURITY: {
    name: '安全',
    keywords: ['security', 'auth', 'xss', 'injection', 'vulnerability', 'secret']
  },
  ARCHITECTURE: {
    name: '架构',
    keywords: ['architecture', 'design', 'refactor', 'pattern', 'structure']
  },
  CODE_QUALITY: {
    name: '代码质量',
    keywords: ['review', 'quality', 'lint', 'format', 'maintainability']
  },
  DOCUMENTATION: { name: '文档', keywords: ['doc', 'readme', 'documentation', 'changelog'] },
  BUILD: { name: '构建', keywords: ['build', 'compile', 'typescript', 'error', 'dependency'] },
  WORKFLOW: {
    name: '工作流',
    keywords: ['git', 'workflow', 'plan', 'quest', 'memory', 'reflection']
  },
  FRONTEND: { name: '前端', keywords: ['react', 'vue', 'component', 'css', 'browser', 'frontend'] },
  BACKEND: { name: '后端', keywords: ['api', 'database', 'server', 'backend', 'rest', 'sql'] },
  DEBUGGING: { name: '调试', keywords: ['debug', 'error', 'fix', 'trace', 'root-cause', 'bisect'] }
});

/**
 * @typedef {Object} CapabilityProfile
 * @property {string} projectName - 项目名称
 * @property {string} analyzedAt - 分析时间
 * @property {Object} domains - 各领域能力评分
 * @property {string[]} strengths - 强项列表
 * @property {string[]} gaps - 缺口列表
 * @property {string[]} suggestions - 改进建议
 */

export class CapabilityAnalyzer {
  /**
   * @param {string} [projectDir] - 项目根目录
   */
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.logger = logger;
  }

  /**
   * 分析项目能力画像
   * @returns {Promise<CapabilityProfile>}
   */
  async analyze() {
    const projectName = path.basename(this.projectDir);
    const agentKeywords = await this._extractAgentKeywords();
    const skillKeywords = await this._extractSkillKeywords();
    const ruleKeywords = await this._extractRuleKeywords();

    const allKeywords = [...agentKeywords, ...skillKeywords, ...ruleKeywords];
    const lowerKeywords = allKeywords.map((k) => k.toLowerCase());

    // 各领域评分
    const domains = {};
    for (const [key, domain] of Object.entries(CAPABILITY_DOMAINS)) {
      const matchCount = domain.keywords.filter((kw) =>
        lowerKeywords.some((k) => k.includes(kw) || kw.includes(k))
      ).length;
      const score = Math.min(100, Math.round((matchCount / domain.keywords.length) * 100));
      domains[key] = {
        name: domain.name,
        score,
        matchedKeywords: domain.keywords.filter((kw) =>
          lowerKeywords.some((k) => k.includes(kw) || kw.includes(k))
        )
      };
    }

    // 识别强项和缺口
    const strengths = [];
    const gaps = [];
    const suggestions = [];

    for (const [key, data] of Object.entries(domains)) {
      if (data.score >= 60) {
        strengths.push(`${data.name} (${data.score}%)`);
      } else if (data.score < 30) {
        gaps.push(`${data.name} (${data.score}%)`);
        suggestions.push(
          `考虑增强 ${data.name} 能力：当前仅匹配 ${data.matchedKeywords.length}/${CAPABILITY_DOMAINS[key].keywords.length} 个关键词`
        );
      }
    }

    const profile = {
      projectName,
      analyzedAt: new Date().toISOString(),
      domains,
      strengths,
      gaps,
      suggestions
    };

    this.logger.info(
      `能力分析完成: ${strengths.length} 个强项, ${gaps.length} 个缺口, ${suggestions.length} 条建议`
    );

    return profile;
  }

  /**
   * 生成能力报告（Markdown 格式）
   * @param {CapabilityProfile} profile
   * @returns {string}
   */
  toReport(profile) {
    const lines = [
      `# 能力画像: ${profile.projectName}`,
      '',
      `**分析时间**: ${profile.analyzedAt}`,
      ''
    ];

    // 领域评分表格
    lines.push('| 领域 | 评分 | 状态 |');
    lines.push('|------|------|------|');
    for (const [, data] of Object.entries(profile.domains)) {
      const bar =
        '#'.repeat(Math.round(data.score / 10)) + '-'.repeat(10 - Math.round(data.score / 10));
      const status = data.score >= 60 ? 'STRONG' : data.score >= 30 ? 'MODERATE' : 'WEAK';
      lines.push(`| ${data.name} | ${bar} ${data.score}% | ${status} |`);
    }

    if (profile.strengths.length > 0) {
      lines.push('');
      lines.push('## 强项');
      for (const s of profile.strengths) {
        lines.push(`- ${s}`);
      }
    }

    if (profile.gaps.length > 0) {
      lines.push('');
      lines.push('## 缺口');
      for (const g of profile.gaps) {
        lines.push(`- ${g}`);
      }
    }

    if (profile.suggestions.length > 0) {
      lines.push('');
      lines.push('## 建议');
      for (const s of profile.suggestions) {
        lines.push(`- ${s}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 从 Agent 文件提取关键词
   * @returns {Promise<string[]>}
   * @private
   */
  async _extractAgentKeywords() {
    return this._extractKeywordsFromDir('agents', (content, name) => {
      const keywords = [];
      // 提取 frontmatter 中的 name 和 description
      const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
        if (nameMatch) keywords.push(nameMatch[1].trim());
        const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
        if (descMatch) keywords.push(...descMatch[1].trim().split(/[\s,|]+/));
        const toolsMatch = fmMatch[1].match(/^tools:\s*(.+)$/m);
        if (toolsMatch) keywords.push(...toolsMatch[1].trim().split(/[\s,]+/));
      }
      keywords.push(name.replace('.md', ''));
      return keywords;
    });
  }

  /**
   * 从 Skill 文件提取关键词
   * @returns {Promise<string[]>}
   * @private
   */
  async _extractSkillKeywords() {
    return this._extractKeywordsFromDir('skills', (content, name) => {
      const keywords = [];
      const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
        if (nameMatch) keywords.push(nameMatch[1].trim());
        const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
        if (descMatch) keywords.push(...descMatch[1].trim().split(/[\s,|]+/));
        const tagsMatch = fmMatch[1].match(/^tags:\s*\[(.+)\]/m);
        if (tagsMatch) {
          keywords.push(...tagsMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, '')));
        }
      }
      keywords.push(name.replace('.md', ''));
      return keywords;
    });
  }

  /**
   * 从 Rule 文件提取关键词
   * @returns {Promise<string[]>}
   * @private
   */
  async _extractRuleKeywords() {
    return this._extractKeywordsFromDir('rules', (content, name) => {
      const keywords = [];
      // Rule 文件可能没有 frontmatter，从标题和内容提取
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        keywords.push(...titleMatch[1].trim().split(/[\s]+/));
      }
      keywords.push(name.replace('.md', ''));
      return keywords;
    });
  }

  /**
   * 通用目录关键词提取
   * @param {string} dirName - 目录名
   * @param {Function} extractor - 提取函数
   * @returns {Promise<string[]>}
   * @private
   */
  async _extractKeywordsFromDir(dirName, extractor) {
    const dirPath = path.join(this.projectDir, dirName);
    const keywords = [];

    if (!(await fs.pathExists(dirPath))) {
      return keywords;
    }

    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(dirPath, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          keywords.push(...extractor(content, file));
        } catch {
          // 跳过无法读取的文件
        }
      }
    } catch (error) {
      this.logger.warn(`扫描 ${dirName} 目录失败: ${error.message}`);
    }

    return keywords;
  }
}

export default CapabilityAnalyzer;
