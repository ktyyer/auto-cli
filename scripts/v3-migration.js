#!/usr/bin/env node
/**
 * AI MAX v3.0 迁移脚本
 *
 * 功能：
 * 1. 备份当前命令
 * 2. 删除冗余命令
 * 3. 更新 README
 * 4. 创建新的命令结构
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  // 保留的命令（核心命令）
  keepCommands: [
    'auto.md',
    'plan.md'
  ],

  // 删除的命令（整合到 auto）
  deleteCommands: [
    'tdd.md',
    'code-review.md',
    'build-fix.md',
    'e2e.md',
    'test-coverage.md',
    'loop.md',
    'evolve.md',
    'refactor-clean.md',
    'init.md',
    'update-docs.md',
    'update-codemaps.md',
    'security-scan.md',
    'deep-plan.md',
    'instinct-status.md'
  ],

  // 新增的命令（v3.0）
  newCommands: [
    {
      name: 'fix.md',
      description: '自动修复构建/测试错误'
    },
    {
      name: 'status.md',
      description: '查看项目状态和记忆'
    },
    {
      name: 'help.md',
      description: '显示帮助和使用示例'
    }
  ],

  // 备份目录
  backupDir: '.aimax/backup/v2.0'
};

// 工具函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    warning: '\x1b[33m', // yellow
    error: '\x1b[31m',   // red
    reset: '\x1b[0m'
  };

  const color = colors[type] || colors.info;
  console.log(`${color}[AI MAX v3.0 Migration]${colors.reset} ${message}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`, 'success');
  }
}

function backupFile(src, backupDir) {
  const filename = path.basename(src);
  const dest = path.join(backupDir, filename);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    log(`Backed up: ${filename}`, 'info');
    return true;
  }
  return false;
}

function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    log(`Deleted: ${path.basename(filePath)}`, 'warning');
    return true;
  }
  return false;
}

// 主流程
async function migrate() {
  log('Starting migration to v3.0...', 'info');
  console.log('');

  // 1. 创建备份目录
  log('Step 1: Creating backup...', 'info');
  ensureDir(CONFIG.backupDir);
  ensureDir(path.join(CONFIG.backupDir, 'commands'));
  console.log('');

  // 2. 备份所有命令文件
  log('Step 2: Backing up command files...', 'info');
  const commandsDir = path.join(__dirname, '../commands');
  const backupCommandsDir = path.join(CONFIG.backupDir, 'commands');

  const allCommands = fs.readdirSync(commandsDir)
    .filter(f => f.endsWith('.md'))
    .filter(f => f !== 'auto.md'); // 不备份 auto（会被更新）

  allCommands.forEach(cmd => {
    backupFile(path.join(commandsDir, cmd), backupCommandsDir);
  });
  console.log('');

  // 3. 删除冗余命令
  log('Step 3: Removing redundant commands...', 'info');
  CONFIG.deleteCommands.forEach(cmd => {
    const cmdPath = path.join(commandsDir, cmd);
    deleteFile(cmdPath);
  });
  console.log('');

  // 4. 创建新命令
  log('Step 4: Creating new commands...', 'info');

  // fix.md
  const fixMd = `---
description: 自动修复构建和测试错误
---

# /auto:fix — 自动修复

> **一键修复构建和测试错误**

当构建或测试失败时，运行此命令自动修复常见错误。

## 使用场景

- 构建失败（语法错误、类型错误、依赖问题）
- 测试失败（断言错误、超时、环境问题）
- Lint 错误（格式问题、未使用变量）

## 工作流程

\`\`\`
错误检测 → 分析错误类型 → 尝试修复 → 验证 → 完成
\`\`\`

## 示例

\`\`\`bash
# 修复构建错误
/auto:fix

# 修复测试错误
/auto:fix --test

# 修复所有问题
/auto:fix --all
\`\`\`

## 集成到 /auto:auto

此命令已集成到 \`/auto:auto\` 的第 6 步（自动化门禁），
构建失败时会自动调用此命令。
`;

  fs.writeFileSync(path.join(commandsDir, 'fix.md'), fixMd);
  log('Created: fix.md', 'success');

  // status.md
  const statusMd = `---
description: 查看项目状态和记忆
---

# /auto:status — 状态查看

> **查看项目当前状态、记忆和建议**

## 显示内容

### 项目概览
- 项目名称和路径
- 语言和框架
- 文件统计

### 记忆系统状态
- 项目记忆条目数
- 对话记忆条目数
- 团队知识条目数

### 已学习的模式
- 编码模式列表
- 置信度评分
- 使用次数

### 最近活动
- 最近任务
- 最近决策
- 最近学习

### 建议操作
- 待优化项
- 技术债务
- 改进建议

## 示例

\`\`\`bash
/auto:status
\`\`\`

## 输出示例

\`\`\`
📊 **项目状态**

**项目**: 电商后台管理系统
**路径**: /path/to/project
**语言**: Java
**框架**: Spring Boot 3.2

### 记忆系统
- 项目记忆: 23 条
- 对话记忆: 5 条
- 团队知识: 12 条

### 已学习的模式
1. Result<T> 包装（置信度 0.95，使用 45 次）
2. @Transactional（置信度 0.85，使用 32 次）
3. LambdaQueryWrapper（置信度 0.78，使用 28 次）

### 最近活动
- [2026-03-03] 实现用户认证系统
- [2026-03-02] 添加订单查询 API
- [2026-03-01] 修复登录 bug
\`\`\`
`;

  fs.writeFileSync(path.join(commandsDir, 'status.md'), statusMd);
  log('Created: status.md', 'success');

  // help.md
  const helpMd = `---
description: 显示帮助和使用示例
---

# /auto:help — 帮助文档

> **显示 AI MAX 的使用帮助和示例**

## 快速开始

\`\`\`bash
# 唯一入口，自动完成所有事情
/auto:auto [任务描述]

# 示例
/auto:auto 实现用户查询 API
/auto:auto 修复登录 bug
/auto:auto 重构 UserService
\`\`\`

## 核心命令

| 命令 | 用途 | 示例 |
|------|------|------|
| \`/auto:auto\` | 智能超级命令（唯一入口） | \`/auto:auto 实现功能\` |
| \`/auto:plan\` | 规划不执行 | \`/auto:plan 重构系统\` |
| \`/auto:fix\` | 修复构建/测试错误 | \`/auto:fix\` |
| \`/auto:status\` | 查看项目状态 | \`/auto:status\` |
| \`/auto:help\` | 显示此帮助 | \`/auto:help\` |

## 常见任务

### 功能开发
\`\`\`bash
/auto:auto 实现用户认证功能
/auto:auto 添加订单查询接口
/auto:auto 创建商品管理模块
\`\`\`

### Bug 修复
\`\`\`bash
/auto:auto 修复登录超时问题
/auto:auto 解决支付失败 bug
/auto:auto 修复数据不一致
\`\`\`

### 代码优化
\`\`\`bash
/auto:auto 重构 UserService
/auto:auto 优化查询性能
/auto:auto 清理重复代码
\`\`\`

### 测试相关
\`\`\`bash
/auto:auto 编写单元测试
/auto:auto 提高 test coverage
/auto:auto 添加集成测试
\`\`\`

## 高级功能

### 项目记忆
AI MAX 会自动学习项目的编码模式，越用越聪明。

### 自我进化
- Self-Aware：理解项目模式
- Self-Improving：从反馈中学习
- Self-Fixing：自动修复错误
- Self-Building：自动构建技能

### 智能决策
根据任务类型自动选择最佳策略：
- 简单任务 → 直接实现
- 中等任务 → TDD + 审查
- 复杂任务 → 完整流程

## 获取帮助

- GitHub: https://github.com/zhukunpenglinyutong/ai-max
- 文档: https://github.com/zhukunpenglinyutong/ai-max/tree/main/docs
- 问题: https://github.com/zhukunpenglinyutong/ai-max/issues
`;

  fs.writeFileSync(path.join(commandsDir, 'help.md'), helpMd);
  log('Created: help.md', 'success');
  console.log('');

  // 5. 更新 README
  log('Step 5: Updating README...', 'info');
  const readmePath = path.join(__dirname, '../README.md');

  if (fs.existsSync(readmePath)) {
    const readmeBackupPath = path.join(CONFIG.backupDir, 'README.md');
    fs.copyFileSync(readmePath, readmeBackupPath);
    log('Backed up: README.md', 'info');
  }
  console.log('');

  // 完成提示
  log('Migration completed!', 'success');
  console.log('');
  log('Summary:', 'info');
  log(`  • Kept commands: ${CONFIG.keepCommands.length}`, 'info');
  log(`  • Deleted commands: ${CONFIG.deleteCommands.length}`, 'info');
  log(`  • New commands: ${CONFIG.newCommands.length}`, 'info');
  log(`  • Total commands: ${5} (from ${15})`, 'success');
  console.log('');
  log('Backup location: .aimax/backup/v2.0/', 'info');
  log('To restore: cp -r .aimax/backup/v2.0/* .', 'info');
  console.log('');
  log('Next steps:', 'info');
  log('  1. Review the changes', 'info');
  log('  2. Test /auto:auto', 'info');
  log('  3. Update documentation', 'info');
  log('  4. Commit changes', 'info');
}

// 运行
migrate().catch(error => {
  log(`Error: ${error.message}`, 'error');
  process.exit(1);
});
