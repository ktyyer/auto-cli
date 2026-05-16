# REPO_MAP.md

> 2026-05-15 | Pure Markdown — 0 JS runtime | v0.40.0

**最新优化**（v0.40.0）:

- ✅ 集成 Claude 4.7 Extended Thinking（深度推理）
- ✅ 集成 Claude 4.7 Self-Verification（自我验证）
- ✅ 协议扩展：cost gate / Agent Preference Memory / interruptPoint / conditionalNext
- ✅ 新增 spec-driven Skill 与 /auto:dashboard 子命令
- ✅ 新增 PreCompact hook 与缓存重建脚本（rebuild:cache）
- 🎯 质量提升 +30%，错误率降低 -50%

## commands/

### commands/auto.md

`/auto` 主命令 — 6 PHASE 工作流（SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN）
4 种执行策略：探索 / 修复 / 实现 / 重构

### commands/auto/

- `dashboard.md` — 聚合 `.auto/runs/` 历史数据展示长期趋势
- `create-hook.md` — 生成 Claude Code Hook 模板
- `doctor.md` — 环境诊断与 preflight 辅助信息
- `learn.md` — LearnCard 知识沉淀入口（统一输出到 insights / feedback）
- `route.md` — 输出标准 `RouteDecision` 的路由入口
- `status.md` — 查看 `.auto/` canonical 结构与能力安装状态

## agents/（10 业务 Agent + 1 共享原则）

> `_shared-principles.md` 定义协议对象与公共原则，供其他 Agent 引用，不作为独立 Agent 调度。业务 Agent 共 10 个。

| Agent                     | 用途                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `_shared-principles.md`   | Agent 公共原则、协议对象与失败状态机（共享，非独立 Agent） |
| `architect.md`            | 系统设计、可扩展性、技术决策                               |
| `build-error-resolver.md` | 构建和 TypeScript 错误修复                                 |
| `code-reviewer.md`        | 代码审查                                                   |
| `doc-updater.md`          | 文档和代码地图更新                                         |
| `e2e-runner.md`           | Playwright E2E 测试                                        |
| `quest-designer.md`       | 输出标准 `QuestMap` 的闯关设计器                           |
| `refactor-cleaner.md`     | 死代码清理和整合                                           |
| `security-reviewer.md`    | 安全漏洞检测和修复                                         |
| `tdd-guide.md`            | 测试驱动开发                                               |
| `verification.md`         | 输出标准 `VerifyReport` 的对抗性验证                       |

## skills/（23 个）

| Skill                      | 用途                                                    |
| -------------------------- | ------------------------------------------------------- |
| `api-design.md`            | API 设计规范（RESTful、分页、错误码、OpenAPI）          |
| `code-analyzer.md`         | tree-sitter 驱动的代码分析（AST 提取、代码结构理解）    |
| `code-style-enforcer.md`   | 代码风格强制执行                                        |
| `comment-standards.md`     | 注释规范                                                |
| `dependency-analyzer.md`   | 依赖分析                                                |
| `error-patterns.md`        | 错误模式库                                              |
| `git-workflow.md`          | Git 工作流规范                                          |
| `init-project.md`          | 项目初始化                                              |
| `java-patterns.md`         | Java/Spring Boot 编码模式                               |
| `logging-patterns.md`      | 日志和可观测性模式                                      |
| `performance-patterns.md`  | 性能优化模式                                            |
| `prd-writer.md`            | PRD 需求文档写作（两阶段：概念版 → 落地板）             |
| `production-standards.md`  | 生产环境标准                                            |
| `refactoring-patterns.md`  | 安全重构方法论（测试保护网、分批策略、常见重构手法）    |
| `requirement-clarifier.md` | 需求澄清（模糊需求回问用户）                            |
| `research-analyst.md`      | 自主调研方法论（先调研再动手）                          |
| `robustness-patterns.md`   | 鲁棒性模式（重试、熔断、限流）                          |
| `skill-creator.md`         | Skill 编写方法论（意图捕获 → SKILL.md 编写 → 测试迭代） |
| `skill-evaluator.md`       | Skill 健康度评估（静态 D1-D7 + 效果 D8 双路径）         |
| `spec-driven.md`           | 规格驱动开发（需求 → 接口契约 → 可执行 acceptance）     |
| `systematic-debugging.md`  | 系统化调试方法论（4 阶段强制流程）                      |
| `test-plan-writer.md`      | 测试计划编写（6 维矩阵）                                |
| `workflow-patterns.md`     | 工作流模式                                              |

## hooks/

- `hooks.json` — 19 个 Hook 配置（PreToolUse 6 / PostToolUse 7 / PreCompact 1 / PostCompact 1 / UserPromptSubmit 1 / TeammateIdle 1 / TaskCompleted 1 / Stop 1）
- `lib/tdd-guard.js` — TDD 守卫逻辑
- `lib/tdd-guard-cli.js` — TDD 守卫 CLI 入口
- `lib/codemaps-hook.sh` — Codemaps 钩子脚本

## rules/

- `agents.md` — Agent 编排
- `coding-style.md` — 编码风格
- `commands.md` — Commands 编写规范
- `git-workflow.md` — Git 工作流
- `hooks.md` — Hook 系统
- `markdown-authoring.md` — Markdown 编写规范
- `performance.md` — 性能与设计模式
- `security.md` — 安全指南
- `testing.md` — 测试要求
- `version-and-release.md` — 版本与发布规范

## scripts/

- `install.js` / `install.sh` / `install.bat` — 安装脚本
- `uninstall.js` / `uninstall.bat` — 卸载脚本
- `reinstall.sh` / `reinstall.bat` — 一键重装
- `rebuild-skill-extracts.js` — 重建 `.auto/cache/skill-extracts/`
- `rebuild-insight-index.js` — 重建 `.auto/cache/insight-index.json`
- `validate-references.js` — Markdown 引用完整性校验
- `validate-run-completeness.js` — `.auto/runs/<runId>/` 基础闭环校验
- `validate-package-contents.js` — npm 分发包内 Codex 关键文件校验

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
