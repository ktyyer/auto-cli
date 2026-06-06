---
name: production-governance
description: 生产治理闭环 — 目标收敛、产物真源、run 状态、成本质量和 skill 健康度检查。实现/重构/生产级任务在 PLAN、VERIFY、LEARN 阶段必须加载，用于防止目标漂移、口头通过和高成本低质量循环。
tags:
  - production
  - governance
  - verify
  - quality
  - goal
  - artifact
  - cost
  - skill-health
---

# Production Governance — 生产治理闭环

> 本 Skill 治理 `/auto` 的运行质量，不提供后台 runtime、daemon、远程执行、Web UI 或部署能力。

## 快速使用

```text
/auto 开发一个可直接上生产的功能
/auto 检查这次 run 是否真的完成闭环
/auto 优化 skill 健康度和 gate 证据质量
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] Goal Convergence：QuestMap 明确 goal / outOfScope / evidence / exitCriteria，VERIFY 记录 `goalDrift=none|minor|major`
- [ ] Artifact Truth：阶段结论必须引用 `.auto/runs/<runId>/` 中已落盘工件，不能只用口头声明
- [ ] Run State：最近 run 有明确状态 `running|partial|blocked|verified|learned|aborted`
- [ ] Cost-Quality：记录重试、返工、gate 失败和高成本低质量信号
- [ ] Skill Health：被激活 skill 必须有应用证据；缺证据写入 `.auto/feedback/skills.json`

**硬约束** (constraints):

- `goalDrift=major` → 回流 PLAN，不允许进入 SUMMARIZE
- 缺少关键真源工件 → `artifactTruth=fail`，回流对应 Phase 补写
- 生产级实现/重构任务缺少 `production-governance` 证据 → VERIFY fail
- 治理只读 `.auto/cache/`，不得把 cache 当长期真源

**输出模板** (output):

```json
{
  "gate": "production-governance",
  "status": "pass | warning | fail",
  "goalDrift": "none | minor | major",
  "artifactTruth": "pass | warning | fail",
  "runState": "running | partial | blocked | verified | learned | aborted",
  "costQuality": "pass | warning | fail",
  "skillHealth": "pass | warning | fail",
  "evidence": [".auto/runs/<runId>/quest-map.md", ".auto/runs/<runId>/verify-report.md"]
}
```

**反模式** (anti-patterns):

- 新增 `/goal`、`/workflow` 等并列入口，破坏 `/auto` 单入口
- 引入 JS/Node workflow runtime 或后台 supervisor 来实现 Markdown 指令能完成的治理
- gate 通过但没有文件证据
- 把成本统计当成压缩验证范围的理由

---

## 使用时机

**必须加载**：

- 用户要求“生产级”“可直接上线”“稳定/安全/健壮”
- 策略 = `implement` 或 `refactor`
- VERIFY 调度 `production-governance` gate
- `/auto:status` 汇总最近 run 的治理状态
- `.auto/feedback/skills.json` 出现 evidence 缺失或治理失败信号

**按需加载**：

- 策略 = `fix` 且用户明确要求生产稳定性
- 策略 = `explore` 且分析目标是运行闭环、gate 质量或产物完整性

**不使用**：

- 纯安装、卸载、版本发布命令
- 无 `.auto/` 的一次性问答，除非用户明确要求治理审查

---

## 五项治理检查

### 1. Goal Convergence

输入：`RouteDecision.userIntent`、`QuestMap.goal`、`QuestMap.outOfScope`、`QuestResult.outputs`、`VerifyReport.gates`。

步骤：

1. 对照用户原话和 QuestMap goal，确认每个 Quest 都服务于目标
2. 检查 outOfScope 是否被遵守
3. 将最终 diff / 分析结论反向翻译成需求描述
4. 记录 `goalDrift`：
   - `none`：完全贴合目标
   - `minor`：存在表述偏移但不影响交付
   - `major`：做了用户没要求的事，或漏掉核心目标

处置：`major` 回流 PLAN；`minor` 可 warning 放行但必须写明原因。

### 2. Artifact Truth

输入：`.auto/runs/<runId>/` 下的标准对象文件。

必检工件：

- `route-decision.md`
- `quest-map.md`
- `quest-results.md`
- `verify-report.md`
- `learn-cards.md`（LEARN 后）
- `index.md`（SUMMARIZE 后）

规则：

1. Phase 交接摘要必须指向真实存在的工件路径
2. VERIFY 结论必须能追溯到 `quest-results.md` 和命令输出
3. LEARN 结论必须能追溯到 `learn-cards.md` 与 `.auto/insights/`
4. `.auto/cache/` 只作派生缓存，不作为通过依据

### 3. Run State

最近 run 必须处于以下状态之一：

| 状态       | 含义                             | 必需证据                         |
| ---------- | -------------------------------- | -------------------------------- |
| `running`  | 当前 run 仍在执行                | 最新 phase 工件存在              |
| `partial`  | 合法部分完成，等待续接           | `session-continuity.md` 或阻塞项 |
| `blocked`  | 被缺失依赖、权限或失败 gate 阻断 | `verify-report.md` 中有原因      |
| `verified` | VERIFY 已通过，等待总结或学习    | `verify-report.md`               |
| `learned`  | SUMMARIZE + LEARN 已完成         | `index.md` + `learn-cards.md`    |
| `aborted`  | 用户中断或预算耗尽，不能自动放行 | 中断原因                         |

未知状态不得显示为成功。

### 4. Cost-Quality Loop

记录以下信号：

- tool 调用过多但 gate 未通过
- 同一 gate 连续失败
- 同一路径重复返工
- 被激活 skill 无应用证据
- 验证跳过或只口头断言

处置：

- 首次出现 → warning，写入 VerifyReport
- 同项目同类问题连续出现 → fail，写 LearnCard(category=trap)
- 与 skill 相关 → 更新 `.auto/feedback/skills.json`

### 5. Skill Health

复用 `skill-evaluator` 的 D1-D8，但增加运行时证据维度：

| 信号                     | 含义                        | 写入位置                     |
| ------------------------ | --------------------------- | ---------------------------- |
| `evidence_missing_count` | skill 被激活但无应用证据    | `.auto/feedback/skills.json` |
| `governance_fail_count`  | 该 skill 相关治理 gate 失败 | `.auto/feedback/skills.json` |

处置：

- `evidence_missing_count` 增长 → 下次 SCAN 降低该 skill 优先级
- `governance_fail_count` 连续增长 → 触发 `skill-evaluator` 健康度检查

---

## 与 auto-cli 集成

| Phase     | 集成方式                                                                 |
| --------- | ------------------------------------------------------------------------ |
| SCAN      | 命中生产级关键词或历史治理失败时激活本 Skill                             |
| PLAN      | 将 goal / evidence / exitCriteria 写入 QuestMap acceptance               |
| EXECUTE   | 在 QuestResult.validations 记录本 Skill 的应用证据                       |
| VERIFY    | 执行 `production-governance` gate，输出 goalDrift / artifactTruth 等字段 |
| SUMMARIZE | 汇总治理状态，不把 partial / blocked 描述成 success                      |
| LEARN     | 将治理失败写为 LearnCard(category=trap)，将可复用治理模式写为 pattern    |
| STATUS    | `/auto:status` 读取最近 run，展示 runState / artifactTruth / skillHealth |

---

## 验收标准

- [ ] 生产级实现/重构任务的 QuestMap 包含 goal / outOfScope / evidence / exitCriteria
- [ ] VerifyReport 包含 `production-governance` gate 结果
- [ ] `goalDrift=major` 时不会进入 SUMMARIZE
- [ ] 最近 run 缺关键工件时 `/auto:status` 不显示 success
- [ ] 被激活但无证据的 skill 会增加 `evidence_missing_count`
- [ ] 未引入任何新 runtime、daemon、Web UI 或并列 slash command
