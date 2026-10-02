---
name: knowledge-management
description: 知识生命周期管理 — LEARN Phase 的蒸馏原则、LearnCard 分发、Session Continuity、feedback 更新和 run 归档。auto.md 只保留 LEARN 高层流程，本文件提供完整实现细节。
tags:
  - knowledge
  - learn
  - insights
  - feedback
  - distillation
  - session-continuity
  - archiving
---

# Knowledge Management — 知识生命周期管理

> auto.md LEARN Phase 的详细实现。涵盖知识蒸馏、分发、feedback 真实化和 run 归档。

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] LearnCard 含全部必填字段（category/scope/title/confidence + 治理字段 insightScore/lifecycleStatus/evidenceStrength，枚举见 canonical contract 的 Field Enumerations），无 category 的卡无效
- [ ] 分发前执行 Curator 检查：查重（同主题 merge）/ 矛盾检测（旧条目标 superseded）/ 复用计数（helpful/harmful/lastConfirmed）
- [ ] 按 category 分发到 `.auto/insights/` 对应文件（必须 Edit append，不能只留在 learn-cards.md）
- [ ] feedback 真实化：按反馈契约逐 run 幂等更新计数与观测；successRate 使用已测 run 分母
- [ ] 需跨会话续接时写 `session-continuity.md`；>30 天 run 移入 `.auto/runs/archive/`

**硬约束** (constraints):

- `scope: stack|universal` 的卡额外写入 `skills.json` 的 `portablePatterns`
- 新旧结论矛盾时旧条目末尾标 `superseded by run-<runId>`，不静默并存
- 失败经验必须标 `trap` 或 `feedback`，不得伪造"已验证"经验

**反模式** (anti-patterns):

- 只写 learn-cards.md 不分发到 insights → knowledge-distribution gate fail
- 同主题重复 append 而非 merge → 知识库膨胀、检索噪音上升
- PLAN 读 successRate 但 LEARN 从不更新 → 反馈闭环断链

---

## Knowledge Governance 2.1

Canonical source: `docs/protocols/knowledge-governance-2.1.md`.
This skill implements governance behavior and must remain semantically consistent with the canonical contract.

### Governance Consumption Rules

本 Skill 只负责执行知识治理流程。

InsightScore、Lifecycle、Retrieval Governance、Relationship Graph、Conflict Resolution 与 Planner Feedback Loop 的语义全部继承自 `docs/protocols/knowledge-governance-2.1.md`，不得在此重新定义。

## LEARN 执行清单（按序执行，不可跳步）

LEARN 阶段必须按以下顺序执行。每步完成后才进入下一步。

### 步骤 1：产出 LearnCards

从 QuestResult + VerifyReport 中蒸馏经验。每张 LearnCard 必须包含以下全部字段：

```markdown
## Card <N>

- category: trap | pattern | decision | prompt | feedback
- title: <5-10 词标题，用于 section heading>
- scope: project | stack | universal
- confidence: high | medium | low
- source: run-<runId>
- summary: <≤3 句核心描述>
- recommendedAction: <1 句推荐动作>
```

**字段说明**：

- `category`（必填）：决定分发目标文件。无 category 的 LearnCard 视为无效，不进入步骤 2
- `title`（必填）：作为 append 到目标文件时的 `###` heading
- `scope`（必填）：`stack|universal` 额外写入 `skills.json` 的 `portablePatterns`
- 每次 run 产出 1-5 张 LearnCard；VERIFY fail 或 EXECUTE 升级时必须产出至少 1 张 `category=trap`

**去重**：与 `.auto/insights/` 已有条目对比。同标题 → 更新内容而非追加。无新增知识时可跳过 LearnCard 产出。

写盘到 `.auto/runs/<runId>/learn-cards.md`。

### 步骤 2：分发 LearnCards 到 insights/（按 scope 分层）

对每张有效 LearnCard（有 category 字段），**必须执行以下操作**：

1. 根据 category **和 scope** 确定目标文件（**v0.52 升级：三层命名空间**）：

| category | scope     | 目标文件（必须 append）                 |
| -------- | --------- | --------------------------------------- |
| trap     | project   | `.auto/insights/project/traps.md`       |
| trap     | stack     | `.auto/insights/stack/traps.md`         |
| trap     | universal | `.auto/insights/universal/traps.md`     |
| pattern  | project   | `.auto/insights/project/patterns.md`    |
| pattern  | stack     | `.auto/insights/stack/patterns.md`      |
| pattern  | universal | `.auto/insights/universal/patterns.md`  |
| decision | project   | `.auto/insights/project/decisions.md`   |
| decision | stack     | `.auto/insights/stack/decisions.md`     |
| decision | universal | `.auto/insights/universal/decisions.md` |
| prompt   | project   | `.auto/insights/project/prompts.md`     |
| prompt   | stack     | `.auto/insights/stack/prompts.md`       |
| prompt   | universal | `.auto/insights/universal/prompts.md`   |
| feedback | (不分层)  | `.auto/insights/agent-feedback.md`      |

**分层说明**：

- `project`：当前项目特有的知识（如"本项目用户表名为 sys_user"）
- `stack`：同技术栈通用（如"Spring Boot @Transactional 要加 rollbackFor"）
- `universal`：跨项目/跨语言通用（如"复杂查询先写伪代码"）

**SCAN 1.6 按技术栈加载**：

- 当前项目技术栈 = Java + Spring Boot → 加载 `stack/` 和 `universal/`，跳过 `project/`（除非明确需要）
- 节省 token：只加载相关 scope 的 insights

2. Read 目标文件当前内容（如文件不存在则自动创建空文件）

3. **Curator 检查**（ACE 式增量演化，append 前必做，来源 arXiv:2510.04618）：

   a. **查重**：`Grep(pattern="<title 关键词>", path="<目标文件>")`。同主题已存在 → 改为 Edit 更新该 section（保留原日期，追加新结论），不新增条目
   b. **矛盾检测**：新结论与已有条目相反时，不得静默并存。在旧条目末尾追加 `**状态**: superseded by run-<runId>`，新条目正常 append 并在 summary 中注明推翻依据
   c. **merge-or-append 决策**：查重命中且无矛盾 → merge；查重未命中 → append；矛盾 → supersede + append

4. 使用 Edit 工具在文件末尾 append 新 section：

```markdown
### <title>

**日期**: YYYY-MM-DD | **置信度**: <confidence> | **来源**: <source> | **Scope**: <scope>

<summary>

推荐动作：<recommendedAction>
```

5. 验证 append 成功（Read 目标文件末尾确认）

**硬约束**：`category=trap` 的 LearnCard 未 append 到对应 scope 的 `traps.md` → LEARN 不完整，`knowledge-distribution` gate = fail。

**迁移说明**（首次使用三层结构时）：

- 如果 `.auto/insights/traps.md` 已存在（旧平铺结构），需手动迁移：
  ```bash
  # 迁移脚本示例（手动执行）
  mkdir -p .auto/insights/{project,stack,universal}
  # 根据每条 insight 的 scope 字段分发到对应目录
  ```
- 新项目直接使用三层结构，无需迁移

### 步骤 3：更新 agents.json

按 [反馈契约](references/feedback-contract.md) Read → 校验 → 合并写入 `.auto/feedback/agents.json`；缺文件用该契约 canonical seed。只记录实际调用，以 runId upsert observations，按新旧 uses 差量更新 totalCalls；未知结果写 unknown，successRate 只由已测 run 推导。保留历史和扩展字段，同 run 重做 LEARN 不重复计数。

### 步骤 4：更新 skills.json

被实际激活（Read + 提取要素）的 skill 按同一契约更新 `.auto/feedback/skills.json`，每 run 的 uses=1；未激活不计数。局部验收结果需要应用证据，不把整 run 的通过率或调用量当 skill 收益。

**样本门槛**：有效 success/failure 观测的 measuredCount ≥ 3 才允许 rate 影响路由和分层；unknown、无观测历史率与无效数据不参与加权。

**scope 附加**：stack/universal LearnCard 写 skills.json **顶层** portablePatterns，附来源 skill，按 (runId, id, skill) 去重；旧条目内数组按反馈契约迁移。

### 步骤 5：归档检查

扫描 `.auto/runs/` 下的目录，创建时间超过 30 天的移入 `.auto/runs/archive/`。

**配置**（环境变量覆盖默认行为）：

```bash
# 修改保留天数（默认 30 天）
export AUTO_CLEAN_RETENTION_DAYS=60

# 启用 DRY RUN 模式（仅预览，不实际归档）
export AUTO_CLEAN_DRY_RUN=true
```

**手动触发清理**（Codex 无 SessionStart Hook 时同样适用）：

```bash
# 立即归档超过 30 天的 run
bash ~/.claude/hooks/lib/auto-clean-runs.sh

# 预览将被归档的 run
AUTO_CLEAN_DRY_RUN=true bash ~/.claude/hooks/lib/auto-clean-runs.sh
```

**恢复已归档 run**：

```bash
# 列出已归档 run
ls .auto/runs/archive/

# 恢复指定 run
mv .auto/runs/archive/run-<id> .auto/runs/
```

---

## 知识注入（SCAN 阶段）

**检索方式**：优先 grep，不依赖 insight-index.json（该文件体积过大，加载成本高于 grep）。

**执行步骤**：

1. 从用户需求提取 3-5 个关键词
2. 对每个关键词执行 `Grep(pattern="<关键词>", path=".auto/insights/")`
3. 取命中数最多的前 3 条，每条提取 ≤2 行摘要
4. 将摘要注入 `RouteDecision.notes.relevantInsights`
5. 记入 `selection.routeHintsUsed`

**注入规则**：

| 命中文件          | PLAN 阶段注入目标       |
| ----------------- | ----------------------- |
| traps.md          | QuestMap.pitfalls       |
| patterns.md       | QuestMap.knowledgeHints |
| decisions.md      | QuestMap.decisionNotes  |
| prompts.md        | 仅探索策略采用          |
| agent-feedback.md | 影响 selection 排序     |

**相似历史 run 预匹配**：Read 最近 3 个未归档 run 的 `route-decision.md` 第一段（userIntent），语义相关时预加载该 run 的 `learn-cards.md` 前 10 行。

---

## Insight 复用计数（ACE 反馈环）

insight 的价值由实际复用结果决定，不由写入时的 confidence 单方面决定。VERIFY 的 `knowledge-reuse` gate 核对完成后，LEARN 阶段对本次被注入的每条 insight 更新计数行：

```markdown
**复用**: helpful=<N> | harmful=<M> | lastConfirmed=YYYY-MM-DD
```

**更新规则**：

| 情形                                                      | 动作                                 |
| --------------------------------------------------------- | ------------------------------------ |
| 被注入且对本次决策有正向贡献（QuestMap/QuestResult 引用） | `helpful` +1，更新 `lastConfirmed`   |
| 被注入但误导执行（VERIFY fail 可归因到该条 / 被用户纠正） | `harmful` +1                         |
| `harmful ≥ 2` 且 `harmful > helpful`                      | 追加 `**状态**: harmful`，注入时排除 |

**衔接约定**：

- 条目无复用行时视为 `helpful=0`（旧条目兼容，不批量回填，首次被复用时才补行）
- `/auto:learn --decay` 的 age-prune 规则中"最后命中时间"以 `lastConfirmed` 为准
- 含 `**状态**: harmful` 的条目按 canonical contract 的 Retrieval Governance 排除与降级规则处置（与 archived/merged/outdated 同级）

---

## Session Continuity

**必填字段**：`runId` | `status` | `currentPhase` | `nextPhase` | `requiredArtifacts` | `blockingIssues` | `resumePrompt`

**扩展字段**：

- `knownDefects` — 已知但未修的缺陷列表（含位置和延后原因）
- `unverifiedPaths` — 未验证的代码路径（含风险评估）
- `cleanStateChecklist` — 关门自检 4 项

---

## LEARN 对 SCAN 的回灌

步骤 3-4 中更新的 agents.json 和 skills.json 在下次 SCAN 时自动被读取，影响 agent 路由和 skill 激活排序。无需额外操作。
