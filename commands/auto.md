---
description: 智能超级命令 - 上下文扫描 + Quest设计 + 逐关执行 + 验证 + 提交 + 知识沉淀
---

# /auto — 智能超级命令

> 上下文扫描 → Quest设计 → 逐关执行 → 验证 → 提交 → 知识沉淀

---

## 三模式执行

根据任务复杂度自动选择：

| 条件 | 模式 | 执行路径 |
|------|------|----------|
| 1文件 且 <=10行变更 | **微型模式** | 直接执行 → 相关测试 → 提交 → 结束 |
| <=3文件 且 无架构变更 | **轻量模式** | PHASE 1 → 简化 Quest 分析 → 直接执行 → PHASE 4(简化) → PHASE 6 |
| >3文件 或 有架构变更 | **完整模式** | 完整 6 PHASE |

---

## PHASE 1: DISCOVER — 扫描 + 能力清单

1. 检测技术栈（package.json / pom.xml / go.mod 等）
2. 列出可用能力（commands, agents, skills, hooks 元数据）
3. 收集源码结构（优先读 REPO_MAP.md）
4. Agent 匹配：使用 `/auto:route` 路由到合适的 Agent

```
TodoWrite([
  { content: "任务: [需求摘要]", status: "completed" },
  { content: "技术栈: [tech]", status: "completed" },
  { content: "能力: [N] cmd, [N] agent, [N] skill, [N] hook", status: "completed" },
  { content: "执行模式: [微型/轻量/完整]", status: "completed" }
])
```

---

## PHASE 2: REASON — Quest 设计

调用 quest-designer Agent（微型模式跳过）：

- **微型模式**：直接执行，无需 Quest Map。
- **轻量模式**：简化 Quest 分析（影响文件 + 执行顺序 + 风险评估）。
- **完整模式**：完整 Quest Map。

等待用户确认后进入下一阶段。

---

## PHASE 3: EXECUTE — 逐关执行（完整模式）

| 规模 | 模式 | Token 成本 |
|------|------|-----------|
| 1-5 关 | 单 Agent 串行 | 1x |
| 6-15 关 | Subagent 并行 | 2-3x |
| 15+ 关 | Agent Teams | 3-10x |

每关流程：Read 代码 → Write/Edit → 补 import → 编译验证 → 增量提交。
失败：回滚 → 修复 → 重试（最多 2 次）。

---

## PHASE 4: VERIFY — 门禁

| 模式 | 要求 |
|------|------|
| 微型 | 编译通过 + 相关测试通过 |
| 轻量 | 编译通过 + 相关测试通过 + lint 无错 |
| 完整 | 编译/构建 → 全量测试 → 覆盖率 >= 80% → 安全扫描 |

失败：修复(1) → 替代方案(2) → `git checkout -- .` 回滚(3)

---

## PHASE 5: COMMIT — 增量提交（完整模式）

每关通过后 `git add [当前 Quest 文件] && git commit`。
只 add 当前 Quest 涉及的文件。

---

## PHASE 6: LEARN — 知识沉淀

CLI 可用时运行 `auto save insight` 保存经验。
CLI 未安装时，知识暂存本地，待 CLI 就绪后补录。
核心架构变更时 → `/auto:update-codemaps`。

---

## 核心原则

1. **一个入口** — /auto 完成所有事情
2. **按规模执行** — 微型/轻量/完整三级，小任务不浪费
3. **原子化验收** — 每关有验收标准，失败可回滚
4. **可回溯** — 每步 Git Commit
5. **知识沉淀** — 越用越强
