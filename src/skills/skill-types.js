/**
 * 技能类型定义和常量
 *
 * 核心功能：
 * - 定义技能元数据结构
 * - 定义技能领域分类
 * - 定义索引文件格式
 */

/**
 * 技能领域分类（对应 Vibe-Skills 的 9 大领域）
 * @readonly
 */
export const SKILL_DOMAINS = Object.freeze([
  {
    id: 'requirement',
    name: '需求规划',
    keywords: ['requirement', 'planning', 'user-story', '需求', '规划']
  },
  {
    id: 'software-engineering',
    name: '软件工程',
    keywords: ['code', 'implement', 'refactor', 'engineering', '编码', '实现']
  },
  {
    id: 'debug-testing',
    name: '调试测试',
    keywords: ['debug', 'test', 'fix', 'bug', '调试', '测试']
  },
  {
    id: 'data-analysis',
    name: '数据分析',
    keywords: ['data', 'analysis', 'visualization', '数据', '分析']
  },
  {
    id: 'machine-learning',
    name: '机器学习',
    keywords: ['ml', 'ai', 'model', 'train', '机器学习']
  },
  {
    id: 'life-science',
    name: '生命科学',
    keywords: ['bio', 'genomics', 'protein', '生信']
  },
  {
    id: 'scientific-computing',
    name: '科学计算',
    keywords: ['scientific', 'math', 'simulation', '科学计算']
  },
  {
    id: 'academic-writing',
    name: '学术写作',
    keywords: ['academic', 'paper', 'latex', '论文', '学术']
  },
  {
    id: 'multimedia',
    name: '多媒体可视化',
    keywords: ['video', 'audio', 'image', 'media', '多媒体']
  }
]);

/**
 * 技能元数据结构
 * @typedef {Object} SkillManifest
 * @property {string} name - 技能名称
 * @property {string} description - 技能描述
 * @property {string[]} tags - 技能标签
 * @property {string} domain - 所属领域
 * @property {string} version - 版本号
 * @property {string} author - 作者
 * @property {number} rating - 评分 (0-5)
 * @property {string} path - 技能文件路径
 * @property {string} source - 来源 (vibe-skills | community | custom)
 * @property {Date} installedAt - 安装时间
 * @property {Date} lastUpdated - 最后更新时间
 */

/**
 * 索引文件结构
 * @typedef {Object} SkillIndex
 * @property {SkillManifest[]} skills - 技能列表
 * @property {number} total - 总数
 * @property {string} lastSync - 最后同步时间
 * @property {string} version - 索引版本
 */
