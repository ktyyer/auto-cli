---
name: smart-memory
description: 智能记忆系统 - 融合项目记忆、对话状态、上下文索引，实现三层记忆体系 + RAG 检索 + 中断恢复
version: 1.0.0
author: auto-cli
tags: [memory, context, rag, state-machine, session]
---

# Smart Memory — 智能记忆系统

> 融合 project-memory、conversational-state-machine、smart-context 三大能力
> 让 AI 记住项目上下文、对话历史，秒级理解大型项目

---

## 三层记忆体系

### Layer 1: 会话记忆（Session Memory）

记住当前对话中的上下文和决策。

**存储内容**：
- 当前任务的决策和理由
- 已修改的文件列表
- 用户明确表达的偏好
- 未完成的事项

**载体**：对话上下文本身（无需额外存储）

### Layer 2: 项目记忆（Project Memory）

跨会话记住项目的架构决策和编码模式。

**存储内容**：
- 架构决策和理由
- 编码模式偏好
- 技术栈约束
- 常见陷阱和解决方案
- 团队规范

**载体**：`.claude/skills/knowledge/` 目录
- `essential/BUSINESS.md` — 业务知识
- `essential/PATTERNS.md` — 代码模式和纠错
- `essential/CRITICAL.md` — 关键决策

**写入时机**：
- 会话结束时自动生成摘要
- 架构决策变更时
- 发现新模式时

### Layer 3: 上下文索引（Context Index）

类似 Cursor RAG 索引，按需检索项目代码。

**核心能力**：
- 语义搜索：根据任务描述找到相关代码
- 精准定位：只加载需要的代码片段
- 关系图谱：理解模块间的依赖关系
- 增量更新：代码变更后只更新受影响的部分

**实现方式**：
- 借鉴 REPO_MAP.md 的符号索引
- 结合 Glob + Grep 的结构化搜索
- 按需 Read 而非全量加载

---

## 对话状态管理

### 状态模型

```text
INTAKE → CONTEXT → WORKING → PAUSED → RESUMED → COMPLETED
                                    ↘ ERROR → RECOVERING → WORKING
```

### 检查点规范

对话状态保存到 `.auto/state/session-state.json`：

```json
{
  "session_id": "sess-20260328-001",
  "task": "重构支付模块",
  "state": "WORKING",
  "progress": {
    "completed_steps": ["分析现有代码", "设计新架构"],
    "current_step": "实现核心逻辑",
    "remaining_steps": ["编写测试", "集成验证"]
  },
  "decisions": [
    { "choice": "使用策略模式", "reason": "支持多种支付方式扩展" }
  ],
  "files_modified": ["src/payment.js", "src/strategy.js"],
  "next_action": "继续实现策略工厂",
  "updated_at": "2026-03-28T12:00:00Z"
}
```

### 中断恢复流程

1. 新会话开始时检查 `.auto/state/session-state.json`
2. 如果存在未完成任务：
   - 读取检查点
   - 展示上下文摘要
   - 确认是否继续
3. 用户确认后从 `next_action` 继续执行

---

## RAG 检索增强

### 检索策略

| 场景 | 策略 | 工具 |
|------|------|------|
| 精确定位 | 文件路径 + 行号 | Read |
| 模式搜索 | 正则匹配 | Grep |
| 结构浏览 | 目录树 | Glob |
| 语义搜索 | 描述 -> 关键词 -> 搜索 | 组合 |

### 索引更新规则

- 文件修改后：只更新该文件的索引条目
- 新文件创建：添加新条目
- 文件删除：移除条目
- 定期重建：当变更量超过 20% 时全量重建

---

## 最佳实践

1. **先查记忆，再读代码** — 避免重复分析和 Token 浪费
2. **主动记录决策** — 不要等会话结束，每做一次架构决策就记录
3. **增量更新索引** — 不要每次全量扫描
4. **会话摘要精炼** — 记住决策和理由，不记住过程细节
5. **上下文分级** — 关键信息放 Layer 2，参考信息放 Layer 1
