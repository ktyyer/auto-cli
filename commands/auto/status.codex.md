---
name: auto:status
description: Codex 版状态查看 - 汇总项目能力、.auto 运行记录、反馈和知识沉淀状态
---

# /auto:status — Codex 状态面板

> 目标：让 Codex 用户看清楚当前项目到底有哪些能力、最近跑到了哪一步、知识有没有真的沉淀下来。

---

## 使用方式

```bash
/auto:status
/auto:status --json
```

---

## 读取范围

### 1. 项目概览

读取：

- `package.json` / `pom.xml` / `go.mod`
- `git status --short`
- `git rev-parse --short HEAD`
- `git branch --show-current`

### 2. 能力清单

统计：

- `.auto/cache/capability-snapshot.json`
- `commands/*.md` 与 `commands/**/*.md`
- `skills/*/SKILL.md`
- `~/.codex/prompts/auto.md`
- `~/.codex/prompts/auto/`
- `~/.codex/skills/*/SKILL.md`

如果本地 Codex 未安装，也要明确指出。

### 3. `.auto/` canonical 状态

检查以下层级：

- `cache/`
- `runs/`
- `insights/`
- `memory/`
- `feedback/`

### 4. 最近运行状态

优先查看最近一个 run 目录，关注：

- `route-decision.md`
- `quest-map.md`
- `quest-results.md`
- `verify-report.md`
- `learn-cards.md`
- `index.md`
- `session-continuity.md`

判断最近 run 是：

- `success`
- `partial`
- `aborted`
- `unknown`

判定时至少检查：

- 是否存在 `route-decision.md`
- 是否存在 `quest-map.md`
- 是否存在 `verify-report.md`
- 是否存在 `learn-cards.md`
- 是否存在 `index.md`

如果缺少以上任一基础工件，默认不能判为 `success`，至少应为 `partial`。

---

## 输出重点

输出至少包含：

1. 当前项目和 Git 状态
2. Codex 侧 `/auto` 是否安装
3. 可用 skills 数量
4. `.auto` 五层结构健康度
5. capability snapshot 是否存在且与当前仓库大致一致
6. 最近 run 的完成度
7. 是否已经有 insights / feedback 沉淀
8. 下一步建议

---

## JSON 模式

`--json` 时，建议输出：

```json
{
  "project": {
    "name": "...",
    "branch": "...",
    "commit": "..."
  },
  "codex": {
    "autoPromptInstalled": true,
    "subcommandsInstalled": true,
    "skillsInstalled": 0
  },
  "workspace": {
    "capabilitySnapshot": "ok | stale | missing",
    "commands": 0,
    "skills": 0
  },
  "auto": {
    "cache": "ok",
    "runs": {
      "count": 0,
      "latestRunId": null,
      "latestState": "unknown"
    },
    "insights": "partial",
    "feedback": "partial",
    "memory": "ok"
  },
  "recommendations": []
}
```

---

## 成功标准

- 用户能一眼看出 Codex `/auto` 是不是装好了
- 用户能知道 Codex 是否先拿到了项目能力快照，而不是裸奔路由
- 用户能知道 `.auto` 是否真的在产出 route / quest / verify / learn 工件
- 建议是围绕“下一次如何跑得更完整”给出的，而不是泛泛状态汇报
