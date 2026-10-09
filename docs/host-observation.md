# 可选宿主运行观测

`scripts/import-host-observation.js` 读取已保存的 Codex `exec --json` 或 Claude Code `-p --output-format stream-json` 日志。它不启动模型、委派 agent 或执行业务工作流。宿主完成、工具结果与独立任务验收分别记录；导入结果不能充当测试通过或 VERIFY gate 的证据。

## 导入

先为每个已启动的进程尝试登记一条清单记录，包括失败、取消、超时、未结束、无输出和重试。清单是覆盖范围的依据：工具不会从目录、事件数或 assistant 消息数猜测漏掉的调用；`modelInvocations` 保持 `null`。

```json
{
  "schemaVersion": "auto-host-attempts/v1",
  "runId": "run-example",
  "attempts": [
    {
      "attemptId": "codex-1",
      "host": "codex",
      "surface": "exec-json",
      "hostVersion": "0.154.0",
      "model": "gpt-6-astra",
      "status": "succeeded",
      "startedAt": "2026-10-08T11:00:00Z",
      "finishedAt": "2026-10-08T11:01:00Z",
      "wallTimeMs": 60000,
      "exitCode": 0,
      "usageScope": "attempt",
      "parentAttemptId": null,
      "retryOf": null,
      "resumeSessionId": null,
      "log": {
        "path": "codex-1.jsonl",
        "sha256": "替换为原始日志字节的64位小写SHA-256"
      }
    }
  ]
}
```

Claude 对应 `host: "claude"`、`surface: "stream-json"`。`hostVersion`、`model`、`finishedAt`、`wallTimeMs`、`exitCode` 未知时显式写 `null`；缺少日志写 `log: null`，空日志则登记空文件的真实摘要。时间必须带时区。版本与模型使用实际记录，不根据 CLI 品牌推断供应商或模型。

`status` 允许 `succeeded`、`failed`、`cancelled`、`timed_out`、`running`、`unknown`，表达进程/宿主完成情况。成功声明还需要唯一且明确的宿主完成事件支持；非零退出码不能变成成功。工具失败可以与宿主完成同时出现，`taskAcceptance` 始终是 `not-measured`。

日志路径相对清单所在目录，必须位于该目录内，不接受绝对路径、父目录穿越或符号链接。ID 使用最多 128 个字母、数字、下划线、点或连字符，以字母或数字开头，不能以点结尾或使用 Windows 保留名。每次重试使用新 ID，以 `retryOf` 关联原尝试；worker 使用自己的 ID 和 `parentAttemptId`。关联必须指向清单内记录且不能成环。

恢复已有会话仍登记为新的进程尝试，并将实际恢复参数写入可选 `resumeSessionId`（非空且不含控制字符；没有恢复则省略或写 `null`）。它不是 `retryOf`：重试可以创建独立会话，恢复的旧会话也可以不在本清单内。不要根据时间接近或任务相似猜测恢复关系。

```sh
# 仅输出 JSON，不写文件
node scripts/import-host-observation.js --manifest /path/to/attempts.json

# 显式保存到已存在、名称与 runId 一致的 run 目录
node scripts/import-host-observation.js --manifest /path/to/attempts.json --run-dir .auto/runs/run-example
```

保存时生成 `host-observation.json` 与 `host-observation-input/` 内逐字节复制的清单、日志。相同输入可重复导入；已有不同内容时拒绝覆盖，应使用新的 run 目录。来源文件保持原样，未知事件保存在原始日志中，并在派生记录中保留行号。

## 两端计数语义

当前字段映射已用 2026-10-08 的 Codex CLI 0.154.0 与 Claude Code 2.1.281 真实轨迹校准。后续版本出现未知事件或无法确定的字段时保留原始记录与 `null`，不按字符数补算用量。

| 观测项           | Codex                                              | Claude Code                                                            |
| ---------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| 终态用量来源     | 唯一根 `turn.completed` / `turn.failed` 的 `usage` | 唯一根 `result.usage`                                                  |
| 输入总量         | `input_tokens` 已包含缓存                          | `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` |
| 输出总量         | `output_tokens` 已包含 reasoning 子集              | `output_tokens`，thinking 子集不再相加                                 |
| 消息/worker 用量 | 不加到终态汇总                                     | 不加 assistant chunk、thinking 提示或 `modelUsage` 的分项总数          |
| 成本             | 未提供则 `null`                                    | `total_cost_usd` 仅为宿主报告的估算；`modelUsage` 原字段另外保留       |
| 实际账单         | `billedUsd: null`                                  | `billedUsd: null`                                                      |

同一尝试内的相同事件可去重，事件对象键顺序不影响比较。事件的 UUID/event_id 按会话与 worker 范围解释；没有该标识时按完整事件内容比较。`message.id`、`item.id` 不作为通用事件 ID。相同事件身份对应不同内容、多个不同根终态或损坏 JSON 时告警，完成与汇总保持未知；不同尝试不会因相同日志而合并。

`toolResults` 仅统计可映射的 Codex `command_execution` 完成和 Claude `tool_result`，不代表宿主所有工具的覆盖率。未知工具事件保持原文；工具 ID 按会话/worker 区分。缺少 `exit_code` 或明确 `is_error` 时，工具结果保持未知；Codex 命令状态与退出码矛盾或状态无法识别时，也保持未知。

`usageScope` 必填：`attempt` 表示该尝试独占用量，可与 worker 相加；`attempt-and-descendants` 表示已含其后代，汇总排除后代重复项，但尝试记录仍保留；`unknown` 表示范围未证实。已知存在 worker 而覆盖范围未知，或跨宿主包含关系无法归属时，整体汇总标为 `unknown-worker-overlap`，资源总量保持 `null`。任何纳入汇总的尝试缺用量或成本时，对应总量也是 `null`，同时给出缺失尝试数。不要把不完整总和用于收益比较。

Claude Code 2.1.281 的实际恢复轨迹中，`result.usage` 是本次进程增量，而 `total_cost_usd` 和 `modelUsage` 延续了会话累计值。因此每条尝试保留原始 `reportedEstimateUsd` 和 `modelUsage`，不能直接把各次恢复的费用相加或相减推算费用。`resumeSessionId` 使该尝试的 `reportedEstimateScope` 为 `session-cumulative`；若可比较的 `modelUsage` 输入、输出或缓存合计超过本次 `result.usage`，且不能由明确包含的已登记/观测 worker 解释，则记为 `unknown-model-usage-range`。未知模型字段不补算 token；`usageScope` 和唯一根终态 `result.usage` 仍决定 token 汇总。

费用归集先排除已被 parent 包含的 worker，再检查同一宿主的根 session 是否被多个进程尝试重复使用。worker 事件中的 session 不作根身份。重复根 session 得到 `estimateAccounting: "unknown-session-overlap"`，恢复或不明确的估算范围得到 `unknown-estimate-scope`；两者都使该宿主的费用合计为 `null`，在 `estimateAccountingIssues` 保留原因与尝试 ID，并在 `nonAdditiveEstimateAttemptIds` 汇总相关尝试。`summary.accounting` 继续表达原有 worker/token 范围，费用使用单独的 `estimateAccounting`。独立会话、明确 parent 包含关系继续按声明范围归集；`descriptor-scopes` 只表示清单范围可相加，不证明实际账单或未声明的恢复已被识别。提供恢复元数据能覆盖旧会话不在清单且日志没有可比较累计计数的情况。

## 来源核验与现有 metrics

`readHostObservation(runDir)` 重新检查所有来源的字节数和 SHA-256，并从保留来源重算派生内容。修改原始快照、清单、派生计数或删掉失败尝试的来源都会使核验失败。该核验是 `local-consistency-only`：它不证明日志由真实供应商签发、清单没有漏项、实际账单金额或任务已经通过。改写整套来源和摘要的行为不在本地一致性核验的证明范围内。

导入器的派生规则变化后，旧快照可能与当前重算结果不同并报告 `derivation differs`；不要据此覆盖旧证据或继续使用旧费用合计。保留采集时的导入器版本/摘要，将原始来源用当前导入器导入新的 run 目录，再使用新汇总。

现有 `generate-metrics.js` 仅在 run 中存在观测文件时增加可选 `hostObservation` 字段。成功导入不改变 run 状态、quest、gate、agent 调用数、文件或时间统计。来源无效时附明确问题并让 metrics CLI 非零退出；历史 run 不需要补造日志。

输入上限：清单 256 KiB、256 个尝试；单日志 8 MiB、总日志 32 MiB；单行 1 MiB、每尝试 25,000 条及总计 100,000 条非空事件；JSON 深度 64；派生文件 32 MiB。重复和损坏事件也计入容量。超过上限会显式失败，不截断成看似完整的结果。
