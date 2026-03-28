/**
 * 知识分类规则
 * 根据内容关键词自动路由到对应的知识文件
 */

/**
 * 内容分类定义
 * @typedef {Object} Category
 * @property {string} name - 分类名称
 * @property {string} file - 目标文件名
 * @property {string[]} keywords - 匹配关键词
 * @property {string} description - 分类描述
 */

export const CATEGORIES = Object.freeze([
  {
    name: 'prompt',
    file: 'prompts.md',
    keywords: [
      'prompt',
      '提示词',
      '指令',
      'command',
      'template',
      '模板',
      '提示',
      'ask',
      '指令模板',
      '对话模板'
    ],
    description: '有效 Prompt 和对话模板'
  },
  {
    name: 'trap',
    file: 'traps.md',
    keywords: [
      '坑',
      '陷阱',
      '踩坑',
      'bug',
      '错误',
      '失败',
      '问题',
      '报错',
      '异常',
      'fix',
      'debug',
      '调试',
      '排查',
      '血泪',
      '教训'
    ],
    description: '踩坑经验和问题排查'
  },
  {
    name: 'pattern',
    file: 'patterns.md',
    keywords: [
      '模式',
      'pattern',
      '设计',
      '架构',
      '最佳实践',
      '规范',
      '原则',
      '惯例',
      '风格',
      'style',
      '重构',
      '优化',
      'perf'
    ],
    description: '设计模式和编码最佳实践'
  },
  {
    name: 'decision',
    file: 'decisions.md',
    keywords: [
      '决策',
      '决定',
      '选择',
      '为什么',
      '选用',
      '技术选型',
      '方案',
      'ADR',
      'trade-off',
      '折衷',
      '权衡',
      '理由'
    ],
    description: '架构决策和技术选型记录'
  }
]);

/**
 * 根据内容自动推断分类
 * @param {string} content - 要分类的内容
 * @param {string} [hint] - 用户指定的分类提示
 * @returns {import('./categories.js').Category} 匹配的分类
 */
export function classifyContent(content, hint) {
  // 优先使用用户指定的分类
  if (hint) {
    const normalisedHint = hint.toLowerCase().trim();
    const matched = CATEGORIES.find(
      (cat) => cat.name === normalisedHint || cat.file === normalisedHint
    );
    if (matched) {
      return matched;
    }
  }

  // 关键词匹配计分
  const lowerContent = content.toLowerCase();
  const scores = CATEGORIES.map((cat) => {
    let score = 0;
    for (const keyword of cat.keywords) {
      if (lowerContent.includes(keyword)) {
        score += 1;
      }
    }
    return { category: cat, score };
  });

  // 取最高分，平局时取第一个
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  // 无匹配时默认归入 decision
  if (best.score === 0) {
    return CATEGORIES.find((cat) => cat.name === 'decision');
  }

  return best.category;
}

/**
 * 根据分类名获取分类定义
 * @param {string} name - 分类名称
 * @returns {import('./categories.js').Category | undefined}
 */
export function getCategoryByName(name) {
  return CATEGORIES.find((cat) => cat.name === name || cat.file === name);
}
