---
name: learn
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

### Route Hint / Pattern Card 回灌

LEARN 除产出 `LearnCard` 外，还应把可复用的选择信号回灌给下次 `SCAN` / `route`：

- `.auto/feedback/agents.json`：记录 Agent 路由反馈
- `.auto/feedback/skills.json`：记录 Skill 注入反馈
- `.auto/cache/pattern-cards.json`：记录可复用模式卡

写回原则：

1. 只有本次 run 中真实读取或验证过的内容才允许回写。
2. 未通过 `VerifyReport` 的路径可以作为反例记录，但必须在 `LearnCard.category=feedback` 或 `trap` 中显式标识失败上下文。
3. route hints 只能帮助下次选择，不得覆盖本次仓库扫描事实。

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

| 参数                 | 说明               |
| -------------------- | ------------------ |
| `--git`              | 启用 Git 历史分析  |
| `--commit-count <n>` | 指定分析的提交数量 |
| `--json`             | 输出 JSON 结构     |
| `-d, --dir <path>`   | 指定分析目录       |

---

## 相关命令

- `/auto`：完整工作流入口
- `/auto:status`：查看 `.auto/` canonical 结构状态
- `/auto:route`：查看路由决策对象

---

## 说明

`/auto:learn` 的核心职责是统一知识入口，而不是单独维护另一套知识协议。
如果未来扩展新的知识来源，也应先映射到 `LearnCard`，再进入 insights / feedback。
