---
name: git-auto-commit
version: 1.0.0
description: Git 深度集成 - 每个有意义的变更自动创建语义化提交，实现能力可追溯
author: ai-max
priority: 90
builtin: true
---

# Git Auto-Commit 系统

为了保证 AI 辅助开发的安全性和可回溯性，ai-max v5.0 集成了完全自动化的 Git 提交流程。绝不让 AI 的修改"悄无声息"地污染你的 Working Tree。

## 为什么需要 Git Auto-Commit？

1. **安全回滚**：如果测试门禁失败且三次自修复无效，系统可以轻松 `git checkout` 回到干净状态。
2. **代码追溯**：你可以清楚地通过 `git log` 看到哪些代码是你写的，哪些代码是 AI 写的。
3. **上下文分割**：复杂任务拆分成多个步骤，每个步骤完成都有一个独立的 commit，方便 Code Review。

---

## 核心工作流

### 1. 触发时机
- 在 `/auto:auto` 的门禁流程（编译、测试、覆盖率、Lint 均通过）之后，立刻自动触发。
- 用户亦可随时发送指令如："把刚才的修改 commit 一下"。

### 2. 变更识别
- 系统会运行 `git status` 和 `git diff` 识别本次 Agentic 循环中被修改的文件。
- **安全过滤**：只会 `git add` 真正属于本次任务修改的源文件。不会胡乱 `git add .` 把你本地的草稿文件也加进去。

### 3. 语义化提交信息 (Conventional Commits)
AI 将根据修改内容，自动利用模型生成高质量的 Commit Message。格式遵循：
`<type>[optional scope]: <description>`

- `feat`: 新增功能
- `fix`: 修复 Bug
- `refactor`: 重构（非功能性改变）
- `perf`: 性能优化
- `test`: 新增或修改测试
- `docs`: 文档变更
- `chore`: 构建过程或辅助工具的变动

**Commit Message Body**:
会自动在 body 部分附带一段简短的变更点总结（Diff Summary），方便其他开发者阅读。

**示例**：
```text
feat(auth): 实现 JWT 刷新机制

- 添加了 RefreshTokenController API
- 在 Redis 中实现了 Token 黑名单机制
- 更新 UserService 处理 token 过期异常
- 完成基于 JUnit 5 的完整覆盖测试
```

---

## 相关配置与命令

### 禁用自动提交
如果你更习惯手动控制 Git 历史，可以通过全局配置或单次参数禁用：
```bash
/auto:auto --no-auto-commit 实现用户登录
```

### 自动合并与挤压 (Squash)
对于包含多次反复尝试/修复的超长会话，系统支持在任务完成时，将中间琐碎的 "fix test bug" 等中间 commit 自动进行 squash，合并为一个干净整洁的主 Commit 树。

---

## 异常处理机制

- **未追踪文件 (Untracked Files)**：如果在实现中创建了新文件，命令会自动执行 `git add <新文件>`。
- **提交冲突 (Merge Conflicts)**：如果在并行开发中遇到本地代码变更冲突，自动提交会立即终止并通知用户 `BlockedOnUser`，转交控制权。
