---
name: context-management
description: 上下文管理 9 大策略 - 基于 Vibe Coding 最佳实践，教你管理 AI 对话的上下文窗口、避免信息丢失、最大化编码效率
version: 1.0.0
author: auto-cli
tags: [context, vibe-coding, best-practices, workflow, memory, subagent]
---

# 上下文管理 -- Vibe Coding 9 大策略

> 管好上下文 = 管好 AI 的脑容量。这 9 个策略来自社区实战经验（Vibe Coding），帮助你避免 AI "失忆"、减少重复解释、提高编码质量。

---

## 策略一：先让 AI 进入"计划模式"

**核心理念**：别一上来就让 AI 写代码。先让它理解项目、分析需求、制定方案。

**为什么重要**：
- 直接让 AI 写代码，容易忽略已有架构和约定
- 计划模式下的 AI 会先读代码再行动，产出质量更高
- 减少反复修改的次数（一次做对 > 多次返工）

**怎么用**：
```
# 错误做法
/auto 给我写一个用户登录接口

# 正确做法
/auto:plan 分析当前项目的认证架构，规划用户登录功能的实现方案
```

**Auto CLI 对应**：
- `/auto:plan` -- 只规划不编码
- Quest Designer v4 的 PHASE 2 就是计划模式

---

## 策略二：用子代理把"脏活累活"隔离出去

**核心理念**：复杂任务分解为子任务，每个子任务交给专用 Agent，主进程保持上下文清洁。

**为什么重要**：
- 单个 Agent 的上下文窗口有限，装太多信息会"忘事"
- 专用 Agent（如 tdd-guide、code-reviewer）在自己的领域表现更好
- 子代理的错误不会污染主流程

**怎么用**：
```
# 并行启动多个子代理
/auto route 安全分析 auth.ts    # -> security-reviewer
/auto route 编写测试 cache.ts   # -> tdd-guide
/auto route 检查类型 utils.ts   # -> code-reviewer
```

**Auto CLI 对应**：
- `/auto:route` -- 智能路由到最合适的 Agent
- Canonical Router -- 自动分析意图，推荐 Agent + 回退链
- Agent Teams -- 15+ 关任务自动触发多队友网状协作

---

## 策略三：把 CLAUDE.md 打造成"活规则书"

**核心理念**：CLAUDE.md 不是一次性写好的文档，而是随着项目演进不断更新的规则集。

**为什么重要**：
- AI 每次对话都会读取 CLAUDE.md，它是最稳定的信息源
- 好的 CLAUDE.md 能避免 80% 的重复解释
- 记录"不要做 X"比记录"要做 Y"更有价值

**怎么维护**：
```markdown
# CLAUDE.md 更新检查点
- 每次踩坑后 -> 追加"避免事项"
- 每次架构决策后 -> 追加"决策记录"
- 每次引入新依赖后 -> 追加"依赖说明"
- 每次修改编码风格后 -> 追加"风格约定"
```

**Auto CLI 对应**：
- `rules/` 目录下的 9 个规范文件 -- 相当于分领域的 CLAUDE.md
- Knowledge Steward -- 自动分类保存经验（prompt / trap / pattern / decision）

---

## 策略四：把验证和验收标准写进提示词

**核心理念**：不要让人肉质检。在 Prompt 中明确写出"什么是完成"，AI 会自动验证。

**为什么重要**：
- AI 不会自己判断"够不够好"，它需要明确的标准
- 写进 Prompt 的验收标准 = 可执行的检查清单
- 每个验收点都可以用命令验证（不需要主观判断）

**怎么写**：
```markdown
# 好的验收标准（具体、可验证）
1. 编译通过: `mvn compile` 返回 BUILD SUCCESS
2. 测试通过: `npm test` 全绿
3. 覆盖率 >= 80%: `npm run coverage`
4. 无 console.log: `grep -r "console.log" src/` 返回空

# 差的验收标准（模糊、需人工判断）
1. 代码质量好
2. 性能不错
3. 测试充分
```

**Auto CLI 对应**：
- Quest Designer v4 -- 每个 Quest 自带验收标准表（验证点 + 验证命令 + 预期结果）
- TDD Guard Hook -- 编辑源文件前强制检查测试文件存在
- PHASE 4 VERIFY -- 编译 + 测试 + 覆盖率 + 安全扫描全量门禁

---

## 策略五：把 Prompt 当 API 文档来写

**核心理念**：Prompt 是你写给 AI 的"接口文档"。结构化、参数化、有输入输出定义。

**为什么重要**：
- 随意的 Prompt 导致随意的输出
- 结构化 Prompt 让 AI 理解你的意图精确度提升 3-5 倍
- 好的 Prompt 模板可以复用（固化成 Skill）

**Prompt 结构模板**：
```markdown
## 角色
你是一个 [领域] 专家。

## 任务
[具体要做的事情]

## 输入
- 参数1: [类型] - [说明]
- 参数2: [类型] - [说明]

## 输出格式
[具体的输出结构]

## 约束
- [硬性约束1]
- [硬性约束2]

## 示例
输入: ...
输出: ...
```

**Auto CLI 对应**：
- `skills/prompt-craft` -- 短小精悍的提示词模板
- `/auto:quest` -- 输入需求，输出完整蓝图（Quest Designer v4 就是"Prompt 即代码"的实践）

---

## 策略六：每 30-45 分钟进行一次上下文重置

**核心理念**：对话越长，AI 的注意力越分散。定期开新会话，用结构化摘要衔接上下文。

**为什么重要**：
- 上下文窗口后半段，AI 开始"忘记"前面的约定
- 长对话中修改的代码，错误率比短对话高 40%+
- 重置不等于重来 -- 带着摘要的重置比盲目续写更高效

**重置流程**：
```bash
# 1. 在当前会话末尾生成摘要
/auto:status   # 查看当前进度

# 2. 手动记录关键信息（或使用 Session Restore）
# - 已完成的任务
# - 未完成的任务
# - 关键决策
# - 未解决的错误

# 3. 开新会话，粘贴摘要继续
```

**Auto CLI 对应**：
- Session Restore Skill -- 自动从 .jsonl 会话文件中恢复上下文
- 上下文压缩 (`src/utils.js` compressContext) -- 长对话自动压缩保留关键信息
- Knowledge Steward -- 一键保存关键经验到知识库

---

## 策略七：并行会话 + Git Worktree

**核心理念**：像包工头一样管理多个 AI，每个负责一个独立的工作区。

**为什么重要**：
- 串行开发是单线程，并行开发是多核
- Git Worktree 让多个会话在不同分支上工作，互不干扰
- 合并时解决冲突，比串行开发快 2-3 倍

**操作方法**：
```bash
# 1. 创建 Worktree
git worktree add ../feature-auth feature/auth
git worktree add ../feature-payment feature/payment

# 2. 在不同终端窗口启动 Claude Code
# 窗口 1: cd ../feature-auth && claude
# 窗口 2: cd ../feature-payment && claude

# 3. 各自完成任务后合并
git checkout main
git merge feature/auth
git merge feature/payment
```

**Auto CLI 对应**：
- `skills/git-worktree` -- Git Worktree 并行开发最佳实践
- `/auto:loop` -- 状态机编排，支持中断恢复
- Agent Teams 模式 -- 15+ 关任务自动触发多 Agent 并行

---

## 策略八：把重复流程固化为 Skill

**核心理念**：如果你发现自己第三次写类似的 Prompt，就该把它固化成 Skill。

**为什么重要**：
- Skill 一次编写，永久复用
- 固化后的 Skill 比 Prompt 更稳定（不会被遗忘或变形）
- 好的 Skill 可以分享给团队

**Skill 模板**：
```markdown
---
name: my-custom-workflow
description: 一句话说明这个 Skill 做什么
version: 1.0.0
author: your-name
tags: [tag1, tag2, tag3]
---

# Skill 标题

## 何时激活
[触发条件]

## 工作流程
### 步骤 1: ...
### 步骤 2: ...

## 输出格式
[期望的输出结构]
```

**Auto CLI 对应**：
- 项目已有 15 个 Skills -- `skills/` 目录下
- SkillIndexer -- 自动索引 Skill 元数据，按需加载完整内容
- `auto install` -- 一键安装所有 Skills 到 `~/.claude/skills/`

---

## 策略九：用真实数据而不是主观猜测

**核心理念**：AI 的输出质量取决于输入质量。喂真实数据（日志、错误信息、测试结果），而不是模糊描述。

**为什么重要**：
- "它报错了" -> AI 无法定位问题
- "运行 `npm test` 后输出 `TypeError: Cannot read properties of undefined (reading 'id')` at `src/user.js:42:15`" -> AI 秒级定位

**数据喂食对比**：
```markdown
# 差的输入（猜测）
"用户模块有个 bug，好像是登录不了"

# 好的输入（真实数据）
"运行 `npm test` 后，以下测试失败：
  - test/user.test.js > 登录测试 > 应返回 200
  - 错误信息: Expected status 200 but received 401
  - 最近修改的文件: src/auth.js (新增了 token 过期检查)"
```

**Auto CLI 对应**：
- ContextInjector -- 自动收集项目上下文（探索/实现/修复/审查 四种模式）
- PHASE 1 DISCOVER -- 全面扫描项目状态，用真实数据驱动 PHASE 2
- `/auto:doctor` -- 环境诊断，用真实数据检查 Node.js、Claude Code 配置、MCP 连接性

---

## 快速参考表

| 策略 | 一句话 | Auto CLI 对应 |
|------|--------|--------------|
| 1. 计划模式 | 先想后做 | `/auto:plan`, Quest Designer |
| 2. 子代理隔离 | 脏活交给专家 | `/auto:route`, Canonical Router |
| 3. 活规则书 | CLAUDE.md 持续更新 | `rules/`, Knowledge Steward |
| 4. 验收标准 | 写进 Prompt 自动验证 | Quest 验收表, PHASE 4 VERIFY |
| 5. Prompt 即文档 | 结构化 > 随意写 | `prompt-craft` Skill |
| 6. 上下文重置 | 30-45 分钟开新会话 | Session Restore, 压缩工具 |
| 7. 并行会话 | Worktree 多开 | `git-worktree` Skill, Agent Teams |
| 8. 固化为 Skill | 第三次就固化 | Skill 模板, SkillIndexer |
| 9. 真实数据 | 喂数据不喂猜测 | ContextInjector, PHASE 1 |

---

## 参考来源

- [Vibe Coding 上下文管理实战指南](https://blog.csdn.net/yangshangwei/article/details/158585374)
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- Claude Code 官方文档
