# REPO_MAP.md

> 2026-04-08 | Pure Markdown — 0 JS runtime | v0.30.0

## commands/

### commands/auto.md
`/auto` 主命令 — 6 PHASE 工作流（DISCOVER → REASON → EXECUTE → VERIFY → SUMMARIZE → LEARN）
四模式执行：探索 / 微型 / 轻量 / 完整

### commands/auto/
- `create-hook.md` — 生成 Claude Code Hook 模板
- `doctor.md` — 环境诊断（Node.js、Claude Code 配置、依赖状态）
- `learn.md` — 分析 Git 历史中的可复用模式
- `route.md` — Canonical Router 智能路由到最合适的 Agent
- `status.md` — 查看项目状态和能力安装情况

## agents/（11 个）

| Agent | 用途 |
|-------|------|
| `_shared-principles.md` | Agent 公共原则和交接协议 |
| `architect.md` | 系统设计、可扩展性、技术决策 |
| `build-error-resolver.md` | 构建和 TypeScript 错误修复 |
| `code-reviewer.md` | 代码审查 |
| `doc-updater.md` | 文档和代码地图更新 |
| `e2e-runner.md` | Playwright E2E 测试 |
| `quest-designer.md` | 闯关大纲设计 v4 |
| `refactor-cleaner.md` | 死代码清理和整合 |
| `security-reviewer.md` | 安全漏洞检测和修复 |
| `tdd-guide.md` | 测试驱动开发 |
| `verification.md` | 对抗性验证 |

## skills/（8 个）

| Skill | 用途 |
|-------|------|
| `code-style-enforcer.md` | 代码风格强制执行 |
| `dependency-analyzer.md` | 依赖分析 |
| `error-patterns.md` | 错误模式库 |
| `git-workflow.md` | Git 工作流规范 |
| `init-project.md` | 项目初始化 |
| `java-patterns.md` | Java/Spring Boot 编码模式 |
| `performance-patterns.md` | 性能优化模式 |
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

- `install.js` — 安装脚本
- `uninstall.js` — 卸载脚本
- `reinstall.sh` — 一键重装

## .auto/

- `cache/` — 能力快照缓存
- `insights/` — 知识沉淀（traps.md / patterns.md / decisions.md / prompts.md）

---
30 files | `auto codemaps`
