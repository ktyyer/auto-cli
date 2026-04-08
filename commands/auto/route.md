---
description: 使用 Canonical Router 智能路由到最合适的 Agent
---

# /auto:route — 智能 Agent 路由

> 基于 Canonical Router（权威路由器），自动分析用户意图并路由到最合适的 Agent。
> 该命令只做路由，不生成 `QuestMap`，也不执行代码修改。

---

## 使用场景

当你不确定应该使用哪个 Agent 时，使用此命令：

```bash
/auto:route 编写测试用例
```

根据任务语义、能力清单、历史 hints 和项目上下文产出 `RouteDecision`。

---

## Phase 边界

允许：

- 读取项目上下文与能力清单
- 生成 `capabilitySnapshot`
- 生成 `selection`
- 输出标准 `RouteDecision`

禁止：

- 直接生成 `QuestMap`
- 直接执行修改
- 直接输出 `QuestResult` / `VerifyReport`

---

## 路由逻辑

1. **能力快照**：先列出可用 commands / agents / skills / insights / feedback / legacy 信号
2. **意图分析**：提取关键词 + 评估复杂度 + 检测安全敏感性
3. **候选匹配**：基于任务特征、能力清单和项目知识选择最优 Agent / Skill
4. **安全优先**：安全相关意图自动提升 `security-reviewer` 优先级
5. **回退链**：主 Agent 失败时按优先级降级
6. **升级修复**：仅当已存在 `failureContext` 或前两次尝试耗尽时，才把 `build-error-resolver` 作为升级目标

优先级排序（高→低）：

- security-reviewer (95) → architect (85) → quest-designer (82)
- tdd-guide (75) → verification (72) → code-reviewer (70)
- e2e-runner (65) → refactor-cleaner (55) → doc-updater (50)
- `build-error-resolver` 不参与 SCAN 阶段默认主路由；仅用于失败升级

---

## 输出格式

输出一个标准 `RouteDecision` 协议块，其中必须内嵌 `capabilitySnapshot` / `selection`，供 `/auto` 的 PLAN 阶段直接消费。

````markdown
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
    "commands": ["/auto", "/auto:route", "/auto:learn", "/auto:status"],
    "agents": ["quest-designer", "tdd-guide", "code-reviewer"],
    "skillsCatalog": ["workflow-patterns", "git-workflow"],
    "insightFiles": [".auto/insights/patterns.md"],
    "feedbackFiles": [".auto/feedback/agents.json"],
    "legacySignals": ["legacy-feedback-found"]
  },
  "selection": {
    "selectedAgents": ["<agent>"],
    "selectedSkills": ["<skill1>", "<skill2>"],
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
````

### RouteDecision 字段说明

- `capabilitySnapshot`：本次路由前扫描到的事实层能力，不带推荐色彩。
- `selection`：在事实层之上做出的选择层结果，记录选中的能力、未选能力和使用过的 route hints。
- `strategy`：四级执行策略，必须与 `/auto` 主流程一致。
- `complexity`：低 / 中 / 高，不再单纯按文件数硬编码。
- `sensitivity`：普通 / 安全敏感 / 高风险。
- `primaryAgent`：本次主路由。
- `fallbackAgents`：失败时的回退链。
- `skills`：本次建议注入的 Skill。
- `preflight`：来自 `doctor` / `status` 的辅助信息，可为空。
- `next`：`planDirectly` 表示轻量直编排，`useQuestDesigner` 表示进入完整 QuestMap 设计。

`/auto` 的 PHASE 2 必须直接消费该协议块，而不是仅凭自然语言摘要继续推理。

---

## 落盘建议

如允许落盘，建议写入：

- `.auto/cache/capability-snapshot.json`
- `.auto/runs/<runId>/route-decision.md`

如历史 hints 存在，应从以下位置读取：

- `.auto/feedback/agents.json`
- `.auto/feedback/skills.json`
- `.auto/cache/pattern-cards.json`

---

## 错误处理

| 错误            | 处理                                                         |
| --------------- | ------------------------------------------------------------ |
| 空意图          | 返回默认路由（quest-designer）                               |
| 无匹配 Agent    | 返回默认路由（quest-designer）                               |
| REPO_MAP 缺失   | 继续路由，但在 `capabilitySnapshot.repoMap` 中标记 `missing` |
| 无历史 hints    | `selection.routeHintsUsed = []`                              |
| legacy 反馈残留 | 写入 `legacySignals`，但不作为新真源                         |

---

## 相关命令

- `/auto`：完整工作流入口
- `/auto:status`：查看 `.auto/` canonical 结构与可复用反馈
- `/auto:learn`：将本次路由和执行结果沉淀为 LearnCard / feedback
