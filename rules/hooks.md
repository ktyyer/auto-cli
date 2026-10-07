---
name: hooks
description: Claude Code Hook 系统规范 — PreToolUse/PostToolUse/PreCompact 等事件钩子配置
paths: ['hooks/**/*', '.claude/settings.json', '.claude/hooks.json']
---

# Hook 系统

## Hook 类型

- **PreToolUse**: 工具执行前（验证、参数修改）
- **PostToolUse**: 工具执行后（只读检查、结果分析）
- **PostToolBatch**: 一批并行工具全部完成后（并行 Quest 聚合验证）
- **SubagentStop**: subagent 完成后（触发 LearnCard 写入提醒）
- **WorktreeCreate**: worktree 创建时（可阻止创建，任意非零 exit 即失败）
- **WorktreeRemove**: worktree 删除时（合并提醒）
- **PreCompact**: 上下文窗口压缩前（写入后续续接提醒）
- **PostCompact**: 上下文窗口压缩后（写入后续续接提醒）
- **SessionStart**: 会话冷启动时（注入项目知识 / 续接上次中断）
- **UserPromptSubmit**: 用户提交 prompt 时（输入安全检查）
- **TeammateIdle**: 多 Agent 团队中队友空闲时（任务分配提醒）
- **TaskCompleted**: 任务完成时（质量门禁）
- **Stop**: 会话结束时（最终验证）

## Exit Code 规范（关键）

| Exit Code      | 含义                                                        | 适用场景                   |
| -------------- | ----------------------------------------------------------- | -------------------------- |
| `0`            | 成功，宿主按事件处理 stdout JSON；stderr 只进入调试日志     | 正常放行或结构化决策       |
| `2`            | 按事件处理 stderr；PreToolUse 阻止工具执行，Stop 会继续会话 | 真实阻断，不能用于普通提醒 |
| 其他（含 `1`） | Hook 执行错误，通常不阻断工具；不是模型上下文通道           | 输入/执行失败              |

`exit 0` 配合 `permissionDecision: "deny"` 也能阻止 PreToolUse，不能把退出码与结构化决策混为一谈。普通提醒不请求权限、不改变控制流；快照失败属于保护前置条件失败，使用 `exit 2` 阻止该次编辑并说明原因。

| 事件                                | 本项目输出通道                                                     | 目的地与边界                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| PreToolUse / PostToolUse            | `hookSpecificOutput: { hookEventName, additionalContext }`，exit 0 | 模型上下文；PostToolUse 无法撤销已执行动作                                                                                  |
| SessionStart / UserPromptSubmit     | 同上                                                               | 模型上下文                                                                                                                  |
| Stop / TeammateIdle / TaskCompleted | `systemMessage`，exit 0                                            | 用户可见提醒；不承诺模型收到，不继续或阻断会话                                                                              |
| PreCompact / PostCompact            | 原子写 `.auto/hook-context.json`，无即时提醒输出                   | 在后续 SessionStart/UserPromptSubmit 读取并注入；PreCompact 的 `systemMessage` 被宿主丢弃，PostCompact 不支持模型上下文注入 |

输入取自官方 stdin JSON：`hook_event_name`、`cwd`、`tool_name`、`tool_input`、`tool_response`。不回显整个输入，不依赖 `CLAUDE_TOOL_OUTPUT`。Node helpers 是 hooks 工具链，使用 CommonJS `.cjs`，无需安装目录提供 package.json；命令使用 `${CLAUDE_PLUGIN_ROOT:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/auto-cli}/hooks/lib/`，仍需要 Bash 与 Node。

协议依据：[Claude Code hooks reference](https://code.claude.com/docs/en/hooks)，核对日期 2026-10-07。自动测试验证命令与 JSON 契约，不等于宿主实际加载或模型收到提醒；不同宿主版本支持的事件仍需单独验收。Codex 不运行这些 Claude hooks。

## 当前 Hook（在 hooks/hooks.json 中）

### PreToolUse

- **tmux 阻止**: 阻止在 tmux 外运行 dev server，确保日志可访问
- **tmux 提醒**: 为长时间运行的命令（npm, pnpm, yarn, cargo, pytest, vitest 等）建议使用 tmux
- **git push 审查**: 推送前提醒审查变更，不暂停、不阻断；命令位置匹配只是信号，不是完整 shell 解析器
- **文档阻止器**: 阻止创建不必要的 .md/.txt 文件（允许 README、CLAUDE、AGENTS、CONTRIBUTING 和 skills 目录下的 .md）
- **大文件警告**: 编辑超过 500 行的源码文件时警告，建议拆分为更小模块
- **TDD 守卫**: 编辑源码文件时检查对应测试文件，默认 `ask`，`AUTO_TDD_STRICT=true` 时 `deny`
- **自动快照**: Write/Edit 前，工作树已有 ≥ 3 个 dirty 文件（阈值不计 `.auto/`）时保存快照。逐文件统计未跟踪目录；使用隔离索引、原始文件字节与 Git 对象，保留 HEAD、暂存与未暂存内容、非忽略的未跟踪文件以及索引标志，支持 unborn 仓库与 linked worktree。原工作树、HEAD、index 均不修改。ref 为 `refs/auto-snapshots/<毫秒>-<随机UUID>`，通过 compare-and-swap 创建，拒绝覆盖旧 ref；真实 index 锁冲突或连续两次采样内容不一致时明确失败。

恢复方式：在原仓库内执行 `node "<宿主目录>/auto-cli/hooks/lib/snapshot.cjs" restore <ref> <新目录绝对路径>`。目标必须不存在、父目录已存在且位于源工作树外；恢复创建独立 Git 仓库并复制对象，随后可以检查 `git status`、`git diff`、`git diff --cached`，无需依赖原仓库存活。也可以执行 `snapshot.cjs create` 手动创建恢复点；这不是 stash 对象，**不要使用 `git stash apply`**。

范围与失败边界：Git 忽略文件、空目录、ACL/扩展属性与仓库配置本身不在快照内（仅保存影响基本文件比较的 core 配置）。sparse checkout、submodule、未合并索引、超过 64 MiB 的文件、非 UTF-8 文件名、不安全路径/文件类型会失败，不报已创建成功；恢复 symlink 需要系统权限。快照锁串行化 Git index 写入并检测工作文件变化，但不是文件系统全局冻结。恢复中断可能留下未完成的新目标目录，报错后应检查该目录，源工作树保持不动。Write/Edit matcher 不覆盖 Bash、外部编辑器或 formatter 的写入，不能作为完整变更审计日志。

### PostToolUse

- **PR 创建日志**: 创建 PR 后自动记录 URL 并提供 review 命令
- **只读 lint**: 编辑 JS/TS 文件后使用项目本地 Prettier `--check` 与 ESLint 检查，不下载工具、不自动格式化或 `--fix`，报告失败输出
- **TypeScript 检查**: 编辑 .ts/.tsx 文件后使用项目本地 tsc `--noEmit --incremental false`，报告整个检查失败输出。父级查找在 `dirname(dir) === dir` 时终止；单个检查超时 15 秒
- **console.log 警告**: 编辑文件后检查 console.log 语句并警告
- **频繁提交提醒**: 5+ 文件有未提交变更时提醒提交，鼓励频繁增量提交
- **覆盖率检查**: 从 `tool_response.stdout/stderr` 的 Istanbul/Vitest/Jest 或 pytest-cov 摘要提取真实报告值，低于 80% 时提醒；测试失败也能报告覆盖率，缺少可识别摘要则不捏造数值，覆盖率数值不能证明测试通过
- **增量 dirty 清单**: Write/Edit 源码后将文件路径追加到 `.auto/runs/<latest>/dirty.txt`，供 `incremental-review` skill 在会话末按需触发增量审查（仅累积不阻塞）

### PreCompact

- **续接提醒落盘**: 保存待续接提醒供后续支持上下文的事件读取；hook 无法获取或保存模型内存中的 Quest 进度，主流程仍须主动写 session-continuity.md

### PostCompact

- **后续上下文提醒**: 写入待续接提醒；由后续 SessionStart/UserPromptSubmit 提醒重读关键文件，不承诺 PostCompact 即时注入

### SessionStart

- **项目知识冷启动注入**: 新会话开始时提示 Read CLAUDE.md / `.auto/constitution.md` / 最新 run 的 session-continuity.md，零阻塞的项目上下文唤醒
- **旧 run 候选提示**: 只列出名称日期超过 30 天（可配置）的候选，不移动文件。旧 AUTO_CLEAN_DRY_RUN=false 也不会恢复移动；归档由授权主流程核对活动状态、依赖和目标路径后执行

### UserPromptSubmit

- **密钥泄露检测**: 检查用户输入中是否包含常见密钥模式（sk-\_、ghp\_\_、gho\__、glpat-_、xoxb-_、AKIA_），检测到时发出警告

### TeammateIdle

- **空闲队友提醒**: 根据官方 `teammate_name` 显示用户可见提醒；不会给 Team Lead 注入模型上下文或阻止队友空闲

### TaskCompleted

- **质量提醒**: 显示未提交变更提醒，exit 0，不阻止任务完成

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
