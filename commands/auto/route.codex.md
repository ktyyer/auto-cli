---
name: auto:route
description: Codex 版任务路由器 - 基于用户意图、项目上下文和本地 skills 生成可执行 RouteDecision
---

# /auto:route — Codex 路由

> 目标：让 Codex 在真正开始执行前，先判断任务类型、复杂度、技能激活和验证路径。

---

## 用途

这个命令只做路由，不直接改代码。

它要回答 5 个问题：

1. 这是探索、修复、实现还是重构
2. 复杂度高不高
3. 需要激活哪些 skills
4. 应该直接执行还是拆步骤执行
5. 最终该怎么验证

---

## Codex 运行时约束

- 不依赖 `~/.claude/agents`
- 不假设存在 `quest-designer`、`verification`、`build-error-resolver` 这些自定义 Agent runtime
- 默认由当前主代理执行
- 只有用户明确要求多 agent / 并行协作时，才规划 `spawn_agent`

---

## 路由输入

路由时优先读取：

1. 用户当前需求
2. `README.md`、`CLAUDE.md`、`REPO_MAP.md`
3. `.auto/cache/capability-snapshot.json`（若存在）
4. 技术栈文件：`package.json` / `pom.xml` / `go.mod` / `requirements.txt` / `Cargo.toml`
5. 仓库内 `commands/**/*.md` 与 `skills/*/SKILL.md`
6. `.auto/feedback/agents.json`、`.auto/feedback/skills.json`
7. `.auto/insights/*` 和最近一次 run 的关键工件（如存在）

---

## 路由逻辑

### 1. 策略判定

按用户意图判断：

- `探索`：分析、审查、解释、建议、定位范围
- `修复`：bug、错误、测试失败、构建失败、小范围调整
- `实现`：新功能、接口、脚本、文档能力扩展
- `重构`：结构调整、模块拆分、迁移、去重、架构整理

### 2. 强制 skill 规则

命中以下场景时必须激活：

- bug / error / test fail / build fail → `systematic-debugging`，并按需追加 `error-patterns`
- 实现 / 重构 → `test-plan-writer`
- 需求不明确或存在多种合理路径 → `requirement-clarifier`
- skill 触发诊断 / skill 质量优化 → `skill-evaluator`
- 新框架 / 第三方能力 / 版本兼容 → `research-analyst`
- API / 接口规范 → `api-design`
- 代码结构理解是前置条件且项目不是纯 Markdown → `code-analyzer`

### 3. 执行模式

- `direct`：小任务，主代理直接做
- `phased`：需要 SCAN → PLAN → EXECUTE → VERIFY 顺序推进
- `delegated`：只有用户明确要求多 agent 时才选

### 4. 验证路径

最少给出：

- `analysis`
- `build`
- `test`
- `lint`
- `regression`
- `knowledge-reuse`

只列真正适用的 gate，不要机械全选。

---

## 输出格式

输出 `RouteDecision` 风格的结构化结果，至少包含：

```json
{
  "id": "route-<id>",
  "runId": "run-<id>",
  "correlationId": "corr-<id>",
  "status": "success | partial | failed",
  "summary": "一句话路由摘要",
  "userIntent": "一句话任务理解",
  "strategy": "explore | fix | implement | refactor",
  "primaryAgent": "main",
  "skills": ["skill-name"],
  "next": "PLAN | ASK_USER | ABORT",
  "complexity": "low | medium | high",
  "executionMode": "direct | phased | delegated",
  "riskLevel": "low | medium | high",
  "skillReasons": {
    "skill-name": "为什么命中"
  },
  "selectedFiles": ["优先要读的文件或目录"],
  "capabilityInputs": ["本次路由复用的能力索引或清单"],
  "verifyGates": ["analysis", "test"],
  "knowledgeInputs": ["会复用的 .auto 文件，若无则为空"],
  "notes": {
    "relevantInsights": ["<insight title or summary>"]
  },
  "selection": {
    "routeHintsUsed": ["<insight title>", "<feedback key>", "<related runId>"]
  },
  "assumptions": ["关键假设"],
  "openQuestions": ["仍需澄清的问题"]
}
```

如果需求已经足够清楚，`openQuestions` 可以为空。
如果存在关键歧义，先提问，不要输出伪确定性的路由。

如果本次声明使用了 `knowledge-reuse` gate，优先把命中的 insight 摘要写入 `notes.relevantInsights`，避免只口头说“复用了 insights / feedback”。
能引用真实目标时，`selection.routeHintsUsed` 可记录真实存在的 insight 标题、feedback key 或历史 runId，而不是占位或模糊描述。
如果仓库启用了弱相关性门禁，优先引用与当前任务文本明显同题的 `insight` 标题或历史 run goal，避免使用真实但明显不相干的引用凑数。

---

## 成功标准

- 路由结果能明确下一步该做什么
- skill 选择是基于任务和仓库事实，不是静态背诵
- 验证路径和任务类型一致
- 不把 Claude 专属机制错误映射成 Codex 现有能力
