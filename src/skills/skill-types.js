/**
 * 技能类型定义
 * 定义技能清单的类型、技能域和元数据结构
 */

/**
 * @typedef {Object} SkillManifest
 * @property {string} name - 技能唯一标识
 * @property {string} displayName - 技能显示名称
 * @property {string} description - 技能描述
 * @property {string[]} tags - 技能标签
 * @property {string} domain - 技能所属领域
 * @property {string} version - 技能版本
 * @property {string} author - 技能作者
 * @property {string} path - 技能文件路径（相对于 skills/ 目录）
 * @property {string} source - 技能来源（'builtin' | 'community' | 'custom'）
 * @property {number} rating - 技能评分（0-5）
 * @property {Date} installedAt - 安装时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 技能域定义
 * 基于 Vibe-Skills 的 9 大领域分类
 */
export const SKILL_DOMAINS = Object.freeze([
  {
    id: 'requirements',
    name: '需求与规划',
    description: '需求澄清、问题定义、规格说明、任务拆解',
    keywords: ['requirement', 'spec', 'plan', 'breakdown', 'clarify']
  },
  {
    id: 'engineering',
    name: '软件工程',
    description: '新功能开发、脚手架搭建、工程化集成、代码实现',
    keywords: ['develop', 'implement', 'feature', 'scaffold', 'integration']
  },
  {
    id: 'debugging',
    name: '调试与重构',
    description: '错误定位、根因分析、代码重构、可维护性恢复',
    keywords: ['debug', 'refactor', 'fix', 'error', 'maintainability']
  },
  {
    id: 'testing',
    name: '测试与品控',
    description: '单元测试、回归验证、质量门禁、覆盖率检查',
    keywords: ['test', 'quality', 'coverage', 'validation', 'tdd']
  },
  {
    id: 'data',
    name: '数据分析',
    description: 'EDA、清洗统计、数据可视化、数据处理',
    keywords: ['data', 'analysis', 'visualization', 'statistics', 'eda']
  },
  {
    id: 'ml',
    name: '机器学习与AI',
    description: '模型训练、RAG检索、实验跟踪、特征工程',
    keywords: ['ml', 'ai', 'model', 'training', 'rag', 'experiment']
  },
  {
    id: 'science',
    name: '科研与生命科学',
    description: '文献综述、生信分析、单细胞分析、药物发现',
    keywords: ['research', 'bio', 'genomics', 'literature', 'drug']
  },
  {
    id: 'math',
    name: '数学与计算',
    description: '符号推导、贝叶斯建模、多目标优化、仿真',
    keywords: ['math', 'optimization', 'simulation', 'symbolic', 'bayesian']
  },
  {
    id: 'multimedia',
    name: '多媒体与展示',
    description: '交互图表、科研绘图、图片生成、语音视频',
    keywords: ['chart', 'plot', 'image', 'video', 'audio', 'visualization']
  },
  {
    id: 'integration',
    name: '外部集成',
    description: '浏览器、网页抓取、设计稿、第三方服务',
    keywords: ['api', 'scrape', 'browser', 'integration', 'webhook']
  }
]);

/**
 * 技能来源类型
 */
export const SkillSource = Object.freeze({
  BUILTIN: 'builtin', // 内置技能（auto-cli 自带）
  COMMUNITY: 'community', // 社区技能（从 Vibe-Skills 同步）
  CUSTOM: 'custom' // 自定义技能（用户创建）
});

/**
 * 根据关键词推断技能域
 * @param {string[]} keywords - 关键词列表
 * @returns {string} 技能域 ID
 */
export function inferDomain(keywords) {
  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  for (const domain of SKILL_DOMAINS) {
    if (domain.keywords.some((kw) => lowerKeywords.includes(kw.toLowerCase()))) {
      return domain.id;
    }
  }

  return 'integration'; // 默认域
}

/**
 * 从 SKILL.md 文件解析技能清单
 * @param {string} content - SKILL.md 文件内容
 * @param {string} skillPath - 技能路径
 * @param {string} source - 技能来源
 * @returns {SkillManifest}
 */
export function parseSkillManifest(content, skillPath, source = SkillSource.BUILTIN) {
  const lines = content.split('\n');
  const manifest = {
    name: '',
    displayName: '',
    description: '',
    tags: [],
    domain: '',
    version: '1.0.0',
    author: '',
    path: skillPath,
    source,
    rating: 0,
    installedAt: new Date(),
    updatedAt: new Date()
  };

  let inFrontmatter = false;
  let frontmatter = '';

  for (const line of lines) {
    // 提取 frontmatter
    if (line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
        continue;
      } else {
        break; // frontmatter 结束
      }
    }

    if (inFrontmatter) {
      frontmatter += line + '\n';
      continue;
    }

    // 提取名称和描述（从第一行标题）
    if (!manifest.displayName && line.startsWith('# ')) {
      manifest.displayName = line.replace('# ', '').trim();
      manifest.name = manifest.displayName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      continue;
    }

    // 提取描述（从正文第一段）
    if (!manifest.description && line.trim() && !line.startsWith('#')) {
      manifest.description = line.trim();
      break; // 只取第一句
    }
  }

  // 解析 frontmatter YAML（简化版）
  const yamlLines = frontmatter.split('\n');
  for (const yamlLine of yamlLines) {
    const match = yamlLine.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      switch (key) {
        case 'name':
          manifest.displayName = value.replace(/['"]/g, '').trim();
          manifest.name = value.toLowerCase().replace(/\s+/g, '-');
          break;
        case 'description':
          manifest.description = value.replace(/['"]/g, '').trim();
          break;
        case 'tags':
          manifest.tags = value
            .replace(/[[\]]/g, '')
            .split(',')
            .map((t) => t.trim().replace(/['"]/g, ''));
          break;
        case 'version':
          manifest.version = value.replace(/['"]/g, '').trim();
          break;
        case 'author':
          manifest.author = value.replace(/['"]/g, '').trim();
          break;
      }
    }
  }

  // 推断技能域
  if (!manifest.domain) {
    const allKeywords = [
      ...manifest.tags,
      ...manifest.description.toLowerCase().split(/\s+/),
      ...manifest.displayName.toLowerCase().split(/\s+/)
    ];
    manifest.domain = inferDomain(allKeywords);
  }

  return manifest;
}
