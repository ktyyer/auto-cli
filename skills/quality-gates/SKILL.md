---
name: quality-gates
description: VERIFY 门禁定义 — 16 个 gate 的详细触发条件、验证逻辑、输出格式和处置规则。VERIFY Phase 执行门禁时按需加载对应 gate 定义，不预加载全量。
tags:
  - verify
  - gate
  - quality
  - validation
  - testing
---

# Quality Gates — VERIFY 门禁定义

> auto.md 只保留各策略的必需 gate 清单表，本文件提供每个 gate 的完整定义。

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 按当前策略查"各策略必需 gate"表，确定本次必检 gate 集合
- [ ] 按需加载对应 gate 的详细定义（不预加载全量 16 个）
- [ ] 每个 gate 输出 `status` + `evidence`（实际命令 + 输出，不接受"看起来没问题"）
- [ ] 任一 gate fail 必须同时给出 `recommendedNext`
- [ ] gate 状态与 verify-report.md 同步收口（命令已 PASS 的 gate 不得仍标 pending）

**硬约束** (constraints):

- 实测优先于断言：任何验证声明必须附实际命令 + 输出
- 探索策略走快速通道时跳过全部 gate；仅结构化分析路径执行探索 gate 集
- `knowledge-distribution` 为全策略必检：LearnCard 未分发到 `.auto/insights/` 即 fail

**反模式** (anti-patterns):

- 用主观判断代替命令实测 → Run-Don't-Claim 违规
- fail 只写结论不写下一步 → 下游无法回流修复
- 一次性加载全部 16 个 gate 定义 → 上下文浪费

## Gate Taxonomy

`analysis` | `build` | `test` | `lint` | `coverage` | `security` | `adversarial` | `self-verification` | `world-class-standards` | `production-readiness` | `self-critique` | `production-governance` | `protocol-validator` | `skill-activation` | `knowledge-reuse` | `knowledge-distribution` | `clean-state` | `cost`

## 各策略必需 gate

> 探索策略走快速通道时跳过全部 gate；仅结构化分析路径执行以下 gate。

| 策略 | 必需 gate                                                                                                                                                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 探索 | `analysis` + `skill-activation`(evidence: read-only) + `knowledge-reuse`(evidence: analysis-only) + `knowledge-distribution` + `clean-state`                                                                                                                                                               |
| 修复 | `build` + `test` + `self-verification` + `world-class-standards` + `production-readiness` + `protocol-validator` + `skill-activation` + `knowledge-reuse`(evidence: relevant) + `knowledge-distribution` + `clean-state`                                                                                   |
| 实现 | `build` + `test` + `lint` + `coverage` + `adversarial` + `self-verification` + `world-class-standards` + `production-readiness` + `self-critique` + `production-governance` + `protocol-validator` + `skill-activation` + `knowledge-reuse` + `knowledge-distribution` + `clean-state`                     |
| 重构 | `build` + `test` + `coverage` + `security` + `adversarial` + `self-verification` + `world-class-standards` + `production-readiness` + `self-critique` + `production-governance` + `protocol-validator` + `skill-activation` + `knowledge-reuse`(evidence: full) + `knowledge-distribution` + `clean-state` |

---

## `self-verification` gate

**触发**：策略 = 修复/实现/重构，每个 QuestResult 产出后自动触发。

**验证维度**：语法正确性 | 逻辑一致性 | 边界值覆盖 | 错误处理 | 性能影响

**输出格式**：

```json
{
  "gate": "self-verification",
  "status": "pass | warning | fail",
  "issues": [
    {
      "severity": "critical | high | medium | low",
      "category": "syntax | logic | boundary | error-handling | performance",
      "description": "具体问题描述",
      "autoFixed": true | false,
      "location": "file:line"
    }
  ],
  "summary": "自我验证摘要"
}
```

**处置**：pass → 继续 | warning → 记录放行 | fail → 回流 EXECUTE

---

## `world-class-standards` gate

**触发**：策略 = 实现/重构，每个 QuestResult 产出后自动触发（与 self-verification 并行）。

**验证维度**：圈复杂度 | 认知复杂度 | 函数长度 | 文件长度 | 嵌套层数 | 重复代码率 | 测试覆盖率 | 问题严重级别

**量化阈值**：

- 圈复杂度 ≤ 10（每个函数）
- 认知复杂度 ≤ 15（每个函数）
- 函数长度 ≤ 50 行
- 文件长度 ≤ 500 行
- 嵌套层数 ≤ 4
- 重复代码率 ≤ 3%
- 测试覆盖率 ≥ 80%
- 严重问题 = 0
- 高优先级问题 ≤ 2

**输出格式**：

```json
{
  "gate": "world-class-standards",
  "status": "pass | warning | fail",
  "metrics": {
    "complexity": {
      "cyclomatic": { "avg": 6.2, "max": 9, "threshold": 10, "status": "pass" },
      "cognitive": { "avg": 8.5, "max": 14, "threshold": 15, "status": "pass" }
    },
    "maintainability": {
      "functionLength": { "avg": 32, "max": 48, "threshold": 50, "status": "pass" },
      "duplication": { "rate": 2.1, "threshold": 3, "status": "pass" }
    },
    "test": {
      "coverage": { "value": 87, "threshold": 80, "status": "pass" }
    },
    "issues": {
      "critical": { "count": 0, "threshold": 0, "status": "pass" },
      "high": { "count": 1, "threshold": 2, "status": "pass" }
    }
  },
  "overallRating": "A",
  "verdict": "pass | warning | fail"
}
```

**处置**：

- pass：评级 ≥ A（所有指标达标）→ 继续
- warning：评级 B（部分指标接近阈值）→ 记录放行 + 建议优化
- fail：评级 ≤ C 或严重问题 > 0 → 回流 EXECUTE

**硬约束**：

- 圈复杂度 > 15 → 必须重构（不可放行）
- 严重问题 > 0 → 必须修复（不可放行）
- 测试覆盖率 < 70% → 必须补充测试

**详细定义**: 见 `skills/world-class-code-standards/SKILL.md`

---

## `self-critique` gate

**触发**：策略 = 实现/重构，每关完成后立即触发。产出 `.auto/runs/<runId>/quest-<N>-critique.md`。

**与 self-verification 的差异**：

| Gate              | 关注层次                                 | 输出                              |
| ----------------- | ---------------------------------------- | --------------------------------- |
| self-verification | 代码语法/逻辑/边界/错误处理              | 代码缺陷修正                      |
| self-critique     | 本关是否真满足 objective（主线漂移防范） | 达成度评分 + 盲点 + 是否回退 PLAN |

**验证维度**：objective 满足度 | 盲点暴露（≥1 条「最不放心的事」）| outOfScope 合规 | 达成度评分 0-100

**处置**：

- pass：达成度 ≥ 70 且盲点已处理 → 继续
- warning：达成度 70-85 但盲点未完全处理 → 记录放行
- fail：达成度 < 70 或 outOfScope 违规 → 回流 PLAN

**跳过**：策略=探索；策略=修复且单关 < 20 行。

---

## `production-governance` gate

**触发**：策略 = 实现/重构；修复策略中用户明确要求“生产级/可上线/稳定安全健壮”时按需触发。

**验证维度**：goal convergence | artifact truth | run state | cost-quality | skill health

**输入**：`RouteDecision.userIntent`、`QuestMap.goal/outOfScope/acceptance`、`QuestResult.validations`、`.auto/runs/<runId>/` 标准工件、`.auto/feedback/skills.json`。

**输出格式**：

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

| 结果    | 条件                                                                | 处置             |
| ------- | ------------------------------------------------------------------- | ---------------- |
| pass    | 目标无漂移，关键工件齐备，run 状态明确，成本质量与 skill 证据均达标 | 继续             |
| warning | 轻微目标偏移或非关键证据缺失，但不影响交付判断                      | 记录放行         |
| fail    | `goalDrift=major`、关键工件缺失、未知状态被当成功、生产级任务缺证据 | 回流 PLAN/VERIFY |

**反馈写入**：skill 被激活但无应用证据时，`.auto/feedback/skills.json` 中对应 skill 的 `evidence_missing_count` +1；治理 gate 失败时 `governance_fail_count` +1。

---

## `adversarial` gate

**触发**：策略 = 实现/重构，每关完成后由 `verification` agent 执行（红蓝对抗）。

**验证维度**：边界值攻击 | 并发场景 | 幂等性验证 | 异常路径覆盖 | 注入攻击

**对抗场景**（至少执行 3 种）：

1. **边界值攻击** — 0, -1, null, undefined, 空字符串, 超长字符串 (10MB), MAX_INT, MIN_INT, Infinity, NaN
2. **并发场景** — 并行请求同一接口，检查竞态条件、重复创建、数据损坏
3. **幂等性验证** — 同一请求提交两次，结果必须一致（或安全失败）
4. **异常路径** — 网络超时、磁盘满、OOM、依赖服务故障
5. **注入攻击** — SQL 注入、XSS、命令注入、路径穿越

**输出格式**：

```json
{
  "gate": "adversarial",
  "status": "pass | warning | fail",
  "attacks": [
    {
      "scenario": "boundary-values",
      "target": "api/users/create",
      "payload": "{ name: '', age: -1, email: 'x'.repeat(10000000) }",
      "expected": "400 Bad Request with validation error",
      "actual": "500 Internal Server Error",
      "status": "fail",
      "evidence": "curl -X POST /api/users -d '{\"age\":-1}' → 500"
    },
    {
      "scenario": "concurrency",
      "target": "orderService.createOrder",
      "payload": "Same order ID submitted twice in parallel",
      "expected": "Second request returns 409 Conflict",
      "actual": "Both requests created duplicate orders",
      "status": "fail",
      "evidence": "parallel curl commands → two rows in DB"
    },
    {
      "scenario": "idempotency",
      "target": "paymentService.charge",
      "payload": "Same payment request submitted twice",
      "expected": "Second request returns cached result (no double charge)",
      "actual": "Second request charged again",
      "status": "fail",
      "evidence": "curl /api/charge (twice) → balance -= 20"
    }
  ],
  "summary": "发现 3 个关键漏洞：边界值未验证、并发重复创建、支付非幂等",
  "verdict": "fail"
}
```

**处置**：

- pass：所有对抗场景通过 → 继续
- warning：非关键路径发现问题（如日志格式、错误消息）→ 记录放行 + 建议修复
- fail：关键漏洞（数据损坏、安全漏洞、非幂等写操作）→ 回流 EXECUTE

**硬约束**：

- 边界值导致 500 错误 → 必须加输入验证
- 并发导致数据重复/损坏 → 必须加锁或幂等性保证
- 注入攻击成功 → 必须修复（不可放行）

**调用方式**：

```markdown
Agent(subagent_type: "verification", prompt: "对抗性验证 Quest 3 的 orderService.createOrder")
```

**详细定义**: 见 `agents/verification.md`

---

## `production-readiness` gate

**触发**：策略 = 实现/重构，每个 QuestResult 产出后自动触发（与 self-verification 并行）。

**验证维度**：错误处理 | 配置管理 | 日志规范 | 安全头 | 边界值验证

**核心检查清单**（5 项强制）：

1. **错误处理完整** — 无裸 try-catch，所有异常必须记录日志 + 返回用户友好错误
2. **无硬编码配置** — 数据库连接、API Key、环境特定配置必须走环境变量
3. **日志结构化** — JSON 格式 + correlationId + timestamp + level
4. **安全头完整** — HTTP 响应必须包含 HSTS / CSP / X-Frame-Options
5. **边界值验证** — 所有外部输入必须验证（长度、类型、范围、格式）

**输出格式**：

```json
{
  "gate": "production-readiness",
  "status": "pass | warning | fail",
  "checks": {
    "errorHandling": {
      "status": "pass | fail",
      "nakedTryCatch": 0,
      "unloggedErrors": 0,
      "evidence": "grep -r 'catch.*{\\s*}' src/ | wc -l"
    },
    "configManagement": {
      "status": "pass | fail",
      "hardcodedSecrets": 0,
      "hardcodedUrls": 1,
      "evidence": "grep -r 'api_key\\s*=\\s*[\"']' src/"
    },
    "logging": {
      "status": "pass | fail",
      "jsonFormatted": true,
      "hasCorrelationId": true,
      "evidence": "grep 'JSON.stringify' src/logger.ts"
    },
    "securityHeaders": {
      "status": "pass | fail",
      "hsts": true,
      "csp": true,
      "xFrameOptions": true,
      "evidence": "grep -r 'Strict-Transport-Security' src/"
    },
    "inputValidation": {
      "status": "pass | fail",
      "validatedInputs": 8,
      "unvalidatedInputs": 0,
      "evidence": "grep -r 'req\\.(body|query|params)' src/ | wc -l"
    }
  },
  "verdict": "pass | warning | fail"
}
```

**处置**：

- pass：5 项全部通过 → 继续
- warning：有硬编码但非敏感信息（如默认端口）→ 记录放行 + 建议修复
- fail：任一项严重违规（硬编码密钥、无错误处理、无输入验证）→ 回流 EXECUTE

**硬约束**：

- 硬编码密钥/密码 → 必须修复（不可放行）
- 无错误处理的外部调用 → 必须加 try-catch
- 无输入验证的 API 端点 → 必须加验证

**详细定义**: 见 `skills/production-standards/SKILL.md`

---

## `protocol-validator` gate

**触发**：Phase 交接前检查上游协议对象完整性；策略 = 修复/实现/重构时，VERIFY gateResults 只汇总截至 EXECUTE→VERIFY 已完成的 handoff 检查结果。

**validator 支持对象**：按阶段校验已产出的对象：`RouteDecision` | `QuestMap` | `QuestResult` | `VerifyReport` | `LearnCard`

**VERIFY gate 汇总范围**：仅汇总本 run 已完成的 handoff 检查：SCAN→PLAN 的 `RouteDecision`、PLAN→EXECUTE 的 `QuestMap`、EXECUTE→VERIFY 的 `QuestResult`；不得把尚未完成的 VERIFY→SUMMARIZE 或 LEARN 后检查计入本 gate。

**验证逻辑**：加载 `skills/protocol-validator/SKILL.md`，检查必填字段、条件字段、同一 run 的 `correlationId` 一致性与失败时的 `recommendedNext`。

| 结果    | 条件                                           | 处置                    |
| ------- | ---------------------------------------------- | ----------------------- |
| pass    | 所有必填字段与条件字段齐备                     | 继续                    |
| warning | 仅 optional 字段缺失或非阻断字段不完整         | 记录放行                |
| fail    | 缺少必填字段、条件字段或失败项 recommendedNext | 回流对应上游 Phase 补全 |

---

## `skill-activation` gate

**验证逻辑**：对每个激活 Skill（top-3）检查 QuestResult.validations 中的证据条目。每条证据须包含 skill 名称 + 提取要素 + 代码位置/决策点。

| 结果    | 条件                             | 处置         |
| ------- | -------------------------------- | ------------ |
| pass    | 所有激活 Skill 均有 ≥1 条证据    | 继续         |
| warning | ≤50% 缺少证据但核心 Skill 已应用 | 记录放行     |
| fail    | >50% 无证据或核心 Skill 未应用   | 回流 EXECUTE |

**跳过**：探索模式且无激活 Skill。

**证据格式**（写入 QuestResult.validations）：

```json
{
  "name": "skill-activation",
  "skillName": "systematic-debugging",
  "status": "pass",
  "evidence": "读 skill 缓存/快速使用段（42 行），提取 checklist + anti-patterns，在 Quest 3 错误处理中应用了根因追踪方法（见 file.ts:L45-L62）"
}
```

---

## `knowledge-reuse` gate

**验证逻辑**：核对 PLAN 阶段注入 RouteDecision.notes 中的 insight 摘要是否在 EXECUTE 中被参考。

**简化检查**：

1. 从 RouteDecision.notes.relevantInsights 提取注入的 insight 列表
2. 检查 QuestResult.validations 中是否有引用对应 insight 的证据
3. 无须检查 `[insight:]` 格式标记（该标记在实践中未被遵守）

| 结果    | 处置                                   |
| ------- | -------------------------------------- |
| pass    | 有注入的 insight 且 EXECUTE 有参考证据 |
| warning | 首次未达标，记录但放行                 |
| fail    | 同项目/同关键词组连续 2 次未达标       |

**跳过**：RouteDecision.notes.relevantInsights 为空。

---

## `knowledge-distribution` gate

**验证逻辑**：核对 LearnCard 是否已从 `learn-cards.md` 分发（Edit append）到 `.auto/insights/` 对应文件。只停留在 `learn-cards.md` 未 append = 未分发。

**验证步骤**：

1. Read `learn-cards.md`，提取所有 `category` 字段
2. 对每张有 category 的 LearnCard，Grep 其 `title` 在对应 insights 文件中是否存在
3. 未找到 → 未分发

**分发清单（硬约束）**：

| LearnCard.category | 目标文件                                                                           |
| ------------------ | ---------------------------------------------------------------------------------- |
| trap               | `.auto/insights/traps.md`                                                          |
| pattern            | `.auto/insights/patterns.md`                                                       |
| decision           | `.auto/insights/decisions.md`                                                      |
| prompt             | `.auto/insights/prompts.md`                                                        |
| feedback           | `.auto/insights/agent-feedback.md` + `.auto/feedback/agents.json` 或 `skills.json` |

| 结果    | 条件                                            | 处置       |
| ------- | ----------------------------------------------- | ---------- |
| pass    | 所有 LearnCard 已 append 到对应文件             | 关闭 run   |
| warning | <50% 未分发但全部 trap/critical decision 已分发 | 记录放行   |
| fail    | ≥50% 未分发或任意 trap 未进 traps.md            | 回流 LEARN |

**最小 append 格式**：

```markdown
### <标题>

**日期**: YYYY-MM-DD | **置信度**: high|medium|low | **来源**: run-<runId>

<2-3 句核心描述 + 推荐动作>
```

---

## `clean-state` gate

**验证维度**：

1. startupAndTestsPass — 启动验证命令通过
2. progressLogReflectsReality — quest-status.json 与实际代码状态一致
3. noHalfFinishedWorkRemains — 无孤立变更
4. repoRestartableViaStandardPath — 新会话可标准路径启动

**处置**：4 项全 pass → 关闭 run | 1-2 项 false 但非关键 → warning 放行 | 关键项 false → 阻断 LEARN

---

## `analysis` gate（探索策略专用）

**验证**：分析产出是否回答了用户的原始问题。检查 QuestResult 中是否有明确的分析结论，结论是否覆盖了 RouteDecision.userIntent 的所有方面。

---

## `build` / `test` / `lint` / `coverage` / `security` / `adversarial` / `cost` gates

**通用模式**：运行对应命令（如 `npm run build`、`npm test`、`npm run lint`），收集输出，判定 pass/warning/fail。

**关键规则**：

- 实测优先于断言（Run-Don't-Claim）：必须附带实际命令 + 输出尾部 ≥3 行作为 evidence
- 预测后验证（Predict-Then-Verify）：跑命令前先预测结果，预测错 = 理解错，必须停下修理解

---

## Phase 交接自检原则

以下自检在各 Phase 关键节点触发。严重命中需回流加固。

| 节点           | 自检项                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCAN → PLAN    | `[C]` 自己用会满意？回避了最痛边角？ `[P]` 有更小版本？ `[A]` 触及哪些架构边界？                                                                                     |
| PLAN → EXECUTE | `[A]` SOLID/单一职责？ `[P]` 每关有用户价值？ `[T]` 6维矩阵？ `[D]` acceptance 可执行？ `[C]` 满足用户原话？                                                         |
| EXECUTE 每关后 | `[D]` 变更可追溯？错误处理覆盖？ `[B]` SQL参数化？N+1？ `[O]` graceful shutdown？ `[T]` 红灯先行？                                                                   |
| VERIFY 后      | `[C]` 最丑输入？反例覆盖？ `[T]` coverage≥80%？并发？ `[B]` 数据迁移可回滚？ `[O]` 监控埋点？ `[A]` 无必要抽象？                                                     |
| SUMMARIZE 前   | `[C]` 用户原话被满足？ `[P]` 核心指标变好？                                                                                                                          |
| LEARN 前       | `[C]` 哪刻差点偷懒？ `[P]` 用户洞察被忽略？ `[A]` 架构决策值得复用？ `[D]` 技巧值得固化？ `[T]` 测试漏检？ `[B]` 数据问题？ `[O]` 生产问题？每命中产出一张 LearnCard |
