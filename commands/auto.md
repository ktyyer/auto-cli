---
name: auto
description: 智能超级命令 - 上下文扫描 + Quest 设计 + 逐关执行 + 验证 + 总结 + 知识沉淀
---

# /auto — 智能超级命令

> SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN
>
> 运行时说明：本文件面向 Claude Code 原生 slash command 工作流；安装到 Codex 时，如存在 `commands/auto.codex.md`，应以 Codex 覆盖版为准。

---

## 执行策略

根据任务本质自主选择执行深度：

| 策略     | 适用场景                       | 执行路径                                                                                |
| -------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| **探索** | 分析/咨询/代码审查，无代码变更 | SCAN → 直接回答（快速通道，见 1.3）；复杂分析可走完整 PHASE 流程                        |
| **修复** | bug/小调整，少量文件局部修改   | SCAN → PLAN → EXECUTE（直接修复）→ VERIFY → SUMMARIZE → LEARN                           |
| **实现** | 新功能/多文件变更              | SCAN → PLAN → quest-designer → EXECUTE（逐关）→ VERIFY → SUMMARIZE → LEARN              |
| **重构** | 架构级变更                     | SCAN → PLAN → quest-designer → EXECUTE（逐关）→ VERIFY（含对抗验证）→ SUMMARIZE → LEARN |

AI 在 SCAN 阶段综合任务语义、安全敏感度、架构影响等因素自主判定，不按文件数或行数硬编码。

### Loop 模式（正交于策略）

Loop 是叠加在上述任一策略之上的**重复模式**，由 SCAN 1.8 的 interval 参数开启。开启后 `/auto` 变成「按时重复跑聚焦版 6 PHASE，直至目标收敛或预算耗尽」的 loop 引擎：

```
/auto 5m 盯 CI 直到全绿              → loop + 修复策略
/auto 30m 把测试覆盖率从 62% 提到 80% → loop + 实现策略
/auto 2h 守住生产环境无 P0 告警       → loop + 探索策略（持续维持）
```

- **不开 loop**：无 interval 且目标一次性可完成 → 走原 6 PHASE 单次流水线。
- **开 loop**：检测到 interval，或语义含持续型（盯盘/巡检/持续/守住/保持/自主/自愈）/ 收敛型（直到/达到/提到/降到/收敛 + 可度量目标）→ 激活 `loop-engineering` skill，进入 DOER + CHECKER 循环（详见 PHASE 1.8 与该 skill）。收敛型关键词是启发式触发，最终由 skill 的「无 CHECKER 不开 loop」硬门禁过滤误命中。
- **核心不变量不变**：loop 模式仍是 `/auto` 单一入口，内层每轮依然是标准 6 PHASE，协议对象照常落 `.auto/runs/`。

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

`cache/`（可丢弃）| `runs/<runId>/`（单次真源）| `insights/`（长期知识）| `memory/`（项目记忆）| `feedback/`（结构化反馈）。路径职责见 `_shared-principles.md`。

---

## 核心编排规则

1. **Phase 单向流动** — `RouteDecision → QuestMap → QuestResult → VerifyReport → LearnCard`
2. **Quest 级失败控制** — 默认只回滚当前 Quest 触及文件，不做仓库级全局回滚
3. **默认自动续行** — 展示阶段摘要后继续执行，除非用户显式打断
4. **知识复用只读 insights/feedback** — `cache/` 不作为长期知识真源
5. **结果真源优先** — 单次 run 写入 `.auto/runs/<runId>/`；跨 run 反馈写入 `.auto/feedback/`
6. **生产治理下沉** — 目标收敛、产物真源、run 状态、成本质量和 skill 健康度由 `production-governance` skill 承接
7. **协议先验验证** — Phase 交接前由 `protocol-validator` 校验上游对象完整性，缺关键字段不得继续
8. **每轮可续接** — 需跨会话时补充 `session-continuity.md`

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

每个 run 同时生成 `correlationId`，贯穿 RouteDecision / QuestMap / QuestResult / VerifyReport / LearnCard，用于跨 Phase 追踪问题；`correlationId` 不替代 `runId`，只作为诊断链路标识。

---

## 结果持久化

协议对象写入 `.auto/runs/<runId>/`，长期知识从 `LearnCard` 分发到 `.auto/insights/` 和 `.auto/feedback/`。

---

## 与子命令关系

- `/auto:route`：显式输出 `RouteDecision`
- `/auto:doctor`：提供 `preflight` 辅助信息，挂入 `RouteDecision.preflight`
- `/auto:status`：读取 `.auto/` canonical 结构，展示运行记录、缓存、知识与反馈状态
- `/auto:dashboard`：聚合 `.auto/runs/` 历史数据，展示策略分布、gate 通过率、skill 激活频率等长期趋势
- `/auto:learn`：输出 `LearnCard` 视图并更新 insights/feedback
- `/auto:create-hook`：生成 Hook 模板建议，辅助手动补全配置
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
Glob("skills/*/SKILL.md") → 提取项目 Skill 列表（分层扫描，见下方 Skill 分层规则）
Glob("~/.claude/skills/*.md") → 提取全局 Skill 列表（补充），与项目 Skill 按 name 去重
Glob("~/.claude/rules/*.md") + Glob("rules/*.md") → 按 frontmatter paths 字段按需注入
Glob(".auto/constitution.md") → 如存在则 Read 全文，注入 RouteDecision.notes.constitution；PLAN/EXECUTE/VERIFY 三 phase 必须遵守（违反即 VERIFY fail）
```

**Skill 分层扫描**（减少 SCAN 阶段 frontmatter 读取量）：

1. **核心层 Skill**（有实际使用记录的 skill）：SCAN 正常读取 frontmatter，参与四信号匹配
2. **储备层 Skill**（usageCount=0 且从未被激活的 skill）：SCAN 跳过 frontmatter 读取，仅在兜底索引命中时按需加载
3. **自动升降**：连续 10 个 run 未激活 → 降级到储备层；储备层 skill 被激活 1 次 → 升回核心层
4. 分层依据：`.auto/feedback/skills.json` 中的 `usageCount` 字段

### 1.2 环境快检

```bash
node --version 2>/dev/null || echo "Node.js: NOT_FOUND"
git status --porcelain 2>/dev/null | head -5 || echo "Git: NOT_REPO"
test -f CLAUDE.md && echo "CLAUDE.md: EXISTS" || echo "CLAUDE.md: MISSING"
```

### 1.3 快速通道

**修复快速通道**（原有）：

当 SCAN 检测到以下条件全部满足时，走快速通道：

- 策略 = `fix`（非安全敏感）
- 触及文件 ≤ 2 个
- 变更行数预估 < 20 行

快速通道：跳过 QuestMap 设计，直接 Read → Edit → 验证 → SUMMARIZE。不调用 quest-designer，但产出最小 `QuestResult` 供 EXECUTE→VERIFY handoff 与 VERIFY gate 汇总。

**探索快速通道**（新增）：

当 SCAN 判定策略 = `探索` 时：

- 跳过 QuestMap / QuestResult / VerifyReport / SUMMARIZE 全部协议产出
- SCAN 后直接回答用户问题（只读分析）
- LEARN 阶段可选：仅在有可沉淀知识时产出 LearnCard（不强制）
- 收益：分析/咨询类任务消除全流程协议开销，直接产出分析结果

### 1.4 Agent 路由

使用 `/auto:route` 分析用户意图，输出主 Agent、回退链、执行策略和安全敏感度。
路由结果必须作为 `RouteDecision` 流入 PHASE 2。

路由时优先读取 `.auto/feedback/agents.json` 中的 `preferences` 和 `successRate`：

- `successRate < 0.5` 的 agent 排除出候选列表；安全敏感任务不得因此排除 `security-reviewer`
- 有 `knownIssues` 的 agent 降优先
- `preferences` 字段注入到 agent 调度 prompt

`RouteDecision` 内嵌字段：`capabilitySnapshot`（commands / agents / skillsCatalog / insightFiles / feedbackFiles）+ `selection`（selectedAgents / selectedSkills / rejectedCapabilities / routeHintsUsed）

### 1.5 上下文预算初始化

估算当前会话上下文使用率，记录 `contextBudget.zone` 到 RouteDecision：

| 模型容量信号            | 绿区上限 | 黄区上限 | 调整策略                         |
| ----------------------- | -------- | -------- | -------------------------------- |
| 大窗口（≥ 200K tokens） | 40%      | 70%      | 默认阈值，允许深度级激活         |
| 中窗口（100-200K）      | 30%      | 55%      | 提前降级，减少每关加载文件数     |
| 小窗口（< 100K）        | 20%      | 40%      | 默认摘要级，最多 3 个 Skill 激活 |

探测方式：通过当前会话已知特征（模型名称、运行时环境、历史行为）推断窗口容量，无法确定时默认使用大窗口阈值。

### 1.6 知识注入（替代原 insight-index 反查）

**简化注入流程**：不再要求 `[insight:]` 格式标记。检索到相关 insight 后，直接将命中摘要（每条 ≤2 行）注入 `RouteDecision.notes.relevantInsights`。后续 Phase 通过继承 RouteDecision 自然获得知识上下文。

检索方式：按技术栈分层加载（**v0.52 升级**）：

1. **确定技术栈**：从 package.json/pom.xml 等提取（如 Java + Spring Boot）
2. **按 scope 分层 Grep**：
   - 优先搜索 `.auto/insights/stack/` + `.auto/insights/universal/`（同技术栈通用知识）
   - 仅当用户需求明确涉及项目特定逻辑时才加载 `.auto/insights/project/`
3. **节省 token**：跳过无关 scope 的 insights（如 Java 项目不加载 Python 专属经验）

关键词从用户需求提取。命中条目记入 `selection.routeHintsUsed`。

**相似历史 run 预匹配**：扫描最近 5 个未归档 run 的 `route-decision.md`，语义相似度 > 0.7 时预加载该 run 的 trap/pattern（最多 3 条）。

### 1.7 能力缓存

命中缓存时可跳过重复扫描，但仍要输出本次 SCAN 摘要。

**出口**：展示技术栈、能力清单、环境状态、策略判定摘要与上下文预算区间，随后进入 PLAN。

### 1.8 Loop 参数解析（loop 模式入口）

解析 `/auto` 入参首 token，判定是否进入 loop 模式：

```text
模式判定：
  入参含 #loop=<loopId>           → 续接既有 loop，读 .auto/runs/<loopId>/loop-state.json 继承预算/迭代号/收敛史（非新 loop）
  首 token 匹配 /^\d+(m|h|s)$/  → 新 loop 模式，记录 interval，剥离子任务
  无 interval 但语义含持续型(盯盘/巡检/持续/守住/保持/自主/自愈)或收敛型(直到/达到/提到/降到/收敛 + 可度量目标) → loop 模式，默认 interval=10m
  其他                              → 非 loop，走原 6 PHASE 单次流水线
```

进入 loop 模式后执行（详见 `skills/loop-engineering/SKILL.md`）：

1. **激活 skill**：全文级加载 `loop-engineering`，提取 DOER/CHECKER 模板与 budget 模板。
2. **写 loop 契约**：`.auto/runs/<loopId>/loop-contract.md`，固化目标 / 收敛判据（可度量）/ 预算。
3. **初始化 loopBudgets**（写入 `RouteDecision`，按模式覆盖默认）：

   | 字段              | 收敛型默认 | 监听型默认 | 触发动作                                                             |
   | ----------------- | ---------- | ---------- | -------------------------------------------------------------------- |
   | `maxIterations`   | 20         | 不限(∞)    | 收敛型超限终止；监听型**不以此终止**（避免 1m 高频轮询 20 分钟早夭） |
   | `maxBudgetUsd`    | 300        | 300        | 超限 → 终止 loop                                                     |
   | `maxWallClock`    | 72h        | 72h        | 到期 → 终止 loop（对齐官方 3 天上限）                                |
   | `noProgressLimit` | 3          | 不适用     | 收敛型连续 3 轮收敛度不增 → 强制换策略 / 终止                        |

4. **选调度机制**：会话内动态 → `ScheduleWakeup`；跨会话持久 / 过夜 → `CronCreate(durable:true)`。
5. **收敛判据硬门禁**：写不出可度量 CHECKER（退出码 / 正则 / 数值阈值）→ **不开 loop**，回退单次 `/auto` 先把目标拆明白。
6. **跨迭代锚点（关键）**：`ScheduleWakeup` / `CronCreate` 的 prompt 必须带 `#loop=<loopId>`（如 `/auto 5m 盯CI #loop=run-xxx`）。不带则下一轮 SCAN 当成新 loop，`loopBudgets` 与 `convergenceHistory` 全部 reset —— 预算耗尽永不触发、退化检测失效、反复用同一失败策略。`loopId` = 本 loop 首轮 run 的 `runId`，全程不变。
7. **预算 / 时长覆盖（per-loop）**：入参含 `--budget <USD|unlimited>` 或 `--max-time <h>` → 覆盖 loopBudgets 默认（默认 `maxBudgetUsd=300` / `maxWallClock=72h`）。例：`/auto 5m --budget 10000 把整个模块重构到测试全过`、`/auto 5m --budget unlimited 持续盯生产`。`unlimited` 仅免费用上限，**仍受 maxWallClock + CHECKER + 用户中断约束**（无 CHECKER 的目标即便 unlimited 也不开 loop）。

> **监听型（fixed/sustain）CHECKER-first**：每轮先跑超轻量状态检查（`gh pr checks` / 退出码 / 接口状态），**无变化跳过 DOER（近乎零成本）**，状态变化才升级聚焦 6 PHASE。这让 `1m` 高频轮询不烧钱，且因监听型免 `maxIterations`，不会被 20 次早夭。

> **反幻觉约束**：interval 转 `delaySeconds` 时偏移避开整点（`5m`→270s/330s），不卡 `:00`/`:30` 撞峰；Codex / 无原生调度运行时降级为外部 cron/schtasks 或人手触发，**不伪造「正在后台跑」**。

> **反幻觉全局守则**（贯穿全 PHASE）：
>
> - **引用必锚定（Cite-or-Die）**：文件路径 / 函数名写入上下文前必须先 `Grep`/`Read` 确认存在
> - **数字必算（Compute-Don't-Guess）**：行数/覆盖率/版本号写进报告前必须有 Bash 命令实算
> - **允许说"不知道"（IDK Permission）**：信息不足时直接说"不知道"，绝不补全
> - **双源印证（Two-Source Cross-Check）**：关键事实至少两个独立来源印证

---

## PHASE 2: PLAN — 编排 + Quest 设计

### 2.1 知识检索

从 SCAN 阶段注入的 `RouteDecision.notes.relevantInsights` 获取已检索的知识摘要，按类别注入 QuestMap 对应字段（traps → pitfalls / patterns → knowledgeHints / decisions → decisionNotes）。

**反馈叠加**：读取 `.auto/feedback/agents.json` 中的 `preferences` 字段，注入到 Quest 设计约束（如 `questGranularity: fine` → 更细的 Quest 拆分）。`confidence=low` 的 insight 仅参考不强制注入。

### 2.2 编排决策

1. **任务拆解**：分析自然边界，每步有明确产出
2. **Agent 选择**：基于 route 结果 + 任务特性
3. **Skill 激活**（两阶段：动态发现 → 激活执行）

**动态发现（四信号匹配）**：tags 命中 × 2 + description 语义相似度 × 1 + 历史反馈 × 1.5 + 上下文预算调节 × (-0.5 ~ +0.5)。产出激活列表（top-5，匹配度 ≥ 3）按三级激活：摘要级(3-4) | 全文级(5-6) | 深度级(7+)。

**激活执行（三级分段读取）**：

- **摘要级**：只读 `## 激活摘要` 段落（~20 行），缓存优先
- **全文级**：摘要级 + 按需读具体 `###` 子段落
- **深度级**：全文级 + `.references/` 目录
- 缓存回写到 `.auto/cache/skill-extracts/<skill>.md`
- **备选**（匹配度 1-2）：仅在 Quest 遇到特定场景时补充查阅，默认不加载

**兜底索引**（动态发现不可用时的回退路径）：

| 触发条件                                                            | 激活 Skill              |
| ------------------------------------------------------------------- | ----------------------- |
| Java / Spring Boot                                                  | `java-patterns`         |
| 性能优化相关                                                        | `performance-patterns`  |
| 错误处理 / 异常                                                     | `error-patterns`        |
| Git 操作 / 提交 / PR                                                | `git-workflow`          |
| Bug / 调试 / 测试失败 / 构建失败                                    | `systematic-debugging`  |
| 模糊需求 / 多种合理理解                                             | `requirement-clarifier` |
| 需求明确但实现路径多选 / 架构决策                                   | `brainstorming`         |
| 重构 / 实现+high 复杂度 / 多角度规划择优                            | `plan-ensemble`         |
| 多并行 Quest / 多模块独立开发                                       | `using-git-worktrees`   |
| 不熟悉的库 / 新技术栈                                               | `research-analyst`      |
| 实现 / 重构策略下的 PHASE 2                                         | `test-plan-writer`      |
| 重试 / 熔断 / 限流 / 降级 / 幂等                                    | `robustness-patterns`   |
| 重构 / 拆分大文件 / 消除重复                                        | `refactoring-patterns`  |
| API 设计 / REST / OpenAPI                                           | `api-design`            |
| 复杂任务 / 上下文接近极限 / 跨会话续接                              | `context-engineering`   |
| 项目硬约束 / `.auto/constitution.md` 存在                           | `constitution`          |
| 每关完成自纠 / 主线漂移防范                                         | `self-critique`         |
| 代码风格 / 格式化                                                   | `code-style-enforcer`   |
| 依赖分析 / 升级                                                     | `dependency-analyzer`   |
| 多 Agent 编排                                                       | `workflow-patterns`     |
| 新项目初始化                                                        | `init-project`          |
| PRD / 需求文档                                                      | `prd-writer`            |
| 日志 / tracing / 可观测性                                           | `logging-patterns`      |
| 目标收敛 / 产物真源 / run 状态 / 生产治理                           | `production-governance` |
| Phase 交接 / 协议字段完整性 / Schema 验证                           | `protocol-validator`    |
| 上线 / 部署 / 生产环境                                              | `production-standards`  |
| 代码注释 / JSDoc                                                    | `comment-standards`     |
| 创建 / 编写 / 优化 skill                                            | `skill-creator`         |
| 代码结构分析 / AST                                                  | `code-analyzer`         |
| 评估 skill / skill 触发诊断                                         | `skill-evaluator`       |
| 需求明确但验收标准模糊 / 契约驱动                                   | `spec-driven`           |
| 会话末增量代码审查 / dirty files 累积                               | `incremental-review`    |
| bot / daemon / 消息队列 / CLI 工具 / 无 UI 的 I/O 系统              | `feedback-loop`         |
| 明确 Bug 复现路径 / 单链修复 ≥2 轮无进展                            | `agentless-repair`      |
| 执行影响性命令前（git commit/npm publish/Edit超50行）               | `predict-verify`        |
| interval 参数（`5m`/`30m`/`2h`）/ 盯盘 / 自主迭代 / 自愈 / 周期巡检 | `loop-engineering`      |

**Phase 敏感性调整**：实现/探索策略下 code-style-enforcer、comment-standards 匹配度 -1；重构策略恢复正常权重。**预算联动**：红区强制摘要级；黄区深度降全文级。

4. **Agent 交接**：上游产出 = 下游输入，显式声明交接数据
5. **并行/串行**：无依赖可并行，有依赖按拓扑排序串行

### 2.3 Extended Thinking 触发

**触发**（满足任一）：复杂度 = high | 策略 = 重构 | 用户 `--deep-think` | Quest ≥ 5

**不启用**：策略 = 探索/修复 | 快速通道 | 用户 `--no-think`

**配置**：推理预算 16k tokens | 可见性对用户隐藏 | 记录写入 `.auto/runs/<runId>/thinking.md`

### 2.4 假设声明

产出 QuestMap 前必须显式声明：假设 / 更简方案 / 不确定项。

**假设证伪**：至少 1 个反例 + 1 个备选。**Premortem**：假设 6 个月后 P0 事故的 3 个原因 → 塞入 `QuestMap.pitfalls`。

> **澄清优先于假设**：≥ 1 个歧义项时先调 `requirement-clarifier` skill。

### 2.5 推理摘要

向用户展示编排推理（任务理解 / 策略 / Quest 拓扑 / Agent 调度），展示后默认续行。

> **30 秒 Reflexion**（PLAN→EXECUTE 前）：QuestMap 看 3 遍，最不放心的是哪一关？该关 acceptance 含糊？缺测试关？任一不放心 → 回 2.6 加固。

### 2.6 Quest 设计

| 策略 | Quest 设计方式                                                   |
| ---- | ---------------------------------------------------------------- |
| 探索 | 跳过 quest-designer，由主窗口生成最小 `QuestMap`，供后续只读执行 |
| 修复 | 跳过 quest-designer，自行生成单关修复计划并固化为最小 `QuestMap` |
| 实现 | 调用 quest-designer 生成完整 `QuestMap`                          |
| 重构 | 调用 quest-designer 生成完整 `QuestMap`（含深度分析）            |

> **方案探索前置**：策略=实现/重构且有 ≥2 条路径时，先调 `brainstorming` skill。
> **视角集成升级**：策略=重构、或实现且复杂度=high、或 brainstorming 后 trade-off 仍不明时，调 `plan-ensemble` skill — 2-3 个异质视角隔离并行出草案，分歧点 + 评分矩阵合成唯一 QuestMap（上下文红区禁用）。
> **测试计划前置**：策略=实现/重构时，先调 `test-plan-writer` skill。
> **调研前置**：触发 `research-analyst` skill 时，先产出 `.auto/runs/<runId>/research-brief.md`，再进入 quest-designer 调用。
> **白话复述（Rubber Duck）**：调用 quest-designer 前，用 ≤3 句白话讲方案。讲不顺 → 回 2.2。

调用 quest-designer 时组装上下文：【用户需求】【技术栈】【项目规范】【编排计划】【能力清单】【现有代码】【历史经验】【Router 推荐】。

### 2.7 Micro QuestMap 最小要求

不调用 quest-designer 时，必须产出最小 QuestMap：`routeDecisionId` + `goal` + `executionMode` + `outOfScope` + 至少 1 个 quest（含 questId / objective / ownerAgent / inputs / outputs / touchFiles / estimatedLines / acceptance）。

> **Scope Contract**：`outOfScope` 显式列出"本次不做"的事。

---

## PHASE 3: EXECUTE — 逐关执行

### 3.0 实时进度反馈

每关开始/完成各输出 1-2 行（进度 + 触及文件）。用户可用 `--quiet` 禁用。

### 3.1 Agent 调度

每关根据编排计划调度对应 Agent：

| Agent                | 触发条件                          | 调度方式                                       |
| -------------------- | --------------------------------- | ---------------------------------------------- |
| Claude 直接执行      | 实现类 Quest（按蓝图 Write/Edit） | Write/Edit                                     |
| tdd-guide            | 编排计划标记测试关                | `Agent(subagent_type: "tdd-guide")`            |
| code-reviewer        | 编排计划标记审查关                | `Agent(subagent_type: "code-reviewer")`        |
| security-reviewer    | route 标记安全敏感                | `Agent(subagent_type: "security-reviewer")`    |
| build-error-resolver | Quest 执行失败（最多 2 次重试后） | `Agent(subagent_type: "build-error-resolver")` |
| architect            | 架构决策 / 重构策略               | `Agent(subagent_type: "architect")`            |
| doc-updater          | 实现/重构策略 LEARN 阶段          | `Agent(subagent_type: "doc-updater")`          |
| refactor-cleaner     | 重构策略 / 死代码清理             | `Agent(subagent_type: "refactor-cleaner")`     |
| e2e-runner           | E2E 测试关（非纯 MD 项目）        | `Agent(subagent_type: "e2e-runner")`           |
| quest-designer       | 实现/重构策略 Quest 设计          | `Agent(subagent_type: "quest-designer")`       |
| verification         | 重构策略对抗验证 / VERIFY 汇总    | `Agent(subagent_type: "verification")`         |

### 3.2 执行流程

**Skill 激活协议**（每关执行前）：

1. 从 QuestMap 获取本关 skills 列表及激活级别
2. 按级别分段读取（缓存优先 → 摘要级 → 全文级 → 深度级）
3. 提取四要素：checklist → 追加 acceptance | patterns → 代码约束 | template → 产出格式 | anti-patterns → 回避清单
4. 执行后在 QuestResult.validations 记录每个 skill 的应用证据
5. 缓存回写到 `.auto/cache/skill-extracts/<skill>.md`

每关执行序列：激活 Skills → Read 代码 → Write/Edit 或只读分析 → 必要验证。

**变更洁癖（Surgical Changes）**：每行变更可追溯到用户需求，禁止顺手改进无关代码、重构未损坏逻辑、或添加未要求的抽象。

执行前必检：QuestMap 存在 / protocol-validator 通过 / inputs 可解析 / acceptance 明确。执行后必记：触及文件 / 输出物 / 局部验证 / handoff ready。

**实施纪律三件套**（执行中持续生效）：

- **Touch-set Lock**：想改 touchFiles 清单外文件必须声明 `scope-expand`；扩张超过 2 个文件触发 PLAN 回流
- **扩张词刹车**：出现"顺手""既然""不如""一并""趁机""索性"等词，立即停下自问是否在用户原话里
- **不偷工捷径声明**：想 mock/skip/ts-ignore 时先写 `[shortcut-attempt]` 说明诱惑来源与替代方案

**失败协议**：

1. `same_path` — 最小差异修复
2. `alternative_path` — 切换路径或 Agent
3. `build-error-resolver` — 两次尝试后升级
4. `quest rollback` — 回滚当前 Quest 触及文件
5. `budget_exhausted` — maxIterations 25 / maxToolCallsPerQuest 15 超限 → LearnCard(trap) + session-continuity(suspended)

每关完成后立即写盘到 `.auto/runs/<runId>/quest-results.md`，上下文只保留 `questId` + `status`。

### 3.3 QuestResult

每关完成后输出标准 `QuestResult`（schema 见 `_shared-principles.md`），落盘到 `.auto/runs/<runId>/quest-results.md`。

> **Self-Critique 触发**（策略 = 实现/重构，每关必做）：达成度 < 70 必须修补或回流 PLAN。详见 `skills/self-critique/SKILL.md`。
> **反向翻译（Reverse Diff）**：把本关 diff 反向翻译成需求描述，与 objective 对照，捕捉偏移。

### 3.4 中断恢复

SCAN 检测到 `session-continuity.md` 且 `status=interrupted` 时，从中断点继续执行。

### 3.5 条件分支执行

Quest 含 `conditionalNext` 时按 `on_success` / `on_fail` / `on_partial` 映射跳转。

### 3.6 压缩防护

上下文接近 70% 时：复读 RouteDecision.userIntent 原话 → 写 interruptPoint → 合并已完关为 checkpoint。

---

## PHASE 4: VERIFY — 门禁验证

`VERIFY` 消费 `QuestResult` 并输出标准 `VerifyReport`。

> **主线回顾**：gate 调度前重读 RouteDecision.userIntent 原话，并行启动 verification + code-reviewer 审计 QuestResult。
> **Subagent 上下文隔离**：每个验证 subagent 只接收最小上下文（touchFiles + objective + diff），禁止传入完整 QuestMap。

各策略最少 gate 要求：

| 策略 | 必需 gate                                                                                                                                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 探索 | `analysis` + `skill-activation`(read-only) + `knowledge-reuse`(analysis-only) + `knowledge-distribution` + `clean-state`                                                                                                                      |
| 修复 | `build` + `test` + `self-verification` + `protocol-validator` + `skill-activation` + `knowledge-reuse`(relevant) + `knowledge-distribution` + `clean-state`                                                                                   |
| 实现 | `build` + `test` + `lint` + `coverage` + `self-verification` + `self-critique` + `production-governance` + `protocol-validator` + `skill-activation` + `knowledge-reuse` + `knowledge-distribution` + `clean-state`                           |
| 重构 | `build` + `test` + `coverage` + `security` + `adversarial` + `self-verification` + `self-critique` + `production-governance` + `protocol-validator` + `skill-activation` + `knowledge-reuse`(full) + `knowledge-distribution` + `clean-state` |

**各 gate 详细定义见 `skills/quality-gates/SKILL.md`。** 以下为简化说明：

- `self-verification`：语法/逻辑/边界/错误处理/性能自动检查
- `self-critique`：objective 满足度 + 盲点暴露 + 达成度评分（<70 回流）
- `production-governance`：目标收敛 + 产物真源 + run 状态 + 成本质量 + skill 健康度
- `protocol-validator`：Phase handoff 检查校验上游协议对象必填字段；VERIFY 中仅汇总截至 EXECUTE→VERIFY 已完成的 handoff 检查结果
- `skill-activation`：核对激活 Skill 的应用证据
- `knowledge-reuse`：核对 RouteDecision.notes.relevantInsights 中的 insight 是否被参考（不再要求 `[insight:]` 格式标记）
- `knowledge-distribution`：核对 LearnCard 是否分发到 `.auto/insights/`
- `clean-state`：关门自检（启动测试通过 / 状态一致 / 无孤立变更 / 可标准路径重启）

> **实测优先于断言（Run-Don't-Claim）**：任何验证声明必须附带实际命令 + 输出。
> **预测后验证（Predict-Then-Verify）**：跑命令前先预测结果，预测错 = 理解错。

### 对抗验证（重构模式专用）

调度 `verification` 进行红蓝对抗：边界值攻击、并发场景、幂等性、错误路径覆盖。

---

## PHASE 5: SUMMARIZE — 完成总结

向用户输出：执行策略 + 完成 Quest 数 + 验证结果 + 变更文件清单 + 统计 + 遗留阻塞项。

不自动提交，由用户决定。

---

## PHASE 6: LEARN — 知识沉淀

**详细实现见 `skills/knowledge-management/SKILL.md`。** 以下为高层流程：

### 6.1 LearnCard 产出与分发

产出标准 LearnCard（必须含 category/scope/title/confidence 字段，模板见 `skills/knowledge-management/SKILL.md`），按 category 分发到 `.auto/insights/` 对应文件（必须 Edit append，不能只留在 learn-cards.md）。分发前执行 Curator 检查（查重 / 矛盾检测 / merge-or-append，含被复用 insight 的 helpful/harmful 计数更新，详见 `skills/knowledge-management/SKILL.md`）。硬约束：`scope: stack|universal` 额外写入 `skills.json` 的 `portablePatterns`。无 category 字段的 LearnCard 无效。

### 6.2 Agent/Skill 路由反馈（真实化更新）

**每次 run 结束后必须更新** `.auto/feedback/agents.json` 和 `skills.json`：

- 被调度的 agent：`totalCalls` +1，更新 `lastUsed`，按结果更新 `successRate`
- 被激活的 skill：`usageCount` +1，更新 `lastUsed`，按结果更新 `successRate`
- 失败时追加 `knownIssues`
- 数据新鲜度：>30 天未更新标记为 `stale`

### 6.3 Session Continuity

需跨会话时写入 `session-continuity.md`（含 runId / status / currentPhase / nextPhase / requiredArtifacts / blockingIssues / resumePrompt / knownDefects / unverifiedPaths / cleanStateChecklist）。

### 6.4 Run 归档

运行超过 30 天的 run 自动移入 `.auto/runs/archive/`（由 SessionStart Hook 触发）。SCAN 1.6 预匹配只扫描未归档的 run。归档 run 可手动删除释放空间。

**配置**：通过环境变量覆盖默认行为

```bash
# 修改保留天数（默认 30 天）
export AUTO_CLEAN_RETENTION_DAYS=60

# 启用 DRY RUN 模式（仅预览，不实际归档）
export AUTO_CLEAN_DRY_RUN=true
```

**手动触发清理**：

```bash
# 立即归档超过 30 天的 run
bash ~/.claude/hooks/lib/auto-clean-runs.sh

# 预览将被归档的 run
AUTO_CLEAN_DRY_RUN=true bash ~/.claude/hooks/lib/auto-clean-runs.sh
```

**恢复已归档 run**：

```bash
# 列出已归档 run
ls .auto/runs/archive/

# 恢复指定 run
mv .auto/runs/archive/run-<id> .auto/runs/
```

### 6.5 LEARN 对 SCAN 的回灌

把路由提示和模式卡写回 `.auto/feedback/agents.json`、`.auto/feedback/skills.json`、`.auto/cache/pattern-cards.json`。下次 SCAN 优先读取作为 hint。

### 6.6 Loop 跨迭代回灌（loop 模式专用）

loop 模式下每轮 LEARN 产物**即时**回灌到下一轮 SCAN，构成跨迭代飞轮（详见 `skills/loop-engineering/SKILL.md` Step 6）：

- 每轮 CHECKER 失败 → 立即写 `LearnCard(category=trap)` → 第 N+1 轮 SCAN 自动注入 `QuestMap.pitfalls`
- 每轮收敛度↑ 的策略 → 写 `LearnCard(category=pattern)` → 下轮优先复用
- 收敛度回退（< 上轮）→ **不写新 trap，先 `git reset` 本轮**，根因分析后才记录
- 终止时写 `.auto/runs/<loopId>/loop-summary.md`（N 轮 / 是否收敛 / 总成本 / 关键 trap），收敛则 commit，未收敛则留 session-continuity 交用户决策

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
9. **上下文工程** — 对的 token 在对的时间：预算感知、渐进披露、压缩降级、Subagent 隔离（详见 `context-engineering` skill）
