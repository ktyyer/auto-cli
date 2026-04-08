---
description: 智能超级命令 - 上下文扫描 + Quest设计 + 逐关执行 + 验证 + 总结 + 知识沉淀
---

# /auto — 智能超级命令

> 上下文扫描 → Quest设计 → 逐关执行 + 验证 + 总结 + 知识沉淀

---

## 四模式执行

根据任务复杂度自动选择：

| 条件                  | 模式         | 执行路径                                                                                     |
| --------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| 0文件变更（纯探索）   | **探索模式** | PHASE 1 → PHASE 2（思考摘要 + 单关探索 Quest）→ 展示 Quest → 回答 → PHASE 5（总结）→ PHASE 6 |
| 1文件 且 <=10行变更   | **微型模式** | PHASE 1 → PHASE 2（完整思考摘要 + 单关 Quest）→ 微型执行 → PHASE 4 → PHASE 5 → PHASE 6       |
| <=3文件 且 无架构变更 | **轻量模式** | PHASE 1 → PHASE 2（完整思考摘要 + 精简 Quest）→ 直接执行 → PHASE 4 → PHASE 5 → PHASE 6       |
| >3文件 或 有架构变更  | **完整模式** | PHASE 1 → PHASE 2（完整思考摘要 + 完整 Quest Map）→ PHASE 3 → PHASE 4 → PHASE 5 → PHASE 6    |

---

## 自检机制

每个 PHASE 开始前，必须确认上一 PHASE 的产出存在。不存在则回退执行上一 PHASE。

| PHASE   | 前置产出检查                           |
| ------- | -------------------------------------- |
| PHASE 2 | TodoWrite 已创建 + DISCOVER 报告已输出 |
| PHASE 3 | Quest 卡片已向用户展示                 |
| PHASE 4 | 代码变更已写入（探索模式除外）         |
| PHASE 5 | 验证报告已输出（探索模式除外）         |
| PHASE 6 | 完成总结已输出                         |

---

## PHASE 1: DISCOVER — 扫描 + 能力清单

### 1.1 缓存检查

```bash
# 检查能力快照缓存是否存在且在 24h 内
test -f .auto/cache/capability-snapshot.json && \
  find .auto/cache/capability-snapshot.json -mtime -1 -exec echo "CACHE_HIT" \;
```

命中缓存 → 读取快照，跳到 1.4 输出报告。
未命中 → 执行 1.2-1.3 完整扫描。

### 1.2 技术栈 + 能力清单（并行扫描）

```
Glob("REPO_MAP.md") → 如存在则 Read（跳过源码扫描）
Glob("package.json") / Glob("pom.xml") / Glob("go.mod") / Glob("requirements.txt") / Glob("Cargo.toml")
  → 匹配任一即确定技术栈 → Read 获取依赖和 scripts
Glob("CLAUDE.md") → Read（如存在）

Glob("~/.claude/commands/auto/*.md") → 提取子命令列表
Glob("~/.claude/agents/*.md") → Grep 提取 frontmatter 元数据（name, description）
Glob("~/.claude/skills/*.md") → Grep 提取标题和描述
Read("~/.claude/hooks/hooks.json") → 统计 hook 类型数量
```

### 1.3 环境快检

```bash
node --version 2>/dev/null || echo "Node.js: NOT_FOUND"
git status --porcelain 2>/dev/null | head -5 || echo "Git: NOT_REPO"
test -f CLAUDE.md && echo "CLAUDE.md: EXISTS" || echo "CLAUDE.md: MISSING"
test -d node_modules && echo "deps: INSTALLED" || echo "deps: MISSING"
```

### 1.4 Agent 路由

使用 `/auto:route` 路由到合适的 Agent，输出推荐 Agent + 回退链。

### 1.5 写入能力快照

```bash
mkdir -p .auto/cache
# 将扫描结果写入 .auto/cache/capability-snapshot.json
# 包含: tech_stack, capabilities, environment, timestamp
```

**门禁**：必须向用户输出 DISCOVER 报告后 → 进入 PHASE 2。禁止跳过 PHASE 2 直接编辑代码。

```
TodoWrite([
  { content: "任务: [需求摘要]", status: "completed" },
  { content: "技术栈: [tech]", status: "completed" },
  { content: "能力: [N] cmd, [N] agent, [N] skill, [N] hook", status: "completed" },
  { content: "执行模式: [探索/微型/轻量/完整]", status: "completed" }
])
```

### DISCOVER 输出模板（必须输出，不可省略）

```markdown
## DISCOVER 扫描结果

### 技术栈检测

- 语言/框架：[检测结果]
- 构建工具：[检测结果]

### 能力清单

| 类型     | 数量 | 列表            |
| -------- | ---- | --------------- |
| Commands | {n}  | [command names] |
| Agents   | {n}  | [agent names]   |
| Skills   | {n}  | [skill names]   |
| Hooks    | {n}  | [hook types]    |

### 环境快检

| 检查项    | 状态                 |
| --------- | -------------------- |
| Node.js   | v{version} PASS/FAIL |
| 依赖安装  | INSTALLED/MISSING    |
| Git 状态  | CLEAN/DIRTY          |
| CLAUDE.md | EXISTS/MISSING       |

### 执行模式判定

**模式**：[探索/微型/轻量/完整]
**理由**：[判定依据]
```

---

## PHASE 2: REASON — Quest 设计 + Skill 注入 + 知识检索

### 2.1 知识检索（读回历史经验）

在分析前先搜索相关历史知识，实现闭环：

```bash
# 搜索历史经验（每个分类最多 3 条）
grep -r -l "[用户需求关键词]" .auto/insights/ 2>/dev/null | head -5
# 对匹配文件 Read 前 50 行，提取相关经验摘要
```

将搜索到的历史经验注入 quest-designer 的上下文。

### 2.2 Skill 匹配

```bash
# 关键词匹配可用 Skill
grep -l "[任务关键词]" ~/.claude/skills/*.md 2>/dev/null
```

匹配的 Skill 名称注入 Quest 的 `skills` 字段。

### 2.2a Phase-Skill 自动映射

除了关键词匹配，以下 Skill 按阶段自动注入：

| Phase    | 自动注入 Skill                      | 注入方式                                  |
| -------- | ----------------------------------- | ----------------------------------------- |
| DISCOVER | dependency-analyzer, init-project   | 如 CLAUDE.md 缺失则触发 init-project      |
| REASON   | workflow-patterns                   | Quest 设计参考                            |
| EXECUTE  | 按关键词动态匹配                    | Skill 内容写入 Agent prompt               |
| VERIFY   | code-style-enforcer, error-patterns | code-reviewer/verification Agent 自动附带 |
| COMMIT   | git-workflow                        | 提交信息格式参考                          |
| LEARN    | —                                   | 无额外注入                                |

### 2.3 按模式生成 Quest

- **探索模式**：跳过 quest-designer Agent 调用，自行生成思考摘要与单关探索 Quest（0 changedFiles，acceptanceCriteria 为回答完整性），按下方模板展示分析结果后回答用户问题，不进入执行/验证阶段。
- **微型模式**：跳过 quest-designer Agent 调用，自行生成完整思考摘要与单关 Quest，再自动进入执行。
- **轻量模式**：调用 quest-designer Agent 输出精简版（影响文件 + 执行顺序 + 风险评估），完整展示后再执行。
- **完整模式**：调用 quest-designer Agent 输出完整 Quest Map（分析/设计 → 核心实现 → 验证测试），展示后自动执行。

### 2.4 quest-designer 调用上下文模板

轻量/完整模式调用 quest-designer Agent 时，必须组装以下上下文：

```
Agent({
  subagent_type: "quest-designer",
  prompt: "
【用户需求】[原始需求描述]
【技术栈】[语言+框架]
【项目规范】[CLAUDE.md 存在/缺失]
【能力清单】
  Commands: [name + description]
  Agents: [name + description]
  Skills: [name + description]
  Hooks: [类型数量]
【现有代码文件】[源码路径列表]
【历史经验】（来自 .auto/insights/）
  [匹配的历史经验摘要，每条最多 200 字]
【Router 推荐】主 Agent：<name> | 回退链：<fallbacks>
  "
})
```

**门禁**：必须向用户输出 Quest 卡片后 → 进入下一阶段。禁止在 PHASE 2 内部消化 Quest 后直接回答或编辑代码。Quest 卡片是面向用户的输出，不是内部推理步骤。

每个 Quest 包含：`id, title, description, keywords, complexity, changedFiles, acceptanceCriteria, decisionNotes, skills, agent`。

### 探索模式输出模板（必须输出，不可省略）

```markdown
## 探索分析

### 任务理解

[一句话说明任务目标]

### 分析路径

- [扫描了哪些文件/目录]
- [关注了哪些关键代码段]

### 历史经验（如有）

- [来自 .auto/insights/ 的相关经验摘要]

### Quest explore-1：[探索目标]

- 描述：[具体探索动作]
- 关注文件：[文件路径列表]
- 验收标准：回答完整覆盖用户问题
```

### 微型/轻量模式输出模板（必须输出，不可省略）

```markdown
## 执行前摘要：[需求摘要]

### 任务理解

[一句话说明任务目标]

### 模式判定理由

[为什么是微型/轻量模式]

### 风险与边界

- [关键风险]
- [不可越界范围]

### Quest light-1：[目标]

- 描述：[具体动作]
- 影响文件：[文件路径列表]
- 验收标准：[可验证结果]
- 决策笔记：[为什么这样做]
- 预判坑点：
  1. [基于代码分析的具体坑点]
```

微型模式至少输出一关 Quest，不能跳过 Quest 展示。

---

## PHASE 3: EXECUTE — 逐关执行

| 规模    | 模式          | Token 成本 |
| ------- | ------------- | ---------- |
| 1-5 关  | 单 Agent 串行 | 1x         |
| 6-15 关 | Subagent 并行 | 2-3x       |
| 15+ 关  | Agent Teams   | 3-10x      |

每关流程：Read 代码 → Write/Edit → 补 import → 编译验证。
失败：回滚 → 修复 → 重试（最多 2 次）。
Quest 间检查上下文窗口 → 若接近溢出则生成会话摘要 + 续接指令。
每关完成后：

- 将执行结果记录到 `.auto/memory/quest-{id}.json`（后续会话可查询）
- 使用 `Grep` / `Glob` 替代手动搜索相关代码

### 逐关执行输出要求（强制，不可省略）

每关完成后 **必须** 向用户输出进度卡片：

```markdown
## Quest [id]：[title] — [PASS/FAIL]

### 执行结果

| 操作          | 文件       | 状态      |
| ------------- | ---------- | --------- |
| CREATE/MODIFY | [文件路径] | OK/FAILED |

### 验证结果

| #   | 验证点     | 命令   | 结果      |
| --- | ---------- | ------ | --------- |
| 1   | [验收标准] | [命令] | PASS/FAIL |

### 进度

已完成：[n]/[total] 关 | 成功：[n] | 失败：[n]
```

**失败/重试时额外输出**：

```markdown
### Quest [id] 执行失败 — 正在重试 (1/2)

**错误**：[错误描述]
**修复策略**：[策略描述]
```

**TodoWrite 同步要求**：每关开始时将该 Quest 的 TodoWrite 状态设为 `in_progress`，完成时设为 `completed`，失败设为 `pending`。

**门禁**：每关进度卡片输出后 → 才能开始下一关。所有关完成并输出总览卡片后 → 进入 PHASE 4。

---

## PHASE 4: VERIFY — 门禁

| 模式 | 要求                                            |
| ---- | ----------------------------------------------- |
| 探索 | 无代码变更，跳过验证阶段                        |
| 微型 | 编译通过 + 相关测试通过                         |
| 轻量 | 编译通过 + 相关测试通过 + lint 无错             |
| 完整 | 编译/构建 → 全量测试 → 覆盖率 >= 80% → 安全扫描 |

失败自动路由: 每个失败 Quest 自动路由到 `build-error-resolver` agent。

### 验证执行

```bash
# 按模式选择验证命令
# 微型: npm test / mvn test / go test
# 轻量: npm test && npm run lint
# 完整: npm run build && npm test -- --coverage && npm run lint && npm audit
```

失败处理: 修复(1) → 替代方案(2) → `git checkout -- .` 回滚(3)

### 验证输出模板（必须输出，不可省略）

```markdown
## 验证报告

### 验证模式：[探索/微型/轻量/完整]

### 验证结果

| #   | 验证项    | 命令/方法 | 结果      | 详情             |
| --- | --------- | --------- | --------- | ---------------- |
| 1   | 编译/构建 | [命令]    | PASS/FAIL | [输出摘要]       |
| 2   | 单元测试  | [命令]    | PASS/FAIL | [通过率]         |
| 3   | 覆盖率    | [命令]    | [n]%      | >= 80% PASS/FAIL |
| 4   | Lint      | [命令]    | PASS/FAIL | [错误数]         |
| 5   | 安全扫描  | [方法]    | PASS/FAIL | [发现数]         |

### 总结

- 通过：[n] 项 / 失败：[n] 项
- 判定：ALL PASS / HAS FAILURES
```

**失败时额外输出**：

```markdown
### 验证失败处理

| #   | 失败项   | 修复状态             |
| --- | -------- | -------------------- |
| 1   | [验证项] | 修复中/已修复/已回滚 |
```

**门禁**：必须向用户输出验证报告后 → 进入 PHASE 5。全部通过或经修复后通过才能继续；3 次修复仍失败 → 回滚并终止，输出失败报告。

---

## PHASE 5: SUMMARIZE — 完成阶段总结

所有 Quest 执行并验证完成后，向用户输出本次工作流的变更总结。不自动提交，由用户决定是否提交。

### 完成总结输出模板（必须输出，不可省略）

```markdown
## 完成总结

### 执行概览

- **模式**：[探索/微型/轻量/完整]
- **完成 Quest**：[n]/[total]
- **验证结果**：ALL PASS / [n] FAILURES

### 变更文件清单

| #   | 文件       | 操作                 | 说明       |
| --- | ---------- | -------------------- | ---------- |
| 1   | [文件路径] | CREATE/MODIFY/DELETE | [变更摘要] |

### 统计

- 变更文件：[n] 个 | 新增：[+]行 | 删除：[-]行
```

**探索模式（无代码变更）输出**：

```markdown
## 完成总结

- **模式**：探索
- **变更文件**：0（纯阅读/分析）
```

**门禁**：必须向用户输出完成总结后 → 进入 PHASE 6。如用户要求提交，再执行 git commit。

---

## PHASE 6: LEARN — 知识沉淀

### 6.1 收集执行摘要

从 TodoWrite 获取执行结果，提取已完成和失败的 Quest。

### 6.2 保存经验到知识库

将经验按三类保存到 `.auto/insights/` 目录：

**踩坑记录**（失败 Quest）：

```bash
mkdir -p .auto/insights
# 写入 .auto/insights/traps.md（追加模式）
# 包含: 时间、失败关卡、失败详情、教训
```

**成功模式**（完成 Quest）：

```bash
# 写入 .auto/insights/patterns.md（追加模式）
# 包含: 时间、完成关卡、关键模式
```

**架构决策**（涉及架构变更的 Quest）：

```bash
# 写入 .auto/insights/decisions.md（追加模式）
# 包含: 时间、变更内容、决策理由
```

### 6.3 更新项目记忆

将本次执行摘要追加到项目记忆（Claude Code 的 Memory 系统），格式：

```markdown
- [{日期}] {任务摘要}: {n} 关完成, {n} 关失败, 关键经验: [摘要]
```

### 6.4 架构变更检测

```bash
# 对比 REPO_MAP.md 与实际源码结构
# 如检测到架构变更 → 记录 pending_doc_update → 建议运行 /auto:update-codemaps
```

### 6.5 Agent 反馈记录

将本次 Agent 路由结果写入反馈文件，供下次 PHASE 1 路由参考：

```bash
# 追加到 .auto/insights/agent-feedback.md
# 格式: [{日期}] agent={name} | task={摘要} | result={SUCCESS/FAIL} | reason={原因}
```

PHASE 1 的 `/auto:route` 在路由时应先检索此文件，优先推荐历史成功率高的 Agent。

### 6.6 Git 模式分析

调用 `/auto:learn` 分析提交约定、热点文件和文件联动。

**门禁**：必须向用户输出工作流总结后 → 工作流结束。这是面向用户的最终交付物，不可省略。

### 工作流总结输出模板（必须输出，不可省略）

```markdown
## 工作流完成

### 执行概览

| 指标       | 值                      |
| ---------- | ----------------------- |
| 执行模式   | [探索/微型/轻量/完整]   |
| 完成 Quest | [n]/[total]             |
| 验证结果   | ALL PASS / [n] FAILURES |

### 知识沉淀

| 类型     | 数量   | 摘要     |
| -------- | ------ | -------- |
| 踩坑记录 | [n] 条 | [关键词] |
| 成功模式 | [n] 条 | [关键词] |
| 架构决策 | [n] 条 | [关键词] |

### 架构变更检测

- 检测结果：[无变更 / 检测到变更]
- 文档更新：[已触发 / 无需更新]

### 下次可用

下次执行 /auto 时，PHASE 2 会自动检索本次沉淀的经验，实现闭环。
```

---

## Session Continuity（会话续接）

当上下文窗口溢出时自动触发：

1. 生成会话摘要：捕获 任务 + 待办 + 错误 + 当前工作状态
2. 生成续接指令：包含足够信息让新会话无缝继续
3. 新会话使用续接指令自动继续工作（不确认/不回顾/不提问）
4. 摘要包含 9 节结构，所有用户消息原文保留

---

## 核心原则

1. **一个入口** — /auto 完成所有事情
2. **按规模执行** — 探索/微型/轻量/完整四级，小任务不浪费
3. **原子化验收** — 每关有验收标准，失败可回滚
4. **可回溯** — 每步可追溯
5. **知识闭环** — 经验持续沉淀 + 检索复用，越用越强
6. **自动编排** — 验证/记忆/摘要/文档更新 全部由 auto 自动触发
7. **结果持久化** — 执行结果写入 `.auto/` 目录，跨会话可查询
