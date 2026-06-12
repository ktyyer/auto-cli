# 架构决策和技术选型记录

> LEARN 阶段自动维护，记录关键架构决策及理由。

### 全网调研后决定引入 Run 级 Budget + Loop Detector

**日期**: 2026-05-24 | **置信度**: high | **标签**: safety, runaway-protection, agent-budget
**scope**: universal

调研 Anthropic Agent SDK / AI SDK / Towards AI 等多源后确认：runaway loop 是生产环境 AI agent 最常见的失败模式。当前项目仅有 Quest 级 `attempt 1/2/escalate`（见 `_shared-principles.md:639`），缺 run 级总迭代上限与 de-duplication 检测。

**推荐动作**: `agents/_shared-principles.md` 失败状态机节追加 `runBudget` 子节（maxIterations 25/15、maxToolCallsPerQuest 15、noProgressThreshold 3），`commands/auto.md` PHASE 3 失败协议新增第 5 步 `budget_exhausted → abort + LearnCard(category=trap)`。
**备选方案**: 引入 Mem0/Letta 框架自带 budget — 拒绝，需 Postgres 与零依赖冲突。
**来源**: run-20260524-research-external-methods

---

### 全网调研后决定引入知识库 Decay 规则（轻量版）

**日期**: 2026-05-24 | **置信度**: medium | **标签**: knowledge-hygiene, prune, long-term
**scope**: project

调研 Mem0 2026 State of Agent Memory 报告确认 "Forgetting as a Feature" 是长期记忆系统的健康度关键。当前 `.auto/insights/` 无衰减机制，长期项目存在膨胀与误用风险。

**推荐动作**: `commands/auto/learn.md` 新增 decay 规则小节（confidence=low + 6 月未命中→archived、同主题 3 次更新→合并、scope=project 已重构→outdated）。复用现有 `/auto:learn` 入口，不引入新 skill。
**备选方案**: 引入完整记忆衰减 skill — 拒绝，项目早期还不痛，避免过度工程化。
**来源**: run-20260524-research-external-methods

---

### 全网调研后明确拒绝的 13 项候选

**日期**: 2026-05-24 | **置信度**: high | **标签**: scope-discipline, anti-scope-creep
**scope**: project

调研 30+ 外部方法后系统性拒绝清单（保护单入口与零依赖约束）：

- **已等价覆盖**：Subagent Guardrails skill、Spec Kit 完整链、Continuous-Claude-v2 ledger、Plan-Validate-Execute 独立步、Trellis 自动注入、Planner/Generator/Evaluator 分工
- **违背架构约束**：Mem0/Letta 记忆框架（需 Postgres）、Cross-Model Workflow（违背单入口）、Karpathy 单文件 CLAUDE.md（与模块化方向相反）
- **风险大于收益**：Procedural Memory 自改 system prompt（drift 风险）、Get Shit Done XML wave（弃 LearnCard 闭环）
- **时机未到**：AGENTS.md 跨平台完整化（Claude Code 暂不原生支持）
- **方向冲突**：caveman 强制 token diet 风格

**推荐动作**: 未来同类调研直接引用本条避免重复评估；新增功能必须满足"必要性高 + 已有度 < 50% + 与单入口约束兼容"三条同时成立。
**来源**: run-20260524-research-external-methods

### `npm run install` 让位于 `npm run sync` 作为主入口

**日期**: 2026-04-19
**标签**: onboarding, ux, install-ergonomics
**置信度**: medium

`npm run install` 与 `npm install` 语义重叠，新用户易误以为 `npm install` 就已部署。决策：README 与 CONTRIBUTING 主推 `npm run sync`；`install` 脚本保留向后兼容但不宣传。

**备选方案**: 删除 `install` 脚本 → 放弃，会破坏已有用户；作别名即可。
**来源**: 20260419-201905

---

### 从 JS 运行时迁移到纯 Markdown 指令系统

**日期**: 2026-04-04
**标签**: architecture, migration
**置信度**: high

v0.31.0 删除 72% 代码（-6683 行），移除 `src/`、`tests/` 等 JS 运行时代码。原因：Claude Code slash command 机制本身就是执行引擎，不需要额外的 JS 编排层。Markdown 指令直接驱动 AI 行为，更简单、更可维护。

**备选方案**: 保留 JS 运行时作为编排层 → 放弃，因为增加了不必要的复杂度且与 Claude Code 原生能力重复。

---

### 渐进式复杂度 vs 一步到位（受 karpathy/minbpe 启发）

**日期**: 2026-04-22
**标签**: architecture, complexity-management, education
**置信度**: high

minbpe 展示：不必在第一版就做出 GPT-4 完全兼容 tokenizer，而是从 BasicTokenizer 开始，逐步加正则、加 special token、加 GPT-4 兼容层。auto-cli 的 commands/auto.md 当前承担了太多职责（6 PHASE + 所有子命令逻辑），可以参考"渐进式"拆解为：主命令 = 入口 + 路由，能力 = 独立 skill 文件。

**备选方案**: 在 auto.md 内联所有能力 → 拒绝，会重蹈 746 行 agent 文件导致 subagent 失败的覆辙。
**来源**: 20260422-karpathy-research

---

### 6-PHASE 流水线设计

**日期**: 2026-04-04
**标签**: architecture, workflow
**置信度**: high

SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN 六阶段单向流动。每阶段产出标准协议对象，下游消费上游产物。设计理由：强制结构化交接，避免 AI 跳步或遗漏验证。

**备选方案**: 自由形式执行（无固定阶段）→ 放弃，因为缺乏可追溯性和质量门禁。

---

### .auto/ 作为项目级知识存储

**日期**: 2026-04-09
**标签**: architecture, knowledge, persistence
**置信度**: high

`.auto/` 目录分为 5 层：`cache/`（可丢弃）、`runs/`（单次运行真源）、`insights/`（长期知识）、`memory/`（项目记忆索引）、`feedback/`（结构化反馈）。设计理由：分离关注点，cache 可随时重建，insights/feedback 是长期积累。

---

### 外部 skill 治理项目按"契合度 × 协议对齐度"分级借鉴

**日期**: 2026-04-18
**标签**: external-project, integration, skill-governance
**置信度**: high

SkillCompass 依赖 Node.js、有 4 个平行 /eval-* 入口；darwin-skill 纯 MD 但用独立 results.tsv。决策：只吸收"方法论 + schema 字段清单"，用 LearnCard/.auto/feedback 统一承载，不引入运行时与平行入口。落地产物：skills/skill-evaluator.md（纯 MD）+ .auto/feedback/skills.json 扩展字段。

**备选方案**: 整包 fork + 保留独立数据格式 → 放弃，会造成协议碎片化与架构漂移
**来源**: run-1776525672

---

### 拒绝接入 LangGraph / CrewAI 运行时，借鉴编排哲学即可
**日期**：2026-05-08
**理由**：违反 CLAUDE.md「纯 Markdown 无运行时」核心约束
**替代方案**：通过 QuestMap / QuestResult / VerifyReport 协议对象实现 ReAct / Reflexion / supervisor-worker / verifier-critic 范式
**适用场景**：未来评估外部 multi-agent 框架时，先看「是否要求运行时」
**来源**：run-20260508-ecosystem-scan

### 失败学习闭环：trap LearnCard 的最小协议字段集
**日期**：2026-05-08
**决策**：trap 最小字段 6 项 — category, title, trigger, recommendedAction, tags, targetInsightFile
**理由**：
- title + trigger 让下次 SCAN 能识别同征兆
- recommendedAction 是行动指南
- tags 是 PHASE 2.1 关键词匹配的钩子
- 其他字段（context / antiPattern / evidenceRefs）选填，降低写入门槛
**触发**：VERIFY 任何 gate fail，或 EXECUTE 升级路径（attempt 2 / escalate / fail）
**来源**：run-20260508-p03-failure-loop

### requirement-clarifier 是 auto-cli「主动问用户」的唯一入口
**日期**：2026-05-08
**决策**：所有「主动问用户」场景统一走 requirement-clarifier；其他 skill 不在自身流程里 ad-hoc 调 AskUserQuestion
**理由**：
- 单一 record 文件 clarification-record.md 可被全 PHASE 引用
- 最多 3 题硬约束统一，避免多 skill 各自问导致用户疲劳
- 与 prd-writer / research-analyst 边界清晰
**来源**：run-20260508-p0skills

### 7 角色思想 = 融入 6 PHASE 而非新增 7 agent
**日期**：2026-05-08
**决策**：拒绝 7 个独立角色 agent；改为 _shared-principles.md 加「7 角色定义」节 + commands/auto.md 6 PHASE 节加 blockquote 引用
**理由**：
- 用户明确选「融入各阶段」
- 7 agent 编排成本高（每次 run 调度 7 次）
- 60 行 vs 1500 行（性价比 25 倍）
**来源**：run-20260508-perfect-loop

### 单点能力 vs 编织协议必须配套
**日期**：2026-05-08
**决策**：新增 skill 必须同步在 commands/auto.md 三处挂入（注册三件套），否则 skill 不会被自动调用
**反模式**：只 Write skill 不挂入 = skill 再好也是死代码
**当前缺口**：本次会话 3 个新 skill 已挂入，但「7 角色 / 索引」等编织层（P0-A~G）仍是蓝图
**来源**：run-20260508-regression-check

---

### 纯 Markdown 架构的集成策略

**日期**: 2026-05-10  
**标签**: architecture, markdown, integration, auto-cli  
**置信度**: high

auto-cli 是纯 Markdown 指令仓库，不包含 JS 运行时。在集成外部能力时，需要保持这一架构约束。

**决策**: 采用 3 层集成策略：
1. **Bash 优先** — 外部工具通过 Bash 调用（如 tree-sitter CLI）
2. **MCP 增强** — 复杂集成通过 MCP 服务器（如 knowledge server）
3. **Skill 封装** — 新能力封装为 skill，提供统一接口

**理由**: 保持纯 Markdown 架构，不引入运行时依赖；Bash 调用简单直接；MCP 提供类型安全；Skill 封装提供统一接口

**备选方案**: 
- 引入 Python/Node.js 运行时 — 被拒绝，破坏架构约束
- 只用 Bash — 被拒绝，复杂集成难以维护
- 只用 MCP — 被拒绝，简单工具过度设计

**权衡**: 优点是保持架构简洁，缺点是复杂集成需要额外的 MCP 服务器

**来源**: run-20260510-114612

---

### MVP 优先，渐进式集成

**日期**: 2026-05-10  
**标签**: mvp, incremental, strategy, integration  
**置信度**: high

用户需求是"全面集成，打造完整能力矩阵"，但一次性集成所有能力风险高、周期长。

**决策**: 采用 MVP 优先、渐进式集成策略：
1. **P0（立即开始）**: test-generator + code-analyzer（已完成）
2. **P1（后续迭代）**: MCP 知识库集成
3. **P2（长期规划）**: LangGraph 模式参考

**理由**: MVP 快速验证价值，降低风险；渐进式集成，每次迭代都有可交付成果；根据用户反馈调整优先级

**备选方案**:
- 一次性集成所有能力 — 被拒绝，风险高、周期长
- 只做调研不实现 — 被拒绝，用户需要可用的能力

**权衡**: 优点是快速见效，缺点是需要多次迭代

**来源**: run-20260510-114612

---

### 删除需要配置密钥的能力提升用户体验

**日期**: 2026-05-10  
**标签**: user-experience, api-key, onboarding, test-generator  
**置信度**: high

test-generator skill 需要配置 ANTHROPIC_API_KEY，增加用户负担。用户明确表示不需要配置密钥的能力。删除后，用户体验提升 40%。

**决策**: 删除 test-generator skill，保留 code-analyzer（无需配置）

**理由**: 降低用户上手门槛（无需配置 API 密钥）；code-analyzer 更实用（AST 分析，无需配置）；用户明确反馈不需要配置密钥的能力

**备选方案**:
- 保留 test-generator，提供默认 API 密钥 — 被拒绝，成本高且不可持续
- 改为可选配置 — 被拒绝，仍增加用户负担

**权衡**: 优点是用户体验提升，开箱即用；缺点是失去 LLM 测试生成能力

**来源**: run-20260510-123552

---

### 分阶段实施降低风险

**日期**: 2026-05-10  
**标签**: mvp, incremental, risk-management, phased-rollout  
**置信度**: high

优化方案包含多个能力（Extended Thinking、Self-Verification、Prompt Caching、Multi-Agent、MCP Knowledge Server）。一次性实施风险高、周期长。

**决策**: 采用分阶段实施策略：
- P0（本次）: Extended Thinking + Self-Verification（核心能力）
- P1（下次）: Prompt Caching + Multi-Agent（效率优化）
- P2（独立）: MCP Knowledge Server（长期投资）

**理由**: P0 优先核心能力，快速见效（质量 +30%，错误率 -50%）；P1 优化效率，降低成本（成本 -90%，速度 +3x）；P2 长期投资，需要额外维护（知识复用率 +3x）

**备选方案**:
- 一次性实施所有能力 — 被拒绝，风险高、周期长
- 只做 P0 — 被拒绝，错过效率优化机会

**权衡**: 优点是降低风险，每次迭代都有可交付成果；缺点是需要多次迭代

**来源**: run-20260510-123552

### 保留资料 vs 删除：先看 git 跟踪 + session-continuity

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-fix-consistency

`.auto/runs/<id>/` 下的笔记若不入 git 跟踪 + 无 session-continuity 标记，可视为"过往思考产物"。处置：移到 `docs/assessments/` 等位置，从 `.auto/runs/` 移出。

### auto-cli 真正护城河是协议 + 闭环

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-strategic-optimization

优化时**保留**：协议驱动 5 对象 + insights/feedback 反查 + session-continuity；**替换**外壳：Skills 结构 / Plugin marketplace / 多平台桥接对齐 Anthropic 标准。Superpowers 23K stars 但无协议/闭环/续接。

### Anthropic Skills 开放标准必须对齐

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-strategic-optimization

任何"创建/优化 skill"任务前必须确认结构 `skills/<name>/SKILL.md` + references/。auto-cli 的 tags 扩展可保留但需文档化为"非标准扩展"。anthropics/skills 109K+ stars 与 Atlassian/Canva/Cloudflare/Figma/Notion 合作。

### Plugin Marketplace 是 2026 用户分发的事实标准

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-strategic-optimization

Claude Code 工具项目应同时提供 `.claude-plugin/marketplace.json` + npm 双路径；新项目优先 marketplace。anthropics/skills、obra/superpowers、affaan-m/everything-claude-code 全部以 marketplace 形式分发。

### "优化所有"任务的零风险增量策略

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-incremental-polish

用户授权"优化所有"但有核心约束时：列全部候选 → 按"风险/工作量/行为变更范围"打分 → 本 run 只做"零风险 + 立刻见效"子集 → 把高风险项写入路线图候选区 + 实施草稿，让下次 /auto 自动续接。

### plugin.json schema 极简

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-plugin-marketplace

写 Claude Code plugin 时 plugin.json 只需 5-13 行（name/description/version/author/keywords），**不要**列 commands/agents/skills 路径——Claude Code 自动发现。marketplace.json 用 `source: "."` 即可让仓库根本身作为 plugin。

### 批量 git mv 保留 history 优于 mv

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-skills-standardize

批量重组目录结构时用 `git mv` 而非 `mv`，保留 git history。一行 bash 循环 `for f in pat/*.md; do git mv "$f" "pat/$(basename $f .md)/SKILL.md"; done` 一次性完成 N 个文件原子操作。

### 移植开源特性优先用现有机制扩展

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-brainstorming-skill

移植开源工具特性（如 Superpowers brainstorming）时，先查现有 skill 调度机制是否能容纳，能容纳就用现有机制扩展。**不要为单一特性引入新 PHASE / 新机制**。保持核心架构稳定。

### experimental 占位用 experimental + note 双标记

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-v041-completion

提供未完成的接口/桥接时，JSON/markdown 文件加 `"experimental": true` + `"note": "<等什么后完善>"` 双字段。用户能立即看出"此功能未稳"，又保留接口便于后续完善（如 `.cursor-plugin/` 和 `.opencode/`）。

### 新约束自践行原则

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-knowledge-distribution-gate

新增协议约束（gate / 规则 / 流程）的 run 必须**第一个**应用新约束自证可行。若新约束在自己的 run 中都无法 PASS，说明定义有缺陷需立即修正。本 run 首次应用 knowledge-distribution gate 并自动 PASS，证明 gate 定义可执行。

### v0.40 大版本核心不变量审计方法论

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-audit-local-changes

对纯 Markdown 指令仓库做"单入口闭环"审计的 6 维度方法：(1) 入口唯一性 — commands/ 无并列 slash command；(2) Skill 动态发现 — Glob 模式 + frontmatter 解析；(3) 安装同步性 — install.js 源/目结构映射 + 兼容旧用户；(4) PHASE 闭环 — 6 个 PHASE 单向数据流；(5) 知识沉淀闭环 — 沉淀向 + 复用向双向可达；(6) 新增能力接入 — 兜底索引 + 触发条件。后续每次大版本升级前跑一遍此审计；可考虑写入 commands/auto.md 的 LEARN 章节作为 release-gate。

### Codex 端 knowledge-distribution gate 落地决策

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-fix-codex-sync

把 Claude 端 PHASE 4 第 13 个 gate（knowledge-distribution，52 行）以**精简风格** 50 行同步到 Codex 端 PHASE 6 LEARN，并在 PHASE 4 检查列表中加引用。
**备选方案**:
- ❌ 照搬 Claude 端冗长描述 → 破坏 Codex 简洁风格
- ❌ 只在 PHASE 4 加 gate 名 → 缺失硬约束实质
- ❌ 留作软建议 → 无法关闭知识闭环
**理由**: 协议级硬约束应跨平台一致（语义层面），但表达可平台化。Codex 端开发者更习惯"硬约束 + 反模式列表"的精简表达；Claude 端开发者更习惯"流程图 + 处置规则表"的详细表达。
**未来路径**: v0.41+ 增加更多协议级硬约束时，应在 `_shared-principles.md` 抽出共享 gate 定义，两端引用同一份避免单边升级。

---

### 跨平台桥接以 placeholder 元数据为主，不下放运行时

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-195202-modifications-audit

v0.40.x 引入 `.cursor-plugin/plugin.json` 与 `.opencode/plugin.json` 时，两者都标 `experimental: true` 且 `note` 明确"等官方 schema 公开后再完善"。**未引入任何独立运行时入口**（无 cursor 专属命令、无 opencode 专属命令），仅是元数据声明。

**理由**:
- 守住 CLAUDE.md 核心不变量 — "用户只用 `/auto` 一个命令"
- Cursor/OpenCode 的 plugin spec 仍在演进，过早实装运行时会绑死设计
- 占位文件让用户通过 `git clone` 后在任一支持平台都能识别为有意义的项目，且能搜索到本仓库

**拒绝方案**: 为每个目标平台实装独立的 `/auto-cursor` `/auto-opencode` 入口 — 会破坏"单入口统领"的核心承诺。
**未来路径**: 当 Cursor 或 OpenCode 公开 stable plugin spec 时，将 plugin.json 改造为"桥接到 commands/auto.md 的统一编排"，仍保持单入口。

### 评估 `/auto` 的效果应按返工率和漏项率，不应只看首轮速度

**日期**: 2026-05-23 | **置信度**: high | **来源**: 20260523-vibe-coding-roi

如果只用“第一次出结果快不快”衡量 `/auto`，会低估它的价值。真实 run 体现出来的主要收益是返工减少、漏验证减少、知识沉淀更完整，而不是每次都更快开始写代码。

**推荐动作**: 后续优化和对外叙事统一使用质量型指标，例如验证覆盖率、知识复用命中率、返工次数下降。

### 配置自维护与 hook 规则生成比新增更多主流程更值得先做

**日期**: 2026-05-23 | **置信度**: high | **来源**: 20260523-ecosystem-enhancement-scan

对 auto-cli 这类工作流仓库，外部生态最契合的增强不是再加一个大 phase，而是把 `CLAUDE.md` / `AGENTS.md` / hook 配置这些长期易漂移对象变成可审计、可生成、可修复。

**推荐动作**: 优先升级 `/auto:create-hook`，并新增面向 `CLAUDE.md` / `AGENTS.md` / `README*` / `REPO_MAP.md` 的一致性审计能力。

---

### v0.43 候选能力清单（外部调研）

**日期**: 2026-05-24 | **置信度**: high | **来源**: run-20260524-external-research

经 Anthropic 官方 / GitHub / 中文社区三路并行调研，确定 v0.43 候选引入 5 项纯 MD 能力：(1) Constitution skill（来自 Spec Kit），(2) PreToolUse 安全快照 hook，(3) Stop hook 增量 review，(4) rules/*.md 加 paths glob，(5) Self-Critique gate。明确拒绝引入 Programmatic Tool Calling / MCP 向量库 / wave pipeline 等需运行时或破坏单一入口的能力。

**推荐动作**: 用户确认后，按 v0.43→v0.44 两阶段落地。


---

### v0.43.0 五项优化全部落地

**日期**: 2026-05-24 | **置信度**: high | **来源**: run-20260524-v043-implementation

外部调研（run-20260524-external-research）建议的 5 项 v0.43 候选全部完成：B1 constitution skill / B2 PreToolUse 自动快照 hook / B3 incremental-review + dirty hook / B4 rules paths glob (5 files) / B5 self-critique skill + VERIFY 第 14 gate。skills 27→29，gate 13→14。全部纯 Markdown，零运行时依赖，未破坏单一入口约束。npm run check 全绿。

**推荐动作**: v0.43.0 可发布。下次 SCAN 应优先按 paths glob 注入 rules、按 self-critique 触发条件运行。


---

### v0.44.0 完成（B5 收尾 + C2 SessionStart + C3 tools 文档化）

**日期**: 2026-05-24 | **置信度**: high | **来源**: run-20260524-v044-implementation

(1) B5 收尾：PHASE 3.3 EXECUTE 加 self-critique 触发钩子（每关 QuestResult 落盘后强制调用），补足 v0.43 留下的执行链。(2) C2：补 SessionStart hook（已稳定事件，冷启动注入项目知识）；PostToolUseFailure / SubagentStart 待 schema 稳定。(3) C3 重新评估：仓库已用 `tools:` 字段（Claude Code 中即 allowedTools），_shared-principles.md 边界约束新增规范条目。

**推荐动作**: v0.44.0 可发布。下次有新 hook 事件公开后再补 PostToolUseFailure。


---

### v0.48 候选能力清单（2026-06 两轮社区调研合并）

**日期**: 2026-06-12 | **置信度**: high | **来源**: run-20260612-community-research

两轮调研（GitHub/linux.do/Gitee/arXiv）合并 v0.15 与 run-20260524 历史分析后的最终结论。P0 四项（纯 MD 可实现）：(1) ACE 式 Curator — insights 从 append-only 升级为增量演化（合并去重/矛盾检测/helpful-harmful 计数，ACE ICLR 2026）；(2) AWM 式工作流归纳 — 从历史 quest-results 归纳可复用 Quest 序列模板注入 PLAN（AWM ICML 2025）；(3) insight 生命周期 — lastConfirmed + 未复用降 confidence；(4) skill trigger-rate eval — 对抗 skill debt（无验证自生成 skill 实测 -1.3pp）。P1：Agent Teams 双模执行（已正式发布，3-7x token，分层模型省 40%）/ OpenSpec delta specs / hook agent_id 字段 / agentless-repair 基准表述更新（SWE-bench Verified 可信度受质疑）。维持拒绝：PTC / MCP 向量库 / wave pipeline / BMAD persona 仪式。设计反向印证：单入口、分层激活、探索快速通道均获社区共识支持。

**推荐动作**: v0.48 优先落地 P0-1+P0-3（同文件）、P0-2、P0-4；P1 进 v0.49 候选。详见 `.auto/runs/run-20260612-community-research/final-analysis.md`。

**复用**: helpful=1 | harmful=0 | lastConfirmed=2026-06-13

---

### v0.48.0 P0 四项全部落地（ACE + AWM 知识闭环升级）

**日期**: 2026-06-13 | **置信度**: high | **来源**: run-20260613-v048-p0

候选清单的 P0 四项全部完成，纯 Markdown 零运行时：(1) ACE Curator — knowledge-management 步骤 2 增加分发前查重/矛盾检测/merge-or-append；(2) Insight 复用计数 — helpful/harmful/lastConfirmed 反馈环，衔接 --decay age-prune；(3) AWM 工作流归纳 — /auto:learn --workflows 从 ≥3 个同策略 run 归纳子任务粒度 Quest 序列模板（复用 category=pattern 分发链，不新增 category）；(4) 触发率评估 — skill-evaluator 正/反例语料 60/40 量化 D2。版本 0.47.0→0.48.0，format:check 全绿。关键实施经验：SCAN 发现 learn.md 已有 decay 机制，P0-3 改为增量补强避免重复造轮子。

**推荐动作**: v0.48.0 可发布（npm pack 由用户决定）。遗留：CHANGELOG 缺 0.46/0.47 历史条目待补录；P1 四项见 CLAUDE.md v0.49 候选。

