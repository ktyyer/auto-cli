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

### 对象职责

| 对象            | 产出阶段 | 作用                                           | 关键字段                                                                 |
| --------------- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| `RouteDecision` | SCAN     | 固化路由、策略、主 Agent、回退链               | `userIntent`, `strategy`, `complexity`, `primaryAgent`, `fallbackAgents` |
| `QuestMap`      | PLAN     | 固化 Quest 拆解、依赖、合约、回滚策略          | `quests[]`, `contracts[]`, `globalAcceptance[]`, `failurePolicy`         |
| `QuestResult`   | EXECUTE  | 固化单关执行结果、重试信息、失败上下文         | `questId`, `attempt`, `changedFiles`, `validations[]`, `failureContext`  |
| `VerifyReport`  | VERIFY   | 固化门禁、对抗验证和修复建议                   | `gateResults[]`, `overallStatus`, `failedGates`, `nextAction`            |
| `LearnCard`     | LEARN    | 固化可复用知识单元，再分发到 insights/feedback | `category`, `recommendedAction`, `confidence`, `targetInsightFile`       |

### RouteDecision 标准对象

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
      "pitfalls": ["<预判坑点1>", "<预判坑点2>"]
    }
  ]
}
```

### QuestResult 标准对象

```json
{
  "protocolVersion": "auto-md/v1",
  "kind": "QuestResult",
  "id": "quest-result-<id>",
  "runId": "run-<id>",
  "phase": "EXECUTE",
  "status": "success | partial | failed | skipped",
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
    "errorType": "unknown | build | test | security | logic",
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
      "name": "build | test | lint | security | adversarial",
      "required": true,
      "command": "<命令>",
      "status": "pass | fail | skipped",
      "evidence": "<输出摘要>",
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
- 不把 `cache/` 当作知识真源，长期复用只写入 `.auto/insights/`、`.auto/feedback/` 或 `.auto/memory/`
