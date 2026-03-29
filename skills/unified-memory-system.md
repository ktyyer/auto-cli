---
name: unified-memory-system
description: 统一记忆系统 - 上下文管理 + 会话恢复 + 知识沉淀，三合一
version: 1.1.0
author: auto-cli
tags: [memory, context, session, knowledge, workflow]
---

# 统一记忆系统

> 管好 AI 的"脑容量" = 管好开发效率。本 Skill 整合三大记忆能力：
> 1. **上下文管理** -- 核心策略避免 AI 失忆
> 2. **会话恢复** -- 跨会话恢复任务状态和关键决策
> 3. **知识沉淀** -- 一句话保存灵感、踩坑经验、架构决策

---

## 一、上下文管理核心策略

### 策略 1：先让 AI 进入"计划模式"

别一上来就让 AI 写代码。先让它理解项目、分析需求、制定方案。

```
# 错误做法
/auto 给我写一个用户登录接口

# 正确做法
/auto:plan 分析当前项目的认证架构，规划用户登录功能的实现方案
```

### 策略 2：把 CLAUDE.md 打造成"活规则书"

CLAUDE.md 不只是 README，它是 AI 的"行为宪法"。

```
好的 CLAUDE.md 包含：
- 技术栈声明（让 AI 用对工具）
- 编码禁区（让 AI 不犯错）
- 项目特有模式（让 AI 遵循惯例）
- 测试要求（让 AI 自动写测试）

参考 skills/init-project.md 的 7 板块模板
```

### 策略 3：验收标准写进 Prompt

```
# 差的验收标准
"写好点" / "尽量完善" / "优化一下"

# 好的验收标准
- [ ] 编译通过：npm run build
- [ ] 测试通过：npm test
- [ ] 覆盖率 >= 80%：npm run test:coverage
- [ ] 无 console.log：grep -rn "console.log" src/
- [ ] 无安全漏洞：npm audit --production
```

### 策略 4：对话太长时压缩上下文

当对话超过 30 条消息时，AI 容易"失忆"。Auto CLI 内置上下文压缩：

```javascript
// src/utils.js - compressContext()
// 自动保留：关键决策(TODO/FIXME/IMPORTANT) + 最近 N 条消息
// 自动移除：纯确认消息、重复提问、无关闲聊
```

### 策略 5：每个 Agent 只接收需要的上下文

```
# 好的做法：只传相关文件
Agent({ subagent_type: "tdd-guide", prompt: "为 src/auth.js 编写单元测试" })

# 坏的做法：传整个项目
Agent({ subagent_type: "tdd-guide", prompt: "这个项目有 200 个文件...为 auth 写测试" })
```

### 策略 6-9 速查

以下策略已由对应组件覆盖，此处仅列出要点：

| 策略 | 要点 | 对应组件 |
|------|------|---------|
| 6. 子代理隔离 | 复杂任务拆给专用 Agent | `workflow-patterns.md` 编排模式 |
| 7. 审查后提交 | 写完代码先自检 | `self-review.md` 10 维度清单 |
| 8. 知识沉淀 | 踩坑经验一句话保存 | `auto save insight -c "..."` |
| 9. 渐进式开发 | 一次只做一个功能，逐步验证 | quest-designer PHASE 3 逐关执行 |

---

## 二、会话恢复

### 什么时候需要恢复

- Claude Code 会话意外中断
- 上下文窗口耗尽被迫开新会话
- 第二天继续昨天的任务

### 恢复模板

在新的 Claude Code 会话中粘贴：

```markdown
# 会话恢复

## 任务描述
[一句话描述你在做什么]

## 已完成的步骤
1. [x] PHASE 1 DISCOVER 完成
2. [x] PHASE 2 Quest Map 已生成
3. [ ] PHASE 3 执行中（Quest 3/7）

## 关键决策记录
- 选择了 A 方案而非 B，因为 [原因]
- 修改了 [文件]，影响 [范围]

## 下一步
- 从 Quest 3 开始继续执行
- 注意 [预判坑点]
```

---

## 三、知识沉淀

### 使用方式

```bash
# CLI 方式
auto save insight -c "发现 N+1 查询问题：循环中调用 selectList 应该先批量查出"
auto save insight -c "选择了 Event Sourcing 而非 CRUD，因为需要审计日志" -t decision

# Claude Code 方式
/auto 保存知识：[内容]
```

### 知识分类

| 分类 | 说明 | 示例 |
|------|------|------|
| prompt | 高效提示词模式 | "先让 AI 列方案再选最优" |
| trap | 踩坑经验 | "Vue3 reactive 不能包裹基础类型" |
| pattern | 代码模式 | "统一用 Result<T> 包装 API 响应" |
| decision | 架构决策 | "选 MongoDB 因为文档结构灵活" |

### 知识检索

```bash
# 搜索
auto save search -q "N+1"

# 列出
auto save list
```

---

## 与 Auto CLI 的集成

- **PHASE 1 DISCOVER**: 使用策略 4 的上下文压缩避免信息过载
- **PHASE 2 REASON**: quest-designer 使用策略 1-3 生成高质量 Quest Map
- **PHASE 3 EXECUTE**: 使用策略 5 隔离子 Agent 上下文
- **PHASE 5 COMMIT**: 使用策略 6 的审查清单
- **PHASE 6 LEARN**: 使用知识沉淀保存经验
