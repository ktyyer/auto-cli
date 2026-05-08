---
name: shared-principles
description: Agent 公共原则和交接协议 — 通用工作流、报告格式、Agent 间交接路径和边界约束
tags: [shared, protocol, handoff, agent, principles]
---

# Agent 公共原则

> 此文件定义所有 Agent 共享的基础原则。各 Agent .md 文件无需重复这些内容。

## 通用工作流

1. **Read 先行** — 修改前必须先读取目标文件，理解现有代码
2. **最小改动** — 只改需要改的，不做"顺手"重构
3. **增量验证** — 每次修改后运行相关测试确认无回归
4. **风格继承** — 严格遵循项目既有的编码风格和命名约定

## 报告格式

所有 Agent 输出报告时遵循统一结构：

1. 摘要（问题数量/严重级别）
2. 详情（按严重级别排序）
3. 修复建议（具体到文件和行号）
4. 验证步骤

## AUTO_PROTOCOL v1

`/auto` 的标准产物统一为 5 类对象：`RouteDecision`、`QuestMap`、`QuestResult`、`VerifyReport`、`LearnCard`。

旧术语兼容映射：

- `DISCOVER` = `SCAN`
- `REASON` = `PLAN`

### 公共头部

所有对象必须先输出 JSON 协议块，再输出人类可读摘要。

```json
{
  "protocolVersion": "auto-md/v1",
  "kind": "RouteDecision | QuestMap | QuestResult | VerifyReport | LearnCard",
  "id": "对象 ID",
  "runId": "run-<id>",
  "phase": "SCAN | PLAN | EXECUTE | VERIFY | SUMMARIZE | LEARN",
  "status": "success | partial | failed | skipped",
  "summary": "一句话摘要",
  "source": "command/agent 名称",
  "refs": {
    "artifacts": ["上游对象 ID"],
    "files": ["相关文件路径"]
  },
  "handoff": {
    "toPhase": "下游 PHASE",
    "ready": true,
    "blockingIssues": []
  }
}
```

### Phase 硬约束

| Phase     | 必需上游对象                   | 必需落盘 / 输出                                                              | 允许进入下游的条件                                     |
| --------- | ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `SCAN`    | 用户需求 + 项目上下文          | `RouteDecision`（内含 `capabilitySnapshot` + `selection`）                   | `RouteDecision.status=success` 且 `handoff.ready=true` |
| `PLAN`    | `RouteDecision`                | `QuestMap`                                                                   | `QuestMap.status=success` 且 `handoff.ready=true`      |
| `EXECUTE` | `QuestMap`                     | `QuestResult`                                                                | 至少 1 个 `QuestResult` 已生成                         |
| `VERIFY`  | `QuestResult`                  | `VerifyReport`                                                               | `VerifyReport.status!=failed` 或显式回流到 `EXECUTE`   |
| `LEARN`   | `QuestResult` + `VerifyReport` | `LearnCard`（必要）；若当前 run 需续接，则补全或更新 `session-continuity.md` | 仅在有可验证来源时写入跨 run 知识                      |

硬规则：

1. `PLAN` 不得在 `RouteDecision` 缺失时继续。
2. `EXECUTE` 不得绕过 `QuestMap` 直接开始修改。
3. `VERIFY` 不得在没有 `QuestResult` 时伪造验证结论。
4. `LEARN` 默认依赖 `VerifyReport`；唯一例外是独立 `/auto:learn --git` 可基于 Git 证据生成 `LearnCard`。
5. 任一阶段如发现上游对象缺失，必须显式输出 `blockingIssues`，而不是静默续行。
6. 当 run 需要跨阶段或跨会话继续时，当前 phase 必须立即写入 `.auto/runs/<runId>/session-continuity.md`；LEARN 仅负责收尾时补全或更新。

### 真源与缓存边界

- `.auto/runs/<runId>/` 是单次 run 的协议真源。
- `.auto/feedback/` 是跨 run 的结构化反馈真源。
- `.auto/insights/` 是长期人类可读知识视图。
- `.auto/cache/` 仅作派生缓存，不作为长期知识真源。
- legacy 文件或路径可继续读取，但新写入必须优先走 `.auto/runs/`、`.auto/feedback/`、`.auto/insights/`。

### insight-index 派生对象

`.auto/cache/insight-index.json` 是 LEARN 阶段维护的反向索引，用于让 SCAN/PLAN 阶段把「按印象 grep」升级为「程序化反查」。

**只读真源仍是 `.auto/insights/*.md`**；索引仅作派生缓存，重建无副作用。

```json
{
  "version": "auto-md/v1",
  "lastUpdated": "YYYY-MM-DD",
  "by_tag": {
    "<tag>": [
      {
        "file": "traps.md | patterns.md | decisions.md | prompts.md | agent-feedback.md",
        "section": "<heading 标题>",
        "confidence": "low | medium | high"
      }
    ]
  },
  "by_keyword": {
    "<keyword 小写>": [{ "file": "...", "section": "..." }]
  }
}
```

**维护时机**：每次 LEARN 阶段产出 `LearnCard` 后，必须更新本索引。详见 `commands/auto/learn.md` 「insight-index 维护」节。

**消费时机**：

- `PHASE 2.1` 知识检索：先按 `by_keyword` 反查，再按 `by_tag` 命中
- `PHASE 4` knowledge-reuse gate：核对 `QuestMap.routeHintsUsed` 中的 `[insight:<file>#<title>]` 引用数 ≥ 索引命中数 × 0.5

### 能力快照与选择的单对象规则

- `capabilitySnapshot` 与 `selection` 不是独立协议对象，而是 `RouteDecision` 的内嵌字段。
- `SCAN` / `route` 可以先收集事实、再做选择，但对下游的唯一标准产物仍是 `RouteDecision`。
- `.auto/cache/capability-snapshot.json` 可作为派生缓存存在，但不替代 `RouteDecision` 作为 PHASE 间 handoff 真源。
- `selection.selectedAgents` / `selection.selectedSkills` 是选择过程记录；最终 handoff 仍以顶层 `primaryAgent`、`fallbackAgents`、`skills` 为准。

### 对象职责

| 对象            | 产出阶段 | 作用                                           | 关键字段                                                                                      |
| --------------- | -------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `RouteDecision` | SCAN     | 固化路由、策略、主 Agent、回退链               | `capabilitySnapshot`, `selection`, `userIntent`, `strategy`, `primaryAgent`, `fallbackAgents` |
| `QuestMap`      | PLAN     | 固化 Quest 拆解、依赖、合约、回滚策略          | `quests[]`, `contracts[]`, `globalAcceptance[]`, `failurePolicy`                              |
| `QuestResult`   | EXECUTE  | 固化单关执行结果、重试信息、失败上下文         | `questId`, `attempt`, `changedFiles`, `validations[]`, `failureContext`                       |
| `VerifyReport`  | VERIFY   | 固化门禁、对抗验证和修复建议                   | `gateResults[]`, `overallStatus`, `failedGates`, `nextAction`                                 |
| `LearnCard`     | LEARN    | 固化可复用知识单元，再分发到 insights/feedback | `category`, `recommendedAction`, `confidence`, `targetInsightFile`                            |

### RouteDecision 标准对象

必填：`id`, `runId`, `status`, `summary`, `userIntent`, `strategy`, `primaryAgent`, `skills`, `next`。
选填：`normalizedTask`, `complexity`, `sensitivity`, `fallbackAgents`, `reasoning`, `preflight`, `capabilitySnapshot`（完整 SCAN 必填）, `selection`。

```json
{
  "protocolVersion": "auto-md/v1",
  "kind": "RouteDecision",
  "id": "route-<id>",
  "runId": "run-<id>",
  "phase": "SCAN",
  "status": "success",
  "summary": "一句话说明路由决策",
  "source": "/auto:route",
  "refs": {
    "artifacts": [],
    "files": []
  },
  "handoff": {
    "toPhase": "PLAN",
    "ready": true,
    "blockingIssues": []
  },
  "capabilitySnapshot": {
    "repoMap": "present | missing",
    "commands": ["<command>"],
    "agents": ["<agent>"],
    "skillsCatalog": ["<skill>"],
    "insightFiles": ["<insightFile>"],
    "feedbackFiles": ["<feedbackFile>"],
    "legacySignals": ["<legacySignal>"]
  },
  "selection": {
    "selectedAgents": ["<agent>"],
    "selectedSkills": ["<skill>"],
    "rejectedCapabilities": [
      {
        "name": "<capability>",
        "reason": "<why not selected>"
      }
    ],
    "routeHintsUsed": ["<hint>"]
  },
  "userIntent": "<原始输入>",
  "normalizedTask": "<归一化任务摘要>",
  "strategy": "explore | fix | implement | refactor",
  "complexity": "low | medium | high",
  "sensitivity": "low | medium | high",
  "primaryAgent": {
    "name": "<name>",
    "priority": 0,
    "reason": "<matchReason>"
  },
  "fallbackAgents": [
    {
      "name": "<fallback>",
      "priority": 0,
      "reason": "<fallback reason>"
    }
  ],
  "skills": ["<skill1>", "<skill2>"],
  "reasoning": ["<理由1>", "<理由2>"],
  "preflight": {
    "doctorResult": "optional",
    "statusSnapshot": "optional"
  },
  "next": "planDirectly | useQuestDesigner"
}
```

### QuestMap 标准对象

必填：`id`, `runId`, `status`, `summary`, `routeDecisionId`, `goal`, `executionMode`, `quests[]`（每关必填 `questId`, `objective`, `ownerAgent`, `acceptance`）。
选填：`contracts`, `globalAcceptance`, `failurePolicy`, `knowledgeHints`, `costCaps`, quest 内 `skills`, `dependsOn`, `inputs`, `outputs`, `touchFiles`, `risk`, `rollback`, `decisionNotes`, `pitfalls`, `thinkingDepth`（`light | standard | deep`，映射执行侧 think/ultrathink 深度）。

**实现 / 重构策略下的额外必填字段**（思考充分度门禁）：

- `assumptions[]` — 每个假设需含 `text`（假设内容）+ `counterexample`（≥1 反例）
- `alternatives[]` — ≥1 个备选方案（即使最终未选用，也要记录）
- `riskMatrix[]` — 每条含 `risk`（风险描述）+ `impact`（low/medium/high）+ `mitigation`（缓解措施）
- `reflexionNote` — 一行：当前 QuestMap 我最不放心的是哪一关？为什么？

缺失任一则 PHASE 2 → PHASE 3 不允许 handoff（与 PHASE 2.4 「30 秒 Reflexion」联动）。

```json
{
  "protocolVersion": "auto-md/v1",
  "kind": "QuestMap",
  "id": "quest-map-<id>",
  "runId": "run-<id>",
  "phase": "PLAN",
  "status": "success",
  "summary": "一句话说明任务拆解结果",
  "source": "quest-designer 或主窗口",
  "refs": {
    "artifacts": ["route-<id>"],
    "files": ["涉及文件路径"]
  },
  "handoff": {
    "toPhase": "EXECUTE",
    "ready": true,
    "blockingIssues": []
  },
  "routeDecisionId": "route-<id>",
  "goal": "<任务总目标>",
  "executionMode": "direct | sequential | parallel | orchestrated",
  "contracts": [
    {
      "name": "CONTRACT-1",
      "producer": "quest-1",
      "consumers": ["quest-2"],
      "summary": "<合约摘要>"
    }
  ],
  "globalAcceptance": ["编译通过", "相关测试通过", "关键门禁通过"],
  "failurePolicy": {
    "maxAttempts": 2,
    "retryPlan": ["same_path", "alternative_path_or_agent"],
    "escalateTo": "build-error-resolver",
    "rollbackScope": "quest_only"
  },
  "knowledgeHints": ["<可沉淀经验1>", "<可沉淀经验2>"],
  "costCaps": {
    "fileWrites": 50,
    "fileReads": 200,
    "bashCalls": 30,
    "maxQuests": 15
  },
  "quests": [
    {
      "questId": "quest-1",
      "title": "<关卡标题>",
      "objective": "<一句话目标>",
      "ownerAgent": "direct | tdd-guide | code-reviewer | security-reviewer | build-error-resolver",
      "skills": ["<skill1>"],
      "dependsOn": [],
      "inputs": ["<输入合约或上下文>"],
      "outputs": ["<输出物>"],
      "touchFiles": ["<文件路径>"],
      "acceptance": ["<验收标准1>", "<验收标准2>"],
      "risk": "low | medium | high",
      "rollback": "<当前 Quest 的回滚范围和方式>",
      "decisionNotes": ["<决策1>", "<决策2>"],
      "pitfalls": ["<预判坑点1>", "<预判坑点2>"],
      "thinkingDepth": "light | standard | deep"
    }
  ]
}
```

### QuestResult 标准对象

必填：`id`, `runId`, `status`, `summary`, `questId`, `attempt`, `ownerAgent`, `changedFiles`。
选填：`diffSummary`, `validations`, `producedOutputs`, `producedContracts`, `decisionNotes`。
失败时必填：`failureContext`（含 `errorType`, `errorSummary`）, `retry`。

```json
{
  "protocolVersion": "auto-md/v1",
  "kind": "QuestResult",
  "id": "quest-result-<id>",
  "runId": "run-<id>",
  "phase": "EXECUTE",
  "status": "success | partial | failed | skipped | cost_exceeded",
  "summary": "一句话说明本关结果",
  "source": "执行该关的 command/agent",
  "refs": {
    "artifacts": ["quest-map-<id>"],
    "files": ["变更文件路径"]
  },
  "handoff": {
    "toPhase": "VERIFY",
    "ready": true,
    "blockingIssues": []
  },
  "questId": "quest-<id>",
  "attempt": 1,
  "ownerAgent": "direct | tdd-guide | code-reviewer | security-reviewer | build-error-resolver",
  "changedFiles": ["<文件路径>"],
  "diffSummary": "+N / -N",
  "validations": [
    {
      "name": "build | test | lint | analysis",
      "command": "<命令>",
      "status": "pass | fail | skipped"
    }
  ],
  "producedOutputs": ["<输出物>"],
  "producedContracts": ["CONTRACT-1"],
  "decisionNotes": ["<决策1>", "<决策2>"],
  "failureContext": {
    "errorType": "unknown | build | test | security | logic | cost",
    "errorSummary": "<一句话错误摘要>",
    "failedCommand": "<失败命令>",
    "rootCauseHypothesis": "<根因假设>",
    "suggestedFallbackAgent": "<候选 Agent>"
  },
  "retry": "same_path | alternative_path_or_agent | escalate_build_error_resolver | none",
  "rollbackApplied": false
}
```

### VerifyReport 标准对象

必填：`id`, `runId`, `status`, `summary`, `gateResults[]`（每项必填 `name`, `status`）, `overallStatus`, `nextAction`。
选填：`scope`, `targetIds`, `failedGates`, `evidence`, `remediationPlan`, `rollbackRecommendation`。

```json
{
  "protocolVersion": "auto-md/v1",
  "kind": "VerifyReport",
  "id": "verify-<id>",
  "runId": "run-<id>",
  "phase": "VERIFY",
  "status": "success | partial | failed | skipped",
  "summary": "一句话验证结论",
  "source": "verification 或主窗口",
  "refs": {
    "artifacts": ["quest-result-<id>"],
    "files": ["验证涉及文件路径"]
  },
  "handoff": {
    "toPhase": "SUMMARIZE | EXECUTE",
    "ready": true,
    "blockingIssues": []
  },
  "scope": "quest | run",
  "targetIds": ["quest-result-<id>"],
  "gateResults": [
    {
      "name": "analysis | build | test | lint | coverage | security | adversarial | cost",
      "required": true,
      "command": "<命令>",
      "status": "pass | fail | skipped",
      "evidence": "<输出摘要；可附带 analysis-only / no-code-change / relevant / full 等范围信息>",
      "owner": "main | verification",
      "fixHint": "<修复建议>"
    }
  ],
  "overallStatus": "pass | warn | fail",
  "failedGates": ["<gate>"],
  "evidence": ["<证据1>", "<证据2>"],
  "remediationPlan": ["<修复动作1>", "<修复动作2>"],
  "rollbackRecommendation": "quest_only | none",
  "nextAction": "SUMMARIZE | EXECUTE | ABORT"
}
```

### LearnCard 标准对象

必填：`id`, `runId`, `status`, `summary`, `category`, `title`, `confidence`, `targetInsightFile`。
选填：`context`, `trigger`, `recommendedAction`, `antiPattern`, `evidenceRefs`, `sourcePhase`, `sourceArtifacts`, `tags`, `failureClass`。

```json
{
  "protocolVersion": "auto-md/v1",
  "kind": "LearnCard",
  "id": "learn-<id>",
  "runId": "run-<id>",
  "phase": "LEARN",
  "status": "success",
  "summary": "一句话经验",
  "source": "auto / auto:learn / 相关 Agent",
  "refs": {
    "artifacts": [
      "可为空；如 route-<id> / quest-map-<id> / quest-result-<id> / verify-<id> / git-log:<range>"
    ],
    "files": ["相关文件路径"]
  },
  "handoff": {
    "toPhase": "SCAN",
    "ready": true,
    "blockingIssues": []
  },
  "category": "trap | pattern | decision | prompt | feedback",
  "title": "<标题>",
  "context": "<上下文>",
  "trigger": "<触发条件>",
  "recommendedAction": "<推荐动作>",
  "antiPattern": "<反模式>",
  "evidenceRefs": ["<证据1>"],
  "sourcePhase": "SCAN | PLAN | EXECUTE | VERIFY | SUMMARIZE | LEARN",
  "sourceArtifacts": [
    "可为空；按来源填写 route-<id> / quest-map-<id> / quest-result-<id> / verify-<id> / git-log:<range>"
  ],
  "tags": ["<tag1>", "<tag2>"],
  "failureClass": "timeout | network | logic | resource",
  "confidence": "low | medium | high",
  "targetInsightFile": ".auto/insights/<file>.md"
}
```

## Agent 间交接协议

### 交接上下文

交接时必须携带：

- `runId`
- 当前对象 `id`
- `refs.artifacts` 与 `refs.files`
- `handoff.toPhase`
- `handoff.blockingIssues`
- 当前已确认的决策、失败上下文和剩余待办

下游必须优先消费上游协议块，再读取人类可读摘要。

### 交接摘要

协议块之后，使用简明摘要补充：

- 来源：当前 Agent / command
- 目标：下游阶段或下游 Agent
- 任务：原始任务描述
- 关键决策：本阶段已固定的决策
- 待处理：下游仍需完成的事项
- 注意事项：边界条件、已知问题、阻塞项

## 失败状态机

统一失败协议如下：

1. **attempt 1 — same_path**：沿当前方案做最小差异修复
2. **attempt 2 — alternative_path_or_agent**：切换实现路径或更换 Agent
3. **escalate — build-error-resolver**：仍失败时升级到 `build-error-resolver`
4. **fail — quest rollback / abort**：若升级后仍失败，只回滚当前 Quest 触及的文件并终止当前 run

禁止默认使用仓库级全局回滚作为常规失败策略。

## 失败学习闭环

`VERIFY` 任何 gate `status=fail`，或 `EXECUTE` 触发 `attempt 2 / escalate / fail` 任一升级路径时，**当前 Phase 必须**在产出 `VerifyReport` 之前/同时产出一张 `LearnCard(category=trap)`，并立即落盘到 `.auto/insights/traps.md`。

最小字段：

- `category: trap`
- `title`：失败现象的一句话描述
- `trigger`：失败前可观测的征兆（错误码、命令输出关键词、调用上下文）
- `recommendedAction`：下次遇到同征兆的处置（如 fallback 路径、替代 Agent、跳过条件）
- `tags`：≥ 1 个可被关键词匹配的标签
- `targetInsightFile: .auto/insights/traps.md`

下次 `PHASE 2.1` 知识检索时，按 `tags` 命中即注入 `QuestMap.pitfalls`，从而保证「同样错误不犯第二次」。

> 注：`build-error-resolver` 升级路径上的失败也适用本约束 — 升级前的失败上下文必须先沉淀为 trap，再交给 resolver。

## 失败模式分类

失败学习闭环产出的 `LearnCard(category=trap)` 必须附带 `failureClass` 字段，按以下 4 类标注：

| 分类       | 特征                               | 典型触发                                | 推荐处置                       |
| ---------- | ---------------------------------- | --------------------------------------- | ------------------------------ |
| `timeout`  | 超过预设时间阈值                   | API 调用超时、构建超时、Agent 执行超时  | 增大超时 + 重试 + 排查瓶颈     |
| `network`  | 连接失败 / DNS 解析失败 / 连接重置 | ECONNREFUSED、ENOTFOUND、socket hang up | 重试 + 退避 + 检查依赖可用性   |
| `logic`    | 断言失败 / 类型错误 / 业务逻辑错误 | 测试红灯、类型检查失败、验收标准不满足  | 修复代码 + 补充测试 + 更新假设 |
| `resource` | 内存不足 / 磁盘满 / 连接池耗尽     | OOM、ENOENT、连接池 timeout             | 释放资源 + 调整配额 + 扩容     |

`LearnCard` 中 `failureClass` 与 `tags` 配合使用：`failureClass` 粗分类用于统计趋势（哪类失败最多），`tags` 细分类用于关键词匹配和知识检索。

## 7 角色定义

`/auto` 编排时同时融入 7 个生产视角，每个 PHASE 主导角色不同（详见 `commands/auto.md` 各 PHASE 末尾的「角色快检」blockquote）。

| 简称 | 角色         | 核心问                                       | 主导 PHASE              |
| ---- | ------------ | -------------------------------------------- | ----------------------- |
| C    | 挑剔用户     | 我自己用都不会满意吗？真实最丑陋输入会怎样？ | SCAN / SUMMARIZE        |
| P    | 顶级产品     | 衡量成功的指标？有没有更小的版本？           | SCAN / SUMMARIZE        |
| A    | 顶级架构     | 边界 / 依赖单向 / SOLID / 接口契约           | PLAN / VERIFY           |
| D    | 世界顶级开发 | 每行变更可追溯？错误处理覆盖所有路径？       | EXECUTE                 |
| T    | 严格测试     | 红测试在绿之前真失败过？coverage ≥ 80%？     | PLAN / EXECUTE / VERIFY |
| B    | 顶级 DBA     | SQL 参数化？索引覆盖？事务边界？N+1？        | EXECUTE / VERIFY        |
| O    | 顶级运维     | graceful shutdown？correlation-id？监控？    | EXECUTE / VERIFY        |

### 嵌入原则

- 7 角色不是新增 7 个 agent，而是「checklist 视角」融入 6 PHASE
- 每个 PHASE 出口前必须过完所属角色 checklist；严重命中补充到 `QuestMap.pitfalls` 或 `VerifyReport.findings`
- 7 角色思想统一定义在本节，PHASE 文档以 blockquote 引用，避免重复
- LEARN 阶段每个角色复盘对应分类：C/P → prompts.md · A → decisions.md · D → patterns+traps.md · T → test-plan-writer · B → systematic-debugging · O → hooks

## 交接路径

用户意图 → RouteDecision → QuestMap → QuestResult → VerifyReport → LearnCard

标准流程：

1. architect → quest-designer → [tdd-guide | code-reviewer] → verification
2. 失败时：→ build-error-resolver（完成两次尝试后升级）
3. 安全场景：→ security-reviewer（安全敏感关键词触发）
4. 质量场景：code-reviewer → security-reviewer（安全升级 handoff）
5. 架构变更：→ doc-updater（LEARN 阶段检测触发）
6. 死代码：→ refactor-cleaner（deletion-log 触发）
7. E2E：tdd-guide → e2e-runner（Playwright 检测到时 handoff）

Skill 注入和并行/串行编排规则见 `workflow-patterns.md`。

## 交接规则

1. **单向传递** — Agent 只向下游传递，不反向调用
2. **完整上下文** — 交接时包含原始任务、协议块、已做决策和阻塞项
3. **失败升级** — 两次尝试后仍失败才升级到 build-error-resolver
4. **结果回传** — 最终结果回传给编排器，由编排器决定进入 VERIFY / SUMMARIZE / LEARN
5. **先协议后正文** — 先输出标准 JSON 块，再输出人类可读摘要
6. **Quest 级回滚** — 回滚范围仅限当前 Quest 触及文件，不做仓库级默认回滚

## 边界约束

- 不修改与任务无关的文件
- 不添加未请求的新功能
- 不改动项目的配置文件（除非任务明确要求）
- 遵守 `.claude/rules/` 中的编码规范
- 不伪造协议字段；没有证据的字段必须留空或显式标记 `unknown`
- `/auto` 主流程中，不跳过 `VerifyReport` 直接沉淀 `LearnCard`；唯一例外是独立 `/auto:learn --git` 可基于 `git-log:<range>` 等 Git 证据直接生成 `LearnCard`

## Cost-Caps 协议

每次 `/auto` run 的资源消耗必须受以下上限约束，超限自动停止并报告：

| 资源          | 默认上限     | 超限行为                  | 调整方式                       |
| ------------- | ------------ | ------------------------- | ------------------------------ |
| 文件写入次数  | 50 次 / run  | 停止 EXECUTE，进入 VERIFY | `QuestMap.costCaps.fileWrites` |
| 文件读取次数  | 200 次 / run | WARN 日志，不硬停         | `QuestMap.costCaps.fileReads`  |
| Bash 命令次数 | 30 次 / run  | 停止 EXECUTE，进入 VERIFY | `QuestMap.costCaps.bashCalls`  |
| 总 Quest 数   | 15 / run     | 拒绝新增 Quest            | `QuestMap.costCaps.maxQuests`  |

### 落地方式

1. `QuestMap` 可选字段 `costCaps` 覆盖默认值（通常不需要）
2. EXECUTE 阶段每个操作后递增计数器（`Read` / `Write` / `Edit` / `Bash`）
3. 接近上限（≥ 80%）时输出 WARN 日志
4. 达到上限时停止当前 Quest，产出 `QuestResult.status=cost_exceeded`，进入 VERIFY
5. VERIFY 检查已完成的 Quest 是否满足验收标准，未完成的部分标记 `deferred`

- 不把 `cache/` 当作知识真源，长期复用只写入 `.auto/insights/`、`.auto/feedback/` 或 `.auto/memory/`
