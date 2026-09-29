# Feedback contract — auto-feedback/v1

本契约是 `.auto/feedback/{skills,agents}.json` 的读写真源；Markdown 工作流执行更新，`scripts/feedback-contract.js` 只做读取校验和观测汇总，不执行编排。显式引用用 `[feedback:skills.json#key]` / `[feedback:agents.json#key]`，兼容旧 `:key`。

## 存储与冷启动

新文件使用扁平结构；canonical seed：

```json
{
  "schemaVersion": "auto-feedback/v1",
  "lastUpdated": null,
  "portablePatterns": []
}
```

以上是 `skills.json`；`agents.json` seed 省略 `portablePatterns`。保留键为 `schemaVersion / version / lastUpdated / portablePatterns / skills / agents`，不能作为技能或 agent 的证据引用。条目名为其余自有键，保留未知扩展字段（如 tier、knownIssues、evaluator 评分），不得覆盖整个文件丢失旧数据。

新技能条目：

```json
{
  "usageCount": 0,
  "lastUsed": null,
  "successRate": null,
  "observations": {}
}
```

agent 条目将 `usageCount` 换成 `totalCalls`。计数为非负安全整数；skill 每个实际激活的 run 计一次，agent 计实际调用次数。未激活或未调用不增加计数。

## 逐 run 观测与幂等更新

写入前 Read 当前文件，按 runId upsert `observations`；一条观测示例：

```json
{
  "run-example": {
    "uses": 1,
    "date": "2026-09-29",
    "outcome": "success",
    "evidence": [".auto/runs/run-example/quest-results.md"]
  }
}
```

- `uses`：技能固定为 1；agent 为该 run 实际调用次数（正安全整数）。同 run 多次调用只产生一个聚合 outcome。
- `outcome`：`success / failure / unknown`。只评价该能力在该 run 的预定验收；全部适用验收有证据才 success，已观测到验收失败为 failure，缺测/未归因/未完成为 unknown。其他任务失败不自动归咎于该能力。
- `evidence`：非空路径/说明字符串数组；unknown 也要指出缺测原因或对应 run。字符串有效只证明引用格式，不证明证据内容真实或因果收益。
- 计数更新为 `原计数 + 新 uses - 该 run 原 uses（没有则 0）`；同 run 重试/重新 LEARN 替换观测，不能重复累计。`lastUsed` 保留历史与观测中最新的日期，文件 `lastUpdated` 更新为写入日；`lastRunId` 可作摘要，但不能代替 observations 去重。
- `measuredCount = success 的 run 数 + failure 的 run 数`；`successRate = success / measuredCount`。分母为 0 时必须 null；unknown 不计失败、不计分母。不得从总调用量、舍入率、gate 通过率倒推成功次数。
- 失败按 runId 合并 `knownIssues`，解决后保留并标记 resolved；扩展字段保持原样。写临时文件、解析校验成功后替换原文件；更新期间若源文件已变化，重新 Read 合并。

这是**局部工作流验收率**，不是 skill 的因果收益或编码生产力。路由/上下文分层仅在有效观测 `measuredCount >= 3` 时消费 rate；未知、旧格式无观测、无效数据均不给 rate 加权。使用次数不替代 measuredCount；>30 天未使用标 stale，stale 只降权。已解决的 knownIssues 不继续作为失败信号。校验失败应记录诊断，不能默默当高成功率。

## 兼容与迁移

未声明 schemaVersion 的旧扁平文件、旧 `skills` / `agents` 包装层可读；条目至少具有对应计数（非负安全整数），已有 successRate 若非 null 必须在 [0,1]。旧率仅作历史展示，不参与路由。若同一 key 同时在扁平与包装层出现，拒绝歧义引用，先人工合并；v1 禁止包装层。元数据对象不能冒充有效条目。

迁移时先保留源快照；逐项保留计数、日期和扩展字段，把旧 successRate 保存到 `legacyMetrics.successRate`（未知分母不能补造观测），初始化 observations={}、successRate=null。历史 lastRunId 不能自动转换为测量。可逐条迁移未标版本的文件；全部条目规范化后再写 schemaVersion。引用校验只检查文件元数据和被引用条目，不等于全文件验收。

## 可迁移知识

`portablePatterns` **只写 skills.json 顶层数组**。每项保留 LearnCard 的 `id / runId / scope / confidence / title / summary`，另加来源 `skill`；scope 只允许 stack/universal。迁移旧 skill 条目内的同名数组时按 `(runId, id, skill)` 去重后移到顶层，同键内容矛盾先解决，不能静默覆盖。冷启动导入、doctor 统计与 LEARN 都读此位置；只导入 high confidence 且 scope/技术栈适用的知识。顶层保留键不得被枚举为技能。

## 校验边界

`validate-run-completeness.js` 在 knowledge-reuse 声明 pass 时检查显式引用，使用上述计数、保留键、兼容策略和观测率规则。不会据此断言自然语言工作流已经执行、路径内容为真或生产力有提升。重复执行同一 LEARN 前后计数不变、unknown 分母不变，须在 run 的验证证据中体现。
