# 踩坑经验和问题排查

> LEARN 阶段自动维护，记录已验证的踩坑经验。

### 空目录污染：skills/ 下 12 个历史试验残留

**日期**: 2026-04-18
**标签**: dir-hygiene, skills, git-tracking
**置信度**: high

skills/ 下残留 12 个空子目录（architect / backend / ceo / data / data-patterns / devops / frontend / qa / security / security-patterns / super-nexus-engineering / project-development-quality-maintainability）。git 不跟踪空目录，所以 CI、引用校验、commit diff 都看不到，但 `ls skills/` 让外部看到"23 个 skill"（实际只有 11 个）。

**触发条件**: 历史实验创建目录后未清理
**推荐动作**: 定期 `find <dir> -maxdepth 1 -type d -empty` 扫描并 rmdir；CI 加目录卫生检查
**反模式**: 依赖 git 追踪来发现目录漂移

---

### Agent subagent 上下文溢出

**日期**: 2026-04-09
**标签**: agent, context-window, quest-designer
**置信度**: high

quest-designer.md 曾达 746 行，作为 subagent 加载时挤占上下文窗口，导致 50+ 次 agent 调度全部失败（成功率 0%）。

**触发条件**: agent .md 文件超过 400 行
**推荐动作**: 将 JSON schema 引用 `_shared-principles.md`，移除项目特定示例，保持 agent .md < 450 行
**反模式**: 在 agent .md 中内联完整 JSON schema 和大段示例代码

---

### store.json 脏数据污染 SCAN

**日期**: 2026-04-09
**标签**: memory, scan, stale-data
**置信度**: high

store.json 残留旧 JS 运行时的路径引用（`src/router/canonical-router.js` 等已删除文件）和 100% 失败的 agent_result 记录。SCAN 阶段读取后被误导。

**触发条件**: 项目架构大幅变更后未重置 store.json
**推荐动作**: 架构迁移后清理 store.json，只保留 canonical 格式数据
**反模式**: 在 store.json 中累积永不清理的历史记录

---

### 协议 schema 多处重复导致不一致

**日期**: 2026-04-09
**标签**: protocol, duplication, maintenance
**置信度**: high

QuestMap/QuestResult/VerifyReport/LearnCard 的 JSON schema 曾同时出现在 auto.md、_shared-principles.md、quest-designer.md 三处，修改一处忘记同步其他导致字段不一致。

**触发条件**: 协议对象定义出现在多个文件中
**推荐动作**: schema 只在 `_shared-principles.md` 定义一次，其他文件用引用
**反模式**: 在多个 .md 文件中复制粘贴完整 JSON schema

---

### 纯 MD 仓库 VERIFY 要按可执行子集调整 gate

**日期**: 2026-04-18
**标签**: verify-gate, markdown-repo, strategy-adaptation
**置信度**: high

"实现"策略默认要求 build+test+lint+coverage，但 auto-cli 是纯 MD 指令仓库，仅 `format:check` 与 JSON 合法性可跑。

**触发条件**: 在无 build/test 的仓库跑 /auto 实现任务
**推荐动作**: VerifyReport 明确标记 skipped gate 与原因；必须 pass 的是 format + JSON + 引用一致性
**反模式**: 机械按"实现=必须过 build+test"，在纯 MD 仓库会导致 VERIFY 误判失败
**来源**: run-1776525672

---
