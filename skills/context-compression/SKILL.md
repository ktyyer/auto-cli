---
name: context-compression
description: 上下文压缩技能 - 接近上下文窗口限制时，通过锚定迭代摘要保留关键信息，支持超长对话和大型任务
version: 1.0.0
author: ai-max
tags: [context, compression, memory, long-running, summarization]
---

# Context Compression — 上下文压缩

> 突破上下文窗口限制，让 AI 在超长任务中始终保持清醒

## 为什么需要上下文压缩

Claude 的上下文窗口有限（200k token）。在复杂任务中：
- 对话历史不断积累 → token 耗尽
- 强制截断 → 丢失关键信息
- 重新开始 → 损失所有进度

上下文压缩解决方案：
- 主动识别并摘要早期的非关键对话
- 保留所有关键决策、文件修改、架构信息
- 在关键节点压缩，而非被动截断

---

## 锚定迭代摘要（Anchored Iterative Summarization）

### 核心算法

```
每 N 轮对话：
  1. 识别锚点信息（不可丢弃的关键内容）
  2. 对非锚点内容生成摘要
  3. 替换原始对话为「摘要 + 锚点」
  4. 继续对话
```

### 何时触发压缩

- 上下文使用率 > 70%（主动压缩）
- 用户明确要求 "压缩上下文" 或 "总结进度"
- 任务遇到检查点（如完成一个阶段）
- 使用 `/aimax:loop next` 推进状态机时

---

## 信息分类体系

压缩时按重要性分类：

### 🔴 锚点信息（绝不丢弃）

```markdown
## 🔴 锚点信息

### 文件修改记录
- `src/service/UserService.java` — 添加了 `findByEmail()` 方法
- `src/controller/UserController.java` — 新增 `/api/user/profile` 端点
- `src/mapper/UserMapper.xml` — 添加对应 SQL 映射

### 架构决策
- 决定使用 JWT 而非 Session（原因：无状态、支持分布式）
- API 响应统一使用 `Result<T>` 包装
- 密码使用 BCrypt 加密，强度因子 12

### 遗留问题
- ⚠️ UserService 的邮件发送功能尚未实现（等待邮件服务配置）
- ⚠️ 密码重置 token 过期时间待确认（暂设 24h）

### 测试覆盖率
- UserController: 已通过
- UserService: 已通过（覆盖率 87%）
- 待测试: 邮件验证流程
```

### 🟡 摘要信息（压缩保留要点）

```markdown
## 🟡 阶段摘要

### 第 1 阶段（已完成）
目标：实现用户注册和登录
结果：✅ 完成。注册 API、登录 API、JWT 生成验证均已实现并通过测试。
关键文件：UserController, UserService, JwtUtils

### 第 2 阶段（进行中）
目标：实现用户个人资料管理
当前进度：GET /profile 已完成；PUT /profile 进行中（50%）
```

### 🟢 可丢弃信息

- 中间讨论过程和思考过程
- 重复的代码解释
- 已解决的问题的排查过程
- 语法确认和简单问答

---

## 标准压缩模板

### 压缩触发时生成

```markdown
---
⚡ 上下文压缩（第 N 次）
时间: 2026-02-28
压缩前: ~150k tokens → 压缩后: ~30k tokens
---

## 任务状态
**目标**: 重构用户认证模块，从 session 迁移到 JWT
**状态**: 进行中（第 3/7 步）
**剩余**: JWT 验证中间件、刷新 token、集成测试

## 已完成工作（摘要）
1. ✅ 分析了原有 session 实现（SessionManager.java x 3 个类）
2. ✅ 设计了 JWT 方案：HS256 算法，access token 2h，refresh token 7d
3. ✅ 实现了 JwtUtils.java（生成、验证、解析 token）

## 关键决策
- JWT 密钥从 application.yml 读取（键: `jwt.secret`）
- Claims 包含: userId, username, roles
- 过期处理: 返回 401，前端自动刷新

## 文件修改清单
| 文件 | 状态 | 说明 |
|------|------|------|
| `JwtUtils.java` | ✅ 完成 | 新建，JWT 工具类 |
| `SecurityConfig.java` | 🔄 修改中 | 替换 session 为 JWT |
| `UserController.java` | ⬜ 待修改 | 更新登录端点返回 token |

## 待解决问题
- SecurityConfig 的 whitelist 路径需要确认（登录/注册不拦截）

## 下一步
继续实现 JWT 验证中间件（`JwtAuthenticationFilter.java`）
---
```

---

## 即时压缩命令

在对话中使用以下指令：

```bash
# 请求压缩当前上下文
"请压缩当前上下文，保留所有关键决策和文件修改，生成压缩摘要"

# 保存进度检查点
"请创建当前任务的检查点，保存到 .aimax/state/checkpoint.md"

# 从检查点恢复
"请读取 .aimax/state/checkpoint.md 并从上次中断处继续"
```

---

## 检查点文件规范

### 路径

`.aimax/state/checkpoint.md`

### 格式

```markdown
# 任务检查点

## 基本信息
- 创建时间: 2026-02-28 10:30
- 任务描述: 重构用户认证模块
- 当前阶段: 第 3/7 步

## 文件修改记录（必须保留）
- 新建: src/utils/JwtUtils.java
- 修改: src/config/SecurityConfig.java
- 修改: src/service/UserService.java

## 架构决策（必须保留）
- ...

## 下一步操作
- ...
```

---

## 与 /aimax:loop 集成

loop 状态机在每次状态转换时自动触发轻量级检查点：

```
EXECUTE → VERIFY: 保存执行摘要到 loop-state.json
VERIFY → SUMMARIZE: 触发全量上下文压缩
SUMMARIZE → PERSIST: 写入检查点文件
```

---

## 开源借鉴

- **Claude Code Auto Compact** — 自动检测上下文使用率并触发压缩
- **Cline Auto Compact** — 接近限制时自动摘要
- **Anthropic 官方研究** — Anchored Iterative Summarization 算法
- **everything-claude-code** — Context Compression Skill 格式规范
