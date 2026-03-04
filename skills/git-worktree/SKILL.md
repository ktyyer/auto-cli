---
name: git-worktree
description: Git Worktree 并行 Agent 工作流 - 用隔离的 worktree 让多个 Claude 实例并行开发不同功能，互不干扰
version: 1.0.0
author: ai-max
tags: [git, worktree, parallel, multi-agent, productivity]
---

# Git Worktree 并行 Agent 工作流

> 打破单线程 AI 编码瓶颈 — 多 Agent 并行，各自独立，速度翻倍

## 核心理念

传统 AI 编码：AI 在主分支串行工作 → 每次任务都要等待 → 上下文相互污染

Git Worktree 模式：
- 每个功能/任务在独立 worktree 目录中运行
- 多个 Claude 实例并行工作，共享 `.git` 历史但隔离文件
- 最终合并最优结果

---

## 快速上手

### 1. 创建并行 Worktree

```bash
# 为新功能创建 worktree（自动创建并切换到新分支）
git worktree add ../my-project-feature-auth feature/auth
git worktree add ../my-project-feature-payment feature/payment
git worktree add ../my-project-bugfix-login hotfix/login-crash

# 查看所有 worktree
git worktree list
```

### 2. 在各 Worktree 独立运行 Claude

```bash
# 终端 1: 在 auth worktree 中运行 Claude
cd ../my-project-feature-auth
claude "实现 JWT 认证模块，包含注册、登录、刷新 token"

# 终端 2: 在 payment worktree 中并行运行 Claude  
cd ../my-project-feature-payment
claude "集成支付宝和微信支付，统一支付接口"

# 终端 3: 修复 bug（不阻塞功能开发）
cd ../my-project-bugfix-login
claude "修复登录失败后无法重试的问题"
```

### 3. 合并最优结果

```bash
# 回到主项目目录
cd ../my-project

# 审查各 worktree 的工作
git diff main feature/auth
git diff main feature/payment

# 合并到主分支
git merge feature/auth
git merge feature/payment

# 清理已完成的 worktree
git worktree remove ../my-project-feature-auth
git worktree prune
```

---

## 任务分配模式

### 功能并行模式

适合：同时开发多个独立功能

```
main
├── worktree: feature/user-auth      ← Claude Agent A
├── worktree: feature/order-system   ← Claude Agent B
└── worktree: feature/report-export  ← Claude Agent C
```

### 竞争模式（Ensemble）

适合：对同一个复杂问题获取多种实现，选最优

```
main
├── worktree: solution/approach-a    ← Claude Agent A（方案A）
├── worktree: solution/approach-b    ← Claude Agent B（方案B）
└── worktree: solution/approach-c    ← Claude Agent C（方案C）
# 人工审查后选择最优方案
```

### 分层模式

适合：前后端、微服务分离开发

```
main
├── worktree: feature/backend-api    ← Claude Agent A（后端 API）
├── worktree: feature/frontend-ui    ← Claude Agent B（前端页面）
└── worktree: feature/e2e-tests      ← Claude Agent C（E2E 测试）
```

---

## AI 在 Worktree 中的操作指南

### 开始新任务时

```markdown
## 工作区信息
- Worktree 路径: [当前目录]
- 任务分支: [git branch --show-current]
- 主分支: main
- 并行任务: [其他 worktree 正在做什么]

## 约束
- 只修改当前功能范围内的文件
- 不修改共享配置文件（pom.xml 除非必要）
- 每个功能提交独立、可回滚
```

### 提交规范

```bash
# Worktree 中使用约定式提交
git commit -m "feat(auth): 实现 JWT 令牌生成和验证"
git commit -m "feat(auth): 添加刷新令牌轮换机制"
git commit -m "test(auth): 添加认证模块单元测试"
```

---

## 常用命令速查

```bash
# 列出所有 worktree
git worktree list

# 创建 worktree（从现有分支）
git worktree add <路径> <已存在的分支>

# 创建 worktree（新建分支）
git worktree add -b <新分支名> <路径>

# 移除 worktree（先确认已合并）
git worktree remove <路径>

# 清理无效 worktree 记录
git worktree prune

# 锁定 worktree（防止误删）
git worktree lock <路径>
```

---

## 与 /aimax:loop 协作

每个 Worktree 可以独立运行状态机：

```bash
# worktree A 中
/aimax:loop init "实现用户认证模块"
/aimax:loop next

# worktree B 中（独立的状态文件）
/aimax:loop init "实现订单系统"
/aimax:loop next
```

> 每个 worktree 有独立的 `.aimax/state/` 目录，状态互不干扰。

---

## 最佳实践

1. **命名规范**: worktree 目录放在主项目目录同级，命名 `<项目名>-<功能>`
2. **时长控制**: 每个 worktree 任务不超过 1 天，避免长期分叉
3. **频繁同步**: 每天 `git fetch origin && git rebase main` 避免大量冲突
4. **独立测试**: 每个 worktree 运行自己的测试套件再合并
5. **清理习惯**: 合并后立即 `git worktree remove` 保持整洁

---

## 开源借鉴

- **Kilo AI Agent Manager** — 并行 Agent + Git Worktree 隔离
- **Kilo Ensemble Mode** — 多模型并行 + 审查模型合并
- **Claude Code 官方文档** — Worktree 并行开发最佳实践（2026）
