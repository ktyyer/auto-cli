#!/usr/bin/env node

/**
 * repo-map 符号提取脚本
 *
 * 用法:
 *   node extract-symbols.js [目录] [语言]
 *
 * 示例:
 *   node extract-symbols.js src java
 *   node extract-symbols.js src typescript
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 语言模式配置
const PATTERNS = {
  java: {
    class: /(?:^|\n)\s*(?:@\w+\s+)*public\s+(?:abstract\s+)?class\s+(\w+)/gm,
    interface: /(?:^|\n)\s*(?:@\w+\s+)*public\s+interface\s+(\w+)/gm,
    enum: /(?:^|\n)\s*(?:@\w+\s+)*public\s+enum\s+(\w+)/gm,
    method: /(?:^|\n)\s*(?:public|protected|private)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/gm,
    controller: /@RestController|@Controller/g,
    service: /@Service|@Component/g,
    repository: /@Repository|@Mapper/g
  },
  javascript: {
    export: /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/g,
    exportDefault: /export\s+default/g,
    class: /(?:^|\n)\s*class\s+(\w+)/g,
    function: /(?:^|\n)\s*function\s+(\w+)/g,
    arrowFunction: /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)\s*)?=>/g
  },
  typescript: {
    class: /class\s+(\w+)/g,
    interface: /interface\s+(\w+)/g,
    export: /export\s+(?:(?:default\s+)?(?:class|interface|function|const|type)\s+)?(\w+)/g,
    asyncFunction: /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g
  },
  python: {
    class: /^class\s+(\w+)/gm,
    function: /^def\s+(\w+)/gm,
    asyncFunction: /^async\s+def\s+(\w+)/gm
  },
  go: {
    struct: /type\s+(\w+)\s+struct/g,
    interface: /type\s+(\w+)\s+interface/g,
    function: /^func\s+(?:\(\w*\s+\*?\w+\)\s+)?(\w+)/gm
  }
};

/**
 * 扫描目录获取所有目标文件
 */
function scanDirectory(dir, extensions) {
  const files = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // 跳过 node_modules 和隐藏目录
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * 从单个文件提取符号
 */
function extractFromFile(filePath, patterns) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const symbols = { type: [], method: [], annotation: [] };
  const relativePath = path.relative(process.cwd(), filePath);

  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const name = match[1];
      if (name) {
        if (type === 'controller' || type === 'service' || type === 'repository') {
          symbols.annotation.push({ type, name: 'annotation' });
        } else {
          symbols.type.push({ type, name, file: relativePath });
        }
      }
    }
  }

  return symbols;
}

/**
 * 生成 Markdown 格式的仓库地图
 */
function generateRepoMap(symbols, language, projectPath) {
  const lines = [
    '# 仓库符号地图 (REPO_MAP.md)',
    '',
    `> 自动生成于 ${new Date().toISOString().split('T')[0]}`,
    `> 语言: ${language}`,
    '',
    '## 符号概览',
    '',
    `| 类型 | 名称 | 文件 |`,
    '|------|------|------|'
  ];

  // 去重并排序
  const uniqueTypes = new Map();
  for (const sym of symbols.type) {
    const key = `${sym.type}:${sym.name}`;
    if (!uniqueTypes.has(key)) {
      uniqueTypes.set(key, sym);
    }
  }

  for (const sym of [...uniqueTypes.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`| ${sym.type} | \`${sym.name}\` | ${sym.file || ''} |`);
  }

  lines.push('', '---', '', '## 使用说明', '', '1. 将此文件保存为 `REPO_MAP.md`', '2. 加入 `.gitignore`（这是生成的文件）', '3. AI 可以使用此地图快速定位代码');

  return lines.join('\n');
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || 'src';
  const language = args[1] || detectLanguage(targetDir);

  console.log(`🔍 扫描目录: ${targetDir}`);
  console.log(`📝 检测语言: ${language}`);

  const patterns = PATTERNS[language];
  if (!patterns) {
    console.error(`❌ 不支持的语言: ${language}`);
    console.error(`   支持的语言: ${Object.keys(PATTERNS).join(', ')}`);
    process.exit(1);
  }

  // 根据语言确定文件扩展名
  const extensions = {
    java: ['.java'],
    javascript: ['.js'],
    typescript: ['.ts', '.tsx'],
    python: ['.py'],
    go: ['.go']
  }[language] || ['.js', '.ts'];

  // 扫描文件
  const files = scanDirectory(targetDir, extensions);
  console.log(`📄 找到 ${files.length} 个文件`);

  if (files.length === 0) {
    console.warn('⚠️  未找到任何文件，请检查目录和语言配置');
    return;
  }

  // 提取符号
  const allSymbols = { type: [], method: [], annotation: [] };
  for (const file of files) {
    const symbols = extractFromFile(file, patterns);
    allSymbols.type.push(...symbols.type);
    allSymbols.method.push(...symbols.method);
    allSymbols.annotation.push(...symbols.annotation);
  }

  console.log(`✅ 提取到 ${allSymbols.type.length} 个符号`);

  // 生成地图
  const repoMap = generateRepoMap(allSymbols, language, targetDir);

  // 输出
  const outputPath = path.join(process.cwd(), 'REPO_MAP.md');
  fs.writeFileSync(outputPath, repoMap, 'utf-8');
  console.log(`📦 已生成: ${outputPath}`);
}

/**
 * 简单的语言检测
 */
function detectLanguage(dir) {
  if (!fs.existsSync(dir)) return 'javascript';

  const files = fs.readdirSync(dir);
  const exts = files.map(f => path.extname(f));

  if (exts.includes('.java')) return 'java';
  if (exts.includes('.ts') || exts.includes('.tsx')) return 'typescript';
  if (exts.includes('.py')) return 'python';
  if (exts.includes('.go')) return 'go';
  return 'javascript';
}

// 运行
// 更健壮的入口检查，兼容不同平台
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
                      import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
                      process.argv[1].endsWith('extract-symbols.js');

if (isMainModule) {
  main();
}

export { scanDirectory, extractFromFile, generateRepoMap };
