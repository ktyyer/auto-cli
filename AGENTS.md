# Auto CLI For Codex

本文件是 Codex 侧的全局桥接层，目的是让用户在 Codex 中输入 `/prompts:auto` 或 `/auto` 时，行为尽量接近 Claude Code 中的 `/auto`。

## 入口识别

以下输入都视为已经调用 Auto CLI 主入口，而不是普通聊天文本：

- `/prompts:auto <任务>`
- `/auto <任务>`
- 单独一行 `/prompts:auto`
- 单独一行 `/auto`

如果用户以这些前缀发起任务：

1. 去掉命令前缀，把剩余文本视为真实任务
2. 将本轮任务按 Auto CLI 工作流处理，而不是普通问答或普通 review
3. 优先遵循当前工作区中的 `commands/auto.codex.md` 规则（若存在）
4. 若当前项目存在 `CLAUDE.md`、`REPO_MAP.md`、`.auto/cache/capability-snapshot.json`、`commands/`、`skills/`，先读取这些能力索引，再形成 RouteDecision

## 行为要求

当命中 `/prompts:auto` 或 `/auto`：

1. 必须先形成 `RouteDecision`
2. 必须先形成 `Plan`
3. 完成最小 preflight 后，第一条 commentary 必须直接向用户展示简版 `## RouteDecision` 和 `## Plan`
4. 然后再执行更深的检查、修改、验证
5. 若项目存在 `.auto/`，必须写 run 工件
6. 第一条完整结果必须采用以下骨架：

```markdown
## RouteDecision

## Plan

## Execution / Findings

## Verify

## Learn
```

不要因为用户输入很短，例如“确认本地修改是否没有问题”，就退化成普通评审；也不要先发“我先去检查一下”的普通 commentary，再在后文补规划。

## 真源说明

Auto CLI 在 Codex 中的详细规则以仓库内 `commands/auto.codex.md` 为准；本文件只负责保证入口被真正接管。

## Context

本仓库是纯 Markdown 指令仓库，通过 Claude Code / Codex slash command 机制运行。

- `commands/` — slash command 入口，`/auto` 是唯一编排入口
- `skills/` — 可复用技能知识，新能力优先落地为 skill
- `agents/` — Claude Code Agent 定义（Codex 不支持，忽略）
- `hooks/` — Claude Code 自动化 hook（Codex 不支持，忽略）
- `.auto/` — 运行产物真源（runs / insights / feedback / cache）

当前版本 `v0.45.0`，32 个 skill，15 个 VERIFY gate。

## Avoid

- 不新增并列 slash command 入口（如 `/goal`、`/workflow`），所有能力通过 `/auto` 编排
- 不引入 JS/Node 运行时代码，本项目是纯 Markdown 指令仓库
- 不修改 `agents/` 目录（Codex 不使用 agent 文件）
- 不承诺文档中尚未实现的功能
- 修改 `.md` 文件时保持最小 diff，不顺手重构无关内容
