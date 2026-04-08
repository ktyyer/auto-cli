---
description: 使用 Canonical Router 智能路由到最合适的 Agent
---

# /auto:route — 智能 Agent 路由

> 基于 Canonical Router（权威路由器），自动分析用户意图并路由到最合适的 Agent

---

## 使用场景

当你不确定应该使用哪个 Agent 时，使用此命令：

```bash
/auto:route 编写测试用例
```

根据关键词匹配 Agent（数据源：`agents/*.md`）。

---

## 路由逻辑

1. **意图分析**：提取关键词 + 评估复杂度 + 检测安全敏感性
2. **候选匹配**：基于关键词 + 能力 + 优先级评分
3. **安全优先**：安全相关意图自动提升 security-reviewer 优先级
4. **回退链**：主 Agent 失败时按优先级降级
5. **升级修复**：仅当已存在 `failureContext` 或前两次尝试耗尽时，才把 `build-error-resolver` 作为升级目标

优先级排序（高→低）：

- security-reviewer (95) → architect (85) → quest-designer (82)
- tdd-guide (75) → verification (72) → code-reviewer (70)
- e2e-runner (65) → refactor-cleaner (55) → doc-updater (50)
- `build-error-resolver` 不参与 SCAN 阶段默认主路由；仅用于失败升级

---

## 输出格式

先输出标准 `RouteDecision` 协议块，再输出人类可读摘要，供 `/auto` 的 PLAN 阶段直接消费。

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

### Router 分析

用户意图：
<原始输入>

推荐结果：
主 Agent：<name> - <displayName>
优先级：<0-100>
匹配原因：<matchReason>

回退链（主 Agent 失败时）：

1. <fallback1> - <displayName1>
````

### RouteDecision 字段说明

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

## 错误处理

| 错误         | 处理                           |
| ------------ | ------------------------------ |
| 空意图       | 返回默认路由（quest-designer） |
| 无匹配 Agent | 返回默认路由（quest-designer） |
| CLI 未安装   | 降级到手动查表选择 Agent       |
