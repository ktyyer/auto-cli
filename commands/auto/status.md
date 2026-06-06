---
name: auto:status
description: 查看项目状态、能力安装情况与 .auto 协议落盘状态
---

# /auto:status -- 状态查看

> 查看项目当前状态、已安装能力，以及 `.auto/` 的 cache / runs / insights / memory / feedback 五层结构状态。
> 状态以 `.auto/` canonical 结构为真源；legacy 路径仅用于兼容性提示；生产治理状态由最近 run 工件推导，不引入后台运行时。

---

## 使用方式

```bash
/auto:status
/auto:status --json
```

---

## 执行步骤

### 1. 项目概览

读取以下信息：

```text
Read package.json / pom.xml / go.mod → 提取 name, version
Glob commands/*.md + commands/**/*.md → 统计命令数量
Glob agents/*.md → 统计 Agent 数量
Glob skills/*/SKILL.md → 统计 Skill 数量
Bash: git status --short | wc -l → 未提交变更数
Bash: git rev-parse --short HEAD → 当前 commit
Bash: git branch --show-current → 当前分支
```

### 2. `.auto/` canonical 结构扫描

按五层 canonical 结构读取：

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

检查项：

- `cache/`：能力快照和模式卡是否存在
- `runs/`：最近 run 数量、最近 runId、终态是完整成功 run、合法 partial/aborted run，还是异常中断 run
- `runs/`：最近 run 是否存在 `session-continuity.md`（仅在需要续接时要求）
- `runs/`：治理状态是否明确（runState / artifactTruth / goalDrift / costQuality / skillHealth）
- `insights/`：知识文件是否存在、各文件是否非空
- `feedback/`：`agents.json` / `skills.json` 是否存在
- `memory/`：`store.json` 是否存在（项目级辅助记忆）
- legacy 反馈文件是否仍存在，以及是否与 canonical 真源冲突

### 3. 能力与健康度检查

```text
Bash: test -f CLAUDE.md && echo "EXISTS" || echo "MISSING"
Bash: test -f REPO_MAP.md && echo "EXISTS" || echo "MISSING"
Bash: test -d .auto && echo "EXISTS" || echo "MISSING"
Bash: test -d node_modules && echo "INSTALLED" || echo "NOT_INSTALLED"
```

补充检查：

- Agent / Skill / Rule 文件是否存在且非空
- `.auto/runs/` 是否已采用标准对象命名
- 是否仍存在 legacy 反馈或运行记录路径
- `.auto/feedback/*` 与 legacy 反馈是否存在真源冲突

### 4. 输出格式

```markdown
## 项目状态

**项目**: {name} v{version} | **分支**: {branch} @ {commit}
**未提交变更**: {count}

### 已安装能力

| 类型     | 数量 | 详情            |
| -------- | ---- | --------------- |
| Agents   | {n}  | {agent names}   |
| Commands | {n}  | {command names} |
| Skills   | {n}  | {skill names}   |

### .auto 状态

| 层级     | 状态                             | 详情                                                                                       |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| cache    | OK / MISSING / PARTIAL           | capability-snapshot, pattern-cards                                                         |
| runs     | OK / MISSING / PARTIAL / ABORTED | runs={n}, latest={runId}, latestState={state}, continuity={y/n}, nextPhase={phase or none} |
| insights | OK / PARTIAL                     | traps/patterns/decisions/prompts/agent-feedback                                            |
| feedback | OK / PARTIAL                     | agents.json / skills.json / legacyFeedbackFiles                                            |
| memory   | OK / PARTIAL                     | store.json                                                                                 |

### 健康度

| 检查项       | 状态                |
| ------------ | ------------------- |
| CLAUDE.md    | EXISTS / MISSING    |
| REPO_MAP.md  | EXISTS / MISSING    |
| .auto        | EXISTS / MISSING    |
| node_modules | INSTALLED / MISSING |
| Git 状态     | CLEAN / DIRTY       |
| 真源冲突     | NONE / PRESENT      |

### 生产治理

| 检查项        | 状态                                                                 |
| ------------- | -------------------------------------------------------------------- |
| runState      | running / partial / blocked / verified / learned / aborted / unknown |
| artifactTruth | pass / warning / fail                                                |
| goalDrift     | none / minor / major / unknown                                       |
| costQuality   | pass / warning / fail / unknown                                      |
| skillHealth   | pass / warning / fail / unknown                                      |

### 建议

- [ ] 缺失 `.auto/runs/` → 说明尚未产生标准 run 记录
- [ ] latest run = `ABORTED` / `PARTIAL` → 说明最近一次 run 合法终止但未完成全链路
- [ ] latest run 缺少 `session-continuity.md` 且仍需续接 → 说明跨会话续接信息尚未结构化
- [ ] insights 缺失 → 说明 LEARN 产物尚未沉淀
- [ ] feedback 缺失 → 说明 agent / skill 路由反馈尚未结构化
- [ ] legacy 路径仍存在 → 建议迁移到 canonical 结构
- [ ] true source conflict = PRESENT → 建议以 `.auto/feedback/*` 为真源并清理 legacy 歧义
```

### 5. JSON 输出模式

当使用 `--json` 参数时，输出结构化 JSON：

```json
{
  "project": { "name": "...", "version": "...", "branch": "...", "commit": "..." },
  "capabilities": { "agents": 0, "commands": 0, "skills": 0 },
  "auto": {
    "cache": {
      "status": "OK",
      "files": ["capability-snapshot.json", "pattern-cards.json"]
    },
    "runs": {
      "status": "OK",
      "count": 0,
      "latestRunId": null,
      "latestState": "success | partial | aborted | unknown",
      "hasSessionContinuity": false,
      "nextPhase": "PLAN | EXECUTE | VERIFY | SUMMARIZE | LEARN | none",
      "requiredArtifacts": ["route-<id>", "quest-map-<id>"]
    },
    "insights": { "status": "PARTIAL", "files": [] },
    "feedback": {
      "status": "PARTIAL",
      "files": ["agents.json", "skills.json"],
      "legacyFeedbackFiles": ["<legacy-feedback-file>"]
    },
    "memory": { "status": "OK", "files": ["store.json"] }
  },
  "governance": {
    "runState": "running | partial | blocked | verified | learned | aborted | unknown",
    "artifactTruth": "pass | warning | fail | unknown",
    "goalDrift": "none | minor | major | unknown",
    "costQuality": "pass | warning | fail | unknown",
    "skillHealth": "pass | warning | fail | unknown"
  },
  "health": {
    "claudeMd": true,
    "repoMap": true,
    "autoDir": true,
    "nodeModules": false,
    "gitDirty": true,
    "truthSourceConflict": false
  },
  "issues": [],
  "timestamp": 0
}
```

---

## 建议操作

根据扫描结果生成建议：

- 缺少 `.auto/cache/` → 建议先运行 `/auto` 触发能力快照与模式卡缓存
- 缺少 `.auto/runs/` → 说明尚未产出标准 `RouteDecision / QuestMap / QuestResult / VerifyReport / LearnCard`
- 最近 run 为 `partial` / `aborted` → 说明该 run 合法终止，但未完成全链路落盘
- 最近 run 治理状态为 `unknown` / `fail` → 建议重新运行 `/auto` 完成 VERIFY/LEARN，不手工伪造状态
- 最近 run 缺少 `session-continuity.md` 且仍需续接 → 说明跨会话续接信息尚未结构化
- 缺少 `.auto/insights/` → 建议检查 LEARN 阶段是否已执行
- 缺少 `.auto/feedback/` → 建议将 agent / skill 反馈收敛到 canonical 结构
- 发现 legacy 路径 → 建议保留读取兼容，但后续写入统一改走 canonical 结构
- `.auto/feedback/*` 与 legacy 反馈并存且数据冲突 → 建议以 `.auto/feedback/*` 为真源，并在状态面板中标记 `truthSourceConflict`
