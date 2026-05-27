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

## 知识蒸馏原则

**核心理念**：沉淀的知识必须是原子化、可检索、跨会话可用的，而非原始日志堆积。

**蒸馏三步**：

1. **压缩**：从 QuestResult + VerifyReport 中提取可复用模式，每条 ≤ 5 行
2. **标记可迁移性**：
   - `scope: project` — 仅当前项目适用
   - `scope: stack` — 同技术栈通用
   - `scope: universal` — 跨项目通用
3. **去重合并**：与 `.auto/insights/` 已有条目对比，同主题更新而非追加

**反模式**：

- 把完整 QuestResult JSON 塞进 insights（不可检索）
- 沉淀仅适用于当前 commit 的临时信息（过期即噪声）
- 沉淀不标注 scope 导致未来误用

---

## LearnCard 分发

**分发清单（硬约束）**：

| 类型   | 目标文件                           | 内容                 |
| ------ | ---------------------------------- | -------------------- |
| 踩坑   | `.auto/insights/traps.md`          | 遇到的坑和解决方案   |
| 模式   | `.auto/insights/patterns.md`       | 验证有效的做法       |
| 决策   | `.auto/insights/decisions.md`      | 架构/技术选择及理由  |
| Prompt | `.auto/insights/prompts.md`        | 可复用输入模式       |
| 反馈   | `.auto/insights/agent-feedback.md` | agent/skill 路由反馈 |

**蒸馏要求**（每张 LearnCard）：

- 核心描述 ≤ 5 行，原子化可检索
- 必须标注 `scope: project | stack | universal`
- `scope: stack|universal` 额外写入 `.auto/feedback/skills.json` 的 `portablePatterns` 字段

**最小 append 格式**：

```markdown
### <标题>

**日期**: YYYY-MM-DD | **置信度**: high|medium|low | **来源**: run-<runId>

<2-3 句核心描述 + 推荐动作>
```

**硬约束**：VERIFY 任何 gate `status=fail` 或 EXECUTE 触发升级路径时，必须先产出 `LearnCard(category=trap)` 并写入 `traps.md`。

---

## 知识注入（SCAN 阶段）

**注入方式**：SCAN 阶段检索到相关 insight 后，直接将命中摘要（每条 ≤2 行）注入 `RouteDecision.notes.relevantInsights`。后续 Phase 通过继承 RouteDecision 自然获得知识上下文。

**检索流程**：

```bash
# 1. 从 insight-index.json 反查关键词
# 2. 缺失时降级 grep
# 3. 命中摘要注入 RouteDecision.notes.relevantInsights
```

**注入规则**：

| 命中文件          | 注入字段                |
| ----------------- | ----------------------- |
| traps.md          | QuestMap.pitfalls       |
| patterns.md       | QuestMap.knowledgeHints |
| decisions.md      | QuestMap.decisionNotes  |
| prompts.md        | 仅探索策略采用          |
| agent-feedback.md | 影响 selection 排序     |

---

## Feedback 真实化

**问题**：agents.json 和 skills.json 中的 totalCalls/usageCount 多数停留在初始值 0，未反映真实使用情况。

**更新规则**（LEARN 阶段执行）：

1. **Agent 更新**：当 agent 在本次 run 中被调度（无论成功失败），更新：
   - `totalCalls` +1
   - `lastUsed` 设为当前日期
   - 成功时更新 `successRate`（滚动平均）
   - 失败时追加 `knownIssues`

2. **Skill 更新**：当 skill 在 EXECUTE 中被实际激活（Read + 提取要素），更新：
   - `usageCount` +1
   - `lastUsed` 设为当前日期
   - 按 EXECUTE 结果更新 `successRate`

3. **数据新鲜度**：feedback 文件 >30 天未更新时，`/auto:status` 和 `/auto:dashboard` 标记为 `stale`

---

## Session Continuity

**必填字段**：`runId` | `status` | `currentPhase` | `nextPhase` | `requiredArtifacts` | `blockingIssues` | `resumePrompt`

**扩展字段**：

- `knownDefects` — 已知但未修的缺陷列表（含位置和延后原因）
- `unverifiedPaths` — 未验证的代码路径（含风险评估）
- `cleanStateChecklist` — 关门自检 4 项

---

## Run 归档

**问题**：历史 run 持续累积，SCAN 1.6 预匹配需扫描所有 run 目录。

**归档规则**：

- 运行超过 30 天的 run 目录移入 `.auto/runs/archive/`
- SCAN 1.6 预匹配只扫描未归档的 run（最近 5 个）
- `/auto:dashboard` 仍可读取归档 run
- `.auto/runs/archive/` 可手动删除释放空间

**实施**：LEARN 阶段最后一步执行归档检查，移动符合条件的 run 目录。

---

## LEARN 对 SCAN 的回灌

LEARN 阶段除生成 LearnCard 外，还应把可复用路由提示和模式卡写回：

- `.auto/feedback/agents.json`
- `.auto/feedback/skills.json`
- `.auto/cache/pattern-cards.json`

SCAN / route 在下次运行时优先读取这些文件作为 hint，但不覆盖当前仓库扫描结果。
