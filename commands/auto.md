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

`/auto` 统一消费和产出以下 5 个标准对象（定义见 `_shared-principles.md`）：

- `RouteDecision` · `QuestMap` · `QuestResult` · `VerifyReport` · `LearnCard`

### PHASE 输入 / 输出矩阵

| Phase       | 主要输入                                       | 标准输出                                                   | 默认落盘位置                                                                  |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `SCAN`      | 用户需求 + 技术栈 + 能力清单 + preflight       | `RouteDecision`                                            | `.auto/runs/<runId>/route-decision.md`                                        |
| `PLAN`      | `RouteDecision` + 相关上下文 + Memory/insights | `QuestMap`                                                 | `.auto/runs/<runId>/quest-map.md`                                             |
| `EXECUTE`   | `QuestMap` + 上游产出合约                      | `QuestResult`                                              | `.auto/runs/<runId>/quest-results.md`                                         |
| `VERIFY`    | `QuestResult` 列表 + 相关命令输出              | `VerifyReport`                                             | `.auto/runs/<runId>/verify-report.md`                                         |
| `SUMMARIZE` | `QuestResult` + `VerifyReport`                 | 汇总摘要（人类可读）                                       | `.auto/runs/<runId>/index.md`                                                 |
| `LEARN`     | `QuestResult` + `VerifyReport` + Git 模式      | `LearnCard` 列表 + `session-continuity.md`（仅在需续接时） | `.auto/runs/<runId>/learn-cards.md` + `.auto/insights/*` + `.auto/feedback/*` |

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
│       ├── session-continuity.md (optional)
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

说明：`cache/` 可丢弃；`runs/` 单次运行真源；`insights/` 长期知识；`memory/` 项目记忆索引；`feedback/` 结构化反馈。Legacy 文件只读兼容，新写入以上述结构为准。

---

## 核心编排规则

1. **Phase 单向流动** — `RouteDecision → QuestMap → QuestResult → VerifyReport → LearnCard`
2. **Quest 级失败控制** — 默认只回滚当前 Quest 触及文件，不做仓库级全局回滚
3. **默认自动续行** — 展示阶段摘要后继续执行，除非用户显式打断
4. **知识复用只读 insights/feedback** — `cache/` 不作为长期知识真源
5. **结果真源优先** — 单次 run 写入 `.auto/runs/<runId>/`；跨 run 反馈写入 `.auto/feedback/`
6. **每轮可续接** — 需跨会话时补充 `session-continuity.md`

Phase 硬约束、协议头部、对象职责等详见 `_shared-principles.md`。

---

## 上下文预算

**写重读轻**：协议对象完整版只存在于 `.auto/runs/<runId>/` 文件，上下文只保留交接摘要。**禁止在上下文中累积多个完整协议 JSON。**

### 管理规则

1. **立即写盘** — 每个 Phase 产出协议对象后立即 `Write` 到对应文件，不等后续 Phase
2. **交接只传摘要** — Phase 间只保留 `status` + 一句话结论 + 文件路径；不重复已写盘的完整内容
3. **Quest 间压缩** — 每关完成立即写盘；上下文中只保留未完成关的 `questId` + `status`
4. **压缩模式** — 已产出 3+ 协议对象或感知上下文紧张时自动切换：
   - 协议块只输出必填字段，省略选填
   - 摘要限 3 行以内
   - 已写盘内容只用路径引用，不展开
5. **紧急续接** — 如上下文接近极限，立即写入 `session-continuity.md` 并提示用户开新会话

### Phase 交接格式

Phase 交接时只输出（不输出完整 JSON）：

`[Phase X → Y] status=<状态> | <一句话> | 文件: .auto/runs/<runId>/xxx.md`

下游需要细节时自行 `Read` 对应文件。

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

每次 `/auto` 调用生成 `runId`，串联所有协议对象和运行记录。后续阶段引用上游时携带 `runId` + 上游对象 `id`。

---

## 结果持久化

协议对象写入 `.auto/runs/<runId>/`，长期知识从 `LearnCard` 分发到 `.auto/insights/` 和 `.auto/feedback/`。

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

旧术语（`DISCOVER`、`REASON`、`.auto/memory/quest-{id}.json`、仓库级回滚）均以本文件和 `_shared-principles.md` 为准。

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

在标准 `RouteDecision` 内，必须内嵌以下能力快照字段：

- `capabilitySnapshot.commands`
- `capabilitySnapshot.agents`
- `capabilitySnapshot.skillsCatalog`
- `capabilitySnapshot.insightFiles`
- `capabilitySnapshot.feedbackFiles`
- `capabilitySnapshot.legacySignals`

随后再在同一个 `RouteDecision` 内补充选择结果：

- `selection.selectedAgents`（选择过程记录，最终 handoff 仍以 `primaryAgent` / `fallbackAgents` 为准）
- `selection.selectedSkills`（选择过程记录，最终 handoff 仍以顶层 `skills` 为准）
- `selection.rejectedCapabilities`
- `selection.routeHintsUsed`

### 1.4 能力缓存

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
3. **Skill 注入**：按技术栈 + 任务类型自动关联

| 触发条件             | 自动注入 Skill         |
| -------------------- | ---------------------- |
| Java / Spring Boot   | `java-patterns`        |
| 性能优化相关         | `performance-patterns` |
| 错误处理 / 异常      | `error-patterns`       |
| Git 操作 / 提交 / PR | `git-workflow`         |
| 代码风格 / 格式化    | `code-style-enforcer`  |
| 依赖分析 / 升级      | `dependency-analyzer`  |
| 多 Agent 编排        | `workflow-patterns`    |
| 新项目初始化         | `init-project`         |

4. **Agent 交接**：上游产出 = 下游输入，显式声明交接数据
5. **并行/串行**：无依赖可并行，有依赖按拓扑排序串行

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

### 2.5 Micro QuestMap 最小要求

当任务足够轻量，不调用 `quest-designer` 时，也不得跳过 PLAN，而是必须产出最小 `QuestMap`（Micro QuestMap）。

最小要求：

- `routeDecisionId`
- `goal`
- `executionMode`（通常为 `direct`）
- 至少 1 个 `quest`
- 每个 `quest` 至少包含：
  - `questId`
  - `objective`
  - `ownerAgent`
  - `inputs`
  - `outputs`
  - `touchFiles`
  - `acceptance`

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

执行前必须满足：

- 已存在 `QuestMap`
- 当前 Quest 的 `inputs` 已可解析
- 当前 Quest 的 `acceptance` 已明确

执行后每关至少要记录：

- 本关触及文件
- 本关输出物
- 本关局部验证结果
- 下一阶段 handoff 是否 ready

失败协议固定为：

1. `same_path` — 沿当前实现路径做最小差异修复
2. `alternative_path_or_agent` — 切换替代路径或替代 Agent
3. `build-error-resolver` — 两次尝试后升级构建修复 Agent
4. `quest rollback / abort` — 若仍失败，仅回滚当前 Quest 触及文件并终止当前 run

每关完成后立即写盘到 `.auto/runs/<runId>/quest-results.md`，上下文中只保留 `questId` + `status`。
连续 3+ 关后主动压缩：合并已完关为一段 checkpoint 写入文件，上下文中清除已完关详情。
如感知上下文接近极限，立即写入 `session-continuity.md` 并提示用户开新会话续接。

### 3.3 QuestResult

每关完成后输出标准 `QuestResult`（schema 见 `_shared-principles.md`）。

- 探索模式也要输出 `QuestResult(status=success)`，`validations` 标记为 `analysis` / `skipped`
- 失败上下文供 `verification` 和 `build-error-resolver` 直接消费
- 落盘到 `.auto/runs/<runId>/quest-results.md`

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

门禁 taxonomy：`analysis`、`build`、`test`、`lint`、`coverage`、`security`、`adversarial`。

各策略最少 gate 要求：

| 策略 | 必需 gate                                                                      |
| ---- | ------------------------------------------------------------------------------ |
| 探索 | `analysis`（evidence: `analysis-only` / `no-code-change`）                     |
| 修复 | `build` + `test`（evidence: `relevant`）                                       |
| 实现 | `build` + `test` + `lint` + `coverage`                                         |
| 重构 | `build` + `test` + `coverage` + `security` + `adversarial`（evidence: `full`） |

跳过的 gate 必须标记 `status=skipped` 并给出理由，不得直接省略。

Gate owner：`main`（轻量/单命令）、`verification`（对抗/红蓝/复杂汇总）。

### VerifyReport

输出标准 `VerifyReport`（schema 见 `_shared-principles.md`）。

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

产出标准 `LearnCard`（schema 见 `_shared-principles.md`），再按分类分发：

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

### 6.5 Session Continuity

当 run 需要跨会话继续时，当前 phase 写入 `.auto/runs/<runId>/session-continuity.md`（schema 见 `_shared-principles.md`）。

最小字段：`runId`、`status`、`currentPhase`、`nextPhase`、`requiredArtifacts`、`blockingIssues`、`resumePrompt`。

用途：phase 中断恢复、新会话续接、`/auto:status` 展示可继续状态。

### 6.6 LEARN 对 SCAN 的回灌

LEARN 阶段除生成 `LearnCard` 外，还应优先把可复用的路由提示和模式卡写回：

- `.auto/feedback/agents.json`
- `.auto/feedback/skills.json`
- `.auto/cache/pattern-cards.json`

`SCAN` / `route` 在下次运行时应优先读取这些文件作为 hint 输入，但不得把 hint 当作事实覆盖当前仓库扫描结果。

---

## 核心原则

1. **一个入口** — `/auto` 完成统一编排
2. **协议驱动** — 关键阶段统一产出标准对象
3. **自主编排** — AI 综合能力清单，自主选择 Agent/Skill 调度路径
4. **默认续行** — 展示摘要后继续执行，除非用户显式打断
5. **Quest 原子化** — 每关有验收标准，失败只做 Quest 级回滚
6. **知识闭环** — 经验沉淀到 memory + insights + feedback，越用越强
7. **结果持久化** — 标准对象写入 `.auto/runs/`，跨会话可查询
8. **写重读轻** — 协议对象立即写盘，上下文只保留交接摘要，禁止累积完整 JSON
