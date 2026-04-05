---
name: shared-principles
description: Agent 公共原则和交接协议 — 通用工作流、报告格式、Agent 间交接路径和边界约束
tags: [shared, protocol, handoff, agent, principles]
---

# Agent 公共原则

> 此文件定义所有 Agent 共享的基础原则。各 Agent .md 文件无需重复这些内容。

## 通用工作流

1. **Read 先行** — 修改前必须先读取目标文件，理解现有代码
2. **最小改动** — 只改需要改的，不做"顺手"重构
3. **增量验证** — 每次修改后运行相关测试确认无回归
4. **风格继承** — 严格遵循项目既有的编码风格和命名约定

## 报告格式

所有 Agent 输出报告时遵循统一结构：
1. 摘要（问题数量/严重级别）
2. 详情（按严重级别排序）
3. 修复建议（具体到文件和行号）
4. 验证步骤

## Agent 间交接协议

### 交接上下文格式

Agent 向下游传递结果时，使用以下标准结构：

```markdown
## Agent 交接

**来源**: {当前 Agent 名称}
**目标**: {下游 Agent 名称}
**任务**: {原始任务描述}

### 完成状态
- 状态: completed | partial | failed
- 产出文件: {文件列表}
- 变更摘要: {简要说明改了什么}

### 传递给下游
- 关键决策: {决策列表}
- 待处理: {下游需要处理的事项}
- 注意事项: {边界条件、已知问题}
```

### 交接路径

完整 Handoff 路径：

用户意图 → CanonicalRouter → [主 Agent]

触发条件映射：
- architect: 架构/系统/重构/迁移 关键词
- quest-designer: 规划/任务拆解/Quest 设计
- tdd-guide: 测试/TDD/覆盖率 关键词
- code-reviewer: 审查/质量/code-review 关键词（自动：Agent 写代码后）
- verification: 验证/边界/对抗/测试 关键词
- security-reviewer: 安全/漏洞/注入/密钥 关键词
- build-error-resolver: 编译失败/类型错误/构建错误（自动：Quest 执行失败时）
- e2e-runner: E2E/Playwright/端到端 关键词
- doc-updater: 文档/README/代码地图 关键词（自动：架构变更时）
- refactor-cleaner: 清理/死代码/重构/unused 关键词

标准流程：
1. architect → quest-designer → [tdd-guide | code-reviewer] → verification
2. 失败时: → build-error-resolver（重试 2 次后自动路由）
3. 安全场景: → security-reviewer（安全敏感关键词触发 +50 分提升）
4. 质量场景: code-reviewer → security-reviewer（安全升级 handoff）
5. 架构变更: → doc-updater（Phase 6 自动检测触发）
6. 死代码: → refactor-cleaner（deletion-log 触发）
7. E2E: tdd-guide → e2e-runner（Playwright 检测到时 handoff）

### 交接规则

1. **单向传递** — Agent 只向下游传递，不反向调用
2. **完整上下文** — 交接时包含原始任务 + 已做决策 + 待办事项
3. **失败升级** — 重试 2 次后仍失败 → 路由到 build-error-resolver
4. **结果回传** — 最终结果回传给编排器，不直接回传给上游 Agent

## 边界约束

- 不修改与任务无关的文件
- 不添加未请求的新功能
- 不改动项目的配置文件（除非任务明确要求）
- 遵守 .claude/rules/ 中的编码规范
