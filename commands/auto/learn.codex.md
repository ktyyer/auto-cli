---
name: auto:learn
description: Codex 版知识沉淀入口 - 将运行经验、路由反馈和 Git 模式整理成 LearnCard 并回写 .auto
---

# /auto:learn — Codex 知识沉淀

> 目标：让 Codex 的 `/auto` 不是一次性会话，而是能把经验沉淀回项目。

---

## 使用方式

```bash
/auto:learn
/auto:learn --git
/auto:learn --workflows
/auto:learn --decay
/auto:learn --json
```

| 参数               | 说明                                                 |
| ------------------ | ---------------------------------------------------- |
| `--git`            | 额外分析 Git 历史模式                                |
| `--commit-count n` | `--git` 时分析最近 n 条提交（默认 30）               |
| `--workflows`      | 跨 run 归纳可复用 Quest 序列模板（AWM 模式，见下文） |
| `--decay`          | 触发知识库防膨胀规则（见下文）                       |
| `--json`           | 输出结构化摘要                                       |
| `-d, --dir <path>` | 指定项目目录（默认当前目录）                         |

---

## 这条命令应该做什么

统一处理三类知识来源：

1. 最近一次或指定 run 的执行结果
2. `.auto/feedback/*` 中的路由与 skill 反馈
3. Git 历史里可复用的模式

输出时先归一成 `LearnCard`，再分发到：

- `.auto/insights/*`
- `.auto/feedback/*`
- `.auto/cache/insight-index.json`

---

## Codex 版执行原则

- 不依赖 Claude 自定义 Agent
- 可以直接从现有 run 工件中提炼经验
- 没有完整 run 时，也允许只基于 Git 或当前上下文生成有限 LearnCard
- 不能伪造“已验证”的经验；失败经验要明确标成 `trap` 或 `feedback`

---

## 推荐读取顺序

1. 最近一个 `.auto/runs/<runId>/`
2. 其中的 `route-decision.md`、`quest-map.md`、`quest-results.md`、`verify-report.md`、`learn-cards.md`
3. `.auto/feedback/agents.json`、`.auto/feedback/skills.json`
4. `.auto/insights/traps.md`、`patterns.md`、`decisions.md`、`prompts.md`、`agent-feedback.md`
5. `git log`（使用 `--git` 时）
6. `.auto/cache/capability-snapshot.json`（若本次任务涉及命令 / skills / runtime 结构变更）

---

## LearnCard 分类

只使用这 5 类：

- `trap`
- `pattern`
- `decision`
- `prompt`
- `feedback`

每张卡至少要有：

- `category`
- `scope`（`project | stack | universal`，必填；`stack|universal` 额外写入 `skills.json` 的 `portablePatterns`）
- `title`
- `summary`
- `context`
- `recommendedAction`
- `confidence`
- `targetInsightFile`

---

## 回写规则

### insights

- `trap` → `.auto/insights/traps.md`
- `pattern` → `.auto/insights/patterns.md`
- `decision` → `.auto/insights/decisions.md`
- `prompt` → `.auto/insights/prompts.md`
- `feedback` → `.auto/insights/agent-feedback.md`

### feedback

按需更新：

- `.auto/feedback/agents.json`
- `.auto/feedback/skills.json`

### cache

完成后重建或更新：

- `.auto/cache/insight-index.json`
- `.auto/cache/pattern-cards.json`
- `.auto/cache/capability-snapshot.json`（当命令 / skills / runtime 支持矩阵发生变化时）

---

## 知识库 Decay 规则（防膨胀，与 Claude 端对齐）

长期项目 `.auto/insights/` 单调增长会导致检索噪音上升与 Skill 激活污染。`/auto:learn --decay` 触发时按以下三条规则处理：

| 规则             | 触发条件                                                                  | 处置                                                      |
| ---------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| `age-prune`      | `confidence: low` + 最后命中 > 6 个月（无 LearnCard 引用、无 index 命中） | 末尾追加 `**状态**: archived`；不删除                     |
| `dedup-merge`    | 同 insight 文件连续 3 条同主题（标题前 10 字符相似度 > 0.7）              | 合并为一条，保留最新置信度，旧条目追加 `**状态**: merged` |
| `scope-outdated` | `scope: project` 且引用的文件 / 路径已 grep 不到                          | 追加 `**状态**: outdated`；保留历史决策                   |

规则纪律：

- 标记类操作（archived / merged / outdated）以末尾追加方式写，不修改原内容
- 同时更新 `.auto/cache/insight-index.json`，对应条目 confidence 降级
- 默认 `/auto:learn` 不扫描全量；只有显式 `--decay` 才触发
- 反模式：直接 `rm` 删除条目 / 用硬时间阈值一刀切 / 不区分 `scope` 一律 decay

---

## 工作流归纳（`--workflows`，与 Claude 端对齐）

`.auto/runs/`（未归档）存在 ≥ 3 个同策略且 VERIFY pass 的 run 时，`/auto:learn --workflows` 可归纳可复用工作流模板（AWM 模式）：

1. 跨 run 比较 `quest-map.md` / `quest-results.md` 的 Quest 序列
2. 找出出现 ≥ 2 次的重复子序列（2-4 关的子任务粒度，不取整条流水线）
3. 文件名参数化为 `<占位符>`，保留 agent / skill / 验证组合
4. 产出 `LearnCard(category=pattern, tags 含 workflow)` 写入 `.auto/insights/patterns.md`

纪律：只归纳 VERIFY pass 的 run；失败轨迹走 `trap`；同模板再次命中走 Curator merge 路径（`helpful` +1、刷新 `lastConfirmed`），不重复 append。

---

## Portable Patterns 冷启动导入（与 Claude 端对齐）

新项目首次运行且 `.auto/insights/` 为空时，可从同技术栈旧项目的 `.auto/feedback/skills.json` 读取 `portablePatterns`：

1. 只导入 `confidence: high` 且 `scope: stack`（技术栈匹配）或 `scope: universal` 的条目
2. 导入条目写入本项目 `.auto/insights/patterns.md`，末尾标注 `**来源**: imported-from <旧项目>`
3. 导入后按本项目实际复用效果维护 helpful/harmful 计数，误导性条目正常衰减

---

## Session Continuity（跨会话续接）

run 未完成或需跨会话续接时，`/auto:learn` 负责补全或更新 `.auto/runs/<runId>/session-continuity.md`，至少包含：

- `runId` / `status`（interrupted | suspended | completed）
- `currentPhase` / `nextPhase`
- `requiredArtifacts`（续接前必须存在的工件清单）
- `blockingIssues` / `knownDefects` / `unverifiedPaths`
- `resumePrompt`（下次会话可直接粘贴的续接指令）

下次 `/auto` SCAN 检测到 `status=interrupted` 时从中断点继续。

---

## 典型提炼方向

### 从 run 提炼

- 哪个 skill 命中后确实提升了结果
- 哪个验证 gate 缺失导致返工
- 哪个任务拆解方式更稳定

### 从反馈提炼

- 哪些 skill 经常被忽略
- 哪些 skill 经常被用户纠正
- 哪类任务更适合 direct，哪类更适合 phased

### 从 Git 提炼

- 热点文件
- 高频联动文件
- 常见提交模式

---

## 输出要求

默认输出：

- 本次提炼出的 LearnCard 数量
- 每类卡片的数量
- 写入了哪些目标文件
- 哪些内容因证据不足被跳过

`--json` 时输出结构化摘要即可，不必展开全文。

---

## 成功标准

- `.auto` 中的知识文件会随运行逐步变强
- Codex 下的 skill / route / verify 经验可被下一次 `/auto` 复用
- 沉淀结果来自真实运行证据，而不是模板化空话
