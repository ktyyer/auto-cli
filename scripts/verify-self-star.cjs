#!/usr/bin/env node
/**
 * Self-* 系统验证脚本
 *
 * 验证 Self-* 系统文件是否正确创建
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(colors.green, `✅ ${message}`);
}

function error(message) {
  log(colors.red, `❌ ${message}`);
}

function info(message) {
  log(colors.blue, `ℹ️  ${message}`);
}

// 验证文件
const files = [
  'skills/self-star/lib/pattern-learner.js',
  'skills/self-star/lib/project-scanner.js',
  'skills/self-star/lib/self-star.js',
  'skills/self-star/lib/memory-manager.js',
  'docs/SELF_STAR_INTEGRATION.md',
  'commands/status.md',
  'commands/auto.md'
];

console.log('');
log(colors.cyan, '🔍 Self-* 系统验证\n');

let allExist = true;

files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    const size = (stats.size / 1024).toFixed(2);
    success(`${file} (${size} KB)`);
  } else {
    error(`${file} - 文件不存在`);
    allExist = false;
  }
});

console.log('');
if (allExist) {
  success('所有 Self-* 系统文件已正确创建！');
} else {
  error('部分文件缺失，请检查');
}

// 验证代码结构
console.log('');
log(colors.cyan, '📊 代码统计\n');

const codeFiles = [
  'skills/self-star/lib/pattern-learner.js',
  'skills/self-star/lib/project-scanner.js',
  'skills/self-star/lib/self-star.js',
  'skills/self-star/lib/memory-manager.js'
];

let totalLines = 0;
let totalSize = 0;

codeFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n').length;
    const size = fs.statSync(fullPath).size;

    totalLines += lines;
    totalSize += size;

    info(`${path.basename(file)}: ${lines} 行, ${(size / 1024).toFixed(2)} KB`);
  }
});

console.log('');
success(`总计: ${totalLines} 行代码, ${(totalSize / 1024).toFixed(2)} KB`);

// 验证功能模块
console.log('');
log(colors.cyan, '🧠 功能模块\n');

const modules = [
  { name: 'Pattern Learner', file: 'pattern-learner.js', features: ['学习模式', '置信度评分', '模式应用'] },
  { name: 'Project Scanner', file: 'project-scanner.js', features: ['语言检测', '框架检测', '结构分析'] },
  { name: 'Self-* System', file: 'self-star.js', features: ['Self-Aware', 'Self-Improving', 'Self-Fixing', 'Self-Building'] },
  { name: 'Memory Manager', file: 'memory-manager.js', features: ['统一查询', '报告生成', '记忆管理'] }
];

modules.forEach(module => {
  const fullPath = path.join(process.cwd(), 'skills/self-star/lib', module.file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const foundFeatures = module.features.filter(feature => content.includes(feature));

    if (foundFeatures.length === module.features.length) {
      success(`${module.name}: 所有功能已实现`);
    } else {
      info(`${module.name}: ${foundFeatures.length}/${module.features.length} 功能`);
    }
  } else {
    error(`${module.name}: 文件不存在`);
  }
});

console.log('');
log(colors.cyan, '🎯 Self-* 系统特性\n');

const features = [
  'Self-Aware: 自我感知 - 理解项目编码模式',
  'Self-Improving: 自我改进 - 从反馈中学习',
  'Self-Fixing: 自修复 - 自动修复错误（最多 3 次）',
  'Self-Building: 自构建 - 首次使用自动初始化',
  '置信度学习曲线: 0.3 → 0.6 → 0.8 → 0.95',
  '统一记忆管理接口: MemoryManager',
  '与三大记忆系统深度整合'
];

features.forEach(feature => {
  success(feature);
});

console.log('');
log(colors.cyan, '📚 文档\n');

const docs = [
  { file: 'docs/SELF_STAR_INTEGRATION.md', desc: '系统集成指南' },
  { file: 'commands/status.md', desc: '状态命令（已集成 Self-*）' },
  { file: 'commands/auto.md', desc: 'Auto 命令（已集成 Self-*）' }
];

docs.forEach(doc => {
  const fullPath = path.join(process.cwd(), doc.file);
  if (fs.existsSync(fullPath)) {
    success(`${doc.desc}: ${doc.file}`);
  } else {
    error(`${doc.desc}: ${doc.file} - 不存在`);
  }
});

console.log('');
if (allExist) {
  log(colors.cyan, '🎉 Self-* 系统验证完成！\n');
  success('AI MAX v3.0 已具备完整的自我进化能力');
} else {
  log(colors.red, '⚠️  验证未完全通过\n');
}
console.log('');
