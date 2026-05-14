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
/auto:learn --json
```

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
