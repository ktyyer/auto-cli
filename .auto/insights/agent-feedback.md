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
