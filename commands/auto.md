---
description: 智能超级命令 - 上下文扫描 + Quest设计 + 逐关执行 + 验证 + 提交 + 知识沉淀
---

# /auto — 智能超级命令

> 上下文扫描 → Quest设计 → 逐关执行 + 验证 + 提交 + 知识沉淀

---

## 三模式执行

根据任务复杂度自动选择：

| 条件 | 模式 | 执行路径 |
|------|------|----------|
| 1文件 且 <=10行变更 | **微型模式** | 直接执行任务 → 相关测试 → 知识沉淀 → 结束 |
| <=3文件 且 无架构变更 | **轻量模式** | PHASE 1 → 简化 Quest Map → 直接执行 → PHASE 4(简化) → PHASE 6 |
| >3文件 或 有架构变更 | **完整模式** | 完整 6 PHASE |

---

## PHASE 1: DISCOVER — 扫描 + 能力清单

1. 检测技术栈（package.json / pom.xml / go.mod 等）
2. 列出可用能力（commands, agents, skills, hooks 元数据）
3. 收集源码结构（优先读 REPO_MAP.md）
4. Agent 匹配：使用 `/auto:route` 路由到合适的 Agent
5. 上下文窗口检测 → 若 OVERFLOW 则生成会话摘要 + 续接指令
6. **Hook 缺失检测**: 检查 hooks.json 配置并记录状态；默认只读扫描，不隐式写入项目文件
7. **环境快检**: 调用 `_runDoctorCheck()` 检查 Node.js 版本、依赖安装、Git 状态。结果记录到 `doctorResult`，不自动执行 `npm install`
8. **CLAUDE.md 检测**: 检查项目根目录是否有 CLAUDE.md。缺失时记录到 doctor issues，并在后续工作流中给出补齐建议

```
TodoWrite([
  { content: "任务: [需求摘要]", status: "completed" },
  { content: "技术栈: [tech]", status: "completed" },
  { content: "能力: [N] cmd, [N] agent, [N] skill, [N] hook", status: "completed" },
  { content: "执行模式: [微型/轻量/完整]", status: "completed" }
])
```

---

## PHASE 2: REASON — Quest 设计 + Skill 注入

- **微型模式**: `_runMicroExecute()` 直接执行任务，跳过 Quest Map 设计。
- **轻量模式**: `_generateQuestMap()` 生成简化 Quest（1关：影响文件 + 执行顺序 + 风险评估）。
- **完整模式**: `_generateQuestMap()` 生成完整 Quest Map（分析/设计 → 核心实现 → 验证测试）。

每个 Quest 包含：`id, title, description, keywords, complexity, changedFiles, acceptanceCriteria, decisionNotes, skills, agent`。

**Skill 注入**: `_extractKeywords()` 提取任务关键词 → `skillIndexer.search()` 匹配 → 匹配的 Skill 名称注入 Quest 的 `skills` 字段。

等待用户确认后进入下一阶段。

---

## PHASE 3: EXECUTE — 逐关执行

| 规模 | 模式 | Token 成本 |
|------|------|-----------|
| 1-5 关 | 单 Agent 串行 | 1x |
| 6-15 关 | Subagent 并行 | 2-3x |
| 15+ 关 | Agent Teams | 3-10x |

每关流程：Read 代码 → Write/Edit → 补 import → 编译验证 → 增量提交。
失败：回滚 → 修复 → 重试（最多 2 次）。
Quest 间压缩检查 → 若 OVERFLOW 则生成会话摘要 + 续接指令。
每关完成后：
- 记录合成消息到 `_messageAccumulator`（上限 50 条）
- **Agent 结果持久化**: `_persistAgentResult()` 记录到 MemoryManager（后续会话可查询）
- **RepoIndexer 搜索**: architect 等 Agent 使用 `_searchRepoIndex()` 替代手动 Glob/Read

---

## PHASE 4: VERIFY — 门禁

| 模式 | 要求 |
|------|------|
| 微型 | 编译通过 + 相关测试通过 |
| 轻量 | 编译通过 + 相关测试通过 + lint 无错 |
| 完整 | 编译/构建 → 全量测试 → 覆盖率 >= 80% → 安全扫描 |

失败自动路由: 每个失败 Quest 自动路由到 `build-error-resolver` agent，存储到 `verificationActions` 供 Claude Code 参考。

**验证结果持久化**: `last_verification` 写入 session memory，后续会话可查询上次验证状态。

失败处理: 修复(1) → 替代方案(2) → `git checkout -- .` 回滚(3)

---

## PHASE 5: COMMIT — 自动提交（按模式）

- **完整模式**: 所有 Quest 完成并通过验证后，在 PHASE 5 统一执行一次提交。
- **轻量/微型模式**: 所有任务完成后统一提交一次。

提交内容基于本次工作流累计的变更文件与决策信息生成，不保证每个 Quest 单独提交。

---

## PHASE 6: LEARN — 知识沉淀

1. **两轮记忆提取**: 从 `_messageAccumulator` 中自动提取用户偏好、错误修正、项目模式（上限 5 条）
2. **知识整理**: AutoDream 调度器执行 Orient → Gather → Consolidate → Prune
3. **经验持久化**: 将执行经验自动保存到 `.auto/insights/`（CLI 未安装时暂存本地，CLI 可用时运行 `auto save insight`）
4. **架构变更检测**: `_detectArchitectureChange()` → 记录 `pending_doc_update` 到 session memory → 触发 doc-updater 更新文档和 CODEMAPS
5. **Git 历史分析**: `_analyzeGitPatterns()` 分析提交约定、文件联动、热点文件
6. **DELETION_LOG**: `_generateDeletionLog()` 持久化删除记录到 `docs/DELETION_LOG.json`
7. **会话摘要**: 若本次执行生成了会话摘要，将 `sessionSummary` + `resumeDirective` 包含在结果中

下一会话可使用 `resumeDirective` 自动续接。

---

## Session Continuity（会话续接）

当上下文窗口溢出时自动触发：
1. `createSessionSummary()` 捕获: 任务 + 待办 + 错误 + 当前工作状态
2. `createResumeDirective()` 生成续接指令
3. 新会话使用 `resumeDirective` 自动继续工作（不确认/不回顾/不提问）
4. 摘要包含 9 节结构，所有用户消息原文保留

---

## 核心原则

1. **一个入口** — /auto 完成所有事情
2. **按规模执行** — 微型/轻量/完整三级，小任务不浪费
3. **原子化验收** — 每关有验收标准，失败可回滚
4. **可回溯** — 每步 Git Commit
5. **知识沉淀** — 越用越强
6. **自动编排** — 验证/记忆/摘要/文档更新 全部由 auto 自动触发
7. **结果持久化** — Agent 执行结果和验证状态写入 MemoryManager，跨会话可查询
