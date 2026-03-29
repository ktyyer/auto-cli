---
name: workflow-patterns
description: 开发工作流模式集合 - Plan Mode 工作流、Multi-Agent 编排、根因追踪方法论、10 维度代码审查清单
version: 1.0.0
author: auto-cli
tags: [workflow, plan-mode, orchestration, root-cause, debugging, patterns, agent, parallel, troubleshooting, review, checklist, quality, self-correction, verification]
---

# Workflow Patterns -- 开发工作流模式集合

> 四大核心方法论合一：Plan Mode 工作流选择、Multi-Agent 编排模式、结构化根因追踪、10 维度代码审查清单。
> 让 quest-designer 在 PHASE 2 自动匹配最优工作流。

---

## 一、Plan Mode 工作流（4 种）

### 工作流选择决策

| 信号关键词 | 工作流 | 上下文预算 |
|-----------|--------|-----------|
| 重构/迁移/架构/系统/redesign | Explore | 10-15 文件, 3000-5000 行 |
| 实现/开发/新增/功能/feature | Implement | 5-8 文件, 1500-3000 行 |
| bug/错误/失败/error/fix/修复 | Fix | 3-5 文件, 500-1500 行 |
| 审查/review/检查/安全/质量 | Review | 3-6 文件, 1000-2000 行 |

### 自动检测逻辑

```
用户意图 -> 关键词匹配:
  +--- [重构|迁移|全面|架构|系统|microservice] -> Explore
  +--- [实现|开发|新增|功能|feature|创建|接口] -> Implement
  +--- [bug|错误|失败|error|fix|修复|异常|debug] -> Fix
  +--- [审查|review|检查|安全|质量|PR] -> Review
  +--- 无匹配 -> 默认 Implement
```

### 与 Auto CLI 对应

| 工作流 | PHASE 1 | quest-designer | Canonical Router |
|--------|---------|----------------|------------------|
| Explore | 完整扫描（不用缓存） | 读取 10-15 文件 | 默认 quest-designer |
| Implement | 缓存优先 | 读取 5-8 文件 | 默认 quest-designer |
| Fix | 最小化 | 读取 3-5 文件 | 优先 build-error-resolver |
| Review | 缓存优先 | 读取 3-6 文件 | 优先 code-reviewer |

> 注：本 Skill 的工作流选择逻辑已由 `src/router/canonical-router.js` 的 COMPLEXITY_INDICATORS 实现，此处保留作为设计参考和人类可读文档。

---

## 二、Multi-Agent 编排模式（4 种）

### 选择决策树

```
任务是否可拆分？
+-- 否 -> 单 Agent（quest-designer）
+-- 是 -> 子任务之间是否有依赖？
    +-- 有依赖 -> Sequential Chain（串行链）
    +-- 无依赖 -> 需要总协调者吗？
        +-- 需要 -> Orchestrator-Workers（主从模式）
        +-- 不需要 -> Parallel Fan-Out（并行扇出）

质量要求特别高？-> 追加 Evaluator-Optimizer（评估优化）
```

### 模式详解

| 模式 | 流程 | 适用场景 | Quest 数量建议 |
|------|------|---------|--------------|
| Sequential Chain | A -> B -> C | 后一步依赖前一步输出 | 1-5 关 |
| Parallel Fan-Out | Router -> [A, B, C] | 子任务无依赖 | 6-15 关 |
| Orchestrator-Workers | 总指挥 -> 分配 -> 收集 | 复杂任务需协调 | 15+ 关 |
| Evaluator-Optimizer | 产出 -> 审查 -> 迭代 | 质量要求高（最多 3 轮） | 追加于任何模式 |

### 最佳实践

1. **上下文隔离**：每个子 Agent 只接收它需要的上下文
2. **并行 Agent 不修改同一文件**：如有冲突需串行化
3. **失败不阻塞**：单个 Agent 失败设定超时和重试
4. **结果聚合**：Union（审查类）/ Latest Wins（修复类）/ Vote（决策类）

---

## 三、根因追踪方法论（五步法）

> 修 Bug 不是打地鼠。从症状出发，逐步定位根因，确保修复源头而非表面。

### 五步流程

| 步骤 | 名称 | 输出格式 |
|------|------|---------|
| 1 | 症状描述 | 现象 + 触发条件 + 影响范围 + 复现步骤 |
| 2 | 假设生成 | 按可能性排序的原因列表（参考 error-patterns.md 速查） |
| 3 | 二分排除 | 最小验证实验表格（假设 -> 验证方法 -> 结论） |
| 4 | 根因确认 | 一句话根因 + 证据链 + 代码位置 |
| 5 | 修复 + 防复发 | 最小修复 + 测试覆盖 + 防复发检查 |

### 常见根因模式

| 模式 | 症状 | 定位方法 |
|------|------|---------|
| 依赖版本漂移 | 本地正常 CI 失败 | 对比 `npm ls`，检查 lock 文件 |
| 时序竞态 | 偶发性失败 | 检查 await、事件监听、回调顺序 |
| 状态泄漏 | 测试顺序影响结果 | 逐个运行测试，检查共享状态 |
| 隐式依赖 | 删代码后功能异常 | Grep 全项目搜索引用 |
| 编码不一致 | 特殊字符显示异常 | 检查所有数据流转环节的编码 |

### 工具辅助

| 工具 | 命令 |
|------|------|
| git bisect | `git bisect start` / `good` / `bad` |
| git diff | `git diff HEAD~1 -- src/file.js` |
| git log | `git log --oneline -20 -- src/file.js` |
| Node.js 调试 | `node --inspect-brk script.js` |

---

## 四、10 维度代码审查清单

> AI 写完代码后，再让它按清单自检一次，Bug 率降低 60%（社区实测数据）。
> 本清单提供 10 个维度的结构化审查，可与 PHASE 4 VERIFY 无缝集成。

### 核心理念

1. **AI 也能审查自己** -- 给它一个清单，它会逐项检查
2. **清单比直觉可靠** -- 人的直觉会遗漏，清单不会
3. **审查时机很重要** -- 写完代码立即审查，趁热打铁效果最好
4. **增量审查 > 全量审查** -- 每次只审查本次变更，不要审查整个文件

### 审查时机

| 场景 | 触发条件 | 使用方式 |
|------|---------|---------|
| 自动审查 | 每次 Edit/Write 后 | Hook 自动触发部分检查项 |
| 手动审查 | `/auto:code-review` | 完整 10 维度审查 |
| 提交前审查 | PHASE 5 COMMIT 前 | 精简版（维度 1-5） |
| PR 审查 | 创建 PR 时 | 完整 10 维度 + 安全专项 |

### 10 维度审查清单

#### 维度 1：功能正确性

```
审查项：
- [ ] 代码实现了需求描述的所有功能点
- [ ] 边界条件已处理（空值、零值、负数、超长字符串）
- [ ] 并发/竞态条件已考虑（如适用）
- [ ] 异步操作正确使用 await/Promise
- [ ] 返回值类型与接口定义一致

常见遗漏：
- 只处理了"快乐路径"，忘了错误路径
- 分页查询忘了处理 total=0 的情况
- 异步函数忘了 await 导致返回 Promise 而非结果
```

#### 维度 2：错误处理

```
审查项：
- [ ] 所有外部调用有 try-catch 包裹
- [ ] catch 块不是空的（至少有日志记录）
- [ ] 错误信息对用户友好（不暴露内部实现）
- [ ] 异常类型正确匹配（业务异常 vs 系统异常）
- [ ] 错误恢复策略合理（重试/降级/快速失败）

常见遗漏：
- catch (e) {} 空块 -- 最常见的问题
- 只捕获不处理，异常被"吞掉"
- 错误信息暴露数据库结构或内部路径
```

#### 维度 3：安全性

```
审查项：
- [ ] 用户输入已验证和清理
- [ ] SQL 使用参数化查询（不是字符串拼接）
- [ ] 无硬编码密钥/密码/Token
- [ ] 文件路径无目录遍历风险
- [ ] 敏感操作有权限检查
- [ ] 日志中不记录敏感信息

快速检查命令：
grep -rn "console.log\|print\|log.info" --include="*.js" --include="*.ts" | grep -i "password\|secret\|token\|key"
```

#### 维度 4：性能

```
审查项：
- [ ] 循环内无不必要的数据库查询（N+1 问题）
- [ ] 大数据集使用分页而非全量加载
- [ ] 无不必要的深拷贝
- [ ] 正确使用缓存（如适用）
- [ ] 异步操作可并行的已用 Promise.all

常见反模式：
- for 循环内 await（应该先 Promise.all 再 await）
- 列表查询后又在循环中逐个查询详情
- 大数组使用 .map().filter() 两次遍历（应该用 .reduce() 一次完成）
```

#### 维度 5：代码风格

```
审查项：
- [ ] 命名清晰且有语义（不用 a/b/c/tmp/var）
- [ ] 函数不超过 50 行
- [ ] 文件不超过 400 行
- [ ] 无深层嵌套（超过 3 层提取函数）
- [ ] 无重复代码（DRY 原则）
- [ ] 遵循项目既有的命名和格式风格

快速检查命令：
find src/ -name "*.js" -exec wc -l {} + | sort -rn | head -10
```

#### 维度 6：测试覆盖

```
审查项：
- [ ] 每个公共方法有对应的测试用例
- [ ] 测试覆盖了正常路径和异常路径
- [ ] 测试之间相互独立（不依赖执行顺序）
- [ ] Mock 使用合理（不过度 mock）
- [ ] 测试命名清晰（描述预期行为）
- [ ] 覆盖率 >= 80%

快速检查命令：
npm run coverage 2>/dev/null | grep "All files"
```

#### 维度 7：接口兼容性

```
审查项：
- [ ] 公共 API 接口没有破坏性变更
- [ ] 新增的参数有默认值（向后兼容）
- [ ] 删除的参数/方法有废弃过渡期
- [ ] 数据库 Schema 变更有迁移脚本
- [ ] 配置文件变更向后兼容

常见遗漏：
- 直接删除方法而不是先标记 @deprecated
- 修改了接口返回格式但没有通知调用方
```

#### 维度 8：可维护性

```
审查项：
- [ ] 复杂逻辑有注释说明"为什么"（不是"是什么"）
- [ ] Magic Number 提取为常量
- [ ] 职责单一（一个函数/类只做一件事）
- [ ] 依赖注入而非硬编码依赖
- [ ] 可配置项提取到配置文件

衡量标准：
- 新人能在 5 分钟内理解这段代码吗？
- 修改这个功能需要改几个文件？（理想情况 1-2 个）
```

#### 维度 9：文档

```
审查项：
- [ ] 公共方法有 JSDoc/docstring
- [ ] README 更新（如新增了配置项/命令/API）
- [ ] CHANGELOG 更新（记录变更内容）
- [ ] 类型定义更新（如修改了接口）
- [ ] 注释中的 TODO/FIXME 已处理或记录

审查规则：
- 不要写"无用文档"（如 /** set name */ 这种注释比没有还糟）
- 文档要写"为什么"，代码表达"是什么"
```

#### 维度 10：Git 规范

```
审查项：
- [ ] 变更范围合理（不包含无关文件）
- [ ] 提交信息格式正确（type: description）
- [ ] 无调试代码（console.log/TODO/临时文件）
- [ ] 无敏感文件（.env/credentials）
- [ ] 大文件拆分为多个原子提交

快速检查命令：
git diff --stat HEAD
git diff HEAD -- "*.env*" "*credentials*" "*secret*"
```

### 精简版清单（5 维度，适用于快速审查）

在时间紧迫时，只审查最重要的 5 个维度：

1. **功能正确性** -- 代码做了它该做的事吗？
2. **错误处理** -- 失败时会怎样？
3. **安全性** -- 有没有可被利用的漏洞？
4. **性能** -- 有没有明显的性能问题？
5. **测试覆盖** -- 改动有测试保护吗？

### 自动化建议

以下检查项可以通过 Hook 自动化（当前已实现标注为 [已实现]）：

| 检查项 | 自动化方式 | 状态 |
|-------|-----------|------|
| console.log 检查 | PostToolUse Hook | [已实现] |
| ESLint/Prettier 格式化 | PostToolUse Hook | [已实现] |
| TypeScript 类型检查 | PostToolUse Hook | [已实现] |
| 文件行数警告 | PreToolUse Hook | [已实现] |
| TDD 前置检查 | PreToolUse Hook | [已实现] |
| 密钥泄露检查 | UserPromptSubmit Hook | [已实现] |
| 未提交变更检查 | TaskCompleted Hook | [已实现] |
| 测试覆盖率检查 | 需新增 Hook | [待实现] |
| N+1 查询检测 | 需集成 ast-grep | [待实现] |

> 注：标注为 [已实现] 的 Hook 检查项已配置在 `hooks/hooks.json` 中，此处保留作为审查方法论参考。

---

## 来源

- Claude Code 官方文档：Plan Mode 四种工作流
- Andrew Ng "AI Agent Design Patterns"：Reflection、Multi-Agent
- linux.do 社区验证数据
- Vibe Coding 实战策略
- 社区实测：AI 自我审查降低 60% Bug 率
