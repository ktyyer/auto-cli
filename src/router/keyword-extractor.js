/**
 * 关键词提取器 - 统一关键词提取和扩展逻辑
 *
 * 解决问题：
 * - PHASE 6 的 _extractKeywords() 只做正则分词，无法路由到具体知识
 * - SkillIndexer.search() 只做子串匹配，缺少语义理解
 *
 * 改进：
 * - 停用词过滤（中英文）
 * - 同义词扩展（技术术语映射）
 * - CJK 词典分词（复用 CanonicalRouter 的字典）
 * - 权重评分（提取的关键词带权重）
 */

/**
 * 英文停用词
 */
const EN_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'need',
  'dare',
  'ought',
  'used',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'as',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'out',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'and',
  'but',
  'or',
  'nor',
  'not',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  'each',
  'every',
  'all',
  'any',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'just',
  'because',
  'if',
  'when',
  'where',
  'how',
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'him',
  'his',
  'she',
  'her',
  'they',
  'them',
  'their',
  'there',
  'here'
]);

/**
 * 中文停用词
 */
const ZH_STOPWORDS = new Set([
  '的',
  '了',
  '在',
  '是',
  '我',
  '有',
  '和',
  '就',
  '不',
  '人',
  '都',
  '一',
  '一个',
  '上',
  '也',
  '很',
  '到',
  '说',
  '要',
  '去',
  '你',
  '会',
  '着',
  '没有',
  '看',
  '好',
  '自己',
  '这',
  '他',
  '她',
  '它',
  '们',
  '那',
  '被',
  '从',
  '把',
  '让',
  '用',
  '对',
  '为',
  '什么',
  '怎么',
  '可以',
  '这个',
  '那个',
  '没',
  '能',
  '所以',
  '但是',
  '因为',
  '如果',
  '虽然',
  '已经',
  '还是',
  '或者',
  '以及',
  '及',
  '等',
  '等等',
  '地',
  '得',
  '着',
  '过',
  '来',
  '去',
  '吧',
  '呢',
  '吗',
  '啊',
  '嗯',
  '哦',
  '哈',
  '呀',
  '哪',
  '谁',
  '多',
  '少',
  '些',
  '做',
  '给',
  '比',
  '与',
  '跟',
  '像',
  '个'
]);

/**
 * 技术同义词映射 — 将自然语言意图映射到标准技术术语
 * key: 用户可能使用的词 → value: 标准化后的扩展词列表
 */
const SYNONYM_MAP = {
  // 语言/框架
  java: ['java', 'spring', 'mybatis', 'maven', 'gradle', 'jvm'],
  spring: ['spring', 'spring-boot', 'springboot', 'java'],
  typescript: ['typescript', 'ts', 'tsc'],
  javascript: ['javascript', 'js', 'node', 'nodejs'],
  python: ['python', 'py', 'pip', 'django', 'flask'],
  react: ['react', 'reactjs', 'hooks', 'jsx', 'tsx'],
  vue: ['vue', 'vuejs', 'vuex', 'pinia'],
  go: ['go', 'golang', 'goroutine'],
  rust: ['rust', 'cargo', 'rustc'],
  // 操作
  重构: ['refactor', '重构', '清理', 'restructure'],
  refactor: ['refactor', '重构', '清理', 'restructure'],
  优化: ['optimize', '优化', 'performance', 'perf', '性能'],
  optimize: ['optimize', '优化', 'performance', 'perf'],
  修复: ['fix', '修复', 'debug', '调试', '解决'],
  fix: ['fix', '修复', 'debug', '调试', '解决', 'bugfix'],
  测试: ['test', '测试', 'testing', 'unit-test', 'e2e'],
  test: ['test', '测试', 'testing', 'unit-test', 'e2e', 'tdd'],
  清理: ['clean', '清理', '死代码', 'dead-code', 'refactor'],
  clean: ['clean', '清理', '死代码', 'dead-code'],
  安全: ['security', '安全', '漏洞', 'vulnerability', 'xss', 'csrf'],
  security: ['security', '安全', '漏洞', 'vulnerability'],
  文档: ['docs', '文档', 'documentation', 'readme'],
  docs: ['docs', '文档', 'documentation', 'readme'],
  部署: ['deploy', '部署', 'ci/cd', 'release', '发布'],
  deploy: ['deploy', '部署', 'ci/cd', 'release'],
  构建: ['build', '构建', '编译', 'compile', 'webpack', 'vite'],
  build: ['build', '构建', '编译', 'compile'],
  // 质量
  审查: ['review', '审查', '检查', 'audit', 'lint'],
  review: ['review', '审查', '检查', 'audit', 'lint'],
  代码质量: ['code-quality', '代码质量', 'lint', 'review'],
  性能: ['performance', '性能', 'perf', 'optimize', '优化'],
  死代码: ['dead-code', '死代码', 'unused', '清理'],
  // 流程
  提交: ['commit', '提交', 'git'],
  分支: ['branch', '分支', 'git', 'merge'],
  // 类型
  类型: ['type', '类型', 'typescript', 'tsc', '类型检查'],
  错误: ['error', '错误', 'bug', '异常', 'exception'],
  失败: ['fail', '失败', 'error', 'broken']
};

/**
 * CJK 关键词字典 — 从 CanonicalRouter 复用
 */
const CJK_DICT = [
  '单元测试',
  '集成测试',
  '端到端',
  '代码质量',
  '技术选型',
  '代码审查',
  '死代码',
  '微服务',
  '分布式',
  '最佳实践',
  '重构',
  '架构',
  '系统',
  '迁移',
  '整体',
  '功能',
  '实现',
  '开发',
  '新增',
  '修改',
  '集成',
  '优化',
  '修复',
  '测试',
  '部署',
  '发布',
  '回滚',
  '分支',
  '构建',
  '编译',
  '类型',
  '错误',
  '失败',
  '格式化',
  '重命名',
  '文档',
  '注释',
  '简单',
  '快速',
  '批量',
  '密码',
  '密钥',
  '认证',
  '授权',
  '权限',
  '注入',
  '加密',
  '安全',
  '漏洞',
  '泄露',
  '审查',
  '检查',
  '性能',
  '缓存',
  '清理',
  '提交',
  '模式',
  '规范',
  '风格',
  '约定',
  '排查',
  '调试',
  '报错',
  '异常',
  '血泪',
  '教训',
  '踩坑',
  '陷阱',
  '解决',
  '原因'
];

/** 按长度降序排列，确保最长匹配优先 */
const SORTED_CJK_DICT = [...CJK_DICT].sort((a, b) => b.length - a.length);

/**
 * CJK 词典分词（正向最大匹配）
 * @param {string} text - 输入文本
 * @returns {string[]} 分词结果
 */
function segmentCJK(text) {
  const keywords = [];
  let remaining = text;
  while (remaining.length > 0) {
    let matched = false;
    for (const word of SORTED_CJK_DICT) {
      if (remaining.startsWith(word)) {
        keywords.push(word);
        remaining = remaining.slice(word.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      remaining = remaining.slice(1);
    }
  }
  return keywords;
}

/**
 * 扩展关键词（同义词展开）
 * @param {string[]} keywords - 原始关键词
 * @returns {string[]} 扩展后的关键词（去重）
 */
function expandSynonyms(keywords) {
  const expanded = new Set(keywords);

  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    const synonyms = SYNONYM_MAP[lower] || SYNONYM_MAP[kw];
    if (synonyms) {
      for (const syn of synonyms) {
        expanded.add(syn);
      }
    }
  }

  return [...expanded];
}

/**
 * 过滤停用词
 * @param {string[]} tokens - 原始分词结果
 * @returns {string[]} 过滤后的词
 */
function filterStopwords(tokens) {
  return tokens.filter((t) => {
    const lower = t.toLowerCase();
    return !EN_STOPWORDS.has(lower) && !ZH_STOPWORDS.has(t) && t.length > 1;
  });
}

/**
 * 统一关键词提取器
 *
 * @param {string} text - 输入文本
 * @param {Object} [options] - 选项
 * @param {boolean} [options.expandSynonyms=true] - 是否扩展同义词
 * @param {boolean} [options.filterStopwords=true] - 是否过滤停用词
 * @param {boolean} [options.includeCJKSegment=true] - 是否对中文做词典分词
 * @returns {string[]} 提取的关键词列表
 */
export function extractKeywords(text, options = {}) {
  if (!text || typeof text !== 'string') return [];

  const {
    expandSynonyms: doExpand = true,
    filterStopwords: doFilter = true,
    includeCJKSegment = true
  } = options;

  // 1. 英文分词
  const englishTerms = (text.match(/[a-z][a-z0-9._-]+/gi) || []).filter((t) => t.length > 2);

  // 2. 中文分词 — 先用词典匹配，再兜底连续字符
  let chineseTerms = [];
  if (includeCJKSegment) {
    // 提取所有中文片段
    const cjkChunks = text.match(/[\u4e00-\u9fff]+/g) || [];
    for (const chunk of cjkChunks) {
      const segmented = segmentCJK(chunk);
      chineseTerms.push(...segmented);
      // 词典未匹配的连续字符（2+字）也保留
      const remaining = chunk.replace(new RegExp(segmented.map(escapeRegex).join('|'), 'g'), '');
      const fallbackTerms = remaining.match(/[\u4e00-\u9fff]{2,}/g) || [];
      chineseTerms.push(...fallbackTerms);
    }
  } else {
    chineseTerms = text.match(/[\u4e00-\u9fff]{2,}/g) || [];
  }

  // 3. 合并去重
  let allTerms = [...new Set([...englishTerms, ...chineseTerms])];

  // 4. 停用词过滤
  if (doFilter) {
    allTerms = filterStopwords(allTerms);
  }

  // 5. 同义词扩展
  if (doExpand) {
    allTerms = expandSynonyms(allTerms);
  }

  return [...new Set(allTerms)];
}

/**
 * 计算关键词与搜索文本的相关性得分
 *
 * @param {string[]} keywords - 关键词列表
 * @param {string} searchText - 搜索文本
 * @returns {number} 相关性得分
 */
export function computeRelevance(keywords, searchText) {
  if (!keywords.length || !searchText) return 0;

  const lowerSearch = searchText.toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    const idx = lowerSearch.indexOf(lower);

    if (idx === -1) continue;

    // 精确匹配 name 得分最高
    if (idx === 0 && lower.length === lowerSearch.length) {
      score += 10;
    }
    // 前缀匹配
    else if (idx === 0) {
      score += 5;
    }
    // 子串匹配
    else {
      score += 2;
    }

    // 长词加分（更有区分度）
    score += Math.floor(lower.length / 3);
  }

  return score;
}

/**
 * 转义正则特殊字符
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { SYNONYM_MAP, EN_STOPWORDS, ZH_STOPWORDS, CJK_DICT, segmentCJK };
