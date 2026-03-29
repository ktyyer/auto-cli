---
name: unified-memory-system
description: 统一记忆系统 - 上下文管理 + 会话恢复 + 知识沉淀，三合一
version: 1.0.0
author: auto-cli
tags: [memory, context, session, knowledge, workflow]
---

# 统一记忆系统

> 管好 AI 的"脑容量" = 管好开发效率。本 Skill 整合了三大记忆能力：
> 1. **上下文管理** -- 9 大策略避免 AI 失忆（来自 Vibe Coding 社区实战）
> 2. **会话恢复** -- 跨会话恢复任务状态和关键决策
> 3. **知识沉淀** -- 一句话保存灵感、踩坑经验、架构决策

---

## 一、上下文管理 9 大策略

> 管好上下文 = 管好 AI 的脑容量。这 9 个策略来自社区实战经验（Vibe Coding）。

### 策略 1：先让 AI 进入"计划模式"

别一上来就让 AI 写代码。先让它理解项目、分析需求、制定方案。

```
# 错误做法
/auto 给我写一个用户登录接口

# 正确做法
/auto:plan 分析当前项目的认证架构，规划用户登录功能的实现方案
```

Auto CLI 对应：`/auto:plan` -- 只规划不编码；Quest Designer v4 的 PHASE 2 就是计划模式。

### 策略 2：用子代理把"脏活累活"隔离出去

复杂任务分解为子任务，每个子任务交给专用 Agent，主进程保持上下文清洁。

```
# 并行启动多个子代理
/auto route 安全分析 auth.ts    # -> security-reviewer
/auto route 编写测试 cache.ts   # -> tdd-guide
/auto route 检查类型 utils.ts   # -> code-reviewer
```

Auto CLI 对应：`/auto:route` -- 智能路由到最合适的 Agent；Canonical Router -- 自动分析意图。

### 策略 3：把 CLAUDE.md 打造成"活规则书"

CLAUDE.md 不是一次性写好的文档，而是随项目演进不断更新的规则集。好的 CLAUDE.md 能避免 80% 的重复解释。记录"不要做 X"比记录"要做 Y"更有价值。

Auto CLI 对应：`rules/` 目录下的规范文件；Knowledge Steward CLI (`auto save`)。

### 策略 4：把验证和验收标准写进提示词

不要让人肉质检。在 Prompt 中明确写出"什么是完成"，AI 会自动验证。

```markdown
# 好的验收标准（具体、可验证）
1. 编译通过: `mvn compile` 返回 BUILD SUCCESS
2. 测试通过: `npm test` 全绿
3. 覆盖率 >= 80%: `npm run coverage`
```

Auto CLI 对应：Quest Designer v4 -- 每个 Quest 自带验收标准表。

### 策略 5：把 Prompt 当 API 文档来写

Prompt 是你写给 AI 的"接口文档"。结构化、参数化、有输入输出定义。好的 Prompt 模板可以复用，固化成 Skill。

### 策略 6：每 30-45 分钟进行一次上下文重置

对话越长，AI 的注意力越分散。定期开新会话，用结构化摘要衔接上下文。

```bash
# 1. 在当前会话末尾生成摘要
/auto:status   # 查看当前进度

# 2. 手动记录关键信息
# - 已完成的任务
# - 未完成的任务
# - 关键决策

# 3. 开新会话，粘贴摘要继续
```

Auto CLI 对应：上下文压缩 (`src/utils.js` compressContext)；Knowledge Steward CLI。

### 策略 7：并行会话 + Git Worktree

像包工头一样管理多个 AI，每个负责一个独立的工作区。

```bash
git worktree add ../feature-auth feature/auth
git worktree add ../feature-payment feature/payment
# 在不同终端窗口启动 Claude Code
```

Auto CLI 对应：Agent Teams 模式 -- 15+ 关任务自动触发多 Agent 并行。

### 策略 8：把重复流程固化为 Skill

如果你发现自己第三次写类似的 Prompt，就该把它固化成 Skill。Skill 一次编写，永久复用。

### 策略 9：用真实数据而不是主观猜测

AI 的输出质量取决于输入质量。喂真实数据（日志、错误信息、测试结果），而不是模糊描述。

```
# 差："用户模块有个 bug"
# 好："运行 npm test 后 TypeError: Cannot read properties of undefined (reading 'id') at src/user.js:42:15"
```

### 策略速查表

| 策略 | 要点 | Auto CLI 工具 |
|------|------|--------------|
| 1. 计划模式 | 先想后做 | `/auto:plan`, Quest Designer |
| 2. 子代理隔离 | 脏活交给专家 | `/auto:route`, Canonical Router |
| 3. 活规则书 | CLAUDE.md 持续更新 | `rules/`, Knowledge Steward |
| 4. 验收标准 | 写进 Prompt 自动验证 | Quest 验收表, PHASE 4 VERIFY |
| 5. Prompt 即文档 | 结构化 > 随意写 | `prompt-craft` Skill |
| 6. 上下文重置 | 30-45 分钟开新会话 | 上下文压缩 |
| 7. 并行会话 | Worktree 多开 | Agent Teams |
| 8. 固化为 Skill | 第三次就固化 | SkillIndexer |
| 9. 真实数据 | 喂数据不喂猜测 | PHASE 1 DISCOVER |

---

## 二、会话恢复

> 让 Claude Code 记住昨天的对话，继续未完成的工作

### 何时使用

- 开始新会话时需要了解之前的工作
- 继续昨天未完成的任务
- 跨会话追踪复杂问题的解决过程

### 工作流程

#### 步骤 1：定位会话文件

Claude Code 会话文件位于：
```
~/.claude/sessions/<project-name>/conversations/<timestamp>.jsonl
```

```bash
# 按时间排序列出最近 10 个会话
ls -lt ~/.claude/sessions/*/conversations/*.jsonl | head -n 10
```

#### 步骤 2：提取关键信息

从 .jsonl 会话文件中提取：
- 用户需求和任务描述
- AI 的分析和结论
- 代码修改和文件操作
- 未完成的问题

#### 步骤 3：生成上下文摘要

```markdown
## 会话摘要 (2026-03-29 10:00 - 11:30)

### 任务
- [x] 创建用户注册 API
- [ ] 实现 JWT 认证模块

### 关键决策
1. 使用 bcrypt 进行密码哈希
2. JWT 有效期设为 7 天

### 下一步
实现登录 API 并添加速率限制
```

### 与 loop-state-machine 集成

Auto CLI 的 loop 状态机已支持状态持久化（`.auto/state/loop-state.json`），会话恢复扩展了这一能力，不仅恢复状态机状态，还恢复完整的对话上下文。

### 性能优化

- **尾部解析**: 大型会话文件（>100MB）只读取最后 N 行
- **时间过滤**: 只恢复最近 24 小时的上下文

---

## 三、知识沉淀

> 一句话保存灵感、踩坑经验、架构决策，自动分类 + Git 提交

### 使用方式

#### Claude Code 内

```
用户：保存这个提示词
用户：记录这个踩坑经验
用户：保存决策：选用 XX 方案
```

#### CLI

```bash
# 保存知识
auto save insight -c "内容" -t prompt --tags react,hooks

# 查看统计
auto save list

# 搜索
auto save search -q "react"
```

### 智能分类

| 分类 | 文件 | 描述 |
|------|------|------|
| prompt | `.auto/insights/prompts.md` | 有效 Prompt 和对话模板 |
| trap | `.auto/insights/traps.md` | 踩坑经验和问题排查 |
| pattern | `.auto/insights/patterns.md` | 设计模式和编码最佳实践 |
| decision | `.auto/insights/decisions.md` | 架构决策和技术选型记录 |

### 存储格式

```markdown
### [标题]

**日期**: YYYY-MM-DD HH:mm:ss
**标签**: tag1, tag2

[内容]

---
```

### 边界

- 不保存敏感信息（密码、密钥、Token）
- 不修改已有知识条目（只追加）
- 单条内容不超过 2000 字（超出时截取摘要）

### 相关代码

- `src/knowledge/knowledge-steward.js` -- 核心实现
- `src/knowledge/categories.js` -- 分类规则
- `bin/cli.js` -- CLI `save` 子命令
