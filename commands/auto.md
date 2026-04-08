---
description: 智能超级命令 - 上下文扫描 + Quest 设计 + 逐关执行 + 验证 + 总结 + 知识沉淀
---

# /auto — 智能超级命令

> SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN

---

## 执行策略

根据任务本质自主选择执行深度：

| 策略     | 适用场景                       | 执行路径                                                                                                                 |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **探索** | 分析/咨询/代码审查，无代码变更 | SCAN → PLAN（生成最小 `QuestMap`）→ EXECUTE（只读分析产出 `QuestResult`）→ VERIFY（`status=skipped`）→ SUMMARIZE → LEARN |
| **修复** | bug/小调整，少量文件局部修改   | SCAN → PLAN → EXECUTE（直接修复）→ VERIFY → SUMMARIZE → LEARN                                                            |
| **实现** | 新功能/多文件变更              | SCAN → PLAN → quest-designer → EXECUTE（逐关）→ VERIFY → SUMMARIZE → LEARN                                               |
| **重构** | 架构级变更                     | SCAN → PLAN → quest-designer → EXECUTE（逐关）→ VERIFY（含对抗验证）→ SUMMARIZE → LEARN                                  |

AI 在 SCAN 阶段综合任务语义、安全敏感度、架构影响等因素自主判定，不按文件数或行数硬编码。

## 协议对象与 Phase 出入口

`/auto` 统一消费和产出以下 5 个标准对象（定义见 `agents/_shared-principles.md`）：

- `RouteDecision`
- `QuestMap`
- `QuestResult`
- `VerifyReport`
- `LearnCard`

旧术语兼容映射：

- `DISCOVER` = `SCAN`
- `REASON` = `PLAN`

### PHASE 输入 / 输出矩阵

| Phase       | 主要输入                                       | 标准输出             | 默认落盘位置                                                                  |
| ----------- | ---------------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `SCAN`      | 用户需求 + 技术栈 + 能力清单 + preflight       | `RouteDecision`      | `.auto/runs/<runId>/route-decision.md`                                        |
| `PLAN`      | `RouteDecision` + 相关上下文 + Memory/insights | `QuestMap`           | `.auto/runs/<runId>/quest-map.md`                                             |
| `EXECUTE`   | `QuestMap` + 上游产出合约                      | `QuestResult`        | `.auto/runs/<runId>/quest-results.md`                                         |
| `VERIFY`    | `QuestResult` 列表 + 相关命令输出              | `VerifyReport`       | `.auto/runs/<runId>/verify-report.md`                                         |
| `SUMMARIZE` | `QuestResult` + `VerifyReport`                 | 汇总摘要（人类可读） | `.auto/runs/<runId>/index.md`                                                 |
| `LEARN`     | `QuestResult` + `VerifyReport` + Git 模式      | `LearnCard` 列表     | `.auto/runs/<runId>/learn-cards.md` + `.auto/insights/*` + `.auto/feedback/*` |

### `.auto/` canonical 结构

```text
.auto/
├── cache/
│   ├── capability-snapshot.json
│   └── pattern-cards.json
├── runs/
│   └── <runId>/
│       ├── route-decision.md
│       ├── quest-map.md
│       ├── quest-results.md
│       ├── verify-report.md
│       ├── learn-cards.md
│       └── index.md
├── insights/
│   ├── traps.md
│   ├── patterns.md
│   ├── decisions.md
│   ├── prompts.md
│   └── agent-feedback.md
├── memory/
│   └── store.json
└── feedback/
    ├── agents.json
    └── skills.json
```

说明：

- `cache/` 是可丢弃层，只缓存能力快照和模式卡。
- `runs/` 是单次工作流的运行记录真源。
- `insights/` 是长期复用的知识视图。
- `memory/` 是项目级辅助记忆索引层。
- `feedback/` 存放结构化 agent / skill 反馈。
- 已存在 legacy 文件可继续读取，但新协议以以上结构为准。

---

## 核心编排规则

1. **先协议后正文** — 关键阶段先输出 JSON 协议块，再输出人类可读摘要。
2. **Phase 单向流动** — `RouteDecision → QuestMap → QuestResult → VerifyReport → LearnCard`。
3. **Quest 级失败控制** — 默认只回滚当前 Quest 触及文件，不做仓库级全局回滚。
4. **默认自动续行** — 展示阶段摘要后继续执行，除非用户显式打断。
5. **LEARN 依赖可验证来源** — 主流程 LEARN 默认依赖 `VerifyReport`；独立 `/auto:learn --git` 可使用 Git 证据单独产出 `LearnCard`。
6. **知识复用只读 insights/memory** — `cache/` 不作为长期知识真源。
7. **doctor/status 是 preflight 辅助** — 它们提供上下文，但不替代核心协议对象。

---

## PHASE 约定

- `SCAN`：产出 `RouteDecision`，决定主 Agent、回退链、策略、敏感度。
- `PLAN`：消费 `RouteDecision`，产出 `QuestMap`，固化 Quest 拆解、依赖、合约、失败策略。
- `EXECUTE`：逐关执行，产出 `QuestResult`，记录尝试次数、验证结果、失败上下文。
- `VERIFY`：消费 `QuestResult`，产出 `VerifyReport`，决定继续执行、总结或终止。
- `SUMMARIZE`：汇总 `QuestResult` 与 `VerifyReport`，不自动提交。
- `LEARN`：将执行与验证结果沉淀为 `LearnCard`，再归档到 `.auto/insights/` 与 `.auto/feedback/`。

---

## 运行 ID

每次 `/auto` 调用默认生成一个 `runId`，用于串联所有协议对象、运行记录和知识沉淀。

后续阶段引用上游结果时，必须携带：

- `runId`
- 上游对象 `id`
- 涉及文件路径
- 阻塞项（如有）

---

## 结果持久化

- `RouteDecision`、`QuestMap`、`QuestResult`、`VerifyReport`、`LearnCard` 优先写入 `.auto/runs/<runId>/`
- 长期复用知识再从 `LearnCard` 分类投递到 `.auto/insights/` 或 `.auto/feedback/`
- `.auto/memory/store.json` 用于聚合项目级记忆索引，不再承担单次 Quest 运行记录

---

## 与子命令关系

- `/auto:route`：显式输出 `RouteDecision`
- `/auto:doctor`：提供 `preflight` 辅助信息，挂入 `RouteDecision.preflight`
- `/auto:status`：读取 `.auto/` canonical 结构，展示运行记录、缓存、知识与反馈状态
- `/auto:learn`：输出 `LearnCard` 视图并更新 insights/feedback
- `quest-designer`：消费 `RouteDecision`，产出 `QuestMap`
- `verification`：消费 `QuestResult`，产出 `VerifyReport`
- `build-error-resolver`：消费失败上下文，输出修复后的 `QuestResult` 增量

---

## 兼容说明

当前文档或旧说明中若出现 `DISCOVER`、`REASON`、`.auto/memory/quest-{id}.json`、仓库级回滚等表达，均以本文件和 `agents/_shared-principles.md` 的新协议为准。

---

## PHASE 1: SCAN — 上下文扫描

### 1.1 技术栈 + 能力扫描

```text
Glob("REPO_MAP.md") → 如存在则 Read（优先使用仓库地图）
Glob("package.json" / "pom.xml" / "go.mod" / "requirements.txt" / "Cargo.toml") → 确定技术栈
Glob("CLAUDE.md") → Read（如存在）
Glob("~/.claude/agents/*.md") → 提取可用 Agent 列表
Glob("~/.claude/skills/*.md") → 提取可用 Skill 列表
```

### 1.2 环境快检

```bash
node --version 2>/dev/null || echo "Node.js: NOT_FOUND"
git status --porcelain 2>/dev/null | head -5 || echo "Git: NOT_REPO"
test -f CLAUDE.md && echo "CLAUDE.md: EXISTS" || echo "CLAUDE.md: MISSING"
```

### 1.3 Agent 路由

使用 `/auto:route` 分析用户意图，输出主 Agent、回退链、执行策略和安全敏感度。
路由结果必须作为 `RouteDecision` 流入 PHASE 2。

### 1.4 能力缓存

扫描结果写入 `.auto/cache/capability-snapshot.json`（24h 有效）。
命中缓存时可跳过重复扫描，但仍要输出本次 SCAN 摘要。

**出口**：展示技术栈、能力清单、环境状态与策略判定摘要，随后进入 PLAN。

---

## PHASE 2: PLAN — 编排 + Quest 设计

### 2.1 知识检索

从 Claude Memory 中检索相关经验。
如有 `.auto/insights/*.md`，按标题关键词匹配读取相关段落。

### 2.2 编排决策

参考 `workflow-patterns.md` 的编排模式，结合用户需求自主完成：

1. **任务拆解**：分析自然边界，每步有明确产出
2. **Agent 选择**：基于 route 结果 + 任务特性（参考 `_shared-principles.md` 交接路径）
3. **Skill 注入**：按技术栈自动关联
4. **Agent 交接**：上游产出 = 下游输入，显式声明交接数据
5. **并行/串行**：无依赖可并行，有依赖按拓扑排序串行

| 技术栈   | 自动关联 Skill       |
| -------- | -------------------- |
| Java     | java-patterns        |
| 性能相关 | performance-patterns |
| 错误处理 | error-patterns       |

### 2.3 推理摘要

向用户展示简明编排推理，至少包含：

- 任务理解
- 复杂度与执行策略
- Quest 拆解与依赖拓扑
- Agent 调度与 Skill 注入

展示后默认继续执行，不等待确认；如用户显式打断则停止。

### 2.4 Quest 设计

| 策略 | Quest 设计方式                                                   |
| ---- | ---------------------------------------------------------------- |
| 探索 | 跳过 quest-designer，由主窗口生成最小 `QuestMap`，供后续只读执行 |
| 修复 | 跳过 quest-designer，自行生成单关修复计划并固化为最小 `QuestMap` |
| 实现 | 调用 quest-designer 生成完整 `QuestMap`                          |
| 重构 | 调用 quest-designer 生成完整 `QuestMap`（含深度分析）            |

调用 quest-designer 时，组装上下文：

```text
【用户需求】[原始需求]
【技术栈】[语言+框架]
【项目规范】[CLAUDE.md 摘要]
【编排计划】任务拆解 + Agent 调度 + Skill 注入 + 交接关系 + 并行/串行
【能力清单】Agents + Skills 列表
【现有代码】源码路径列表
【历史经验】Memory 匹配的经验摘要
【Router 推荐】主 Agent + 回退链 + 安全敏感度
```

**出口**：始终产出 `QuestMap`，再进入 EXECUTE；探索模式随后也必须产出只读 `QuestResult` 与 `VerifyReport(status=skipped)`，再进入 SUMMARIZE / LEARN。

---

## PHASE 3: EXECUTE — 逐关执行

### 3.1 Agent 调度

每关根据编排计划调度对应 Agent：

| Agent                | 触发条件                          | 调度方式                                       |
| -------------------- | --------------------------------- | ---------------------------------------------- |
| Claude 直接执行      | 实现类 Quest（按蓝图 Write/Edit） | Write/Edit                                     |
| tdd-guide            | 编排计划标记测试关                | `Agent(subagent_type: "tdd-guide")`            |
| code-reviewer        | 编排计划标记审查关                | `Agent(subagent_type: "code-reviewer")`        |
| security-reviewer    | route 标记安全敏感                | `Agent(subagent_type: "security-reviewer")`    |
| build-error-resolver | Quest 执行失败（最多 2 次重试后） | `Agent(subagent_type: "build-error-resolver")` |

### 3.2 执行流程

每关：Read 代码 → Write/Edit 或只读分析 → 必要验证。
探索模式也必须产出一个只读 `QuestResult`，用于把分析结论标准化地交给 VERIFY / SUMMARIZE / LEARN。
失败协议固定为：

1. `same_path` — 沿当前实现路径做最小差异修复
2. `alternative_path_or_agent` — 切换替代路径或替代 Agent
3. `build-error-resolver` — 两次尝试后升级构建修复 Agent
4. `quest rollback / abort` — 若仍失败，仅回滚当前 Quest 触及文件并终止当前 run

每关完成后记录到 `.auto/runs/<runId>/quest-results.md`。
Quest 间检查上下文窗口，接近溢出则生成会话摘要续接。

### 3.3 QuestResult（每关完成后输出）

````markdown
## QuestResult [{id}]

```json
{
  "protocolVersion": "auto-md/v1",
  "kind": "QuestResult",
  "id": "quest-result-<id>",
  "runId": "run-<id>",
  "phase": "EXECUTE",
  "status": "success | partial | failed | skipped",
  "summary": "一句话说明本关结果",
  "source": "执行当前 Quest 的 command/agent",
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
      "name": "build",
      "command": "<命令>",
      "status": "pass | fail"
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
````

要点：

- `QuestResult` 是 PHASE 3 到 PHASE 4 的唯一标准产物
- 探索模式也要输出 `QuestResult(status=success)`，并把 `validations` 标记为 `analysis` / `skipped`
- 失败上下文供 `verification` 和 `build-error-resolver` 直接消费
- 不再将单关结果写入 `.auto/memory/quest-{id}.json` 这类旧路径

### 3.4 执行失败与升级

- 第 1 次失败：沿当前方案最小差异修复
- 第 2 次失败：切换替代路径或替代 Agent
- 两次尝试后仍失败：升级到 `build-error-resolver`
- 若升级后仍失败：只回滚当前 Quest 触及文件并终止当前 run
- 禁止默认使用仓库级 `git checkout -- .` 作为常规失败策略

---

## PHASE 4: VERIFY — 门禁验证

| 策略 | 验证要求                                                                          |
| ---- | --------------------------------------------------------------------------------- |
| 探索 | 输出 `VerifyReport(status=skipped)`；至少记录 analysis-only / no-code-change 证据 |
| 修复 | 编译通过 + 相关测试通过                                                           |
| 实现 | 编译 + 测试 + lint + 覆盖率 ≥ 80%                                                 |
| 重构 | 编译 + 全量测试 + 覆盖率 + 安全扫描 + 对抗验证                                    |

`VERIFY` 必须消费 `QuestResult` 并输出标准 `VerifyReport`。即使探索模式没有代码变更，也要输出 `status=skipped` 的 `VerifyReport`，再进入 SUMMARIZE / LEARN。验证失败时只按 Quest 级失败协议回流，不做仓库级默认回滚。

### VerifyReport

````markdown
## VerifyReport [{id}]

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
      "name": "build",
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
````

### 对抗验证（重构模式专用）

调度 `verification` 进行红蓝对抗：边界值攻击、并发场景、幂等性、错误路径覆盖。

**出口**：展示 `VerifyReport`。全部通过则进入 SUMMARIZE；达到最大修复次数仍失败则 Quest 级回滚并终止。

---

## PHASE 5: SUMMARIZE — 完成总结

向用户输出：

- 执行策略
- 完成 Quest 数
- 验证结果
- 变更文件清单
- 统计（行数变更）
- 是否有遗留阻塞项

不自动提交，由用户决定。

**出口**：展示总结并进入 LEARN。

---

## PHASE 6: LEARN — 知识沉淀

### 6.1 LearnCard

LEARN 阶段先产出标准 `LearnCard`，再把它分发到 `.auto/insights/` 和 `.auto/feedback/`。

````markdown
## LearnCard [{id}]

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
````

按分类写入：

| 类型   | 文件                | 内容                 |
| ------ | ------------------- | -------------------- |
| 踩坑   | `traps.md`          | 遇到的坑和解决方案   |
| 模式   | `patterns.md`       | 验证有效的做法       |
| 决策   | `decisions.md`      | 架构/技术选择及理由  |
| Prompt | `prompts.md`        | 可复用输入模式       |
| 反馈   | `agent-feedback.md` | agent/skill 路由反馈 |

### 6.2 Agent 路由反馈

记录本次 Agent 调用结果，先生成 `LearnCard(category=feedback)`，再落盘到 `.auto/insights/agent-feedback.md` 与 `.auto/feedback/agents.json` / `.auto/feedback/skills.json`。

### 6.3 Git 模式分析

调用 `/auto:learn` 分析提交约定、热点文件和文件联动，统一输出为 `LearnCard(category=pattern)` 列表。

### 6.4 架构变更检测

对比 `REPO_MAP.md` 与实际结构，如检测到变更则建议更新文档。

**出口**：展示执行概览、知识沉淀统计和下次可复用提示。

---

## Session Continuity

上下文溢出时自动触发：

1. 生成会话摘要：任务、待办、错误、当前状态
2. 新会话使用续接指令自动继续（不确认、不提问）
3. 摘要包含结构化交接信息，保留用户消息原文

---

## 核心原则

1. **一个入口** — `/auto` 完成统一编排
2. **协议驱动** — 关键阶段统一产出标准对象
3. **自主编排** — AI 综合能力清单，自主选择 Agent/Skill 调度路径
4. **默认续行** — 展示摘要后继续执行，除非用户显式打断
5. **Quest 原子化** — 每关有验收标准，失败只做 Quest 级回滚
6. **知识闭环** — 经验沉淀到 memory + insights + feedback，越用越强
7. **结果持久化** — 标准对象写入 `.auto/runs/`，跨会话可查询
