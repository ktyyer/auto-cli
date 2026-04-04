/**
 * 源码符号提取模式
 *
 * 使用正则从 JS/TS 源码中提取 exports、classes、functions、imports。
 * 无 AST 依赖，纯字符串匹配。
 *
 * 设计原则：
 * - 每个 extract 函数返回 Object.freeze() 数组（不可变）
 * - 容错：解析失败返回空数组，不抛异常
 * - 签名截断：只保留参数类型/名字，不保留函数体
 */

/** 默认包含的文件扩展名 */
export const DEFAULT_INCLUDE_PATTERNS = Object.freeze([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts'
]);

/** 默认排除的目录/文件模式 */
export const DEFAULT_EXCLUDE_PATTERNS = Object.freeze([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.auto',
  '.claude',
  '.codemoss'
]);

// --- 内部工具：剥离注释（引言感知，保护字符串/正则字面量中的 // 和 /*）---

/**
 * 逐字符状态机剥离注释。
 * 正确处理 '...' "..." `...` /regex/ 内的 // 和 /*，
 * 避免误删 URL、正则字面量等。
 */
function stripComments(content) {
  const out = [];
  let i = 0;
  const len = content.length;

  while (i < len) {
    const ch = content[i];
    const next = content[i + 1];

    // 单行注释 //
    if (ch === '/' && next === '/') {
      // 跳过到行尾
      while (i < len && content[i] !== '\n') i++;
      continue;
    }

    // 块注释 /* */
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < len - 1 && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 2; // skip */
      continue;
    }

    // 单引号字符串
    if (ch === "'") {
      out.push(ch);
      i++;
      while (i < len && content[i] !== "'") {
        if (content[i] === '\\') {
          out.push(content[i++]);
        }
        if (i < len) out.push(content[i++]);
      }
      if (i < len) out.push(content[i++]); // closing '
      continue;
    }

    // 双引号字符串
    if (ch === '"') {
      out.push(ch);
      i++;
      while (i < len && content[i] !== '"') {
        if (content[i] === '\\') {
          out.push(content[i++]);
        }
        if (i < len) out.push(content[i++]);
      }
      if (i < len) out.push(content[i++]); // closing "
      continue;
    }

    // 模板字面量 `
    if (ch === '`') {
      out.push(ch);
      i++;
      while (i < len && content[i] !== '`') {
        if (content[i] === '\\') {
          out.push(content[i++]);
        }
        out.push(content[i++]);
      }
      if (i < len) out.push(content[i++]); // closing `
      continue;
    }

    // 正则字面量 /pattern/flags — 仅在非除法运算符上下文
    // 简化启发：前一个非空白字符是 =, (, [, !, &, |, ^, ~, ?, :, ;, {, }, ,, >, \n
    if (ch === '/' && next !== '/' && next !== '*' && next !== '=') {
      const prevNonSpace = _lastNonSpaceChar(out);
      if (prevNonSpace !== null && _isRegexPrefix(prevNonSpace)) {
        out.push(ch);
        i++;
        while (i < len && content[i] !== '/') {
          if (content[i] === '\\') {
            out.push(content[i++]);
          }
          if (i < len) out.push(content[i++]);
        }
        if (i < len) out.push(content[i++]); // closing /
        // flags
        while (i < len && /[gimsuy]/.test(content[i])) out.push(content[i++]);
        continue;
      }
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}

function _lastNonSpaceChar(arr) {
  for (let j = arr.length - 1; j >= 0; j--) {
    const c = arr[j];
    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') return c;
  }
  return null;
}

function _isRegexPrefix(ch) {
  return '=([!&|^~?:;{},>\n'.includes(ch);
}

// --- 正则定义 ---

const RE = {
  namedExport: /export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g,
  defaultExport: /export\s+default\s+(?:function\s+)?(\w+)?/g,
  reExport: /export\s+\{([^}]+)\}/g,
  classDecl: /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?/g,
  classMethod: /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g,
  functionDecl: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
  arrowFunc: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
  namedImport: /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
  defaultImport: /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
  typeImport: /import\s+type\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g
};

// --- 提取函数 ---

/**
 * 提取 export 声明
 * @param {string} content - 文件内容
 * @returns {ReadonlyArray<{name: string, type: string, signature: string}>}
 */
export function extractExports(content) {
  const clean = stripComments(content);
  const results = [];
  const seen = new Set();

  // named exports: export const/function/class NAME
  let match;
  RE.namedExport.lastIndex = 0;
  while ((match = RE.namedExport.exec(clean)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({ name, type: 'named', signature: '' });
    }
  }

  // re-exports: export { NAME1, NAME2 }
  RE.reExport.lastIndex = 0;
  while ((match = RE.reExport.exec(clean)) !== null) {
    const names = match[1]
      .split(',')
      .map((s) => {
        const trimmed = s.trim();
        const parts = trimmed.split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      })
      .filter(Boolean);

    for (const name of names) {
      if (!seen.has(name)) {
        seen.add(name);
        results.push({ name, type: 'named', signature: '' });
      }
    }
  }

  // default export
  RE.defaultExport.lastIndex = 0;
  while ((match = RE.defaultExport.exec(clean)) !== null) {
    if (match[1] && !seen.has(match[1])) {
      seen.add(match[1]);
      results.push({ name: match[1], type: 'default', signature: '' });
    }
  }

  return Object.freeze(results);
}

/**
 * 提取 class 声明及其方法
 * @param {string} content - 文件内容
 * @returns {ReadonlyArray<{name: string, methods: string[]}>}
 */
export function extractClasses(content) {
  const clean = stripComments(content);
  const results = [];

  // 先找到所有 class 声明的位置
  const classPositions = [];
  RE.classDecl.lastIndex = 0;
  let match;
  while ((match = RE.classDecl.exec(clean)) !== null) {
    classPositions.push({
      name: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  // 对每个 class，提取其方法（在 class 块内）
  for (const cls of classPositions) {
    const afterClass = clean.slice(cls.startIndex);
    // 找到 class 块的大括号范围
    let braceCount = 0;
    let classEnd = 0;
    let started = false;
    for (let i = 0; i < afterClass.length; i++) {
      if (afterClass[i] === '{') {
        braceCount++;
        started = true;
      } else if (afterClass[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          classEnd = i;
          break;
        }
      }
    }

    const classBody = classEnd > 0 ? afterClass.slice(0, classEnd) : afterClass.slice(0, 2000);

    const methods = [];
    const methodSeen = new Set();
    RE.classMethod.lastIndex = 0;
    while ((match = RE.classMethod.exec(classBody)) !== null) {
      const methodName = match[1];
      if (
        !methodSeen.has(methodName) &&
        methodName !== 'if' &&
        methodName !== 'for' &&
        methodName !== 'while' &&
        methodName !== 'switch' &&
        methodName !== 'catch'
      ) {
        methodSeen.add(methodName);
        methods.push(`${methodName}(${_truncateParams(match[2])})`);
      }
    }

    results.push(Object.freeze({ name: cls.name, methods: Object.freeze(methods) }));
  }

  return Object.freeze(results);
}

/**
 * 提取函数声明（含箭头函数）
 * @param {string} content - 文件内容
 * @returns {ReadonlyArray<{name: string, params: string, isAsync: boolean}>}
 */
export function extractFunctions(content) {
  const clean = stripComments(content);
  const results = [];
  const seen = new Set();

  // function declarations
  let match;
  RE.functionDecl.lastIndex = 0;
  while ((match = RE.functionDecl.exec(clean)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      const isAsync = match[0].includes('async ');
      results.push({
        name,
        params: _truncateParams(match[2]),
        isAsync
      });
    }
  }

  // arrow functions
  RE.arrowFunc.lastIndex = 0;
  while ((match = RE.arrowFunc.exec(clean)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      const isAsync = match[0].includes('async ');
      results.push({
        name,
        params: _truncateParams(match[2]),
        isAsync
      });
    }
  }

  return Object.freeze(results);
}

/**
 * 提取 import 声明
 * @param {string} content - 文件内容
 * @returns {ReadonlyArray<{source: string, names: string[], isType: boolean}>}
 */
export function extractImports(content) {
  const clean = stripComments(content);
  const results = [];

  // named imports: import { A, B } from 'module'
  let match;
  RE.namedImport.lastIndex = 0;
  while ((match = RE.namedImport.exec(clean)) !== null) {
    const names = match[1]
      .split(',')
      .map((s) =>
        s
          .trim()
          .split(/\s+as\s+/)
          .pop()
          .trim()
      )
      .filter(Boolean);
    results.push({
      source: match[2],
      names: Object.freeze(names),
      isType: false
    });
  }

  // default imports: import NAME from 'module'
  RE.defaultImport.lastIndex = 0;
  while ((match = RE.defaultImport.exec(clean)) !== null) {
    results.push({
      source: match[2],
      names: Object.freeze([match[1]]),
      isType: false
    });
  }

  // type imports: import type { A } from 'module'
  RE.typeImport.lastIndex = 0;
  while ((match = RE.typeImport.exec(clean)) !== null) {
    const names = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    results.push({
      source: match[2],
      names: Object.freeze(names),
      isType: true
    });
  }

  return Object.freeze(results);
}

/**
 * 检测文件语言
 * @param {string} filePath - 文件路径
 * @returns {'javascript' | 'typescript' | 'unknown'}
 */
export function detectLanguage(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  const tsExts = ['.ts', '.tsx', '.mts', '.cts'];
  const jsExts = ['.js', '.jsx', '.mjs', '.cjs'];

  if (tsExts.includes(ext)) return 'typescript';
  if (jsExts.includes(ext)) return 'javascript';
  return 'unknown';
}

// --- 内部工具函数 ---

/**
 * 截断参数列表（保留参数名，移除类型注解的冗余部分）
 * @param {string} paramsStr - 参数字符串
 * @returns {string}
 */
function _truncateParams(paramsStr) {
  if (!paramsStr || !paramsStr.trim()) return '';
  const params = paramsStr
    .split(',')
    .map((p) => {
      const trimmed = p.trim();
      // 移除默认值，只保留参数名
      const eqIdx = trimmed.indexOf('=');
      return eqIdx > 0 ? trimmed.slice(0, eqIdx).trim() : trimmed;
    })
    .filter(Boolean);
  return params.join(', ');
}
