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

## 验证规则

### RouteDecision 必填字段

```json
{
  "required": [
    "id",
    "runId",
    "correlationId",
    "status",
    "summary",
    "userIntent",
    "strategy",
    "primaryAgent",
    "skills",
    "next"
  ]
}
```

### QuestMap 必填字段

```json
{
  "required": [
    "id",
    "runId",
    "correlationId",
    "status",
    "summary",
    "routeDecisionId",
    "goal",
    "executionMode",
    "quests"
  ],
  "questRequired": ["questId", "objective", "ownerAgent", "acceptance"],
  "conditional": {
    "if.strategy == 'implement' || strategy == 'refactor'": {
      "require": ["assumptions[]", "alternatives[]", "riskMatrix[]", "reflexionNote"]
    }
  }
}
```

### QuestResult 必填字段

```json
{
  "required": [
    "id",
    "runId",
    "correlationId",
    "status",
    "summary",
    "questId",
    "attempt",
    "ownerAgent",
    "changedFiles"
  ],
  "conditional": {
    "if.status == 'failed'": {
      "require": ["failureContext", "failureContext.recommendedNext", "retry"]
    }
  }
}
```

### VerifyReport 必填字段

```json
{
  "required": [
    "id",
    "runId",
    "correlationId",
    "status",
    "summary",
    "gateResults",
    "overallStatus",
    "nextAction"
  ],
  "gateResultRequired": ["name", "status"],
  "conditional": {
    "if.gateResult.status == 'fail'": {
      "require": ["evidence", "recommendedNext"]
    }
  }
}
```

### correlationId 一致性

同一 `runId` 下的 RouteDecision / QuestMap / QuestResult / VerifyReport / LearnCard 必须使用同一个 `correlationId`；不一致时 fail，回流最早产生错误对象的 Phase。

### LearnCard 必填字段

```json
{
  "required": [
    "id",
    "runId",
    "correlationId",
    "status",
    "summary",
    "category",
    "title",
    "confidence",
    "targetInsightFile",
    "scope"
  ],
  "enum": {
    "category": ["trap", "pattern", "decision", "prompt", "feedback"],
    "scope": ["project", "stack", "universal"],
    "confidence": ["low", "medium", "high"]
  }
}
```

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
