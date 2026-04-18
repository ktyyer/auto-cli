# REPO_MAP.md

> 2026-04-18 | Pure Markdown — 0 JS runtime | v0.32.0

## commands/

### commands/auto.md
`/auto` 主命令 — 6 PHASE 工作流（SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN）
4 种执行策略：探索 / 修复 / 实现 / 重构

### commands/auto/
- `create-hook.md` — 生成 Claude Code Hook 模板
- `doctor.md` — 环境诊断与 preflight 辅助信息
- `learn.md` — LearnCard 知识沉淀入口（统一输出到 insights / feedback）
- `route.md` — 输出标准 `RouteDecision` 的路由入口
- `status.md` — 查看 `.auto/` canonical 结构与能力安装状态

## agents/（11 个）

| Agent | 用途 |
|-------|------|
| `_shared-principles.md` | Agent 公共原则、协议对象与失败状态机 |
| `architect.md` | 系统设计、可扩展性、技术决策 |
| `build-error-resolver.md` | 构建和 TypeScript 错误修复 |
| `code-reviewer.md` | 代码审查 |
| `doc-updater.md` | 文档和代码地图更新 |
| `e2e-runner.md` | Playwright E2E 测试 |
| `quest-designer.md` | 输出标准 `QuestMap` 的闯关设计器 |
| `refactor-cleaner.md` | 死代码清理和整合 |
| `security-reviewer.md` | 安全漏洞检测和修复 |
| `tdd-guide.md` | 测试驱动开发 |
| `verification.md` | 输出标准 `VerifyReport` 的对抗性验证 |

## skills/（11 个）

| Skill | 用途 |
|-------|------|
| `code-style-enforcer.md` | 代码风格强制执行 |
| `dependency-analyzer.md` | 依赖分析 |
| `error-patterns.md` | 错误模式库 |
| `git-workflow.md` | Git 工作流规范 |
| `init-project.md` | 项目初始化 |
| `java-patterns.md` | Java/Spring Boot 编码模式 |
| `performance-patterns.md` | 性能优化模式 |
| `prd-writer.md` | PRD 需求文档写作（两阶段：概念版 → 落地板） |
| `skill-creator.md` | Skill 编写方法论（意图捕获 → SKILL.md 编写 → 测试迭代） |
| `systematic-debugging.md` | 系统化调试方法论（4 阶段强制流程） |
| `workflow-patterns.md` | 工作流模式 |

## hooks/

- `hooks.json` — 15 个 Hook 配置（PreToolUse/PostToolUse/PostCompaction/UserPromptSubmit/Stop 等）
- `lib/tdd-guard.js` — TDD 守卫逻辑
- `lib/tdd-guard-cli.js` — TDD 守卫 CLI 入口
- `lib/codemaps-hook.sh` — Codemaps 钩子脚本

## rules/

- `coding-style.md` — 编码风格规范
- `security.md` — 安全指南

## scripts/

- `install.js` / `install.sh` / `install.bat` — 安装脚本
- `uninstall.js` / `uninstall.bat` — 卸载脚本
- `reinstall.sh` / `reinstall.bat` — 一键重装

## .auto/

```text
.auto/
├── cache/
│   ├── capability-snapshot.json
│   └── pattern-cards.json
├── runs/
│   └── <runId>/
│       ├── route-decision.md
│       ├── quest-map.md
│       ├── quest-results.md
│       ├── verify-report.md
│       ├── learn-cards.md
│       ├── session-continuity.md (optional)
│       └── index.md
├── insights/
│   ├── traps.md
│   ├── patterns.md
│   ├── decisions.md
│   ├── prompts.md
│   └── agent-feedback.md
├── memory/
│   └── store.json
└── feedback/
    ├── agents.json
    └── skills.json
```

- `cache/` — 可丢弃缓存层，不作为长期知识真源
- `runs/` — 单次 `/auto` 工作流的协议对象落盘真源
- `runs/<runId>/session-continuity.md` — 当前 run 的结构化续接摘要（可选，仅在需续接时存在）
- `runs/<runId>/index.md` — 当前 run 的人类可读汇总与收尾摘要
- `insights/` — LearnCard 分类后的长期知识视图
- `memory/` — 项目级辅助记忆索引
- `feedback/` — agent / skill 路由反馈的结构化记录
- legacy 路径可继续读取，但新写入统一走 canonical 结构
