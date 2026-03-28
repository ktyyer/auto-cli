/**
 * 实体类型定义和关系类型常量
 * 用于知识图谱的实体提取和关系构建
 */

/**
 * 实体类型枚举
 * @readonly
 */
export const ENTITY_TYPES = Object.freeze({
  TECH_STACK: 'tech_stack',
  PATTERN: 'pattern',
  PRACTICE: 'practice',
  TRAP: 'trap',
  TOOL: 'tool',
  CONCEPT: 'concept'
});

/**
 * 关系类型枚举
 * @readonly
 */
export const RELATION_TYPES = Object.freeze({
  USES: 'uses',
  INCLUDES: 'includes',
  RELATES_TO: 'relates_to',
  CAUSES: 'causes',
  SOLVES: 'solves',
  CONTRADICTS: 'contradicts'
});

/**
 * 实体类型显示名称映射
 * @readonly
 */
export const ENTITY_TYPE_LABELS = Object.freeze({
  [ENTITY_TYPES.TECH_STACK]: '技术栈',
  [ENTITY_TYPES.PATTERN]: '设计模式',
  [ENTITY_TYPES.PRACTICE]: '最佳实践',
  [ENTITY_TYPES.TRAP]: '常见陷阱',
  [ENTITY_TYPES.TOOL]: '工具',
  [ENTITY_TYPES.CONCEPT]: '概念'
});

/**
 * 关系类型显示名称映射
 * @readonly
 */
export const RELATION_TYPE_LABELS = Object.freeze({
  [RELATION_TYPES.USES]: '使用',
  [RELATION_TYPES.INCLUDES]: '包含',
  [RELATION_TYPES.RELATES_TO]: '相关',
  [RELATION_TYPES.CAUSES]: '导致',
  [RELATION_TYPES.SOLVES]: '解决',
  [RELATION_TYPES.CONTRADICTS]: '矛盾'
});

/**
 * 默认实体提取规则（关键词 → 实体类型映射）
 * @readonly
 */
export const DEFAULT_ENTITY_RULES = Object.freeze([
  // 技术栈
  {
    type: ENTITY_TYPES.TECH_STACK,
    keywords: [
      'React',
      'Vue',
      'Angular',
      'Svelte',
      'Solid',
      'Node.js',
      'Deno',
      'Bun',
      'Express',
      'Koa',
      'TypeScript',
      'JavaScript',
      'Python',
      'Go',
      'Rust',
      'Java',
      'Vitest',
      'Jest',
      'Mocha',
      'Chai',
      'Webpack',
      'Vite',
      'Rollup',
      'esbuild',
      'PostgreSQL',
      'MySQL',
      'MongoDB',
      'Redis',
      'SQLite'
    ],
    patterns: [/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g]
  },
  // 设计模式
  {
    type: ENTITY_TYPES.PATTERN,
    keywords: [
      'Singleton',
      'Observer',
      'Strategy',
      'Factory',
      'Builder',
      'Adapter',
      'Decorator',
      'Facade',
      'Proxy',
      'Composite',
      'MVC',
      'MVVM',
      'Redux',
      'Flux',
      'Repository'
    ],
    patterns: [/([A-Z][a-z]+)\s+模式/g]
  },
  // 最佳实践
  {
    type: ENTITY_TYPES.PRACTICE,
    keywords: [
      'TDD',
      '测试驱动开发',
      'BDD',
      '行为驱动开发',
      'Code Review',
      '代码审查',
      'CI/CD',
      '持续集成',
      '不可变性',
      'immutability',
      '单一职责',
      'SRP',
      '依赖注入',
      'DI',
      '控制反转',
      'IoC',
      'DRY',
      "Don't Repeat Yourself",
      'KISS',
      'Keep It Simple',
      'SOLID',
      'YAGNI',
      "You Aren't Gonna Need It"
    ],
    patterns: [/测试覆盖率/g, /80%/g, /\d{2,3}%/g]
  },
  // 常见陷阱
  {
    type: ENTITY_TYPES.TRAP,
    keywords: [
      '陷阱',
      '坑',
      '踩坑',
      'bug',
      '错误',
      '异常',
      '内存泄漏',
      'memory leak',
      '竞态条件',
      'race condition',
      '死锁',
      'deadlock',
      '空指针',
      'null pointer',
      '依赖地狱',
      'dependency hell',
      '循环依赖',
      'circular dependency'
    ],
    patterns: [/陷阱/g, /问题/g, /错误/g]
  },
  // 工具
  {
    type: ENTITY_TYPES.TOOL,
    keywords: [
      'Docker',
      'Kubernetes',
      'K8s',
      'Helm',
      'Git',
      'GitHub',
      'GitLab',
      'Bitbucket',
      'VS Code',
      'WebStorm',
      'IntelliJ',
      'Vim',
      'ESLint',
      'Prettier',
      'Babel',
      'PostCSS',
      'npm',
      'yarn',
      'pnpm',
      'bun'
    ],
    patterns: []
  },
  // 概念
  {
    type: ENTITY_TYPES.CONCEPT,
    keywords: [
      '性能',
      'performance',
      '优化',
      'optimization',
      '安全',
      'security',
      '认证',
      'authentication',
      '可扩展性',
      'scalability',
      '可维护性',
      'maintainability',
      '异步',
      'async',
      '并发',
      'concurrency',
      '并行',
      'parallel'
    ],
    patterns: []
  }
]);

/**
 * 根据关键词推断实体类型
 * @param {string} text - 文本内容
 * @returns {string|null} 实体类型或 null
 */
export function inferEntityType(text) {
  const lowerText = text.toLowerCase();

  for (const rule of DEFAULT_ENTITY_RULES) {
    for (const keyword of rule.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return rule.type;
      }
    }
  }

  return null;
}

/**
 * 提取文本中的所有实体
 * @param {string} text - 文本内容
 * @returns {Array<{name: string, type: string, count: number}>} 实体列表
 */
export function extractEntities(text) {
  const entities = new Map();

  for (const rule of DEFAULT_ENTITY_RULES) {
    for (const keyword of rule.keywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);

      if (matches) {
        const key = `${keyword}|${rule.type}`;
        const existing = entities.get(key);

        if (existing) {
          existing.count += matches.length;
        } else {
          entities.set(key, {
            name: keyword,
            type: rule.type,
            count: matches.length
          });
        }
      }
    }
  }

  return Array.from(entities.values());
}
