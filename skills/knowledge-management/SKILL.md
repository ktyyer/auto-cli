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

### 步骤 2：分发 LearnCards 到 insights/

对每张有效 LearnCard（有 category 字段），**必须执行以下操作**：

1. 根据 category 确定目标文件：

| category | 目标文件（必须 append）            |
| -------- | ---------------------------------- |
| trap     | `.auto/insights/traps.md`          |
| pattern  | `.auto/insights/patterns.md`       |
| decision | `.auto/insights/decisions.md`      |
| prompt   | `.auto/insights/prompts.md`        |
| feedback | `.auto/insights/agent-feedback.md` |

2. Read 目标文件当前内容
3. 使用 Edit 工具在文件末尾 append 新 section：

```markdown
### <title>

**日期**: YYYY-MM-DD | **置信度**: <confidence> | **来源**: <source>

<summary>

推荐动作：<recommendedAction>
```

4. 验证 append 成功（Read 目标文件末尾确认）

**硬约束**：`category=trap` 的 LearnCard 未 append 到 `traps.md` → LEARN 不完整，`knowledge-distribution` gate = fail。

### 步骤 3：更新 agents.json

**必须执行**。使用 Read → Edit 更新 `.auto/feedback/agents.json`。

对本次 run 中被调度的每个 agent：

1. Read `.auto/feedback/agents.json`
2. 找到对应 agent 条目
3. Edit 更新以下字段：
   - `totalCalls`：当前值 +1
   - `lastUsed`：设为 `YYYY-MM-DD`
   - `successRate`：成功时保持或上调（最高 1.0），失败时下调（最低 0.0）
   - `knownIssues`：失败时追加一条描述
4. 更新文件顶部 `lastUpdated` 为当前日期

**最小更新示例**（假设 quest-designer 在本次 run 中被调度且成功）：

```diff
- "totalCalls": 0,
- "lastUsed": null,
+ "totalCalls": 1,
+ "lastUsed": "2026-05-27",
```

### 步骤 4：更新 skills.json

**必须执行**。对本次 run 中被激活（Read + 提取要素）的每个 skill：

1. Read `.auto/feedback/skills.json`
2. 找到对应 skill 条目
3. Edit 更新以下字段：
   - `usageCount`：当前值 +1
   - `lastUsed`：设为 `YYYY-MM-DD`
   - `successRate`：同步骤 3 逻辑
4. 更新文件顶部 `lastUpdated` 为当前日期

**scope 附加**：如果某张 LearnCard 的 `scope` 为 `stack` 或 `universal`，在该 skill 条目中追加 `portablePatterns` 条目。

### 步骤 5：归档检查

扫描 `.auto/runs/` 下的目录，创建时间超过 30 天的移入 `.auto/runs/archive/`。

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

## Session Continuity

**必填字段**：`runId` | `status` | `currentPhase` | `nextPhase` | `requiredArtifacts` | `blockingIssues` | `resumePrompt`

**扩展字段**：

- `knownDefects` — 已知但未修的缺陷列表（含位置和延后原因）
- `unverifiedPaths` — 未验证的代码路径（含风险评估）
- `cleanStateChecklist` — 关门自检 4 项

---

## LEARN 对 SCAN 的回灌

步骤 3-4 中更新的 agents.json 和 skills.json 在下次 SCAN 时自动被读取，影响 agent 路由和 skill 激活排序。无需额外操作。
