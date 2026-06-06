---
name: hooks
description: Claude Code Hook 系统规范 — PreToolUse/PostToolUse/PreCompact 等事件钩子配置
paths: ["hooks/**/*", ".claude/settings.json", ".claude/hooks.json"]
---

# Hook 系统

## Hook 类型

- **PreToolUse**: 工具执行前（验证、参数修改）
- **PostToolUse**: 工具执行后（自动格式化、检查、结果分析）
- **PostToolBatch**: 一批并行工具全部完成后（并行 Quest 聚合验证）
- **SubagentStop**: subagent 完成后（触发 LearnCard 写入提醒）
- **WorktreeCreate**: worktree 创建时（可阻止创建，任意非零 exit 即失败）
- **WorktreeRemove**: worktree 删除时（合并提醒）
- **PreCompact**: 上下文窗口压缩前（保存关键进度）
- **PostCompact**: 上下文窗口压缩后（重新注入关键上下文）
- **SessionStart**: 会话冷启动时（注入项目知识 / 续接上次中断）
- **UserPromptSubmit**: 用户提交 prompt 时（输入安全检查）
- **TeammateIdle**: 多 Agent 团队中队友空闲时（任务分配提醒）
- **TaskCompleted**: 任务完成时（质量门禁）
- **Stop**: 会话结束时（最终验证）

## Exit Code 规范（关键）

| Exit Code | 含义 | 适用场景 |
|-----------|------|---------|
| `0` | 成功，JSON 输出被处理 | 正常放行 |
| `2` | **硬阻断**，stderr 内容发送给 Claude | 强制阻止工具执行（TDD Guard、Doc 阻止器等）|
| 其他（含 `1`） | 非阻断，仅在 transcript 显示第一行 stderr | 警告提示，Claude 仍继续执行 |

> **关键规则**：`exit 1` **不会阻止工具执行**，只有 `exit 2` 才能真正阻断。所有需要强制拦截的场景必须用 `exit 2`。

## 当前 Hook（在 hooks/hooks.json 中）

### PreToolUse

- **tmux 阻止**: 阻止在 tmux 外运行 dev server，确保日志可访问
- **tmux 提醒**: 为长时间运行的命令（npm, pnpm, yarn, cargo, pytest, vitest 等）建议使用 tmux
- **git push 审查**: 推送前暂停以审查变更
- **文档阻止器**: 阻止创建不必要的 .md/.txt 文件（允许 README、CLAUDE、AGENTS、CONTRIBUTING 和 skills 目录下的 .md）
- **大文件警告**: 编辑超过 500 行的源码文件时警告，建议拆分为更小模块
- **TDD 守卫**: 强制测试驱动开发，编辑源码文件时检查是否存在对应的测试文件
- **自动快照**: 工作树已有 ≥ 3 个 dirty 文件时，Write/Edit 前用 `git stash create -u` 创建非破坏性快照，落 ref `refs/auto-snapshots/<ts>` 并记录到 `.auto/snapshots.log`，零工作树侵入。恢复：`git stash apply refs/auto-snapshots/<ts>`

### PostToolUse

- **PR 创建日志**: 创建 PR 后自动记录 URL 并提供 review 命令
- **Auto-lint-fix**: 编辑 JS/TS 文件后自动运行 Prettier 格式化 + ESLint --fix，报告剩余错误
- **TypeScript 检查**: 编辑 .ts/.tsx 文件后运行 tsc --noEmit，显示类型错误数和具体位置
- **console.log 警告**: 编辑文件后检查 console.log 语句并警告
- **频繁提交提醒**: 5+ 文件有未提交变更时提醒提交，鼓励频繁增量提交
- **覆盖率检查**: 测试运行后检查覆盖率，低于 80% 时发出警告
- **增量 dirty 清单**: Write/Edit 源码后将文件路径追加到 `.auto/runs/<latest>/dirty.txt`，供 `incremental-review` skill 在会话末按需触发增量审查（仅累积不阻塞）

### PreCompact

- **进度保存**: 上下文窗口压缩前提醒保存当前 Quest 进度到 `.auto/runs/<runId>/session-continuity.md`，确保中断可续接

### PostCompact

- **上下文重注入**: 上下文窗口压缩后提醒重新加载关键文件（CLAUDE.md、settings.json、最新 run 的 session-continuity.md），防止压缩丢失项目上下文

### SessionStart

- **项目知识冷启动注入**: 新会话开始时提示 Read CLAUDE.md / `.auto/constitution.md` / 最新 run 的 session-continuity.md，零阻塞的项目上下文唤醒

### UserPromptSubmit

- **密钥泄露检测**: 检查用户输入中是否包含常见密钥模式（sk-_、ghp\__、gho\__、glpat-_、xoxb-_、AKIA_），检测到时发出警告

### TeammateIdle

- **空闲队友提醒**: 多 Agent 团队中队友空闲时提醒 Team Lead 检查任务列表，建议分配新工作或发送 shutdown_request

### TaskCompleted

- **质量门禁**: 任务完成前检查是否存在未提交的变更，有未提交变更时阻止任务完成（exit 2 = reject）

### Stop

- **console.log 审计**: 会话结束前检查所有修改文件中的 console.log，提醒移除

## 自动接受权限

谨慎使用：

- 为可信的、明确定义的计划启用
- 探索性工作时禁用
- 绝不使用 dangerously-skip-permissions 标志
- 改用 `~/.claude.json` 中配置 `allowedTools`

## TodoWrite 最佳实践

使用 TodoWrite 工具来：

- 跟踪多步骤任务的进度
- 验证对指令的理解
- 启用实时调整
- 显示细粒度的实现步骤

Todo 列表可以揭示：

- 顺序错乱的步骤
- 遗漏的项目
- 额外不必要的项目
- 错误的粒度
- 误解的需求
