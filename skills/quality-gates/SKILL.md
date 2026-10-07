---
name: quality-gates
description: VERIFY 门禁定义 — 17 个 gate 的适用条件、证据标准与处置规则。按当前变更风险加载相关定义；实际执行、独立期望与反例证据不能由退出码、自评分或结构完整性替代。
tags:
  - verify
  - gate
  - quality
  - validation
  - testing
---

# Quality Gates — VERIFY 门禁定义

共享语义见 [执行契约](../production-governance/references/workflow-contract.md) 的证据回路；阶段边界与实际工具见同目录的 workflow-phases.md、host-adapters.md。本文件细化现有 taxonomy，不新增平行 gate。

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 按当前策略与实际变更风险确定本次适用 gate，记录不适用项的理由
- [ ] 按需加载对应 gate 的详细定义（不预加载全量 17 个）
- [ ] 每个 gate 输出 `name` + `status` + `evidence`；实际执行附命令与输出，规则审查附来源与位置
- [ ] 任一 gate fail 必须同时给出 `recommendedNext`
- [ ] gate 状态与 verify-report.md 同步；实际验收完成才移除 pending，不从命令 exit 0 直接推导 pass

**硬约束** (constraints):

- 实测优先于断言：声称执行过必须附真实命令与输出；文档/规则审查引用已读事实，不虚构命令
- 业务验收须附独立规则来源与版本；仅模型生成的测试或 mutation 结果不能证明业务预期正确。来源缺失且影响结论时标未验证，不得写 pass。
- 简单探索可压缩为原问题与证据核对；结构化探索按下表评估相关 gate，不能无依据宣布全部通过
- `knowledge-distribution` 收口检查归属 LEARN（VERIFY 时 LearnCard 尚未产出，时序上不可能通过）：LearnCard 未分发到 `.auto/insights/` 即 run 收口 fail，由 `knowledge-management` skill 执行
- 状态使用 `pass | fail | warning | skipped | pending | not_applicable`；不适用须有理由，必需验证因环境缺失未执行不能伪装成不适用。存在 fail/pending 时整体不能 pass，但允许如实失败/部分完成总结。
- 运行证据绑定 run/quest/cwd、相关产物状态、命令自身退出码、输出、时间与来源。相关代码/测试/配置改动后重新验证；本地可写记录只声明本地一致性。

**反模式** (anti-patterns):

- 用主观判断代替命令实测 → Run-Don't-Claim 违规
- fail 只写结论不写下一步 → 下游无法回流修复
- 一次性加载全部 17 个 gate 定义 → 上下文浪费

## Gate Taxonomy

`analysis` | `build` | `test` | `lint` | `coverage` | `security` | `adversarial` | `self-verification` | `world-class-standards` | `production-readiness` | `self-critique` | `production-governance` | `protocol-validator` | `skill-activation` | `knowledge-reuse` | `clean-state` | `cost`

下文 JSON 展示单项检查字段，不是可原样复制的完成记录。写入 VerifyReport 时补全当前 evidence；fail 补 recommendedNext，最终对象由 protocol-validator 校验。涉及未知测量时，不得采用示例中的 pass 或数字。

## 各策略 gate 选择

下表为候选集合，不要求不适用的检查实际执行。实现/重构保留 production-governance 与协议核对；应用 build/test/coverage、容量、运维按本次交付判断。纯 Markdown 修改使用结构、引用、协议及安装验证，不为凑门禁创建应用测试。self-critique 没有触发信号时可附理由记 not_applicable。

| 策略 | 候选 gate                                                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 探索 | `analysis` + `skill-activation`(evidence: read-only) + `knowledge-reuse`(evidence: analysis-only) + `clean-state`                                                                                                                                                               |
| 修复 | `build` + `test` + `self-verification` + `world-class-standards` + `production-readiness` + `protocol-validator` + `skill-activation` + `knowledge-reuse`(evidence: relevant) + `clean-state`                                                                                   |
| 实现 | `build` + `test` + `lint` + `coverage` + `adversarial` + `self-verification` + `world-class-standards` + `production-readiness` + `self-critique` + `production-governance` + `protocol-validator` + `skill-activation` + `knowledge-reuse` + `clean-state`                     |
| 重构 | `build` + `test` + `coverage` + `security` + `adversarial` + `self-verification` + `world-class-standards` + `production-readiness` + `self-critique` + `production-governance` + `protocol-validator` + `skill-activation` + `knowledge-reuse`(evidence: full) + `clean-state` |

---

## `self-verification` gate

**触发**：修复/实现/重构的相关实现与验收核对；复用已有检查，新增变更、失败或未解疑点才扩大验证，不机械重复所有检查。

**验证维度**：语法正确性 | 逻辑一致性 | 边界值覆盖 | 错误处理 | 性能影响

**输出格式**：

```json
{
  "name": "self-verification",
  "status": "pass | warning | fail",
  "issues": [
    {
      "severity": "critical | high | medium | low",
      "category": "syntax | logic | boundary | error-handling | performance",
      "description": "具体问题描述",
      "autoFixed": false,
      "location": "file:line"
    }
  ],
  "summary": "自我验证摘要"
}
```

**处置**：pass → 继续 | warning → 记录放行 | fail → 回流 EXECUTE

---

## `world-class-standards` gate

**触发**：代码变更需要复杂度、维护性或覆盖率审查时；纯文档或无适用测量的项目说明范围，不机械运行代码指标工具。

**验证维度**：圈复杂度 | 认知复杂度 | 函数长度 | 文件长度 | 嵌套层数 | 重复代码率 | 测试覆盖率 | 问题严重级别

**量化参考**（优先项目实际规则；只有已确认适用的阈值才作为门槛，不从模型估算判定）：

- 圈复杂度 ≤ 10（每个函数）
- 认知复杂度 ≤ 15（每个函数）
- 函数长度 ≤ 50 行
- 文件长度 ≤ 500 行
- 嵌套层数 ≤ 4
- 重复代码率 ≤ 3%
- 测试覆盖率 ≥ 80%
- 严重问题 = 0
- 高优先级问题 ≤ 2

**输出格式**（以下数字仅示意结构；实际缺少测量时用 null/unknown，不复制为结果）：

```json
{
  "name": "world-class-standards",
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

- pass：适用的项目约束与验收均有证据 → 继续
- warning：非关键指标或测量存在已声明限制 → 记录影响
- fail：实际违反必要约束或存在严重问题 → 回流 EXECUTE

**硬约束**：

- 严重问题须修复；项目明确规定的指标不得悄悄降低。
- 通用复杂度/行数/覆盖率建议是调查信号，不能无视业务正确性或为评分重构无关代码。
- 覆盖率需来自当前产物的真实报告；没有适用工具时保留未验证状态，不编造数值或等级。

**详细定义**: 见 `skills/world-class-code-standards/SKILL.md`

---

## `self-critique` gate

**触发**：简短目标核对发现验收差异、范围漂移、失败证据或高影响未知项，或用户明确要求逐关复核。复用 QuestResult/VerifyReport，不强制每关独立文件。

**与 self-verification 的差异**：

| Gate              | 关注层次                                 | 输出                      |
| ----------------- | ---------------------------------------- | ------------------------- |
| self-verification | 代码语法/逻辑/边界/错误处理              | 代码缺陷修正              |
| self-critique     | 本关是否真满足 objective（主线漂移防范） | 实际差异与证据 + 后续动作 |

**验证维度**：objective 与 diff 的对应关系 | 未解决验收 | 范围与授权 | 影响结论的未知项。不要求评分或补一条盲点。

**处置**：

- pass：触发差异已处理且相关验收有当前证据 → 继续
- warning：次要未知项已声明且不影响必要 acceptance → 记录影响
- fail：必要 acceptance 未满足或目标偏移未解决 → 修补或回流 PLAN

**不适用**：没有深入自纠信号，简短目标核对无异常。授权内必要关联修改记 scope-expand 后继续，不自动重新询问；缺证据允许失败总结。

---

## `production-governance` gate

**触发**：策略 = 实现/重构；修复策略中用户明确要求“生产级/可上线/稳定安全健壮”时按需触发。

**验证维度**：goal convergence | artifact truth | run state | cost-quality | skill health

**输入**：`RouteDecision.userIntent`、`QuestMap.goal/outOfScope/acceptance`、`QuestResult.validations`、`.auto/runs/<runId>/` 标准工件、`.auto/feedback/skills.json`。

**输出格式**：

```json
{
  "name": "production-governance",
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

**反馈写入**：按 knowledge-management 契约记录真实观察并按 runId 幂等更新；unknown 不算失败、不进成功率分母，重复核对不能重复累加。

---

## `adversarial` gate

**触发**：按实际变更风险选择反例。默认可由主执行者运行；仅在有授权、独立性有价值且工具可用时委派，不能将自检伪称独立验证。

**验证维度**：边界值攻击 | 并发场景 | 幂等性验证 | 异常路径覆盖 | 注入攻击 | **容量/伸缩性**

**对抗场景**（按风险选择：凡与本次变更风险相关的都必须覆盖，选中/不选均写明风险依据，无相关的记 `not_applicable` 并在 evidence 写明理由；不固定凑数量，通常 2-4 类；涉及数据/集合/I/O 的任务必须包含容量探针）：

高保障任务逐项处理以下六类场景，适用项执行，不适用项说明理由；强化任务明确 A/B/C 三链结论，不用场景数量替代覆盖依据。

1. **边界值攻击** — 0, -1, null, undefined, 空字符串, 超长字符串 (10MB), MAX_INT, MIN_INT, Infinity, NaN
2. **并发场景** — 并行请求同一接口，检查竞态条件、重复创建、数据损坏
3. **幂等性验证** — 同一请求提交两次，结果必须一致（或安全失败）
4. **异常路径** — 网络超时、磁盘满、OOM、依赖服务故障
5. **注入攻击** — SQL 注入、XSS、命令注入、路径穿越
6. **容量/伸缩性探针** <!-- capacity-contract: probe --> — 列出规模假设（当前规模、峰值并发、单项大小、内存/磁盘预算），对数据量 ×100 或明确的容量上限做反例；检查无界查询（无 `LIMIT`）、全量加载/累积集合、未分页接口、无背压消费者、固定内存缓存；验证分页/流式/背压/限流/超时/取消或给出 `capacity: not-applicable` 理由

```json
{
  "name": "adversarial",
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
    },
    {
      "scenario": "capacity-scale",
      "target": "repository.findAll",
      "payload": "Current dataset ×100 or declared capacity ceiling",
      "expected": "Bounded memory, paginated/streamed result, or explicit safe rejection",
      "actual": "Unbounded query accumulates all rows in memory",
      "status": "fail",
      "evidence": "query/file:line + row estimate + memory/latency measurement"
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

**执行方式**：使用当前宿主真实工具；验证提示提供独立规则、当前产物与风险场景。mutation 仅在隔离副本进行，记录是否等价；有限反例通过不能证明业务规则完整。Codex 不依赖 `agents/` 定义。

---

## `production-readiness` gate

**触发**：本次交付涉及服务运行、部署或外部 I/O 时，检查实际适用的运行风险；无运行系统的文档改动说明不适用。

**验证维度**：错误处理 | 配置管理 | 日志规范 | 安全头 | 边界值验证

**核心检查清单**（按系统类型适用，不固定凑齐五项）：

1. **错误处理完整** — 错误被正确传播、处理或记录，不能吞掉失败；不要求每层重复日志
2. **无硬编码配置** — 数据库连接、API Key、环境特定配置必须走环境变量
3. **日志可诊断** — 服务按项目规范提供结构化字段、关联标识与级别，不向用户泄露敏感信息
4. **安全头适用** — HTTP 服务按内容类型、TLS 与部署方式检查实际响应，CLI/纯文档不适用
5. **边界值验证** — 所有外部输入必须验证（长度、类型、范围、格式）

**输出格式**（示例字段与定位命令不是运行证据；需用真实响应、测试或配置生效检查补全）：

```json
{
  "name": "production-readiness",
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

- pass：适用项目全部通过且有证据 → 继续
- warning：有硬编码但非敏感信息（如默认端口）→ 记录放行 + 建议修复
- fail：任一项严重违规（硬编码密钥、无错误处理、无输入验证）→ 回流 EXECUTE

**硬约束**：

- 硬编码密钥/密码 → 必须修复（不可放行）
- 外部调用失败无法正确处理或传播 → 修复错误路径，不能只机械包 try-catch
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

此 gate 的 pass 仅证明协议结构符合要求，不能替代其他 gate 的业务、执行或证据新鲜性判定。

---

## `skill-activation` gate

**验证逻辑**：对本轮实际应用的 Skill 检查 QuestResult.validations 中的证据条目。每条证据包含 skill 名称、应用规则与代码位置/决策点；只读过索引不等于应用，无关 skill 不为凑数量激活。

| 结果    | 条件                                     | 处置         |
| ------- | ---------------------------------------- | ------------ |
| pass    | 所有激活 Skill 均有 ≥1 条证据            | 继续         |
| warning | 非关键应用证据缺失，已说明影响           | 记录限制     |
| fail    | 必要规则未应用并影响验收，或伪造应用证据 | 回流对应阶段 |

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
| warning | 相关性或复用效果未知，记录原因         |
| fail    | 忽略适用硬约束导致当前验收失败         |

**跳过**：RouteDecision.notes.relevantInsights 为空。

---

## `knowledge-distribution` 收口检查（LEARN 期执行，非 VERIFY gate）

**验证逻辑**：有新增 LearnCard 时，按 knowledge-management 查重后分发或合并到 `.auto/insights/`，记录实际目标。无新增经验可明确说明，不为分发数量制造卡片。

**验证步骤**：

1. Read `learn-cards.md`，提取所有 `category` 字段
2. 检查目标内容、来源 run 与实际合并结果，标题命中仅作定位
3. 未分发的必要记录 → 补写或记录真实失败；不得用复制标题冒充内容已分发

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
| pass    | 新知识已写入/合并且来源可追溯，或明确无新增知识 | 关闭 run   |
| warning | 非必要分发存在限制且实际影响已声明              | 记录限制   |
| fail    | 必要记录遗漏、来源丢失或分发结果被虚报          | 当场补分发 |

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
3. noHalfFinishedWorkRemains — 本任务无未解释的半成品；用户原有变更保留并区分归属
4. repoRestartableViaStandardPath — 新会话可标准路径启动

**处置**：适用项目有证据且交付可解释 → pass；次要限制 → warning；关键项未满足 → fail，不能宣称完成，但仍可失败总结与 LEARN。clean-state 不要求 Git 干净，不得为此提交、stash、reset 或清理用户既有修改。

---

## `analysis` gate（探索策略专用）

**验证**：分析产出是否回答了用户的原始问题。检查 QuestResult 中是否有明确的分析结论，结论是否覆盖了 RouteDecision.userIntent 的所有方面。

---

## `build` / `test` / `lint` / `coverage` / `security` / `adversarial` / `cost` gates

**通用模式**：先定位项目真实命令与适用规则，运行并收集命令自身输出、退出码、产物状态及来源。不存在对应命令时说明不适用或验证缺口，不能假定 npm 脚本存在。

**关键规则**：

- evidence 保留能支撑结论的真实输出与完整日志指针，不为满足行数补写输出。
- test 还检查非空发现/执行数量、失败、skip 与回归；exit 0、全部跳过、过期记录或日志中的 passed 均不能单独放行。
- coverage 读取当前实际报告，数值达标不能替代行为验收；cost 无遥测写 null/unknown，不把估算当已授权支出。
- 重要影响命令先说明预期；结果不符时调查原因，不凭预测本身判定成功或失败。

---

## Phase 交接自检原则

以下问题是风险相关的核对提示，不是每关固定问卷；只记录实际发现与来源。重大偏差回流，已授权范围内的必要修补自主继续。

| 节点           | 自检项                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| SCAN → PLAN    | `[C]` 自己用会满意？回避了最痛边角？ `[P]` 有更小版本？ `[A]` 触及哪些架构边界？                                 |
| PLAN → EXECUTE | `[A]` SOLID/单一职责？ `[P]` 每关有用户价值？ `[T]` 6维矩阵？ `[D]` acceptance 可执行？ `[C]` 满足用户原话？     |
| EXECUTE 每关后 | `[D]` 变更可追溯？错误处理覆盖？ `[B]` SQL参数化？N+1？ `[O]` graceful shutdown？ `[T]` 红灯先行？               |
| VERIFY 后      | `[C]` 最丑输入？反例覆盖？ `[T]` coverage≥80%？并发？ `[B]` 数据迁移可回滚？ `[O]` 监控埋点？ `[A]` 无必要抽象？ |
| SUMMARIZE 前   | `[C]` 用户原话被满足？ `[P]` 核心指标变好？                                                                      |
| LEARN 前       | 有哪些可复用的新事实、失效假设或验收遗漏？仅对有来源的新结论写/合并 LearnCard，无新增则说明                      |
