---
name: session-restore
description: 跨会话上下文恢复 - 从之前的 Claude Code 会话中恢复上下文、任务状态和未完成的工作
version: 1.0.0
author: auto-cli
tags: [session, context, restore, continuity, memory]
---

# 跨会话上下文恢复

> 让 Claude Code 记住昨天的对话，继续未完成的工作

## 问题背景

Claude Code 的会话是隔离的。当你关闭会话后：
- 上下文丢失
- 未完成的任务被遗忘
- 需要重新解释项目背景

## 解决方案

session-restore 技能让 Claude Code 从之前的会话中恢复上下文，实现：

1. **会话历史分析** - 解析 Claude Code 的 .jsonl 会话文件
2. **关键信息提取** - 提取任务、决策、未完成事项
3. **智能摘要** - 压缩冗长对话为关键要点
4. **时间过滤** - 只恢复最近的、相关的上下文

---

## 何时激活

- 开始新会话时需要了解之前的工作
- 继续昨天未完成的任务
- 跨会话追踪复杂问题的解决过程
- 需要回顾之前做出的架构决策

---

## 工作流程

### 步骤 1：定位会话文件

Claude Code 会话文件位于：
```
~/.claude/sessions/<project-name>/conversations/<timestamp>.jsonl
```

查找最近的会话：
```bash
# 按时间排序列出最近 10 个会话
ls -lt ~/.claude/sessions/*/conversations/*.jsonl | head -n 10

# 或查找特定项目的会话
ls -lt ~/.claude/sessions/<project-name>/conversations/*.jsonl
```

### 步骤 2：解析会话内容

会话文件格式（.jsonl）：
```json
{"type":"user","content":"用户输入","timestamp":"2026-03-29T10:00:00Z"}
{"type":"assistant","content":"AI回复","timestamp":"2026-03-29T10:00:05Z"}
{"type":"tool_use","tool":"Read","input":{...},"timestamp":"..."}
{"type":"tool_result","output":"...","timestamp":"..."}
```

关键提取内容：
- 用户需求和任务描述
- AI 的分析和结论
- 代码修改和文件操作
- 测试结果和验证
- 未完成的问题

### 步骤 3：生成上下文摘要

将会话内容结构化为摘要：

```markdown
## 会话摘要 (2026-03-29 10:00 - 11:30)

### 任务
- [ ] 实现 JWT 认证模块
- [x] 创建用户注册 API
- [x] 添加密码加密

### 关键决策
1. 使用 bcrypt 进行密码哈希
2. JWT 有效期设为 7 天
3. 刷新令牌存储在 Redis

### 未完成事项
- 登录 API 需要添加速率限制
- 需要编写集成测试

### 相关文件
- src/auth/jwt.js (新建)
- src/auth/password.js (新建)
- src/api/register.js (修改)

### 下一步
实现登录 API 并添加速率限制
```

### 步骤 4：注入到新会话

在新会话开始时，加载摘要：

```markdown
# 上下文恢复

从上次会话 (2026-03-29 11:30) 恢复：
- 任务：实现 JWT 认证模块
- 进度：注册 API 完成，登录 API 待实现
- 下一步：添加速率限制并测试

请继续之前的工作。
```

---

## 使用方式

### 方式 1：手动恢复

```bash
# 查看最近的会话
auto session list

# 恢复特定会话
auto session restore <session-id>

# 恢复最近的会话
auto session restore latest
```

### 方式 2：自动恢复（推荐）

在 `CLAUDE.md` 中配置：
```markdown
## Session Restore

在每个新会话开始时，自动加载最近 24 小时的会话摘要。
```

---

## 与 loop-state-machine 集成

Auto CLI 的 `loop-state-machine.js` 已经支持状态持久化：

```javascript
// .auto/state/loop-state.json
{
  "runId": "run-20260329-100000",
  "currentStep": "EXECUTE",
  "steps": [...],
  "retryCount": 0,
  "lastUpdate": "2026-03-29T10:30:00Z"
}
```

session-restore 扩展了这一能力：
- 不仅恢复状态机状态
- 还恢复完整的对话上下文
- 包括工具调用、代码修改、测试结果

---

## 性能优化

### 尾部解析（Tail Parsing）

对于大型会话文件（>100MB），使用尾部解析：

```javascript
import fs from 'fs'

// 只读取最后 N 行，快速提取最近的上下文
const lastLines = readLastLines(sessionFile, 1000)
const recentContext = extractContext(lastLines)
```

### 时间过滤

只恢复最近的上下文（默认 24 小时）：

```javascript
const cutoffTime = Date.now() - (24 * 60 * 60 * 1000)
const recentMessages = messages.filter(m => m.timestamp > cutoffTime)
```

---

## 隐私和安全

- 会话文件存储在本地，不上传
- 敏感信息（API 密钥）自动过滤
- 支持会话清理命令：`auto session clean --older-than 30d`

---

## 成功指标

- 新会话启动时间 < 5 秒（含上下文加载）
- 上下文恢复准确率 > 90%
- 用户满意度：无需重复解释背景

---

## 开源借鉴

本技能灵感来自：
- **Claude Session Restore** by ZENG3LD
- **recall** by zippoxer - 全文搜索 Claude Code 会话
- **cchistory** by eckardt - 会话历史查看工具
