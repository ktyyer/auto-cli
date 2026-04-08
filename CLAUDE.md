# Auto CLI

> Claude Code `/auto` 超级命令。本仓库的目标是让 `/auto` 统一发现、推理、编排并复用各类能力。

## 定位

纯 Markdown 指令仓库，通过 Claude Code 的 slash command 机制运行。不包含 JS 运行时代码。

## 项目结构
- `commands/auto.md`：`/auto` 主命令，定义 6 PHASE 工作流
- `commands/auto/`：子命令（doctor、learn、status、route、create-hook）
- `agents/`：内置 agent 清单与说明
- `skills/`：可复用技能知识
- `rules/`：编码规范
- `hooks/`：默认 hooks 配置

## 架构约束
- `/auto` 是唯一编排入口，新增能力优先接入 auto.md，不新增平行入口。
- 文档必须以当前真实行为为准，不能承诺尚未实现的功能。
- PHASE 1 SCAN 默认只读；只有显式 `--fix` 才允许执行安全自动修复。
- 子命令是自包含的 Markdown 指令，不依赖外部 JS 运行时。

## 编码规范
- 修改 Markdown 文件时保持最小 diff。
- 不顺手重构与当前需求无关的内容。
- 不新增无根据的兜底或兼容说明。

## 验证
- 修改后运行 `npm run format:check` 确保格式一致。
- 修改子命令后检查内部引用是否一致。

## 安装与卸载
- `npm run install` — 复制 commands/agents/skills/hooks 到 ~/.claude/
- `npm run uninstall` — 移除已安装的文件
- `npm run sync` — 同上，install 的别名

## Git 与发布
- 提交信息遵循 conventional commits：`feat: ...` / `fix: ...` / `docs: ...`
- 仅在用户明确要求时提交 commit。

## AI 工作方式
- 先读相关文件再改，不猜实现。
- 多文件或有多种实现路径的任务先规划再动手。
- 对删除文件、git 提交等可见操作要谨慎，按用户请求范围执行。
- 如果发现文档与实际行为冲突，优先修文档到一致。

## 当前仓库高价值关注点
- `commands/auto.md` 是统一动作入口。
- 子命令 md 中的能力描述需要持续与实际行为同步。
- 包产物只保留当前需要的版本，旧 tgz 可在确认无用后删除。
