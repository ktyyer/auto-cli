#!/usr/bin/env node

/**
 * Cost Tracker - Token 成本追踪器
 *
 * 功能:
 *   - 追踪会话 token 使用
 *   - 计算预估成本
 *   - 成本预警
 *   - 优化建议
 *
 * 用法:
 *   node cost-tracker.js analyze <file>
 *   node cost-tracker.js estimate --input 10000 --output 5000
 *   node cost-tracker.js budget --monthly 50
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Claude 定价 (2025)
// https://www.anthropic.com/pricing
const PRICING = {
  claude_opus: {
    input: 15.00,   // per million tokens
    output: 75.00,
    cached: 1.50    // cached prompt tokens
  },
  claude_sonnet: {
    input: 3.00,
    output: 15.00,
    cached: 0.30
  },
  claude_haiku: {
    input: 0.80,
    output: 4.00,
    cached: 0.08
  }
};

// 成本等级
const COST_LEVELS = {
  low: { threshold: 0.10, emoji: '🟢', label: '低成本' },
  medium: { threshold: 0.50, emoji: '🟡', label: '中等成本' },
  high: { threshold: 2.00, emoji: '🟠', label: '高成本' },
  extreme: { threshold: Infinity, emoji: '🔴', label: '极高成本' }
};

/**
 * 计算 token 成本
 */
function calculateCost(model, inputTokens, outputTokens, cachedTokens = 0) {
  const pricing = PRICING[model];
  if (!pricing) {
    throw new Error(`Unknown model: ${model}`);
  }

  const inputCost = (inputTokens - cachedTokens) * pricing.input / 1_000_000;
  const cachedCost = cachedTokens * pricing.cached / 1_000_000;
  const outputCost = outputTokens * pricing.output / 1_000_000;

  return {
    input: inputCost + cachedCost,
    output: outputCost,
    total: inputCost + cachedCost + outputCost,
    cached: cachedCost
  };
}

/**
 * 估算文件 token 数
 *
 * 粗略估算: 1 token ≈ 4 字符 (英文) / 2 字符 (中文)
 */
function estimateTokens(content) {
  // 统计中文字符
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  // 统计非中文字符
  const otherChars = content.length - chineseChars;

  // 中文: 1 token ≈ 2 字符, 英文: 1 token ≈ 4 字符
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/**
 * 分析文件 token 和成本
 */
function analyzeFile(filePath, model = 'claude_sonnet') {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tokens = estimateTokens(content);

  // 假设上下文包含该文件 (input) 和 AI 回复 (output, 约 30%)
  const inputTokens = tokens;
  const outputTokens = Math.ceil(tokens * 0.3);

  const cost = calculateCost(model, inputTokens, outputTokens);

  return {
    file: filePath,
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    cost,
    size: content.length
  };
}

/**
 * 获取成本等级
 */
function getCostLevel(cost) {
  for (const entry of Object.entries(COST_LEVELS)) {
    const level = entry[0];
    const config = entry[1];
    if (cost < config.threshold) {
      return { level, emoji: config.emoji, label: config.label };
    }
  }
  return { level: 'extreme', emoji: COST_LEVELS.extreme.emoji, label: COST_LEVELS.extreme.label };
}

/**
 * 分析目录下所有文件
 */
function analyzeDirectory(dir, extensions = ['.js', '.ts', '.jsx', '.tsx', '.md', '.json', '.java', '.py']) {
  const results = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // 跳过 node_modules 和隐藏目录
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          try {
            const result = analyzeFile(fullPath);
            results.push(result);
          } catch (e) {
            // 跳过无法读取的文件
          }
        }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * 生成优化建议
 */
function generateOptimizationSuggestions(results) {
  const suggestions = [];

  // 检查是否有大文件
  const largeFiles = results.filter(r => r.tokens.total > 5000);
  if (largeFiles.length > 0) {
    suggestions.push({
      type: 'split-large-files',
      priority: 'high',
      message: `发现 ${largeFiles.length} 个大文件 (>5000 tokens)`,
      detail: '建议拆分为更小的模块，减少上下文加载成本',
      files: largeFiles.map(f => ({ file: f.file, tokens: f.tokens.total }))
    });
  }

  // 检查总成本
  const totalCost = results.reduce((sum, r) => sum + r.cost.total, 0);
  if (totalCost > 1.00) {
    suggestions.push({
      type: 'use-repo-map',
      priority: 'high',
      message: '项目总成本较高',
      detail: '建议使用 /auto:update-codemaps 生成 REPO_MAP.md，AI 可通过符号地图快速定位代码',
      potential: '可节省 60-70% token'
    });
  }

  // 检查是否有很多测试文件
  const testFiles = results.filter(r => r.file.includes('.test.') || r.file.includes('.spec.'));
  if (testFiles.length > 5) {
    suggestions.push({
      type: 'test-summary',
      priority: 'medium',
      message: `发现 ${testFiles.length} 个测试文件`,
      detail: '在讨论测试时，提供测试摘要而非完整文件',
      potential: '可节省 40-50% token'
    });
  }

  // 模型建议
  const avgTokensPerFile = results.length > 0
    ? results.reduce((sum, r) => sum + r.tokens.total, 0) / results.length
    : 0;

  if (avgTokensPerFile < 1000) {
    suggestions.push({
      type: 'model-selection',
      priority: 'low',
      message: '文件较小，可考虑使用 Haiku',
      detail: '简单任务（格式化、注释生成）使用 Haiku 可节省 75% 成本'
    });
  }

  return suggestions;
}

/**
 * 格式化输出
 */
function formatOutput(results, model) {
  const totalTokens = results.reduce((sum, r) => sum + r.tokens.total, 0);
  const totalInputTokens = results.reduce((sum, r) => sum + r.tokens.input, 0);
  const totalOutputTokens = results.reduce((sum, r) => sum + r.tokens.output, 0);
  const totalCost = results.reduce((sum, r) => sum + r.cost.total, 0);
  const costLevel = getCostLevel(totalCost);
  const suggestions = generateOptimizationSuggestions(results);

  const lines = [
    '📊 Token 成本分析报告',
    '',
    `模型: ${model.replace('claude_', 'Claude ').toUpperCase()}`,
    `文件数: ${results.length}`,
    '',
    '## Token 统计',
    `  输入:  ${totalInputTokens.toLocaleString()} tokens`,
    `  输出:  ${totalOutputTokens.toLocaleString()} tokens`,
    `  总计:  ${totalTokens.toLocaleString()} tokens`,
    '',
    '## 成本估算 (单次加载)',
    `  ${costLevel.emoji} ${costLevel.label}: $${totalCost.toFixed(4)}`,
    '',
    '## 最昂贵的文件 (Top 10)',
  ];

  const topFiles = [...results].sort((a, b) => b.cost.total - a.cost.total).slice(0, 10);
  for (const file of topFiles) {
    const relativePath = path.relative(process.cwd(), file.file);
    const level = getCostLevel(file.cost.total);
    lines.push(`  ${level.emoji} $${file.cost.total.toFixed(4)}  (${file.tokens.total.toLocaleString()} tokens)  ${relativePath}`);
  }

  if (suggestions.length > 0) {
    lines.push('', '## 💡 优化建议');
    for (const suggestion of suggestions) {
      const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[suggestion.priority];
      lines.push(`  ${priorityEmoji} ${suggestion.message}`);
      if (suggestion.detail) {
        lines.push(`     → ${suggestion.detail}`);
      }
      if (suggestion.potential) {
        lines.push(`     💰 ${suggestion.potential}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';

  if (command === 'estimate') {
    // 手动估算: node cost-tracker.js estimate --input 10000 --output 5000
    let inputTokens = 0;
    let outputTokens = 0;
    let model = 'claude_sonnet';

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--input') inputTokens = parseInt(args[++i]);
      if (args[i] === '--output') outputTokens = parseInt(args[++i]);
      if (args[i] === '--model') model = args[++i];
    }

    if (!inputTokens || !outputTokens) {
      console.error('用法: node cost-tracker.js estimate --input <tokens> --output <tokens> [--model <model>]');
      process.exit(1);
    }

    const cost = calculateCost(model, inputTokens, outputTokens);
    const costLevel = getCostLevel(cost.total);

    console.log(`\n📊 成本估算 (${model.replace('claude_', 'Claude ').toUpperCase()})`);
    console.log(``);
    console.log(`输入:  ${inputTokens.toLocaleString()} tokens ≈ $${cost.input.toFixed(4)}`);
    console.log(`输出:  ${outputTokens.toLocaleString()} tokens ≈ $${cost.output.toFixed(4)}`);
    console.log(``);
    console.log(`${costLevel.emoji} 总计: $${cost.total.toFixed(4)} (${costLevel.label})`);

  } else if (command === 'budget') {
    // 预算计算: node cost-tracker.js budget --monthly 50
    let monthlyBudget = 50;
    let model = 'claude_sonnet';

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--monthly') monthlyBudget = parseFloat(args[++i]);
      if (args[i] === '--model') model = args[++i];
    }

    const pricing = PRICING[model];
    const avgCostPer1kTokens = (pricing.input + pricing.output * 0.3) / 1000;
    const estimatedRequests = Math.floor(monthlyBudget / avgCostPer1kTokens * 1000);

    console.log(`\n💰 月度预算分析`);
    console.log(``);
    console.log(`月度预算: $${monthlyBudget}`);
    console.log(`模型: ${model.replace('claude_', 'Claude ').toUpperCase()}`);
    console.log(``);
    console.log(`预估可用量:`);
    console.log(`  • 简单对话 (1k input, 500 output): ~${Math.floor(monthlyBudget / ((pricing.input * 1 + pricing.output * 0.5) / 1_000_000))} 次`);
    console.log(`  • 中等对话 (5k input, 2k output): ~${Math.floor(monthlyBudget / ((pricing.input * 5 + pricing.output * 2) / 1_000_000))} 次`);
    console.log(`  • 复杂对话 (20k input, 5k output): ~${Math.floor(monthlyBudget / ((pricing.input * 20 + pricing.output * 5) / 1_000_000))} 次`);
    console.log(``);
    console.log(`预警阈值 (80%): $${(monthlyBudget * 0.8).toFixed(2)}`);

  } else {
    // 分析目录: node cost-tracker.js analyze [dir]
    const targetDir = args[1] || 'src';
    const model = 'claude_sonnet';

    if (!fs.existsSync(targetDir)) {
      console.error(`目录不存在: ${targetDir}`);
      process.exit(1);
    }

    console.log(`🔍 扫描目录: ${targetDir}`);
    const results = analyzeDirectory(targetDir);
    console.log(`📄 找到 ${results.length} 个文件`);
    console.log(``);
    console.log(formatOutput(results, model));
  }
}

// 运行
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
                      import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
                      process.argv[1].endsWith('cost-tracker.js');

if (isMainModule) {
  main();
}

export { calculateCost, estimateTokens, analyzeFile, analyzeDirectory, generateOptimizationSuggestions };
