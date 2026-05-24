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

`cache/`（可丢弃）| `runs/<runId>/`（单次真源）| `insights/`（长期知识）| `memory/`（项目记忆）| `feedback/`（结构化反馈）。路径职责见 `_shared-principles.md`。

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
Glob("skills/*/SKILL.md") → 提取项目 Skill 列表（每个 skill 是独立目录，含 SKILL.md，对齐 Anthropic 开放标准）；读每个 Skill 的 frontmatter（name, description, tags），注意 tags 可能为多行数组格式
Glob("~/.claude/skills/*.md") → 提取全局 Skill 列表（补充，Claude 端 flat 安装为兼容旧用户），与项目 Skill 按 name 去重（项目 Skill 优先）
Glob("~/.claude/rules/*.md") + Glob("rules/*.md") → 读取 rules frontmatter；如 frontmatter 含 `paths` 字段，仅当本 run 触及文件命中该 glob 时注入（按需加载，减少无关上下文）；**无 `paths` 字段视为通用规则始终加载**（如 `git-workflow` / `performance` / `security` / `testing` / `agents` 这些不限技术栈的规则）
Glob(".auto/constitution.md") → 如存在则 Read 全文，作为项目级硬约束注入 RouteDecision.notes.constitution；PLAN/EXECUTE/VERIFY 三 phase 必须遵守（违反即 VERIFY fail）。详见 `skills/constitution/SKILL.md`
```

### 1.2 环境快检

```bash
node --version 2>/dev/null || echo "Node.js: NOT_FOUND"
git status --porcelain 2>/dev/null | head -5 || echo "Git: NOT_REPO"
test -f CLAUDE.md && echo "CLAUDE.md: EXISTS" || echo "CLAUDE.md: MISSING"
```

### 1.3 快速通道

当 SCAN 检测到以下条件全部满足时，走快速通道（fast-path）：

- 策略 = `fix`（非安全敏感）
- 触及文件 ≤ 2 个
- 变更行数预估 < 20 行

快速通道：跳过 QuestMap 设计，直接 Read → Edit → 验证 → SUMMARIZE。不调用 quest-designer，不产出 QuestResult 中间文件。

### 1.4 Agent 路由

使用 `/auto:route` 分析用户意图，输出主 Agent、回退链、执行策略和安全敏感度。
路由结果必须作为 `RouteDecision` 流入 PHASE 2。

路由时优先读取 `.auto/feedback/agents.json` 中的 `preferences` 和 `successRate`：

- `successRate < 0.5` 的 agent 排除出候选列表
- 有 `knownIssues` 的 agent 降优先
- `preferences` 字段注入到 agent 调度 prompt（如 `questGranularity: fine` → Quest 拆分更细）

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

### 1.5 上下文预算初始化

**启动时建立预算感知**（2026 Context Engineering 核心实践）：

1. **预算三区判定**：估算当前会话已消耗上下文占比
   - **绿区**（< 40%）：正常加载，允许深度级 Skill 激活
   - **黄区**（40-70%）：切换摘要级激活，Phase 交接只传路径引用
   - **红区**（> 70%）：强制压缩，写 `session-continuity.md`，提示续接
2. **加载策略选择**：根据预算区间决定后续 Phase 的加载深度
3. **预算标记**：在 `RouteDecision` 中记录 `contextBudget.zone` 字段，供下游 Phase 参考

**动态阈值适配**（多模型兼容）：

不同 AI 模型的上下文窗口容量差异显著，预算阈值应动态调整：

| 模型容量信号            | 绿区上限 | 黄区上限 | 调整策略                         |
| ----------------------- | -------- | -------- | -------------------------------- |
| 大窗口（≥ 200K tokens） | 40%      | 70%      | 默认阈值，允许深度级激活         |
| 中窗口（100-200K）      | 30%      | 55%      | 提前降级，减少每关加载文件数     |
| 小窗口（< 100K）        | 20%      | 40%      | 默认摘要级，最多 3 个 Skill 激活 |

探测方式：通过当前会话的已知特征（如模型名称、运行时环境、历史行为）推断窗口容量，无法确定时默认使用大窗口阈值。

### 1.6 相似历史 run 预匹配（知识复用加速）

- 若 `.auto/runs/` 存在，扫描最近 5 个 run 的 `route-decision.md`，提取 `userIntent` + `strategy`
- 当前任务与历史 run 语义相似度 > 0.7 时，预加载该 run 的 `learn-cards.md` 中的 trap/pattern
- 收益：避免重复踩同样的坑，起手就有历史经验注入
- 限制：最多预加载 3 条历史 LearnCard，避免上下文污染
- 已预加载的条目以 `[run:<runId>#<learnCardTitle>]` 格式记入 `selection.routeHintsUsed`

### 1.7 能力缓存

命中缓存时可跳过重复扫描，但仍要输出本次 SCAN 摘要。

**出口**：展示技术栈、能力清单、环境状态、策略判定摘要与上下文预算区间，随后进入 PLAN。

> **角色快检（C+P+A）**：在进入 PLAN 前自问 — `[C]` 我自己用都不会满意吗？是否回避了用户最痛的边角场景？`[P]` 这需求有更小的版本能更快验证吗？衡量成功的指标是什么？`[A]` 触及哪些现有架构边界？有无引入跨服务依赖？严重命中需补充到 `RouteDecision.notes`。详见 `agents/_shared-principles.md` 「7 角色定义」节。

> **反幻觉全局守则**（贯穿全 PHASE，任何阶段违反都应立即停下）：
>
> - **引用必锚定（Cite-or-Die）**：文件路径 / 函数名 / API / 配置项写进上下文前必须先 `Grep`/`Read` 确认存在；引用以 `file:line` 粘贴，禁用"我记得这里有 X"。
> - **数字必算（Compute-Don't-Guess）**：行数 / 覆盖率 / 文件数 / 版本号 / 耗时写进报告前必须有 Bash 命令实算并贴输出；禁用"大约""估计""约 X 行"。
> - **允许说"不知道"（IDK Permission）**：信息不足时直接说"不知道，需要 X 才能确定"，绝不补全。含猜测内容必须前缀 `[guess]`，可验证事实不带前缀。
> - **双源印证（Two-Source Cross-Check）**：关键事实（API 行为 / 库版本 / 配置语义）至少两个独立来源印证（代码 + 文档 / grep + 实跑 / lockfile + import），单源不下结论。

---

## PHASE 2: PLAN — 编排 + Quest 设计

### 2.1 知识检索（按 insight-index 反查）

**索引优先 / grep 兜底**：先读 `.auto/cache/insight-index.json`（schema 见 `_shared-principles.md` 「insight-index 派生对象」节），缺失或为空时降级为全量 grep。

可执行流程：

```bash
# 1. 提取检索词（3-5 个关键词，从 RouteDecision.userIntent + 技术栈 + 策略）
KEYWORDS="..."  # 由主窗口决定

# 2. 索引反查（首选）
if [ -f .auto/cache/insight-index.json ]; then
  for KW in $KEYWORDS; do
    jq -r ".by_keyword.\"$KW\"[]?" .auto/cache/insight-index.json
  done > .auto/runs/<runId>/matched-insights.txt
fi

# 3. 索引不存在或命中数为 0 时降级 grep
[ ! -s .auto/runs/<runId>/matched-insights.txt ] && \
  grep -l "$KEYWORDS" .auto/insights/*.md > .auto/runs/<runId>/matched-insights.txt
```

**注入规则**（按 file 字段映射）：

| 命中文件            | 注入字段                  |
| ------------------- | ------------------------- |
| `traps.md`          | `QuestMap.pitfalls`       |
| `patterns.md`       | `QuestMap.knowledgeHints` |
| `decisions.md`      | `QuestMap.decisionNotes`  |
| `prompts.md`        | 仅探索策略采用            |
| `agent-feedback.md` | 影响 selection 排序       |

**输出**：每条命中以 `[insight:<file>#<section>]` 格式记入 `selection.routeHintsUsed`，并写入 `matched-insights.txt` 供 PHASE 4 `knowledge-reuse` gate 核对。

**反馈叠加**：读取 `.auto/feedback/agents.json` 与 `.auto/feedback/skills.json`，已有负向信号的 agent/skill 降优先。读取 `agents.json` 中每个 agent 的 `preferences` 字段，注入到 Quest 设计约束（如 `questGranularity: fine` → 更细的 Quest 拆分）。

**置信度规则**：confidence=low 的条目仅参考不强制注入。

### 2.2 编排决策

参考 `workflow-patterns.md` 的编排模式，结合用户需求自主完成：

1. **任务拆解**：分析自然边界，每步有明确产出
2. **Agent 选择**：基于 route 结果 + 任务特性（参考 `_shared-principles.md` 交接路径）
3. **Skill 激活**（两阶段：动态发现 → 激活执行，替代旧的"被动注入"模式）

**阶段 A — 动态发现（四信号匹配，2026 增强版）**：
a. 从 SCAN 1.1 已读取的所有 Skill frontmatter 中提取 `name` + `description` + `tags`
b. 以 `RouteDecision.userIntent` + 技术栈 + 策略提取 3-5 个语义关键词
c. 逐 Skill 计算匹配度（四信号加权）：

- `tags` 命中数 × 2（基础信号）
- `description` 与用户意图的语义相似度 × 1（语义信号）
- 历史反馈信号 × 1.5（successRate > 0.8 → +1.5；0.5-0.8 → +0.5；< 0.5 → -1.0）（效果信号，来自 `.auto/feedback/skills.json`）
- 上下文预算调节 × (-0.5 ~ +0.5)（绿区 +0.5 / 黄区 0 / 红区 -0.5）（预算信号）
  d. 排序产出 **激活列表**（top-5，匹配度 ≥ 3）和 **备选列表**（匹配度 1-2）。激活列表按匹配度分三级：摘要级(3-4) | 全文级(5-6) | 深度级(7+)
  e. 未匹配的 Skill 记录到 `selection.rejectedCapabilities`（含原因）
  f. **Phase 敏感性调整**：实现/探索策略下，code-style-enforcer、comment-standards 的匹配度 -1（这些 Skill 的核心价值在 VERIFY 阶段，PLAN/EXECUTE 阶段降权）；重构策略下所有 Skill 恢复正常权重。
  g. **上下文预算联动**：红区时强制所有 Skill 降级为摘要级；黄区时深度级降为全文级。

**阶段 B — 激活执行（三级激活，分段读取，控制上下文占用）**：

- **摘要级激活**（匹配度 3-4）：只读 skill 的 `## 激活摘要` 段落（~20 行），提取 checklist + constraints + anti-patterns，追加到本关 `acceptance`。不读全文。
- **全文级激活**（匹配度 5-6）：先读 `## 激活摘要`，再按需读全文中的相关 `###` 子段落（如具体模式/代码模板/详细流程）。不读 references。
- **深度激活**（匹配度 7+）：全文级 + 按需 Read 对应 `.references/` 目录下的参考文件。
- 缓存加速：如 `.auto/cache/skill-extracts/<skill>.md` 存在 → 直接读缓存（内容即 `## 激活摘要` 副本），跳过 skill 文件读取。
- 缓存回写：执行完成后将提取的四要素（checklist/patterns/anti-patterns/template）写入 `.auto/cache/skill-extracts/<skill>.md`（格式：4 个 `##` 段落，每段 ≤ 10 行），供后续 run 复用。
- **备选**（其余匹配度 ≥ 1）：仅在 Quest 遇到特定场景时补充查阅，默认不加载。
- **预算联动降级**：当上下文进入黄区/红区时，自动将所有已激活 Skill 降级一档（深度→全文→摘要→仅路由参考），释放上下文空间给 EXECUTE 核心操作。详见 `skills/context-engineering/SKILL.md`。

**兜底索引**（动态发现不可用时的回退路径 — SCAN 未读到任何 frontmatter 或全部 Skill 匹配度 < 3）：

| 触发条件                                                 | 激活 Skill              |
| -------------------------------------------------------- | ----------------------- |
| Java / Spring Boot                                       | `java-patterns`         |
| 性能优化相关                                             | `performance-patterns`  |
| 错误处理 / 异常                                          | `error-patterns`        |
| Git 操作 / 提交 / PR                                     | `git-workflow`          |
| 代码风格 / 格式化                                        | `code-style-enforcer`   |
| 依赖分析 / 升级                                          | `dependency-analyzer`   |
| 多 Agent 编排                                            | `workflow-patterns`     |
| 新项目初始化                                             | `init-project`          |
| Bug / 调试 / 测试失败 / 构建失败                         | `systematic-debugging`  |
| PRD / 需求文档 / 产品需求                                | `prd-writer`            |
| 模糊需求 / 多种合理理解 / 关键名词缺定义                 | `requirement-clarifier` |
| 需求明确但实现路径多选 / 架构决策 / 技术选型未定         | `brainstorming`         |
| 多并行 Quest / 多模块独立开发 / 隔离需求                 | `using-git-worktrees`   |
| 不熟悉的库 / 新技术栈 / 显式 `--research`                | `research-analyst`      |
| 实现 / 重构策略下的 PHASE 2                              | `test-plan-writer`      |
| 日志 / log / tracing / 可观测性                          | `logging-patterns`      |
| 重试 / 熔断 / 限流 / 降级 / 幂等 / 并发                  | `robustness-patterns`   |
| 上线 / 部署 / 生产环境 / production                      | `production-standards`  |
| 代码注释 / 注释规范 / JSDoc                              | `comment-standards`     |
| 创建 skill / 编写 skill / 优化 skill                     | `skill-creator`         |
| 代码结构分析 / AST / tree-sitter（非纯 MD 项目）         | `code-analyzer`         |
| 评估 skill / skill 健康度 / skill 触发诊断               | `skill-evaluator`       |
| 重构 / 代码整理 / 拆分大文件 / 消除重复                  | `refactoring-patterns`  |
| API 设计 / REST / 接口规范 / OpenAPI                     | `api-design`            |
| 需求明确但验收标准模糊 / 接口设计 / 契约驱动             | `spec-driven`           |
| 复杂任务 / 上下文接近极限 / 跨会话续接 / 多 Agent        | `context-engineering`   |
| 项目硬约束 / 非协商原则 / `.auto/constitution.md` 存在   | `constitution`          |
| 会话末增量代码审查 / dirty files 累积 / Stop hook review | `incremental-review`    |
| 每关完成自纠 / Reflexion / 主线漂移防范 / quest critique | `self-critique`         |

4. **Agent 交接**：上游产出 = 下游输入，显式声明交接数据
5. **并行/串行**：无依赖可并行，有依赖按拓扑排序串行

### 2.3 Extended Thinking 触发（Claude 4.7 深度推理）

**触发条件**（满足任一即启用）：

- 复杂度 = `high`（由 RouteDecision 判定）
- 策略 = `重构`（架构级变更）
- 用户显式要求（`--deep-think` 或 `/effort max`）
- Quest 数量 ≥ 5（多步骤任务）

**推理配置**：

```
推理预算：16k tokens（复杂任务）
推理可见性：对用户隐藏（避免干扰）
推理记录：写入 .auto/runs/<runId>/thinking.md（供调试）
```

**推理重点**：

- 架构权衡（可扩展性 vs 简洁性）
- 边界场景（空值、极值、并发）
- 失败路径（错误处理、回滚策略）
- 性能影响（时间复杂度、空间复杂度）

**不启用场景**：

- 策略 = `探索` 或 `修复`（简单任务）
- 快速通道（< 20 行变更）
- 用户显式禁用（`--no-think`）

> **Extended Thinking 是 Claude 4.7 的核心能力**，在复杂任务中可提升 30% 质量。但会消耗额外 tokens，需权衡成本与收益。

### 2.4 假设声明（Think Before Coding）

产出 QuestMap 前必须显式声明：

- **我的假设是**：列出对需求的理解（如有多种理解，列出选项让用户选，不偷偷选一个）
- **更简方案**：如果存在更简单的实现路径，主动指出
- **不确定项**：如果有什么不清楚，先停下来问，不猜

如果假设明显有误或用户打断，修正后重新产出 QuestMap。

**假设证伪（Counter-example）**：列完假设必须主动找反例 — `我的假设可能错在哪？` 至少举 1 个反例 + `如果反例为真，方案如何调整？` 至少 1 个备选。证伪不是仪式，是真的让自己怀疑。

**Premortem（事前验尸）**：证伪完成后再追问一次 — "假设 6 个月后这个 run 引发 P0 事故，复盘报告最可能写哪 3 个原因？" 把 3 条原因塞进 `QuestMap.pitfalls`，让 EXECUTE 主动规避。证伪找逻辑反例，premortem 想未来事故，捕捉的是不同维度的盲区——尤其运维 / 数据 / 上下游耦合类问题逻辑找反例找不到。

> **澄清优先于假设**：假设清单出现 ≥ 1 个无法独立判定的歧义项时，必须先调 `requirement-clarifier` skill 用 `AskUserQuestion` 回问用户（最多 3 题），再产出 QuestMap。详见 `skills/requirement-clarifier/SKILL.md`。

### 2.4 推理摘要

向用户展示简明编排推理，至少包含：

- 任务理解（含假设声明）
- 复杂度与执行策略
- Quest 拆解与依赖拓扑
- Agent 调度与 Skill 注入

展示后默认继续执行，不等待确认；如用户显式打断则停止。

> **30 秒 Reflexion**（PLAN→EXECUTE 之前必做）：自问 — 这个 QuestMap 看 3 遍，**最不放心的是哪一关**？该关 acceptance 是不是含糊的？最不放心的关是不是缺测试关？如果有任一不放心 → 回 2.5 加固，再进 EXECUTE。

### 2.5 Quest 设计

| 策略 | Quest 设计方式                                                   |
| ---- | ---------------------------------------------------------------- |
| 探索 | 跳过 quest-designer，由主窗口生成最小 `QuestMap`，供后续只读执行 |
| 修复 | 跳过 quest-designer，自行生成单关修复计划并固化为最小 `QuestMap` |
| 实现 | 调用 quest-designer 生成完整 `QuestMap`                          |
| 重构 | 调用 quest-designer 生成完整 `QuestMap`（含深度分析）            |

> **方案探索前置**：策略=`实现` 或 `重构` 且需求中存在 ≥ 2 条合理实现路径时（如 OAuth/JWT/Session、Redis/本地缓存、新建/重构），调用 quest-designer **之前**必须先调 `brainstorming` skill 列 2-3 个方案（含权衡 / 利弊 / 反例 / AI 推荐）让用户选定方向。`requirement-clarifier` 处理模糊需求，`brainstorming` 处理多路径选择，两者互补。详见 `skills/brainstorming/SKILL.md`。

> **测试计划前置**：策略=`实现` 或 `重构` 时，调用 quest-designer **之前**必须先调 `test-plan-writer` skill 产出 `.auto/runs/<runId>/test-plan.md`，作为 quest-designer 上下文输入。详见 `skills/test-plan-writer/SKILL.md`。

> **调研前置**：触发 `research-analyst` skill 时，先产出 `.auto/runs/<runId>/research-brief.md`，再进入本节的 quest-designer 调用。

> **白话复述（Rubber Duck）**：调用 quest-designer **之前**，用 ≤ 3 句不含技术术语的白话把方案讲给"完全不懂技术的用户"听。讲不顺 = 自己也没真懂 → 回 2.2 重新整理再调。AI 最容易用术语糊弄自己，强制翻译白话能立刻暴露理解漏洞——这是糊涂上下文进入 quest-designer 前的最后一道闸。

调用 quest-designer 时，组装上下文：

```text
【用户需求】[原始需求]
【技术栈】[语言+框架]
【项目规范】[CLAUDE.md 摘要]
【编排计划】任务拆解 + Agent 调度 + Skill 激活列表（含匹配度）+ 交接关系 + 并行/串行
【能力清单】Agents + Skills 列表
【现有代码】源码路径列表
【历史经验】Memory 匹配的经验摘要
【Router 推荐】主 Agent + 回退链 + 复杂度 + 安全敏感度
```

### 2.6 Micro QuestMap 最小要求

当任务足够轻量，不调用 `quest-designer` 时，也不得跳过 PLAN，而是必须产出最小 `QuestMap`（Micro QuestMap）。

最小要求：

- `routeDecisionId`
- `goal`
- `executionMode`（通常为 `direct`）
- `outOfScope`（明列"本次不做但可能被诱惑做的事"，见下方 Scope Contract）
- 至少 1 个 `quest`
- 每个 `quest` 至少包含：
  - `questId`
  - `objective`
  - `ownerAgent`
  - `inputs`
  - `outputs`
  - `touchFiles`（PLAN 阶段锁定；EXECUTE 想改清单外文件必须显式声明 `scope-expand`，见 PHASE 3.2 Touch-set Lock）
  - `estimatedLines`（本关变更行数预估，如 `≤ 60 行`；EXECUTE 实际超出 50% 时停下自问"是否过度设计？能否拆成两关？"）
  - `acceptance`（优先使用可执行验证命令，如 `npm test -- --grep "X"`，而非"功能正常"等弱描述）；探索模式随后也必须产出只读 `QuestResult` 与 `VerifyReport(status=skipped)`，再进入 SUMMARIZE / LEARN。

> **Scope Contract（"本次不做"清单）**：`outOfScope` 字段必须显式列出"用户/AI 可能想做但本次不做的事"（如"不重构 X 模块""不升级依赖""不加日志框架""不优化 Y 模块的性能"）。「不做清单」比「要做清单」更长是健康信号——它要求 AI 直面诱惑，写下即合同，EXECUTE 顺手就违约。

> **角色快检（A+P+T+D+C）**：QuestMap 落盘前自问 — `[A]` 拆解符合 SOLID/单一职责吗？模块边界清晰、依赖单向？`[P]` 每关有可独立交付的用户价值吗？有没有为了拆而拆？`[T]` test-plan-writer 真产了 6 维矩阵吗？regression 维度显式列出？`[D]` 每关 acceptance 是可执行命令而非"功能正常"吗？覆盖边界值？`[C]` 这 QuestMap 真能满足用户原话吗，还是只满足 AI 简化版？严重命中需回 2.5 加固。

---

## PHASE 3: EXECUTE — 逐关执行

### 3.0 实时进度反馈

**每关开始时输出**:

```
🎯 [Quest 1/5] 正在实现用户注册功能...
   预估耗时: 约 2 分钟
   触及文件: src/auth/register.ts, src/models/user.ts
```

**每关完成时输出**:

```
✅ [Quest 1/5] 完成 — 用户注册功能已实现
   实际耗时: 1 分 45 秒
   变更: +85 行, -12 行
```

**整体进度条**（可选）:

```
总进度: [████████░░░░░░░░░░░░] 40% (Quest 2/5)
预估剩余: 约 6 分钟
```

**进度反馈规则**:

1. **简洁优先** — 每关开始/完成只输出 1-2 行
2. **预估准确** — 基于历史数据和复杂度估算
3. **实时更新** — 每关完成后更新总进度
4. **可跳过** — 用户可用 `--quiet` 禁用进度输出

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

**Skill 激活协议**（每关执行前必做，三级激活，确保 Skill 被真正执行而非被动参考）：

1. 从 `QuestMap` 获取本关分配的 `skills` 列表及激活级别（由 2.2 动态发现产出）
2. **分段读取**（按激活级别 + 缓存优先，控制上下文占用）：
   - 优先读 `.auto/cache/skill-extracts/<skill>.md`（如存在，~20 行激活摘要副本）
   - 缓存不存在 → **摘要级**: 只读 skill 的 `## 激活摘要` 段落（~20 行）
   - **全文级**: 摘要级 + 按需读具体 `###` 子段落（如模式/模板）
   - **深度级**: 全文级 + 按需 Read `.references/` 目录文件
3. 从读取内容中提取以下可执行要素，追加到本关执行计划：
   - **检查清单**（checklist）→ 追加到本关 `acceptance`
   - **模式/规范**（patterns）→ 作为本关代码生成约束
   - **输出模板**（output template）→ 作为本关产出格式
   - **禁止项**（anti-patterns）→ 作为本关回避清单
4. 执行完成后：
   - 在 `QuestResult.validations` 中逐条记录每个 skill 的应用证据（不得跳过）
   - 将提取的要素写入 `.auto/cache/skill-extracts/<skill>.md`，供后续 run 复用
5. 如 skill 有明确的输出格式要求，`QuestResult` 必须遵循该格式

每关执行序列：激活 Skills → Read 代码 → Write/Edit 或只读分析 → 必要验证。
探索模式也必须产出一个只读 `QuestResult`，用于把分析结论标准化地交给 VERIFY / SUMMARIZE / LEARN。

**变更洁癖（Surgical Changes）**：每关完成后自检 — 每行变更是否可追溯到用户需求？禁止顺手"改进"无关代码、重构未损坏的逻辑、或添加未要求的抽象。只清理本关引入的孤立代码。

**实施纪律三件套**（执行中持续生效）：

- **Touch-set Lock（文件圈定）**：想改 `touchFiles` 清单外文件必须在 `QuestResult.validations` 显式声明 `scope-expand` 并写明理由；扩张超过 2 个文件触发 PLAN 回流，不允许悄悄改。
- **扩张词刹车（Expansion-Word Stop）**：本关执行中出现"顺手""既然""不如""一并""趁机""索性"等扩张词，立即停下自问"这在用户原话里吗？" 不在 → 加入 `outOfScope`，不做。扩张词是 AI 越界的语言信号，捕到即抓手。
- **不偷工捷径声明（No-Shortcut Pledge）**：任何时刻想 mock 数据库 / skip 测试 / 用 `--no-verify` / `@ts-ignore` / `eslint-disable` / 改测试让它通过 / 删失败用例时，先写一行 `[shortcut-attempt]` 到 `QuestResult.notes` 说明诱惑来源与不走捷径的替代方案，再决定。多数捷径写下来那一刻 AI 自己就会放弃。

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
5. `budget_exhausted` — run 级 budget 超限（默认 maxIterations 25 / maxToolCallsPerQuest 15 / 同动作 3 次去重）→ 立即产出 `LearnCard(category=trap, failureClass=resource)` + 写 `session-continuity.md(status=suspended)` + 不自动重启。详见 `agents/_shared-principles.md` 「运行级 Budget 与循环检测」节。

每关完成后立即写盘到 `.auto/runs/<runId>/quest-results.md`，上下文中只保留 `questId` + `status`。
连续 3+ 关后主动压缩：合并已完关为一段 checkpoint 写入文件，上下文中清除已完关详情。
如感知上下文接近极限，立即写入 `session-continuity.md` 并提示用户开新会话续接。

### 3.3 QuestResult

每关完成后输出标准 `QuestResult`（schema 见 `_shared-principles.md`）。

- 探索模式也要输出 `QuestResult(status=success)`，`validations` 标记为 `analysis` / `skipped`
- 失败上下文供 `verification` 和 `build-error-resolver` 直接消费
- 落盘到 `.auto/runs/<runId>/quest-results.md`

> **Self-Critique 触发**（策略 = 实现/重构，每关必做）：`QuestResult` 落盘后立即调用 `self-critique` skill，产出 `.auto/runs/<runId>/quest-<N>-critique.md`（含 objective 复述 / diff 反向翻译 / 达成度评分 0-100 / 盲点清单 / 下一动作建议）。**达成度 < 70 必须修补或回流 PLAN**，禁止直接进入下一关。修复策略下单关 ≤ 20 行变更可跳过。详见 `skills/self-critique/SKILL.md`。

> **反向翻译（Reverse Diff）**：QuestResult 落盘前，把本关 diff 反向翻译成一段需求描述，再与本关 `objective` 对照。如果翻译出的需求 ≠ objective（多了或少了），说明本关偏移，回头修。能抓住"功能做对了但顺手改了无关的"那一类——和 PHASE 4 全局主线回顾形成单关级 + 全局级双层防漂移。

> **角色快检（D+B+O+T）**：每关执行后自问 — `[D]` 每行变更可追溯到需求吗？有 console.log/注释残留？错误处理覆盖所有路径？`[B]` SQL 参数化吗？索引覆盖查询？事务边界合理？N+1 查询？`[O]` graceful shutdown？配置走环境变量（不硬编码）？健康检查端点？`[T]` 红测试在绿之前真的失败过？测试独立可重入？严重命中应阻断本关 success。

### 3.4 中断恢复

SCAN 阶段检测到 `.auto/runs/<latestRunId>/session-continuity.md` 存在且 `status=interrupted` 时：

1. 读取 `interruptPoint`，向用户展示一行摘要："上次在 Quest X/Y 中断（<lastSuccessfulAction>，待 <pendingActions>）"
2. 默认续接（不等确认），除非用户显式说"重新开始"
3. 跳过已完成的 Quest，从 `interruptPoint.stepWithinQuest` 继续
4. 按 `interruptPoint.contextSnapshot` 重新加载关键文件到上下文

续接时 EXECUTE 不重新生成 QuestMap，而是从 `session-continuity.md` 中读取 `lastCheckpoint` 和 `interruptPoint`，直接从中断点继续执行。

### 3.5 条件分支执行

当 QuestMap 中 Quest 含 `conditionalNext` 时：

1. 当前 Quest 完成后检查 `QuestResult.status`
2. 按 `conditionalNext` 映射跳转到对应 questId：
   - `on_success` → 正常下一关
   - `on_fail` → fallback Quest（降级方案）
   - `on_partial` → 重试简化版
3. `isFallback=true` 的 Quest 的 acceptance 可以比主路径宽松（降级是合理的）
4. 条件分支不增加用户交互——AI 自主判断走哪条路
5. Fallback Quest 完成后，如无 `conditionalNext`，默认按线性顺序继续

### 3.6 压缩防护

当感知上下文接近 70% 时（连续 3+ 关后自动触发）：

1. **复读原话（Echo the Ask）**：把 `RouteDecision.userIntent` 一字不差复读到上下文，再决定下一关方向。长 run 最大风险是"AI 只记得最近的 Quest，忘了用户原话"——复读成本极低但能拉回 mainline。
2. 立即将当前 Quest 的 `interruptPoint` 写入 `session-continuity.md`
3. 将已完成关的 QuestResult 合并为 checkpoint 写盘
4. 上下文中只保留：当前关的 questId + inputs + acceptance + 最近 1 关的 status
5. 如上下文接近极限，立即写入 `session-continuity.md(status=suspended)` 并提示用户开新会话续接

---

## PHASE 4: VERIFY — 门禁验证

`VERIFY` 必须消费 `QuestResult` 并输出标准 `VerifyReport`。即使探索模式没有代码变更，也要输出 `status=skipped` 的 `VerifyReport`。验证失败时只按 Quest 级失败协议回流。

> **主线回顾 + Subagent 交叉审计**（gate 调度前必做）：先一字不差重读 `RouteDecision.userIntent` 原话；再并行启动 `verification` + `code-reviewer` 两个 subagent，对照原话审计全部 `QuestResult`，重点识别「半满足 / 换形式满足 / 顺手增改 / 偏离主线」四类偏移。任一 subagent 报严重偏移 → 回流 EXECUTE 修正，不进入下面的 gate 流程。一次审计能同时捕捉 PLAN 阶段的需求误解和 EXECUTE 阶段的实现漂移，杠杆最大。

> **Subagent 上下文隔离**（2026 Context Engineering 核心实践）：每个验证 subagent 只接收完成其任务所需的**最小上下文**，而非整个会话历史：
>
> - `verification` subagent：只传入当前 Quest 的 `touchFiles` + `objective` + `acceptance` + 对应 diff
> - `code-reviewer` subagent：只传入变更文件内容 + 项目编码规范摘要 + 本关 anti-patterns
> - `security-reviewer` subagent：只传入涉及安全敏感的文件 + 威胁模型上下文
> - **禁止**将完整 QuestMap、历史 run 详情、或无关 Quest 的 QuestResult 传递给验证 subagent
> - **收益**：减少 subagent 幻觉（无关上下文是 hallucination 首因）、降低 token 消耗 40-60%、提升验证精度

门禁 taxonomy：`analysis`、`build`、`test`、`lint`、`coverage`、`security`、`adversarial`、`self-verification`、`self-critique`、`skill-activation`、`knowledge-reuse`、`knowledge-distribution`、`clean-state`、`cost`。

各策略最少 gate 要求：

| 策略 | 必需 gate                                                                                                                                                                                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 探索 | `analysis` + `skill-activation`（evidence: `read-only`）+ `knowledge-reuse`（evidence: `analysis-only` / `no-code-change`）+ `knowledge-distribution` + `clean-state`                                     |
| 修复 | `build` + `test` + `self-verification` + `skill-activation` + `knowledge-reuse`（evidence: `relevant`）+ `knowledge-distribution` + `clean-state`                                                         |
| 实现 | `build` + `test` + `lint` + `coverage` + `self-verification` + `self-critique` + `skill-activation` + `knowledge-reuse` + `knowledge-distribution` + `clean-state`                                        |
| 重构 | `build` + `test` + `coverage` + `security` + `adversarial` + `self-verification` + `self-critique` + `skill-activation` + `knowledge-reuse`（evidence: `full`）+ `knowledge-distribution` + `clean-state` |

#### `self-verification` gate（Claude 4.7 自我验证）

**触发条件**（策略 = 修复/实现/重构）：
每个 QuestResult 产出后，Claude 自动检查自己的输出。

**验证维度**：

1. **语法正确性** — 代码可编译/解析
2. **逻辑一致性** — 实现符合需求
3. **边界值覆盖** — 空值、极值、并发
4. **错误处理** — 异常路径完整
5. **性能影响** — 无明显性能退化

**验证流程**：

```
1. Claude 产出代码（QuestResult）
2. Claude 自我审查（Self-Verification）
3. 发现问题 → 自动修正 → 重新产出
4. 无法修正 → 标记为需人工审查
5. 验证通过 → 继续下一个 gate
```

**输出格式**：

```json
{
  "gate": "self-verification",
  "status": "pass" | "warning" | "fail",
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "syntax" | "logic" | "boundary" | "error-handling" | "performance",
      "description": "具体问题描述",
      "autoFixed": true | false,
      "location": "file:line"
    }
  ],
  "summary": "自我验证摘要"
}
```

**处置规则**：

- `pass`：无问题或已自动修正，继续
- `warning`：有低优先级问题，记录但放行
- `fail`：有关键问题且无法自动修正，回流 EXECUTE

> **Self-Verification 是 Claude 4.7 的核心能力**，可减少 50% 错误率，降低 60% 人工审查时间。

#### `self-critique` gate（Reflexion 当 run 自纠）

**触发条件**（策略 = 实现/重构）：每个 Quest 完成后立即触发，产出 `.auto/runs/<runId>/quest-<N>-critique.md`。修复策略下可选。详见 `skills/self-critique/SKILL.md`。

**与 `self-verification` 的差异**：

| Gate                | 关注层次                                             | 输出                              |
| ------------------- | ---------------------------------------------------- | --------------------------------- |
| `self-verification` | 代码语法 / 逻辑 / 边界 / 错误处理（Claude 4.7 自动） | 代码缺陷修正                      |
| `self-critique`     | 本关是否真满足 objective（主线漂移防范）             | 达成度评分 + 盲点 + 是否回退 PLAN |

**验证维度**：

1. **objective 满足度**：本关 diff 反向翻译后是否与 objective 等价（参考 PHASE 3.3 反向翻译）
2. **盲点暴露**：主动列 ≥ 1 条「最不放心的事」
3. **outOfScope 合规**：是否引入了 PLAN 阶段声明的 outOfScope 内容
4. **达成度评分**：0-100，< 70 触发修补或回流

**处置规则**：

- `pass`：critique 达成度 ≥ 70 且盲点已处理 → 继续下一关
- `warning`：达成度 70-85 但盲点未完全处理 → 记录到 `agent-feedback.md`，放行
- `fail`：达成度 < 70 或发现 outOfScope 违规 → 回流 PLAN 修订 QuestMap

**跳过条件**：策略=探索（无代码变更）；策略=修复且单关 < 20 行（快速通道）。

#### `skill-activation` gate（必检）

核对 PLAN 2.2 激活的 Skill 是否在 EXECUTE 中被真正应用（Read + 提取要素 + 记录证据），而非仅作为参考名称被引用。

**验证逻辑**：

```text
对每个激活 Skill（top-3 列表）：
1. 检查 QuestResult.validations 中是否存在该 skill 的应用证据条目
2. 每条证据必须包含：skill 名称 + 提取了哪些要素（checklist/pattern/template/anti-pattern）+ 对应的代码位置或决策点
3. 缺失证据的 skill 计为未激活
```

| 结果      | 条件                                                           | 处置                  |
| --------- | -------------------------------------------------------------- | --------------------- |
| `pass`    | 所有激活 Skill 均有 ≥ 1 条应用证据                             | 继续                  |
| `warning` | ≤ 50% 激活 Skill 缺少证据，但核心 Skill 已应用                 | 记录缺失列表，放行    |
| `fail`    | > 50% 激活 Skill 无证据，或核心 Skill（由 2.2 排序决定）未应用 | 回流 EXECUTE 补充应用 |

**跳过条件**：探索模式且无激活 Skill（激活列表为空）。

**证据格式**（写入 `QuestResult.validations`）：

```json
{
  "name": "skill-activation",
  "skillName": "systematic-debugging",
  "status": "pass",
  "evidence": "读 skill 缓存/快速使用段（42 行），提取 checklist + anti-patterns，在 Quest 3 错误处理中应用了根因追踪方法（见 file.ts:L45-L62）"
}
```

#### `knowledge-reuse` gate（必检）

核对当前 run 是否真正复用了已沉淀知识：

```bash
# 期望注入数 = .auto/cache/insight-index.json 命中数 × 0.5（向下取整）
EXPECTED=$(jq '...' .auto/cache/insight-index.json | wc -l)
ACTUAL=$(grep -c "\[insight:" .auto/runs/<runId>/quest-map.md)

[ "$ACTUAL" -ge "$((EXPECTED / 2))" ] && echo pass || echo warn
```

| 结果      | 处置                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| `pass`    | ACTUAL ≥ ⌊EXPECTED × 0.5⌋                                                     |
| `warning` | 首次未达标，记录到 `agent-feedback.md` 但放行                                 |
| `fail`    | 同一项目 / 同一关键词组连续 2 次未达标，VERIFY status=fail 并触发失败学习闭环 |

跳过条件：`insight-index.json` 不存在或为空；本次 SCAN 检索词无任何索引命中。

跳过的 gate 必须标记 `status=skipped` 并给出理由，不得直接省略。

#### `knowledge-distribution` gate（必检 · 所有策略）

核对本 run 产出的 `LearnCard` 是否真**分发**到 `.auto/insights/` 对应文件，而非仅停留在 `runs/<runId>/learn-cards.md`。这是「沉淀闭环」从软建议升级为硬约束。

**验证逻辑**：

```bash
# 1. 提取本 run 的 LearnCard 标题与 category
TITLES=$(grep -E "^## LearnCard #" .auto/runs/<runId>/learn-cards.md)
CATEGORIES=$(grep -E "^- category:" .auto/runs/<runId>/learn-cards.md | awk '{print $3}')

# 2. 按 category 检查对应 insights 文件是否已 append（按标题或 来源:run-<runId> 匹配）
for CAT in $CATEGORIES; do
  FILE=".auto/insights/${CAT/feedback/agent-feedback}.md"
  grep -q "来源.*run-<runId>" "$FILE" || echo "MISS: $CAT 未分发"
done
```

| 结果      | 条件                                                                   | 处置                           |
| --------- | ---------------------------------------------------------------------- | ------------------------------ |
| `pass`    | 所有 LearnCard 均已 append 到对应 `.auto/insights/<category>.md`       | 关闭 run                       |
| `warning` | < 50% LearnCard 未分发，但全部 trap / critical decision 已分发         | 记录缺失列表，放行             |
| `fail`    | ≥ 50% LearnCard 未分发，或任意 `category=trap` 的 LearnCard 未进 traps | 回流 LEARN 补分发，再次 verify |

**跳过条件**：本 run 未产出 LearnCard（极少见，通常意味着 LEARN phase 自身有缺陷）。

**分发清单（硬约束）**：

| LearnCard.category | 目标文件                                                                           |
| ------------------ | ---------------------------------------------------------------------------------- |
| `trap`             | `.auto/insights/traps.md`                                                          |
| `pattern`          | `.auto/insights/patterns.md`                                                       |
| `decision`         | `.auto/insights/decisions.md`                                                      |
| `prompt`           | `.auto/insights/prompts.md`                                                        |
| `feedback`         | `.auto/insights/agent-feedback.md` + `.auto/feedback/agents.json` 或 `skills.json` |

**最小 append 格式**（每张 LearnCard）：

```markdown
### <标题>

**日期**: YYYY-MM-DD | **置信度**: high|medium|low | **来源**: run-<runId>

<2-3 句核心描述 + 推荐动作>
```

来源行 `run-<runId>` 是 distribution evidence 的硬锚点 — VerifyReport 检查时 grep 这个串。

**反模式**：

- 把 `runs/<id>/learn-cards.md` 视为知识沉淀终点 → 下次 SCAN 无法反查
- LearnCard 写完不分发就跑 SUMMARIZE → 看起来完成，实际等同于没沉淀
- 分发时省略 "来源" 行 → verify 无法核对，未来追溯丢失

Gate owner：`main`（轻量/单命令）、`verification`（对抗/红蓝/复杂汇总）。

### VerifyReport

输出标准 `VerifyReport`（schema 见 `_shared-principles.md`）。

> **实测优先于断言（Run-Don't-Claim）**：任何"测试通过 / 构建成功 / 类型检查通过 / 运行无报错"类陈述必须附带实际执行的命令 + 输出尾部 ≥ 3 行作为 `evidence`。没跑过命令不准说通过；输出含 warning 必须列出。AI 最常的偷懒是"我假定它能跑"——强制贴输出让"想当然"无处遁形，比加 10 个 gate 都有用。

> **预测后验证（Predict-Then-Verify）**：跑任何验证命令前先预测结果（pass/fail + 预期通过数 / 预期错误位置）写到 `VerifyReport.predictions` 字段；预测错 = 理解错，必须停下修理解再继续，不许"哦原来挂了再改"。不预测的人是在用工具掩盖无知——强制预测能立刻暴露"以为懂其实没懂"，复杂重构高效。

### 对抗验证（重构模式专用）

调度 `verification` 进行红蓝对抗：边界值攻击、并发场景、幂等性、错误路径覆盖。

**出口**：展示 `VerifyReport`。全部通过则进入 SUMMARIZE；达到最大修复次数仍失败则 Quest 级回滚并终止。

> **角色快检（C+T+B+O+A）**：VerifyReport 落盘前自问 — `[C]` 跑一遍最丑陋真实输入会怎样？用户最常问 3 个反例覆盖了吗？`[T]` coverage ≥ 80%？边界值/空值/极大值都测了？并发场景？`[B]` 数据迁移可回滚？锁竞争？慢查询日志？`[O]` 监控指标埋点？关键日志含 correlation-id？失败率/延迟阈值？`[A]` 引入了没必要的抽象吗？与现有架构一致？接口契约清晰？任一严重命中需新增 gate 或回流 EXECUTE。

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

> **角色快检（C+P）**：SUMMARIZE 前自问 — `[C]` 用户原话被满足了吗，还是「换了一种 AI 觉得满足的形式」？`[P]` 用户最关心的指标变好了吗？有没有引入新的用户感知问题？严重命中应在 index.md 显式标注遗留阻塞。

---

## PHASE 6: LEARN — 知识沉淀

### 6.0 知识蒸馏原则（2026 Context Engineering 增强）

**核心理念**：沉淀的知识必须是**原子化、可检索、跨会话可用**的，而非原始日志的堆积。

**蒸馏三步**：

1. **压缩**：从 QuestResult + VerifyReport 中提取可复用模式，每条 ≤ 5 行
2. **标记可迁移性**：为每条知识标注适用范围
   - `scope: project` — 仅当前项目适用（如特定配置路径、项目约定）
   - `scope: stack` — 同技术栈项目通用（如 Spring Boot 最佳实践）
   - `scope: universal` — 跨项目通用（如错误处理模式、调试方法论）
3. **去重合并**：与 `.auto/insights/` 已有条目对比，同主题则更新而非追加

**跨项目复用信号**：

- `scope: stack` 或 `scope: universal` 的 LearnCard 额外写入 `.auto/feedback/skills.json` 的 `portablePatterns` 字段
- 下次 SCAN 读取 `skills.json` 时，这些 patterns 可直接注入到相同技术栈的新项目
- 格式：`{"pattern": "<描述>", "scope": "stack|universal", "source": "run-<runId>", "confidence": "high|medium"}`

**反模式**：

- 把完整 QuestResult JSON 当作 "knowledge" 塞进 insights（太长、不可检索）
- 沉淀仅适用于当前 commit 的临时信息（过期即噪声）
- 沉淀不标注 scope 导致未来误用

#### `clean-state` gate（关门自检）

在沉淀知识之前，先验证当前 run 是否处于可续接的干净状态。借鉴 harness engineering 的 `clean-state-checklist.md` 模式——关门不是"做完了"，而是"下一个会话能无缝起步"。

**验证维度**：

1. **startupAndTestsPass** — `init.sh` 或等效启动验证命令通过（测试/类型检查/构建全绿）
2. **progressLogReflectsReality** — `quest-status.json` 中所有 Quest 的状态与实际代码状态一致（没有"标记 passing 但实际代码未改"或"标记 not_started 但已有变更"）
3. **noHalfFinishedWorkRemains** — 没有未提交的、不属于任何 Quest 的变更（`git status --porcelain` 仅含本次 run 触及的文件）
4. **repoRestartableViaStandardPath** — 仓库处于可通过标准路径重新启动的状态（新会话不需要猜测如何开始）

**验证流程**：

```
1. 读取 quest-status.json → 逐 Quest 核对 status 与实际变更
2. 运行 git status --porcelain → 确认无孤立变更
3. 运行启动验证命令（如 npm test）→ 确认基线健康
4. 生成 cleanStateChecklist → 写入 session-continuity.md
```

**处置规则**：

- `pass`：4 项全部为 true，关闭 run，沉淀 LearnCard
- `warning`：1-2 项为 false 但非关键（如仅探索模式的 noHalfFinishedWork 不适用），记录但放行
- `fail`：任一项关键为 false（如测试不通过、Quest 状态与代码不一致），阻断 LEARN，回流修复后重新验证

**输出格式**（写入 `session-continuity.md` 的 `cleanStateChecklist` 字段）：

```json
{
  "startupAndTestsPass": true,
  "progressLogReflectsReality": true,
  "noHalfFinishedWorkRemains": true,
  "repoRestartableViaStandardPath": true
}
```

### 6.1 LearnCard

产出标准 `LearnCard`（schema 见 `_shared-principles.md`），再按分类分发：

| 类型   | 文件                | 内容                 |
| ------ | ------------------- | -------------------- |
| 踩坑   | `traps.md`          | 遇到的坑和解决方案   |
| 模式   | `patterns.md`       | 验证有效的做法       |
| 决策   | `decisions.md`      | 架构/技术选择及理由  |
| Prompt | `prompts.md`        | 可复用输入模式       |
| 反馈   | `agent-feedback.md` | agent/skill 路由反馈 |

**蒸馏要求**（每张 LearnCard 必须满足）：

- 核心描述 ≤ 5 行，原子化可检索
- 必须标注 `scope: project | stack | universal`（详见 6.0 蒸馏原则）
- `scope: stack|universal` 的条目额外写入 `.auto/feedback/skills.json` 的 `portablePatterns` 字段

> **硬约束**：VERIFY 任何 gate `status=fail`，或 EXECUTE 触发升级路径（attempt 2 / escalate / fail）时，本 Phase 必须先产出 `LearnCard(category=trap)` 并写入 `traps.md`。详见 `agents/_shared-principles.md` 「失败学习闭环」节。这是「同样错误不犯第二次」的闭环基础。

### 6.2 Agent 路由反馈

记录本次 Agent 调用结果，先生成 `LearnCard(category=feedback)`，再落盘到 `.auto/insights/agent-feedback.md` 与 `.auto/feedback/agents.json` / `.auto/feedback/skills.json`。

`.auto/feedback/skills.json` 字段定义与维护逻辑见 `commands/auto/learn.md` 与 `skills/skill-evaluator/SKILL.md`。

### 6.3 Git 模式分析

调用 `/auto:learn` 分析提交约定、热点文件和文件联动，统一输出为 `LearnCard(category=pattern)` 列表。

### 6.4 架构变更检测

对比 `REPO_MAP.md` 与实际结构，如检测到变更则建议更新文档。

**出口**：展示执行概览、知识沉淀统计和下次可复用提示。

> **角色快检（全角色复盘）**：LEARN 前自问每个角色 — `[C]` 哪一刻我差点偷懒？`[P]` 哪个用户洞察被忽略，沉淀为 prompt 模板？`[A]` 哪个架构决策值得复用，写到 decisions.md？`[D]` 哪个具体技巧/反模式值得固化到 patterns/traps？`[T]` 哪个 bug 是测试漏检，补到 test-plan-writer 矩阵？`[B]` 哪个数据问题值得加入 systematic-debugging？`[O]` 哪个生产问题值得固化为 hook？每命中一条产出一张对应 LearnCard。

---

### 6.5 Session Continuity

当 run 需要跨会话继续时，当前 phase 写入 `.auto/runs/<runId>/session-continuity.md`（完整 schema 见 `_shared-principles.md` 「session-continuity 标准对象」节）。

必填字段：`runId`、`status`、`currentPhase`、`nextPhase`、`requiredArtifacts`、`blockingIssues`、`resumePrompt`。
本次新增：`knownDefects`（已知但未修的缺陷列表，含位置和延后原因）、`unverifiedPaths`（未验证的代码路径，含风险评估）、`cleanStateChecklist`（关门自检 4 项：startupAndTestsPass / progressLogReflectsReality / noHalfFinishedWorkRemains / repoRestartableViaStandardPath）。

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
9. **上下文工程** — 对的 token 在对的时间：预算感知、渐进披露、压缩降级、Subagent 隔离（详见 `context-engineering` skill）
