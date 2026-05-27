---
name: quality-gates
description: VERIFY 门禁定义 — 14 个 gate 的详细触发条件、验证逻辑、输出格式和处置规则。VERIFY Phase 执行门禁时按需加载对应 gate 定义，不预加载全量。
tags:
  - verify
  - gate
  - quality
  - validation
  - testing
---

# Quality Gates — VERIFY 门禁定义

> auto.md 只保留各策略的必需 gate 清单表，本文件提供每个 gate 的完整定义。

## Gate Taxonomy

`analysis` | `build` | `test` | `lint` | `coverage` | `security` | `adversarial` | `self-verification` | `self-critique` | `skill-activation` | `knowledge-reuse` | `knowledge-distribution` | `clean-state` | `cost`

## 各策略必需 gate

> 探索策略走快速通道时跳过全部 gate；仅结构化分析路径执行以下 gate。

| 策略 | 必需 gate                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 探索 | `analysis` + `skill-activation`(evidence: read-only) + `knowledge-reuse`(evidence: analysis-only) + `knowledge-distribution` + `clean-state`                                                           |
| 修复 | `build` + `test` + `self-verification` + `skill-activation` + `knowledge-reuse`(evidence: relevant) + `knowledge-distribution` + `clean-state`                                                         |
| 实现 | `build` + `test` + `lint` + `coverage` + `self-verification` + `self-critique` + `skill-activation` + `knowledge-reuse` + `knowledge-distribution` + `clean-state`                                     |
| 重构 | `build` + `test` + `coverage` + `security` + `adversarial` + `self-verification` + `self-critique` + `skill-activation` + `knowledge-reuse`(evidence: full) + `knowledge-distribution` + `clean-state` |

---

## `self-verification` gate

**触发**：策略 = 修复/实现/重构，每个 QuestResult 产出后自动触发。

**验证维度**：语法正确性 | 逻辑一致性 | 边界值覆盖 | 错误处理 | 性能影响

**输出格式**：

```json
{
  "gate": "self-verification",
  "status": "pass | warning | fail",
  "issues": [
    {
      "severity": "critical | high | medium | low",
      "category": "syntax | logic | boundary | error-handling | performance",
      "description": "具体问题描述",
      "autoFixed": true | false,
      "location": "file:line"
    }
  ],
  "summary": "自我验证摘要"
}
```

**处置**：pass → 继续 | warning → 记录放行 | fail → 回流 EXECUTE

---

## `self-critique` gate

**触发**：策略 = 实现/重构，每关完成后立即触发。产出 `.auto/runs/<runId>/quest-<N>-critique.md`。

**与 self-verification 的差异**：

| Gate              | 关注层次                                 | 输出                              |
| ----------------- | ---------------------------------------- | --------------------------------- |
| self-verification | 代码语法/逻辑/边界/错误处理              | 代码缺陷修正                      |
| self-critique     | 本关是否真满足 objective（主线漂移防范） | 达成度评分 + 盲点 + 是否回退 PLAN |

**验证维度**：objective 满足度 | 盲点暴露（≥1 条「最不放心的事」）| outOfScope 合规 | 达成度评分 0-100

**处置**：

- pass：达成度 ≥ 70 且盲点已处理 → 继续
- warning：达成度 70-85 但盲点未完全处理 → 记录放行
- fail：达成度 < 70 或 outOfScope 违规 → 回流 PLAN

**跳过**：策略=探索；策略=修复且单关 < 20 行。

---

## `skill-activation` gate

**验证逻辑**：对每个激活 Skill（top-3）检查 QuestResult.validations 中的证据条目。每条证据须包含 skill 名称 + 提取要素 + 代码位置/决策点。

| 结果    | 条件                             | 处置         |
| ------- | -------------------------------- | ------------ |
| pass    | 所有激活 Skill 均有 ≥1 条证据    | 继续         |
| warning | ≤50% 缺少证据但核心 Skill 已应用 | 记录放行     |
| fail    | >50% 无证据或核心 Skill 未应用   | 回流 EXECUTE |

**跳过**：探索模式且无激活 Skill。

**证据格式**（写入 QuestResult.validations）：

```json
{
  "name": "skill-activation",
  "skillName": "systematic-debugging",
  "status": "pass",
  "evidence": "读 skill 缓存/快速使用段（42 行），提取 checklist + anti-patterns，在 Quest 3 错误处理中应用了根因追踪方法（见 file.ts:L45-L62）"
}
```

---

## `knowledge-reuse` gate

**验证逻辑**：核对 PLAN 阶段注入 RouteDecision.notes 中的 insight 摘要是否在 EXECUTE 中被参考。

**简化检查**：

1. 从 RouteDecision.notes.relevantInsights 提取注入的 insight 列表
2. 检查 QuestResult.validations 中是否有引用对应 insight 的证据
3. 无须检查 `[insight:]` 格式标记（该标记在实践中未被遵守）

| 结果    | 处置                                   |
| ------- | -------------------------------------- |
| pass    | 有注入的 insight 且 EXECUTE 有参考证据 |
| warning | 首次未达标，记录但放行                 |
| fail    | 同项目/同关键词组连续 2 次未达标       |

**跳过**：RouteDecision 中无注入 insight；insight-index 不存在或为空。

---

## `knowledge-distribution` gate

**验证逻辑**：核对 LearnCard 是否已从 `learn-cards.md` 分发（Edit append）到 `.auto/insights/` 对应文件。只停留在 `learn-cards.md` 未 append = 未分发。

**验证步骤**：

1. Read `learn-cards.md`，提取所有 `category` 字段
2. 对每张有 category 的 LearnCard，Grep 其 `title` 在对应 insights 文件中是否存在
3. 未找到 → 未分发

**分发清单（硬约束）**：

| LearnCard.category | 目标文件                                                                           |
| ------------------ | ---------------------------------------------------------------------------------- |
| trap               | `.auto/insights/traps.md`                                                          |
| pattern            | `.auto/insights/patterns.md`                                                       |
| decision           | `.auto/insights/decisions.md`                                                      |
| prompt             | `.auto/insights/prompts.md`                                                        |
| feedback           | `.auto/insights/agent-feedback.md` + `.auto/feedback/agents.json` 或 `skills.json` |

| 结果    | 条件                                            | 处置       |
| ------- | ----------------------------------------------- | ---------- |
| pass    | 所有 LearnCard 已 append 到对应文件             | 关闭 run   |
| warning | <50% 未分发但全部 trap/critical decision 已分发 | 记录放行   |
| fail    | ≥50% 未分发或任意 trap 未进 traps.md            | 回流 LEARN |

**最小 append 格式**：

```markdown
### <标题>

**日期**: YYYY-MM-DD | **置信度**: high|medium|low | **来源**: run-<runId>

<2-3 句核心描述 + 推荐动作>
```

---

## `clean-state` gate

**验证维度**：

1. startupAndTestsPass — 启动验证命令通过
2. progressLogReflectsReality — quest-status.json 与实际代码状态一致
3. noHalfFinishedWorkRemains — 无孤立变更
4. repoRestartableViaStandardPath — 新会话可标准路径启动

**处置**：4 项全 pass → 关闭 run | 1-2 项 false 但非关键 → warning 放行 | 关键项 false → 阻断 LEARN

---

## `analysis` gate（探索策略专用）

**验证**：分析产出是否回答了用户的原始问题。检查 QuestResult 中是否有明确的分析结论，结论是否覆盖了 RouteDecision.userIntent 的所有方面。

---

## `build` / `test` / `lint` / `coverage` / `security` / `adversarial` / `cost` gates

**通用模式**：运行对应命令（如 `npm run build`、`npm test`、`npm run lint`），收集输出，判定 pass/warning/fail。

**关键规则**：

- 实测优先于断言（Run-Don't-Claim）：必须附带实际命令 + 输出尾部 ≥3 行作为 evidence
- 预测后验证（Predict-Then-Verify）：跑命令前先预测结果，预测错 = 理解错，必须停下修理解

---

## Phase 交接自检原则

以下自检在各 Phase 关键节点触发。严重命中需回流加固。

| 节点           | 自检项                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCAN → PLAN    | `[C]` 自己用会满意？回避了最痛边角？ `[P]` 有更小版本？ `[A]` 触及哪些架构边界？                                                                                     |
| PLAN → EXECUTE | `[A]` SOLID/单一职责？ `[P]` 每关有用户价值？ `[T]` 6维矩阵？ `[D]` acceptance 可执行？ `[C]` 满足用户原话？                                                         |
| EXECUTE 每关后 | `[D]` 变更可追溯？错误处理覆盖？ `[B]` SQL参数化？N+1？ `[O]` graceful shutdown？ `[T]` 红灯先行？                                                                   |
| VERIFY 后      | `[C]` 最丑输入？反例覆盖？ `[T]` coverage≥80%？并发？ `[B]` 数据迁移可回滚？ `[O]` 监控埋点？ `[A]` 无必要抽象？                                                     |
| SUMMARIZE 前   | `[C]` 用户原话被满足？ `[P]` 核心指标变好？                                                                                                                          |
| LEARN 前       | `[C]` 哪刻差点偷懒？ `[P]` 用户洞察被忽略？ `[A]` 架构决策值得复用？ `[D]` 技巧值得固化？ `[T]` 测试漏检？ `[B]` 数据问题？ `[O]` 生产问题？每命中产出一张 LearnCard |
