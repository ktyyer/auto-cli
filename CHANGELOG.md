# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.52.0] - 2026-06-28

### Added

- **loop-engineering skill（/auto 自主循环引擎）**：把 `/auto` 从单次 6 PHASE 流水线升级为按 interval 参数触发的 DOER+CHECKER 自主循环，保持 `/auto` 单一超级入口
  - 新增 `skills/loop-engineering/SKILL.md`：interval 参数契约（`5m`/`30m`/`2h`，缺省 10m，上限 72h）、三种 loop 模式（固定间隔巡检 / 目标收敛 / 持续维持）、DOER+CHECKER 分离、调度机制映射（`ScheduleWakeup` 会话内动态 / `CronCreate` 跨会话持久）、收敛判据硬门禁、跨迭代学习回灌、生产级防护（budget / commit-before-loop / 退化检测 / 撞峰偏移）
  - 理论依据：2026 loop engineering 范式（Boris Cherny "My job is to write loops" + Addy Osmani 命名）+ Anthropic 官方 DOER/CHECKER 模型 + Ralph Loop（Stop Hook + Completion-Promise）+ Agent SDK budget caps（max_turns/max_budget_usd）+ 非退化性收敛
  - `commands/auto.md`：执行策略表后新增「Loop 模式（正交于策略）」节；SCAN 新增 1.8 Loop 参数解析（模式判定 + loopBudgets + 调度选择 + 收敛判据硬门禁）；兜底索引加 `loop-engineering` 触发项；LEARN 新增 6.6 跨迭代回灌
  - `commands/auto.codex.md`：双端对齐 —— Codex 无原生 ScheduleWakeup/CronCreate，降级为外部 `cron`/`schtasks`/`at` 或人手触发，**严禁伪造后台运行**；CHECKER / 预算 / 跨迭代逻辑两端一致
  - RouteDecision 新增 `loopBudgets`：maxIterations 20 / maxBudgetUsd 10 / maxWallClock 72h / noProgressLimit 3
  - 语义自动触发（无需 interval 参数）：SCAN 1.8 识别持续型（盯盘/巡检/持续/守住/保持/自主/自愈）与收敛型（直到/达到/提到/降到/收敛 + 可度量目标）语义即自动开 loop，默认 10m；收敛型关键词由「无 CHECKER 不开 loop」硬门禁过滤误命中
  - 核心约束：**写不出可度量收敛判据（退出码/正则/数值阈值）不开 loop** —— CHECKER 缺位的 loop = 烧钱机器（2026 社区数据：过夜自主产出约 25% 被丢弃，根因是 CHECKER 缺位）

### Fixed

- skill 计数长期滞后：`predict-verify` 已在盘但未入 README 表，本次顺带补入；磁盘实测 38 个 skill，全链路计数统一（README / AGENTS.md / marketplace.json / `_shared-principles.md` 示例 36 → 38）
- 版本号同步：package.json / package-lock.json / plugin.json / README 双语徽章 / REPO_MAP 头部 0.51.0 → 0.52.0

## [0.51.0] - 2026-06-13

### Added

- **自动 run 清理机制**：SessionStart Hook 自动归档超过 30 天（可配置）的历史 run，保持 SCAN 性能
  - 新增 `hooks/lib/auto-clean-runs.sh` 脚本，**跨平台兼容**（支持 Linux/macOS/Windows Git Bash/Node.js/Python 降级）
  - 支持环境变量配置 (`AUTO_CLEAN_RETENTION_DAYS`, `AUTO_CLEAN_DRY_RUN`)
  - `hooks/hooks.json` SessionStart Hook 集成自动清理逻辑（< 50ms 开销）
  - `commands/auto.md` PHASE 6.4 补充配置说明、手动触发和恢复方式
  - `commands/auto.codex.md` LEARN 章节同步更新（标注 Codex 暂无 Hook，可手动触发）
  - `rules/hooks.md` SessionStart 章节补充自动清理条目

### Fixed

- **community README 说明**：顶部显式声明 `community/` 是组织目录（非 skill），避免计数困惑
- **validate-references.js 白名单**：新增下沉实现 skill 白名单（`knowledge-management`, `quality-gates`），消除假阳性警告

## [0.50.0] - 2026-06-13

> 全仓自上而下审计修复（27 项），审计清单见 `.auto/runs/run-20260613-top-down-audit/index.md`。

### Added

- **Codex 双端对齐**（`commands/auto.codex.md`）：补齐 constitution 硬约束（SCAN 读取 + VERIFY gate）、self-critique（每关达成度 < 70 回流 + gate）、VERIFY 补 coverage / security / self-verification gate + adversarial 降级模式（同窗口红蓝分段对抗，`degraded: no-isolation`）、LEARN 反馈真实化（usageCount/totalCalls/successRate/stale）、Curator 完整化（矛盾检测 + helpful/harmful 计数）、Run 归档、Claude 端机制降级说明（Extended Thinking / Skill 分层）、探索策略双端分歧显式声明为设计决策
- **learn.codex.md 对齐**：LearnCard 补 `scope` 必填字段、参数表补全（--decay / --commit-count / -d,--dir）、新增 Session Continuity 与 Portable Patterns 冷启动导入章节、Curator helpful 计数
- **激活摘要补齐**：`knowledge-management` + `quality-gates` 两个 skill 补 `## 激活摘要` 段落（三级激活协议要求）
- **CHANGELOG 补史**：补回缺失的 0.46.0 / 0.47.0 条目

### Fixed

- 版本与计数滞后：README.md 徽章 0.48.0 → 0.50.0、README.en.md 徽章 0.45.0 → 0.50.0 + "33 Skills" → 36（补 feedback-loop / agentless-repair / plan-ensemble 三行）、`.claude-plugin/plugin.json` 0.41.0 → 0.50.0、`marketplace.json` 计数刷新（36 skills / 22 hooks）、REPO_MAP.md 头部 v0.40.0 → v0.50.0、`rules/commands.md` 子命令清单补 dashboard、CLAUDE.md C3 条目 11 → 10 agents
- 幽灵引用清除：`doctor.md` 的 `auto install` → `npm run sync`、`RepoIndexer` → AI 按模板生成；`skills/community/README.md` 改为明示"机制开发中"（原文承诺的 SCAN 自动发现 / validate 校验链路实际未接通）+ 修复失效链接；README 中/英 FAQ 贡献流程同步修正
- `.auto/` 结构口径统一：以 auto.md 五层为准，`status.md` 移除虚构的 `memory/store.json`，README 结构图补 `memory/` 层
- `create-hook.md` Hook 类型表补列 SessionStart
- `agents/quest-designer.md` 瘦身 464 → 440 行（恢复 < 450 约束），并修复尾部游离代码围栏导致"质量底线"章节被错误包进代码块的渲染 bug
- 删除根目录残留的 `auto-cli-0.47.0.tgz`
- 移除无出处的量化声明（README 中英双语 + auto.codex.md）："减幻觉 40-60%" / "平均多保留 80% 已完成工作" / "省 40-60% token" 改为定性描述；"节省 80%+ 上下文" 标注为"最高"并附估算依据（摘要级 ~500 vs 深度级 ~5000 tokens）

## [0.49.0] - 2026-06-13

### Added

- **plan-ensemble skill**（`skills/plan-ensemble/SKILL.md`）：视角集成规划 — PLAN 阶段对高复杂度任务并行派出 2-3 个异质视角只读 subagent，隔离出计划草案（≤30 行/个，零共享上下文防锚定），分歧点清单（直接喂 QuestMap.pitfalls）+ 四维评分矩阵（目标契合/风险/成本/可演进）合成唯一 QuestMap。触发门槛：策略=重构 / 实现+复杂度 high / brainstorming 后 trade-off 不明 / 用户显式要求；上下文红区一票否决。理论依据：多 agent 辩论评审（NeurIPS 2025, arXiv:2510.12697）、视角多样性决定收益（ChatEval）、一轮异质出案即获大部分收益（ACL 2026 受控研究）；隔离发散借鉴 ADHD skill

### Changed

- `skills/brainstorming/SKILL.md`：新增「与 plan-ensemble 的升级路由」— 方案列举后 trade-off 仍不明朗时升级而非强行让用户选（激活摘要 checklist 同步加一行，保证摘要级激活可见）
- `commands/auto.md`：兜底索引表 + PHASE 2.6 视角集成升级注记
- `commands/auto.codex.md`：高频硬规则同步（含 Codex 无 subagent 时的 `degraded: no-isolation` 降级模式）
- `README.md`：Skill 清单新增 plan-ensemble，计数修正为实际 36（旧"36"虚高一位）；`AGENTS.md` 版本行刷新至 v0.49.0 / 36 skill / 16 gate

### Fixed

- `scripts/manifest.js`：补齐 v0.43 起遗漏的 9 个 skill（constitution / incremental-review / self-critique / quality-gates / knowledge-management / protocol-validator / feedback-loop / agentless-repair / plan-ensemble）到 `CODEX_SKILL_DIRS` 与 `MANAGED_FILES`，修复 uninstall 在 `~/.claude/skills` 与 `~/.codex/skills` 留孤儿文件的问题

## [0.48.0] - 2026-06-13

### Added

- **ACE Curator**（`knowledge-management` skill）：LearnCard 分发前强制 Curator 检查 — 查重（同主题 merge 而非 append）、矛盾检测（旧条目标 `superseded`，不静默并存）、merge-or-append 决策。来源 ACE（ICLR 2026, arXiv:2510.04618）
- **Insight 复用计数**（`knowledge-management` skill）：被注入的 insight 按复用结果维护 `helpful/harmful/lastConfirmed` 计数行；`harmful ≥ 2 且 > helpful` 标记排除；`lastConfirmed` 作为 `--decay` age-prune 的命中时间依据
- **AWM 工作流归纳**（`/auto:learn --workflows`）：≥ 3 个同策略且 VERIFY pass 的 run 中归纳子任务粒度（2-4 关）的可复用 Quest 序列模板，产出 `LearnCard(category=pattern, tags 含 workflow)` 进入 patterns.md，经 knowledgeHints 在 PLAN 拆关时复用。来源 AWM（ICML 2025, arXiv:2409.07429）
- **触发率评估**（`skill-evaluator` skill）：正例 8-12 条 + 反例 4-6 条触发语料，60/40 train/test 切分，量化 D2 评分并写回 `trigger_accuracy`；对抗 skill debt（SoK arXiv:2602.20867 实测无验证自生成 skill -1.3pp）

### Changed

- `commands/auto.md` PHASE 6.1：分发前 Curator 检查纳入高层流程
- `commands/auto/learn.md`：参数表补全 `--decay`（文内已用但漏列）+ 新增 `--workflows`
- `commands/auto.codex.md` / `commands/auto/learn.codex.md`：与 Claude 端等价同步

## [0.47.0] - 2026-06-08

### Added

- **feedback-loop skill**（`skills/feedback-loop/SKILL.md`）：I/O 系统自验证闭环，融合 SWE-agent ACI / Reflexion / 非退化性理论，含生产级退化防护，覆盖 bot / daemon / 消息队列 / CLI 工具等无 UI 系统
- **agentless-repair skill**（`skills/agentless-repair/SKILL.md`）：两阶段 Bug 修复流水线（分层定位 + 多候选过滤），来源 Agentless 论文（arXiv:2407.01489）

### Changed

- `refactoring-patterns` 追加维度驱动收敛节
- `auto.md` + `auto.codex.md` + README 同步更新；skills 计数随新增刷新

## [0.46.0] - 2026-06-06

### Added

- **production-governance skill**（`skills/production-governance/SKILL.md`）：第 15 个 VERIFY gate，覆盖目标收敛 / 产物真源 / run 状态 / 成本质量 / skill 健康度
- `/auto:status` 增加治理状态字段
- `skill-evaluator` 增加 `evidence_missing_count` / `governance_fail_count` 反馈信号

### Changed

- 安全敏感路由硬约束补齐（安全敏感任务不得因 successRate 排除 `security-reviewer`）

## [0.45.0] - 2026-05-27

### Added

- **探索快速通道**：分析/咨询类任务跳过全部协议开销（QuestMap/QuestResult/VerifyReport/SUMMARIZE），SCAN 后直接回答 + 可选 LEARN
- **Skill 分层机制**：核心层（8 个活跃 skill 正常扫描）vs 储备层（21 个零使用 skill 跳过 frontmatter），自动升降（连续 10 run 未激活降级，激活 1 次升级）
- **`quality-gates` skill**：14 个 VERIFY Gate 完整定义从 auto.md 提取为独立 skill，含 Phase 交接自检原则表
- **`knowledge-management` skill**：LEARN Phase 全流程从 auto.md 提取为独立 skill（蒸馏原则 / 分发 / feedback 真实化 / Session Continuity / Run 归档）
- **Run 归档机制**：运行超过 30 天的 run 移入 `.auto/runs/archive/`，SCAN 预匹配只扫描未归档 run
- **Constitution enforcement clause**：SCAN 显式声明"PLAN/EXECUTE/VERIFY 违反即 VERIFY fail"

### Changed

- **auto.md 精简**：1007 行 → 499 行（细节下沉到 quality-gates + knowledge-management 两个 skill）
- **知识注入简化**：移除 `[insight:]` 格式标记要求（实践证明 0% 遵守率），改为自动注入 `RouteDecision.notes.relevantInsights`
- **Feedback 真实化**：每次 run 结束后必须更新 agents.json / skills.json（totalCalls/usageCount/lastUsed/successRate），>30 天未更新标记 `stale`
- **PLAN 章节重编号**：修复原版双 2.4 编号碰撞（假设声明 → 2.4，推理摘要 → 2.5，Quest 设计 → 2.6，Micro QuestMap → 2.7）
- **策略表与快速通道一致性**：探索策略表更新为引用 1.3 快速通道，消除原有矛盾

### Fixed

- **调研前置断档**：补回 research-analyst 先产出 research-brief.md 再进 quest-designer 的操作指令
- **反馈叠加 + 置信度规则缺失**：PLAN 2.1 补回 agents.json preferences 注入 Quest 设计约束 + confidence=low 过滤
- **备选 Skill 级别缺失**：PLAN 2.2 补回匹配度 1-2 的备选 Skill 行为说明
- **模型容量探测方式缺失**：SCAN 1.5 补回通过已知特征推断窗口容量的方法

### Technical Details

- 纯 Markdown 变更，无运行时依赖
- format:check 通过，validate:references 通过
- Skill 总数 29 → 31

## [0.32.0] - 2026-04-18

### Added

- **prd-writer skill**：PRD 需求文档写作（两阶段：概念版 → 落地版）
- **systematic-debugging skill**：集成 obra/superpowers 官方源的系统化调试方法论（4 阶段强制流程）
- **skill-evaluator skill**：Skill 健康度评估（静态 D1-D7 + 效果 D8 双路径，结构分主 agent + 效果分 verification 子 agent）
- **Windows 安装脚本**：`install.bat`、`reinstall.bat`、`uninstall.bat` 一键化脚本
- **CI 强化**：新增引用完整性校验（`scripts/validate-references.js`）与发布工作流

### Changed

- **对外叙事对齐**：README 的"四级执行模式"（文件数硬编码）更新为"四种执行策略"（探索/修复/实现/重构），与 `commands/auto.md` 真源一致
- **仓库卫生**：清理 `skills/` 下 12 个空子目录与 `docs/`、`examples/`、`lib/` 空目录
- **canonical 结构补齐**：`.auto/` 显式提供 `runs/` 与 `feedback/` 目录
- **REPO_MAP 同步**：Hook 数量修正为 17，Rules 列出全部 10 个文件

### Fixed

- **彻底卸载**：`scripts/uninstall.js` 补齐清单，确保不留孤儿文件
- **CI 工作流**：修复纯 Markdown 项目的 CI 适配问题
- **frontmatter 补全**：规范化 commands 和 skills 的引用与 frontmatter

### Technical Details

- 纯 Markdown 变更，无运行时依赖
- format:check 通过，validate:references 通过（仅孤立警告）

## [0.31.0] - 2026-04-08

### Changed

- **Phase-Skill 自动映射**：auto.md PHASE 2 新增 2.2a 映射表，6 个 Phase 各自绑定最优 Skill
- **Agent 反馈闭环**：auto.md PHASE 6 新增 6.5 反馈记录，路由结果写入 `.auto/insights/agent-feedback.md`
- **REPO_MAP.md 重写**：移除过时的 src/ 引用，更新为当前纯 Markdown 结构（30 files）
- **README 更新**：定位描述改为"纯 Markdown 智能开发辅助工具"，Hooks 数量修正为 17

### Technical Details

- 纯 Markdown 变更，无运行时依赖
- format:check 通过

## [0.25.0] - 2026-03-29

### Changed

- **Commands 精简**：7 -> 6（合并 `skill-create` 到 `learn`）
  - `/auto:learn` 现在支持双模式：会话级提取 + Git 历史分析
  - 减少维护负担，统一知识提取入口
- **Skills 精简**：5 -> 4（合并 `self-review` 到 `workflow-patterns`）
  - `workflow-patterns` 现在包含 10 维度代码审查清单
  - 更全面的工作流和代码质量指导
- **Rules 精简**：8 -> 7（合并 `patterns` 到 `performance`）
  - `performance.md` 现在包含常用设计模式
  - 更名为"性能与设计模式"，内容更全面

### Removed

- commands/skill-create.md（功能已合并到 learn.md）
- skills/self-review.md（审查清单已合并到 workflow-patterns.md）
- rules/patterns.md（设计模式已合并到 performance.md）

### Improved

- `commands/learn.md` 增强为双模式提取工具
  - 模式 1：从当前会话提取编码模式
  - 模式 2：从 Git 历史分析项目规范
- `skills/workflow-patterns.md` 新增 10 维度代码审查清单
  - 功能正确性、错误处理、安全性、性能、代码风格
  - 测试覆盖、接口兼容性、可维护性、文档、Git 规范
- `rules/performance.md` 新增常用设计模式
  - API 响应格式、仓储模式、自定义 Hook 模式

### Technical Details

- 无破坏性变更（仅合并和删除冗余文件）
- 测试全部通过（247 个）
- 项目复杂度降低约 15-20%
- 核心功能完整保留

## [0.24.0] - 2026-03-29

### Changed

- **项目定位精简**：聚焦"智能超级命令"核心定位
- **Skills 精简**：7 -> 5（移除 `backend-patterns`, `frontend-patterns`）
  - 原因：通用代码示例与"超级开发辅助工具"定位不符
  - 用户项目应该有自己的 CLAUDE.md 定义编码规范
- **COMPONENTS 清理**：6 -> 5（移除冗余 `knowledge` 定义）
  - `skills` 组件使用 `recursive: true` 已覆盖整个 skills 目录
  - 避免组件功能重复
- **doctor.md 诊断阈值**：Skills 检查从 `>= 7` 调整为 `>= 5`

### Removed

- skills/backend-patterns.md（通用后端代码示例）
- skills/frontend-patterns.md（通用前端代码示例）
- src/utils.js 中的 `knowledge` 组件定义

### Fixed

- 修正 tests/utils.test.js 组件数量断言（6 -> 5）
- 更新 doctor.md 示例输出（Skills 11 -> 5）
- 测试全部通过（247 个）

### Technical Details

- 无破坏性变更（仅删除非核心文件）
- 代码覆盖率保持 89.93%
- 所有 247 个测试通过
- 项目定位更加清晰：CLI 工具 + 核心开发辅助能力

## [0.22.0] - 2026-03-29

### Added

- **TodoLists 系统**：依赖感知任务管理（Claude Code 官方核心能力）
  - `src/todos/todo-types.js` - TodoItem 和 TodoListSnapshot 类型定义
  - `src/todos/todo-manager.js` - TodoManager 类（依赖感知排序 + 拓扑排序 + 跨会话持久化）
  - `tests/todo-manager.test.js` - 23 个测试，覆盖率 98.38%
  - 支持依赖阻塞、优先级排序、进度统计、Markdown 报告、归档功能

- **Reflection Skill**：自我反思模式（Andrew Ng "AI Agent Design Patterns" 第一模式）
  - `skills/reflection.md` - 4 步反思流程（回顾 → 质疑 → 评估 → 纠偏）
  - 与 `self-review.md` 互补：self-review 是提交前清单，Reflection 是执行中纠偏
  - 可嵌入 Quest 执行，提供量化评分表和反思模板

- **能力分析器**：项目能力画像分析
  - `src/todos/capability-analyzer.js` - CapabilityAnalyzer 类（10 个能力领域评估）
  - `tests/capability-analyzer.test.js` - 9 个测试，全面覆盖
  - 自动识别项目强项和缺口，生成改进建议
  - CLI 命令：`auto analyze`（支持 `-j` JSON 输出）

- **CLI 命令扩展**：
  - `auto analyze` - 分析当前项目的能力画像（Agent + Skill + Rule 覆盖度）

- **测试覆盖**：
  - 新增 32 个测试（215 -> 247，+14.9%）
  - TodoManager 覆盖率 98.38%，CapabilityAnalyzer 全面覆盖

### Changed

- **Skills 数量**：6 -> 7（新增 `reflection`）
- **Skills 数量修正**：7 -> 10（v0.21.0 的 "精简至 6" 描述不准确，实际文件从未被删除）
- **Commands 数量**：5 -> 6（新增 `auto analyze`）
- **输入验证增强**：TodoManager.add() 和 initialize() 现在验证 `content` 和 `taskName` 参数

### Removed

- skills/reflection.md（再次移除：与 self-review + workflow-patterns 重叠）
- skills/git-worktree.md（快速参考级，不属于核心 Skill）
- skills/chrome-devtools-mcp.md（快速参考级，MCP 配置一次性操作）

### Fixed

- 修正 README 命令数量（6 -> 5，移除不存在的 /auto:analyze）
- 修正 README Skills 列表与实际文件一致（10 -> 7）
- 修正源码中对不存在命令的引用（/auto:tdd, /auto:code-review, /auto:plan）
- 修正 CHANGELOG 历史版本中的不准确描述
- 修正 doctor.md 中 Skills 检查阈值（>= 8 -> >= 7）
- 修复 CLI 中 `analyze` 命令的未使用变量（`key` → `,`）
- 修复代码审查中指出的输入验证缺失问题

## [0.21.0] - 2026-03-29

### Changed

- **Skills 精简优化**：13 个 -> 10 个（移除/合并 8 个，新增 workflow-patterns）
  - 移除 agentic-workflow-patterns.md（与 subagent-driven-development 重叠）
  - 移除 coding-standards.md（功能被 rules/ 目录覆盖）
  - 移除 model-selection-guide.md（内容已过时）
  - 移除 prompt-templates.md（功能被 auto 命令/init-project 覆盖）
  - 合并 plan-mode-workflows + subagent-driven-development + root-cause-tracing -> workflow-patterns.md
  - 精简 unified-memory-system.md（去除重复策略详解）

- **README 修正**：
  - 更新 Skills 数量统计（13 -> 10）
  - 移除不属于本项目的 java-coding-style Rule 描述
  - 更新 Rules 数量（9 -> 8）

### Removed

- skills/agentic-workflow-patterns.md（合并入 workflow-patterns.md）
- skills/coding-standards.md（功能被 rules/ 目录覆盖）
- skills/model-selection-guide.md（内容已过时）
- skills/prompt-templates.md（功能被 auto 命令/init-project 覆盖）
- skills/plan-mode-workflows.md（合并入 workflow-patterns.md）
- skills/subagent-driven-development.md（合并入 workflow-patterns.md）
- skills/root-cause-tracing.md（合并入 workflow-patterns.md）

### Added

- skills/workflow-patterns.md（三合一合并：Plan Mode + Multi-Agent + 根因追踪）

## [0.10.0] - 2026-03-29

### Added

- **技能目录系统** (`src/skills/`)
  - `skill-types.js` - 技能类型定义和解析器
  - `skill-catalog.js` - 技能目录扫描和索引
  - `skill-installer.js` - 技能安装、卸载、更新
  - 9 大技能域分类（需求、工程、调试、测试、数据、AI、科研、数学、多媒体）
  - CLI 子命令：`auto skills list/search/install`

- **诊断命令** - `auto doctor` 环境健康检查

- **知识保存命令** - `auto save` 一键保存知识条目

### Changed

- **架构简化** - 移除 6 个超出范围的模块
  - 删除 `src/graph/`（知识图谱系统）
  - 删除 `src/governance/`（治理规则引擎）
  - 删除 `src/brain/`（个人知识大脑）
  - 删除 `src/ecosystem/`（生态编排器）
  - 删除 `src/runtime/`（VCO 适配器）
  - 删除 `src/skills/`（旧的技能发现系统）
  - COMPONENTS 从 12 个减少到 7 个

- **CLI 优化** - 移除 query、brain、rules、workflow 等命令

### Fixed

- 测试失败修复（175 个测试全部通过）

### Tests

- 新增 `tests/context-injector.test.js`（18 个测试用例）
  - 4 种预设模式：探索、实现、修复、审查
  - 智能任务识别自动选择预设
  - 支持 CLAUDE.md、REPO_MAP、session-knowledge、pattern-cards、insights、dependencies 6 种上下文源
  - 内置 Token 估算和缓存机制
  - 基于 linux.do 社区 "自动上下文注入" 最佳实践

- **最佳实践工作流预设**
  - 探索-规划-编码工作流 (`explore-plan-code-workflow`)
  - 上下文感知工作流 (`context-aware-workflow`)
  - 基于 linux.do 社区讨论的最佳实践

- **生态系统扩展**
  - 新增 Context 模块注册到生态编排器
  - MODULE_IDS 新增 CONTEXT 常量

### Tests

- 新增 `tests/context-injector.test.js`（18 个测试用例）
- VCO 适配器测试新增 2 个工作流验证
- 生态系统测试新增 Context 模块集成验证

---

## [0.2.0] - 2026-03-28

### Added

- **quest-designer v4** -- 完整代码输出式闯关大纲设计师，产出可直接复制执行的施工图纸
  - 精确锚点定位（文本锚点替代行号）
  - 完整 import 列表 + package 声明
  - 预判坑点（基于代码分析，非通用建议）
  - 6 步工作流：需求解析 -> 深度代码分析 -> 合约定义 -> Quest Map -> 一致性校验 -> 自验证评分

- **MCP 集成增强** -- 分类配置 + 检测工具
  - 新增 `analyzeMcpServers()` 和 `countMcpServers()` 工具函数
  - 9 个核心 MCP 服务器按类别分组（devtools/ai/search/database）
  - 自动检测 ready/needsConfig 状态

- **prompt-craft skill** -- 短小精悍的提示词模板库

- **project-init skill** -- 项目初始化工具 + 费用追踪工具

- **npm sync script** -- `npm run sync` 仅在全局 `~/.claude/commands` 与当前仓库命令内容一致时跳过本地同步，并只清理可确认的旧 `/auto` 残留路径

### Changed

- **auto 命令精简 -64%** -- 命令定义大幅压缩，去除冗余描述
- **self-star skill 优化** -- 合并多个子能力
- **Skills 合并** -- 精简后的高效组合，减少维护成本
- **MCP 配置精简** -- 去除冗余配置，保留核心 9 个服务器

### Fixed

- **installer 备份文件** -- 使用时间戳后缀防覆盖
- **installer 递归保护** -- 新增 MAX_RECURSION_DEPTH = 20 防循环链接
- **Logger 级别控制** -- 修复级别判断逻辑
- **URL 硬编码消除** -- 移除未使用的 promptComponentSelection

### Improved

- **测试覆盖率** -- 新增 logger/config/prompts/index/installer 单元测试，覆盖率 59% -> 91%
- **静态导入优化** -- 消除动态 import，统一使用 ES Modules

---

## [0.1.1] - 2026-03-25

### Added

- **auto-core v7** -- 动态能力发现 + Quest Map 方法论
  - Grep 批量提取 frontmatter 健康检查
  - 三段推理日志（透明化 AI 决策过程）
  - 文件存在性校验

- **auto-core 透明度增强** -- 五大原则落地
  - 禁止因任务简单而跳过 PHASE（强制规则）
  - 硬性约束重写 + Gate Check 断言

- **quest-designer v2/v3** -- 深度代码分析 + 合约驱动
  - v2: 依赖排序 + 自验证评分 + 防幻觉机制
  - v3: 实现蓝图 + 风险分层 + 代码片段锚定

- **融合 3 项新能力**
  - Council Pattern -- 多 Agent 议会模式协作
  - Auto-lint-fix -- 自动代码格式修复
  - Repo Map 持久化 -- 仓库符号地图

### Fixed

- **auto.md 源文件同步** -- Gate Check 硬性约束，修复安装覆盖丢失问题
- **PHASE 3 执行器** -- 对接 v3 Quest Map 的实现蓝图/风险分层/合约/回滚方案

---

## [0.1.0] - 2026-03-01

### Added

- 初始版本
- 基于 everything-claude-code 二次开发
- npm 全局安装支持
- CLI 交互式安装器
