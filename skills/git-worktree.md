---
name: git-worktree
description: Git Worktree 并行工作流 - 多工作区并行开发实践指南，配合 Claude Code 实现多 Agent 同时工作
version: 1.0.0
author: auto-cli
tags: [git, worktree, parallel, workflow, multi-agent]
---

# Git Worktree -- 并行工作流指南

> 像包工头一样管理多个 AI。每个 Worktree 是一个独立工作区，
> 让不同 Agent 在不同分支上同时工作，互不干扰。

---

## 核心概念

Git Worktree 允许你同时检出多个分支到不同目录：

```
project/              # 主工作区（main/dev）
../project-auth/      # Worktree 1（feature/auth）
../project-payment/   # Worktree 2（feature/payment）
../project-hotfix/    # Worktree 3（hotfix/login-bug）
```

每个 Worktree 共享同一个 Git 仓库，但拥有独立的工作目录和索引。

---

## 快速开始

### 创建 Worktree

```bash
# 基于现有分支创建
git worktree add ../project-auth feature/auth

# 基于新分支创建
git worktree add -b feature/payment ../project-payment dev

# 查看所有 Worktree
git worktree list
```

### 删除 Worktree

```bash
# 先移除 Worktree
git worktree remove ../project-auth

# 清理已删除的 Worktree 记录
git worktree prune
```

---

## 4 种经典并行场景

### 场景 1：功能 + Hotfix 并行

```bash
# 主窗口：正在开发功能 A
# Worktree：紧急修复 Bug

git worktree add -b hotfix/login-bug ../hotfix main
cd ../hotfix
# 在新终端启动 Claude Code，修复 Bug
# 修复完成后合并回 main

git checkout main
git merge hotfix/login-bug
git worktree remove ../hotfix
```

**适用**：正在开发功能时突然需要修线上 Bug。

### 场景 2：多 Agent 并行开发

```bash
# Agent A：认证模块
git worktree add -b feature/auth ../work-auth dev

# Agent B：支付模块
git worktree add -b feature/payment ../work-payment dev

# Agent C：文档更新
git worktree add -b docs/api-docs ../work-docs dev

# 每个终端窗口启动一个 Claude Code 实例
# 各自独立工作，完成后各自提 PR
```

**适用**：Auto CLI Quest Map 中 15+ 关任务，Agent Teams 模式自动触发。

### 场景 3：对比方案实现

```bash
# 方案 A
git worktree add -b approach/redis ../approach-redis dev

# 方案 B
git worktree add -b approach/memcached ../approach-memcached dev

# 两个窗口同时实现，完成后对比
```

**适用**：技术选型时需要实际代码对比，而非纸上谈兵。

### 场景 4：代码审查隔离

```bash
# 在独立 Worktree 中审查 PR
git worktree add ../review-pr-123 pr/123
cd ../review-pr-123
# Claude Code 在独立环境中审查，不影响当前工作
```

---

## 最佳实践

### 1. 命名规范

| Worktree 目录 | 对应分支 | 用途 |
|--------------|---------|------|
| `../project-auth` | `feature/auth` | 功能开发 |
| `../project-hotfix` | `hotfix/xxx` | 紧急修复 |
| `../project-review` | `pr/123` | 代码审查 |
| `../project-docs` | `docs/xxx` | 文档更新 |

### 2. 并行规则

- **每个 Worktree 只有一个 Claude Code 实例**（避免文件冲突）
- **不同 Worktree 不修改相同文件**（否则合并冲突）
- **定期清理**：完成的 Worktree 立即删除（`git worktree remove`）
- **主工作区保持干净**：不要在主工作区同时开发多个功能

### 3. 与 Claude Code 配合

```bash
# 每个终端窗口启动一个 Claude Code
# 窗口 1（主工作区）：quest-designer 规划任务
# 窗口 2（worktree-auth）：tdd-guide 实现认证
# 窗口 3（worktree-payment）：实现支付

# 用 /auto:status 查看各工作区进度
```

### 4. 避免的坑

| 坑 | 说明 | 解决方案 |
|----|------|---------|
| 同一分支不能多次检出 | Git 不允许两个 Worktree 检出同一分支 | 每个功能用独立分支 |
| 残留 Worktree 记录 | 删除目录后未清理 | `git worktree prune` |
| 路径过深 | Windows 260 字符限制 | Worktree 放在同级目录 |
| 合并冲突 | 两个 Worktree 改了同一文件 | 规划时确保文件不重叠 |

---

## 与 Auto CLI 的集成

- **PHASE 3 EXECUTE**：15+ 关任务自动触发 Agent Teams，建议配合 Worktree 并行
- **skills/unified-memory-system.md 策略 7**：简要提及，本 Skill 是详细指南
- **skills/agentic-workflow-patterns.md 模式 4**：并行化模式可与 Worktree 结合
- **PHASE 6 LEARN**：并行开发经验沉淀到知识库

---

## 命令速查

```bash
# 创建
git worktree add <路径> <分支>
git worktree add -b <新分支> <路径> <基础分支>

# 查看
git worktree list

# 删除
git worktree remove <路径>

# 清理
git worktree prune

# 移动（Git 2.36+）
git worktree move <旧路径> <新路径>
```
