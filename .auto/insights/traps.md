# 踩坑经验和问题排查

> LEARN 阶段自动维护，记录已验证的踩坑经验。

### .auto/cache/ legacy 文件描述已删除运行时

**日期**: 2026-04-19
**标签**: cache, stale-data, scan-pollution
**置信度**: high

`.auto/cache/knowledge-runtime-v1.md` 仍引用 `src/hooks/*` JS 文件（v0.31.0 已删除），`.auto/cache/optimization-lessons.md` 不在 canonical 清单。cache 层是可丢弃缓存，但 legacy 残留会被 SCAN 误读为"当前事实"。

**触发条件**: 架构迁移后 cache/ 未同步清理
**推荐动作**: cache/ 按 canonical 白名单（capability-snapshot.json、pattern-cards.json）保留，其余归档或删除
**反模式**: cache/ 堆积历史文件当"知识"使用
**来源**: 20260419-201905

---

### REPO_MAP 与 README 能力计数漂移

**日期**: 2026-04-19
**标签**: doc-drift, single-source-of-truth
**置信度**: high

REPO_MAP.md 写 skills "11 个"、hooks "17 个"；实际 12 / 18（skill-evaluator 新增未录入，PostToolUse 从 6 加到 7）。README 已更新但 REPO_MAP 落后一次迭代。

**触发条件**: 新增 agent/skill/hook 时只改 README 未改 REPO_MAP
**推荐动作**: 发布前 checklist 强制 REPO_MAP + README 计数一致；或写 `scripts/sync-counts.js` 自动校验
**反模式**: 把 README 当唯一真源，REPO_MAP 自生自灭
**来源**: 20260419-201905

---

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

### Explore agent 网络调研：中转网关 500 时立即降级主窗口 WebSearch
**标签**：agent-failure, network-research, fallback-path
**触发条件**：Agent 任务返回含 `API Error: 500 Panic detected (Calcium-Ion/new-api)`
**症状**：4 路并行 Explore agent 全部约 3 分钟后报 500 失败
**反应**：
1. 立即 TaskStop 任何同类 agent（避免 same_path 重试）
2. 主窗口直接 WebSearch / WebFetch（alternative_path）
3. 每搜一次立即结构化压缩 ≤ 30 行写盘
**来源**：run-20260508-ecosystem-scan

### 新建 markdown 文件后必须立即 prettier --write
**标签**：prettier, format-check, new-file, lint-flow
**触发条件**：format:check 报 Code style issues found in N files
**症状**：Write 工具不套 Prettier，新文件首次必然挂 lint
**反应**：先 npx prettier --write 文件路径，再跑 npm run check
**根因**：Prettier 是 lint 代理（已记录），但 Write 工具首次走原始内容
**来源**：run-20260508-p0skills

### Bash heredoc 写大文件遇反引号 + 复杂表格撞 EOF 解析
**标签**：bash-heredoc, large-write, backtick-eof
**触发条件**：cat > file << 'EOF' ... EOF 内容含 ` 反引号代码块 + 多表格时偶发 EOF 提前关闭
**症状**：unexpected EOF while looking for matching ' (line N)
**反应**：拆成多个独立 cat heredoc 分批 append，每段 < 80 行
**来源**：run-20260508-perfect-loop
