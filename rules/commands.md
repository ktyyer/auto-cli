---
name: commands
description: Claude Code slash command 编写规范 — frontmatter、自包含、引用校验
paths: ["commands/**/*.md", ".claude/commands/**/*.md"]
---

# Commands 编写规范

## 主命令

- `/auto` 是唯一编排入口（`commands/auto.md`），新增能力优先接入 auto.md，不新增平行入口
- 主命令定义 6 PHASE 工作流：SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN

## 子命令结构

- 位于 `commands/auto/` 目录，每个子命令一个 .md 文件
- 当前子命令：doctor、learn、status、route、create-hook、dashboard

## 子命令 frontmatter

```yaml
---
name: auto:<子命令名>
description: 一句话描述
---
```

## 子命令内容要求

- 自包含：所有指令写在单文件内，不依赖外部 JS 运行时
- 引用真实：引用的 Agent/Skill 必须在 agents/ 或 skills/ 中实际存在
- 引用一致：Agent 名、Skill 名与对应目录中的文件名一致

## 引用校验

修改子命令后必须检查：

- Agent 引用：`grep` agents/ 确认引用的 Agent 文件存在
- Skill 引用：`grep` skills/ 确认引用的 Skill 文件存在
- 内部链接：子命令间交叉引用路径正确
