---
name: protocol-validator
description: 协议对象 Schema 验证 — 在 Phase 交接前校验 RouteDecision/QuestMap/QuestResult/VerifyReport/LearnCard 字段完整性，防止字段缺失导致下游失败。
tags:
  - validate
  - schema
  - protocol
  - quality
---

# Protocol Validator — 协议对象验证

> 本 Skill 在 Phase 交接前自动触发，按阶段校验已产出的协议对象。验证失败则阻断下游 Phase，回流对应上游 Phase 补全字段。

## 快速使用

```text
/auto 实现一个功能（自动触发）
/auto 检查这次 run 的协议对象是否完整
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] RouteDecision 必填：`id`, `runId`, `correlationId`, `status`, `summary`, `userIntent`, `strategy`, `primaryAgent`, `skills`, `next`
- [ ] QuestMap 必填：`id`, `runId`, `correlationId`, `status`, `summary`, `routeDecisionId`, `goal`, `executionMode`, `quests[]`（每关必填 `questId`, `objective`, `ownerAgent`, `acceptance`）
- [ ] QuestResult 必填：`id`, `runId`, `correlationId`, `status`, `summary`, `questId`, `attempt`, `ownerAgent`, `changedFiles`
- [ ] VerifyReport 必填：`id`, `runId`, `correlationId`, `status`, `summary`, `gateResults[]`（每项必填 `name`, `status`）, `overallStatus`, `nextAction`
- [ ] LearnCard 必填：`id`, `runId`, `correlationId`, `status`, `summary`, `category`, `title`, `confidence`, `targetInsightFile`, `scope`

**硬约束** (constraints):

- 实现/重构策略下 QuestMap 缺少 `assumptions[]` / `alternatives[]` / `riskMatrix[]` / `reflexionNote` → 阻断 EXECUTE
- QuestResult 失败时缺少 `failureContext.recommendedNext` → 阻断 VERIFY
- VerifyReport 中失败 gate 缺少 `gateResults[].evidence` 或 `gateResults[].recommendedNext` → 阻断 SUMMARIZE
- LearnCard 缺少 `category` 或 `scope` → 无效，回流 LEARN

**输出模板** (output):

```json
{
  "gate": "protocol-validator",
  "status": "pass | warning | fail",
  "validatedObjects": [
    {
      "kind": "RouteDecision | QuestMap | QuestResult | VerifyReport | LearnCard",
      "id": "<object-id>",
      "missingFields": ["field1", "field2"],
      "optionalMissingFields": ["field3"]
    }
  ],
  "blockingIssues": [
    {
      "objectKind": "<kind>",
      "objectId": "<id>",
      "field": "<field>",
      "severity": "critical | warning",
      "recommendedNext": "下一步建议动作"
    }
  ]
}
```

**反模式** (anti-patterns):

- 把 optional 字段当必填（过度验证）
- 只报问题不给修复建议
- 验证失败不阻断下游（形同虚设）

---

## 序列化与校验真源

新 run 的五类协议对象使用 JSON：单对象文件可写原始 JSON 或一个 `json` fenced block；QuestResult / LearnCard 列表可用 JSON 数组或多个 `json` block。`index.md` 保留人类可读摘要。JSON block 只放协议对象，示例和日志使用其他代码块。

围栏支持 0–3 个前导空格、至少 3 个反引号或波浪号；闭合符必须同类且不短于起始符。多个协议块全部解析，未闭合或损坏的 JSON 必须报错；非 JSON 围栏内的嵌套示例不作为协议对象。

字段与类型的可执行真源是仓库 `scripts/run-protocol.js` 的 `RUN_CONTRACT` 与条件检查；`validate-run-completeness.js`、`generate-metrics.js`、`dashboard.js` 共用该模块。本页激活摘要用于阅读，不另维护一份 JSON schema。安装环境没有仓库脚本时按摘要人工检查，不能声称运行过脚本校验。

- 所有对象具有非空 `id / runId / correlationId / status / summary`；同 run 的关联 ID 一致，runId 等于目录名。
- RouteDecision 使用 `skills` 字符串数组；`selection.selectedSkills` 仅可作辅助说明，不能替代该字段。
- QuestMap 的 `routeDecisionId` 指向 RouteDecision；questId 唯一，acceptance 为字符串数组。实现/重构还需 `assumptions / alternatives / riskMatrix` 数组与 `reflexionNote`。
- QuestResult 的 status 为 v1 `pending / running / completed / failed / skipped / blocked` 或 v2 新增 `succeeded / cancelled / suspended`；attempt 为正整数，`questId + attempt` 唯一；已提供计划时必须引用其中的 Quest。失败需 `failureContext.recommendedNext` 与 `retry` 对象。
- VerifyReport 使用 `gateResults`，每项有 `name / status`；状态为 `pass / fail / warning / skipped / pending / not_applicable`。失败项需要 evidence 和 recommendedNext；`not_applicable` 需要 evidence 写明理由；evidence 必须含实际内容（空白字符串、null 与空容器不算）；存在 fail/pending 时 overallStatus 不能标 pass；overallStatus 为 `not_applicable` 当且仅当 gateResults 非空且全部为 `not_applicable`。
- LearnCard 的 category 为 `trap / pattern / decision / prompt / feedback`，scope 为 `project / stack / universal`，confidence 为 `low / medium / high`。

旧自由 Markdown 仅做基础完整性检查，输出 `protocolMode: legacy` 警告，不等同协议校验通过；新 run 不混用两种格式。结构化对象缺字段、类型错误或 JSON 损坏时必须失败，不回退为关键词检查。

`knowledge-reuse` 声明 pass 时，显式反馈引用使用 `[feedback:skills.json#key]` / `[feedback:agents.json#key]`（兼容旧的 `:key`）。按 `skills/knowledge-management/references/feedback-contract.md` 校验引用条目：扁平为真源，旧包装层兼容；同 key 双处出现拒绝歧义。保留元数据不能作为条目，计数与观测率必须有效；旧率无观测不参与路由。此检查不证明证据内容或因果收益。

## 指标边界

`metrics.json` 使用 `auto-metrics/v2`：技能来自 `skills`，门禁来自 `gateResults`；Quest 完成/失败数按最大 attempt 的结果统计，`completed` 与 `succeeded` 都计为完成。门禁通过率为 pass / 适用门禁（全部门禁减去 `not_applicable`，含 warning、skipped、pending），适用数为零时通过率为 null；`gates.applicable` 记录该分母，`gates.notApplicable` 单独计数。

缺失或无效观测写 `null` 并记录 unavailable；仅真实空数组计零。耗时、文件读写、agent 调用当前没有遥测来源，不能从摘要文字或 primaryAgent 推算。status 来自 VerifyReport.overallStatus，缺失为 unknown；非法协议为 invalid。声明使用技能不等于实际应用收益。

Dashboard 直接从当前协议工件调用同一收集器，避免旧 metrics 缓存覆盖新证据；未知观测不进入均值和通过率。回归用例见 `tests/scripts/`。

---

## 与 auto-cli 集成

| Phase 交接         | 校验对象      |
| ------------------ | ------------- |
| SCAN → PLAN        | RouteDecision |
| PLAN → EXECUTE     | QuestMap      |
| EXECUTE → VERIFY   | QuestResult   |
| VERIFY → SUMMARIZE | VerifyReport  |
| LEARN 后           | LearnCard     |

---

## 验收标准

- [ ] 实现/重构策略下 QuestMap 缺少 `assumptions[]` / `riskMatrix[]` → 阻断 EXECUTE
- [ ] QuestResult 失败时缺少 `failureContext.recommendedNext` → 阻断 VERIFY
- [ ] LearnCard 缺少 `category` → 无效，回流 LEARN
- [ ] 所有验证失败都提供 `recommendedNext`
- [ ] 不验证 optional 字段（如 `decisionNotes`, `pitfalls`）
