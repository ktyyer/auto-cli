---
name: auto:learn
description: 将 Git 历史模式、执行经验和路由反馈统一输出为 LearnCard，并分发到 insights / feedback
allowed_tools: ['Bash', 'Read', 'Write', 'Grep', 'Glob']
---

# /auto:learn — LearnCard 知识沉淀入口

> `/auto:learn` 是 LEARN 阶段的显式入口。它先产出标准 `LearnCard`，再按分类写入 `.auto/insights/` 与 `.auto/feedback/`。

---

## 使用方式

```bash
/auto:learn
/auto:learn --git
/auto:learn --workflows
/auto:learn --json
```

---

## 目标

统一处理 3 类知识来源：

- Git 历史模式
- 本次 `/auto` 执行中的决策 / 踩坑 / Prompt
- agent / skill 路由反馈

输出时以 `LearnCard` 为唯一标准对象，不再额外定义另一套经验卡片格式。

---

## LearnCard 协议

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

---

## 当前支持范围

- 分析最近若干次 Git 提交
- 识别约定式提交占比
- 统计热点文件
- 发现常见文件联动关系
- 将 Git 模式统一映射为 `LearnCard(category=pattern)`
- 将路由反馈统一映射为 `LearnCard(category=feedback)`
- 将可复用的 route hints 写回 `.auto/feedback/agents.json` / `.auto/feedback/skills.json`
- 分析 skill 使用模式（命中、忽略、纠正），写回 `.auto/feedback/skills.json`
- 从 ≥ 3 个同策略 run 归纳可复用工作流模板（`--workflows`，AWM 模式）
- 将可复用的模式卡写回 `.auto/cache/pattern-cards.json`
- 为跨会话续接产出 `.auto/runs/<runId>/session-continuity.md`

> 当前文档定义的是 canonical 输出协议；实际落盘范围应以当前实现结果为准。

---

## Git 历史分析

### 使用场景

- 新成员快速了解仓库提交习惯
- 回顾团队常见改动热点
- 为 `/auto` 后续规划提供模式输入
- 在完整工作流后补充 `LearnCard(category=pattern)`

### 工作流程

#### 第一步：收集 Git 数据

```bash
git log --oneline -n 200 --name-only --pretty=format:"%H|%s|%ad" --date=short
git log --oneline -n 200 --name-only | grep -v "^$" | grep -v "^[a-f0-9]" | sort | uniq -c | sort -rn | head -20
git log --oneline -n 200 --pretty=format:"%s" | head -50
```

#### 第二步：检测模式

| 模式类型   | 检测方法                                          |
| ---------- | ------------------------------------------------- |
| 提交约定   | 正则匹配提交消息（feat:, fix:, chore:, docs: 等） |
| 文件联动   | 总是一起变更的文件组合                            |
| 热点文件   | 最近提交中被频繁修改的文件                        |
| 工作流线索 | 重复出现的文件变更模式                            |

#### 第三步：映射为 LearnCard

| 输入来源               | LearnCard.category | 目标文件                           |
| ---------------------- | ------------------ | ---------------------------------- |
| 热点文件 / 联动关系    | `pattern`          | `.auto/insights/patterns.md`       |
| 常见失败 / 回退经验    | `trap`             | `.auto/insights/traps.md`          |
| 架构选择理由           | `decision`         | `.auto/insights/decisions.md`      |
| 可复用输入模板         | `prompt`           | `.auto/insights/prompts.md`        |
| Agent / Skill 表现反馈 | `feedback`         | `.auto/insights/agent-feedback.md` |

### 示例输出

```json
{
  "mode": "git",
  "learnCards": [
    {
      "category": "pattern",
      "title": "commands/auto.md 是高频联动热点",
      "summary": "主命令文档经常与 route / shared-principles 一起变更",
      "targetInsightFile": ".auto/insights/patterns.md"
    }
  ]
}
```

---

## Skill 使用模式分析

### 使用场景

- 发现触发不准的 skill（应触发未触发 / 不应触发却触发）
- 识别长期被忽略的 skill，作为 `skill-evaluator` 的优先改进目标
- 积累 skill 健康度历史，辅助下次 `SCAN` / `route` 决策

### 数据来源

- 本次 run 的 `quest-results.md`：哪些 skill 被注入、哪些命中、是否被采纳
- 历史 `.auto/runs/**/quest-results.md`：滚动统计
- 用户纠正信号：对话中的"不对"/"别用"/"这个 skill 不合适"等负向反馈

### 映射为 LearnCard

| 观察           | category   | 目标文件                     |
| -------------- | ---------- | ---------------------------- |
| skill 高命中   | `pattern`  | `.auto/insights/patterns.md` |
| skill 被忽略   | `feedback` | `.auto/feedback/skills.json` |
| skill 被纠正   | `trap`     | `.auto/insights/traps.md`    |
| skill 触发不准 | `feedback` | `.auto/feedback/skills.json` |

### 回写 `.auto/feedback/skills.json`

按 skill 名聚合：

- `trigger_accuracy`
- `adoption_rate`
- `correction_count`
- `correction_patterns`
- `ignore_rate`
- `usage_frequency`

字段定义详见 `commands/auto.md` 6.2 节与 `skills/skill-evaluator/SKILL.md`。

---

## 工作流归纳（AWM 模式）

> 来源：Agent Workflow Memory（ICML 2025, arXiv:2409.07429）。从历史执行轨迹中归纳**子任务粒度**的可复用工作流，供后续 PLAN 拆关时直接复用。

### 触发条件

- 显式 `/auto:learn --workflows`
- 前置条件：`.auto/runs/`（未归档）中存在 ≥ 3 个同策略（修复/实现/重构）且 VERIFY pass 的 run；不满足时跳过并说明原因

### 归纳流程

1. **收集**：Read 候选 run 的 `quest-map.md` + `quest-results.md`，提取每关 objective / ownerAgent / 激活 skills / 验证方式
2. **对齐**：跨 run 比较 Quest 序列，找出出现 ≥ 2 次的重复子序列（2-4 关的子任务粒度，不取整条流水线）
3. **模板化**：把重复子序列抽象为工作流模板——具体文件名/模块名参数化为 `<占位符>`，保留 agent / skill / 验证组合
4. **产出**：每个模板一张 `LearnCard(category=pattern, tags 含 workflow)`，走标准分发链写入 `.auto/insights/patterns.md`

### 工作流模板格式（写入 LearnCard summary）

```markdown
适用：<触发场景，1 句>
步骤：<关1 objective> → <关2 objective> → <关3 objective>
组合：agent=<owner> | skills=<列表> | 验证=<命令或方式>
来源：run-<id1>, run-<id2>（≥2 个 run 实证）
```

### 复用路径

`patterns.md` 经 SCAN 1.6 / PLAN 2.1 注入 `QuestMap.knowledgeHints`，PLAN 拆解 Quest 时优先比对工作流模板，命中则按模板拆关。简单模板可作为复杂模板的子步骤（AWM 雪球效应）。

### 纪律

- 只归纳 VERIFY pass 的 run；失败轨迹走 `trap`，不进工作流模板
- 子任务粒度优先于整条流水线（泛化性更好，AWM 论文核心结论）
- 同模板再次命中时走 Curator merge 路径（`helpful` +1，见 `skills/knowledge-management/SKILL.md` 复用计数节），不重复 append

---

### Route Hint / Pattern Card 回灌

LEARN 除产出 `LearnCard` 外，还应把可复用的选择信号回灌给下次 `SCAN` / `route`：

- `.auto/feedback/agents.json`：记录 Agent 路由反馈
- `.auto/feedback/skills.json`：记录 Skill 注入反馈
- `.auto/cache/pattern-cards.json`：记录可复用模式卡

写回原则：

1. 只有本次 run 中真实读取或验证过的内容才允许回写。
2. 未通过 `VerifyReport` 的路径可以作为反例记录，但必须在 `LearnCard.category=feedback` 或 `trap` 中显式标识失败上下文。
3. route hints 只能帮助下次选择，不得覆盖本次仓库扫描事实。

### 知识蒸馏规范（2026 Context Engineering 增强）

每张 LearnCard 必须进行蒸馏处理，确保沉淀的知识是原子化、可检索、跨会话可用的：

1. **压缩**：核心描述 ≤ 5 行，去除冗余上下文
2. **标注 scope**（必填）：
   - `scope: project` — 仅当前项目适用
   - `scope: stack` — 同技术栈项目通用
   - `scope: universal` — 跨项目跨栈通用
3. **去重合并**：与 `.auto/insights/` 已有条目对比，同主题则更新而非追加
4. **跨项目复用**：`scope: stack|universal` 的条目同步写入 `.auto/feedback/skills.json` 的 `portablePatterns` 数组

### Portable Patterns 导入机制（冷启动加速）

新项目首次 run 时，可从用户其他项目导入通用知识：

```bash
# 检测当前项目是否为冷启动（无 .auto/ 或 .auto/feedback/skills.json 不存在）
# 若是冷启动，检查用户全局配置中是否有已沉淀的 portablePatterns
# 筛选 scope=universal 或与当前技术栈匹配的 scope=stack 条目
# 注入到当前项目的 .auto/feedback/skills.json
```

导入规则：

- 只导入 `confidence: high` 的条目
- `scope: stack` 只导入与当前项目技术栈匹配的条目
- `scope: universal` 无条件导入
- 导入后标记 `source: imported-from-<sourceProject>`
- 首次使用后如验证有效，自动将 `confidence` 升级为 `high`；无效则标记为 `low` 并不再注入

### 知识库 Decay 规则（防膨胀）

长期项目 `.auto/insights/` 会单调增长，无衰减机制会导致：检索噪音上升、Skill 激活时被无关历史污染、knowledge-reuse gate 误命中。`/auto:learn` 在 LEARN 阶段顺带跑 decay 扫描，按以下三条规则标记或合并条目：

| 规则               | 触发条件                                                                              | 处置                                                      |
| ------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **age-prune**      | `confidence: low` 且最后命中时间 > 6 个月（无 LearnCard 引用、无 insight-index 命中） | 在条目末尾追加 `**状态**: archived` 标记；不删除          |
| **dedup-merge**    | 同 insight 文件内连续 3 条同主题（标题前 10 字符相似度 > 0.7）                        | 合并为一条，保留最新置信度，旧条目追加 `**状态**: merged` |
| **scope-outdated** | `scope: project` 且条目引用的文件 / 路径已不存在（grep 验证不到）                     | 追加 `**状态**: outdated`；不删除，作为历史决策保留       |

执行流程：

```bash
# 1. 扫描所有 insight 文件，按 section（### <标题>）拆解
# 2. 对每个 section 执行三条规则匹配
# 3. 标记结果以末尾追加方式写入，不修改原内容
# 4. 同时更新 .auto/cache/insight-index.json，archived/merged/outdated 条目 confidence 降级
```

**反模式**：

- 直接 `rm` 删除条目 → 丢失历史决策追溯
- 用时间戳硬阈值（如"超过 X 天必删"）→ 误删长期有效的 universal pattern
- 不区分 `scope` 一刀切 decay → universal/stack 条目可能错杀

**注入规则**（影响 PHASE 2.1 知识检索）：

- 含 `**状态**: archived / merged / outdated` 的条目，confidence 自动按 (-1) 降级
- 仅在 SCAN 检索词强命中（tags 全 match）时才注入，不参与默认推荐

**跳过条件**：`/auto:learn` 不带 `--decay` 参数时默认轻量模式（只追加新知识），用户显式触发 `/auto:learn --decay` 才扫描全量。

---

### insight-index 维护（必做）

LEARN 完成 `LearnCard` 落盘后，**强制**重建或增量更新 `.auto/cache/insight-index.json`（schema 见 `agents/_shared-principles.md` 「insight-index 派生对象」节）。

最小流程：

```bash
# 1. 收集所有 insight 文件中的标签和 section
# 2. 反向构建 by_tag 与 by_keyword 索引
# 3. 写入 .auto/cache/insight-index.json
```

**关键字段提取规则**：

- `by_tag`：从每条 insight section 内的 `**标签**：a, b, c` 行解析
- `by_keyword`：标签 + section 标题中的中英文小写词（去停用词）
- `confidence`：从 LearnCard.confidence 继承；无对应 LearnCard 默认 `medium`

**幂等性**：每次重建覆盖写入；不做差量合并以避免漂移。

**与 SCAN/PLAN 的契约**：

- 索引文件不存在或为空时，PHASE 2.1 降级为 grep 匹配（不阻断）
- 索引存在则必须先按索引反查，再决定是否补 grep
- VERIFY 阶段 `knowledge-reuse` gate 以本索引为基准计算「应注入数量」

### Session Continuity

当 run 需要跨阶段或跨会话继续时，当前 phase 必须立即产出 `session-continuity.md`；`/auto:learn` 在 LEARN 阶段负责补全或更新该工件，而不是独占创建时机。

推荐结构：

````markdown
## Session Continuity

```json
{
  "runId": "run-<id>",
  "status": "planned | in_progress | blocked | completed",
  "currentPhase": "SCAN | PLAN | EXECUTE | VERIFY | SUMMARIZE | LEARN",
  "lastCompletedPhase": "SCAN | PLAN | EXECUTE | VERIFY | SUMMARIZE | LEARN | none",
  "nextPhase": "SCAN | PLAN | EXECUTE | VERIFY | SUMMARIZE | LEARN | none",
  "requiredArtifacts": ["route-<id>", "quest-map-<id>", "verify-<id>"],
  "blockingIssues": [],
  "resumePrompt": "继续 run-<id>，先读取 .auto/runs/<runId>/ 下的相关工件，再从 <nextPhase> 开始"
}
```
````

推荐落盘位置：

- `.auto/runs/<runId>/learn-cards.md`
- `.auto/runs/<runId>/session-continuity.md`
- `.auto/feedback/agents.json`
- `.auto/feedback/skills.json`
- `.auto/cache/pattern-cards.json`

---

## 与 `/auto` 主流程关系

- `SCAN` / `PLAN` 不直接写 insights
- `LEARN` 先汇总 `QuestResult` + `VerifyReport`
- `/auto:learn` 可作为显式补充入口，继续生成 `LearnCard`
- 主流程 LEARN 默认消费 `VerifyReport`；独立 `/auto:learn --git` 可在无 `VerifyReport` 时基于 Git 证据单独生成 `LearnCard`
- 最终统一写入 `.auto/runs/<runId>/learn-cards.md`，并按分类分发到 insights / feedback

---

## 参数说明

| 参数                 | 说明                                  |
| -------------------- | ------------------------------------- |
| `--git`              | 启用 Git 历史分析                     |
| `--commit-count <n>` | 指定分析的提交数量                    |
| `--decay`            | 触发知识库全量 decay 扫描             |
| `--workflows`        | 从历史 run 归纳工作流模板（AWM 模式） |
| `--json`             | 输出 JSON 结构                        |
| `-d, --dir <path>`   | 指定分析目录                          |

---

## 相关命令

- `/auto`：完整工作流入口
- `/auto:status`：查看 `.auto/` canonical 结构状态
- `/auto:route`：查看路由决策对象

---

## 说明

`/auto:learn` 的核心职责是统一知识入口，而不是单独维护另一套知识协议。
如果未来扩展新的知识来源，也应先映射到 `LearnCard`，再进入 insights / feedback。
