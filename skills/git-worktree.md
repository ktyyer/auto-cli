---
name: git-worktree
description: Git Worktree 并行工作流 - 多工作区并行开发实践指南，配合 Claude Code 实现多 Agent 同时工作
version: 1.1.0
author: auto-cli
tags: [git, worktree, parallel, workflow, multi-agent]
---

# Git Worktree -- 快速参考

> 每个Worktree是独立工作区，让不同Agent在不同分支上同时工作，互不干扰。

## 核心命令

```bash
# 创建（基于已有分支）
git worktree add ../project-auth feature/auth

# 创建（基于新分支）
git worktree add -b feature/payment ../project-payment dev

# 查看
git worktree list

# 删除
git worktree remove ../project-auth

# 清理残留
git worktree prune
```

## 4 种并行场景

| 场景 | 说明 |
|------|------|
| 功能 + Hotfix 并行 | 主窗口开发功能，Worktree 紧急修 Bug |
| 多 Agent 并行开发 | 每个 Agent 独立 Worktree，各自提 PR |
| 对比方案实现 | 两个 Worktree 同时实现不同方案，完成后对比 |
| 代码审查隔离 | 独立 Worktree 审查 PR，不影响当前工作 |

## 最佳实践

1. 每个 Worktree 只有一个 Claude Code 实例（避免文件冲突）
2. 不同 Worktree 不修改相同文件（否则合并冲突）
3. 完成后立即 `git worktree remove` 清理
4. Worktree 放在同级目录（Windows 260 字符路径限制）

## 与 Auto CLI 集成

- Quest Map 15+ 关任务自动触发 Agent Teams，建议配合 Worktree 并行
- `skills/subagent-driven-development.md` 模式 2 和模式 4 可与 Worktree 结合
