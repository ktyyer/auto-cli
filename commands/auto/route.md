---
name: auto:route
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
3. **反馈加权**：读取 `.auto/feedback/agents.json`，对已有记录的 agent 计算 `adjusted_priority = base_priority + (successRate - 0.9) * 20 + (usageCount > 3 ? 5 : 0)`。未记录的 agent bonus = 0。文件不存在或为空时跳过（静默降级为纯静态路由）
4. **候选匹配**：基于任务特征、能力清单和反馈加权后的优先级选择最优 Agent / Skill
5. **安全优先**：安全相关意图自动提升 `security-reviewer` 优先级（+10，无视反馈值）
6. **回退链**：主 Agent 失败时按优先级降级
7. **升级修复**：仅当已存在 `failureContext` 或前两次尝试耗尽时，才把 `build-error-resolver` 作为升级目标

基础优先级（高→低，经步骤 3 反馈加权调整后为最终值）：

- security-reviewer (95) → architect (85) → quest-designer (82)
- tdd-guide (75) → verification (72) → code-reviewer (70)
- e2e-runner (65) → refactor-cleaner (55) → doc-updater (50)
- `build-error-resolver` 不参与 SCAN 阶段默认主路由；仅用于失败升级

---

## 输出格式

输出标准 `RouteDecision`（schema 见 `agents/_shared-principles.md`），必须内嵌 `capabilitySnapshot` + `selection`，供 PHASE 2 直接消费。

`capabilitySnapshot` 为事实层能力快照（不带推荐色彩），`selection` 为选择层结果（记录选中/未选能力和使用过的 route hints）。`/auto` PHASE 2 必须直接消费该协议块，不凭自然语言摘要推理。

---

## 落盘建议

如允许落盘，建议写入：

- `.auto/cache/capability-snapshot.json`
- `.auto/runs/<runId>/route-decision.md`

路由阶段**必须读取**以下反馈文件用于优先级加权（见步骤 3 反馈加权）：

- `.auto/feedback/agents.json` — agent 使用成功率与频率
- `.auto/feedback/skills.json` — skill 触发精度与采纳率
- `.auto/cache/pattern-cards.json` — 可复用模式卡（可选）

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
