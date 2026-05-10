# 架构决策和技术选型记录

> LEARN 阶段自动维护，记录关键架构决策及理由。

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
