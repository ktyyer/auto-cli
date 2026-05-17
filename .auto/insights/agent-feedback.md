# Agent 路由反馈

> 记录 Agent 调用结果，供 SCAN 阶段路由优化参考。

<!-- 格式：### <agent-name> / <日期> / <结果> -->
<!-- 示例：
### quest-designer / 2026-04-09 / success
- 任务：实现用户认证模块
- 耗时：正常
- 备注：QuestMap 拆解合理，5 关全部通过
-->

### Explore (×4) / 2026-05-08 / failure
- 任务：并行网络调研 GitHub / multi-agent / 中文社区 / 同类 CLI
- 失败模式：全部约 3 分钟后报 `API Error: 500 Panic (Calcium-Ion/new-api)`
- 替代：主窗口直接 WebSearch 100% 成功
- 建议：网络调研类任务，路由器降低 Explore agent 优先级

### validate-references.js / 2026-05-17 / pattern · 来源 run-2026-05-17-audit-local-changes

**结论**：validate-references.js 是审计"单入口范式未被破坏"的最快工具。本次审计跑出 45 引用通过 / 0 失败，1 秒内完成。
**推荐动作**：考虑在 npm scripts 中加入 `validate:references` 作为发布前必跑检查；或加入 PreCommit hook 自动触发。
**置信度**：high

### Codex 高频硬规则覆盖度 / 2026-05-17 / feedback · 来源 run-2026-05-17-audit-codex-sync

**结论**：Codex 端 commands/auto.codex.md L404-412 "高频硬规则"仅覆盖 7 个 skill 触发场景，依赖 LLM 自主语义判断其他 18 个 skill。当新增**强制前置类** skill（如 brainstorming 多路径强制前置 / using-git-worktrees 自动并行触发）未列入硬规则时，Codex 端 LLM 可能完全忽略。
**推荐动作**：(1) 关键 skill（强制前置 / 自动触发类）必须进 Codex 端硬规则；(2) 一般性 skill 可保留 LLM 自主判断；(3) 25 个 skill 完整兜底索引在 Codex 端是否需要待观察。
**置信度**：medium
