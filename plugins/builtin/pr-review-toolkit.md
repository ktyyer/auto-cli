---
name: pr-review-toolkit
version: 2.0.0
description: 代码审查触发器 - 检测审查意图，调度 code-reviewer Agent 执行多维度审查
author: ai-max
triggers:
  - "审查"
  - "review"
  - "检查代码"
  - "PR"
  - "代码质量"
priority: 75
builtin: true
---

# PR Review Toolkit — 代码审查触发器

> 触发器职责：检测到审查意图 → 调度代码审查能力链

## 触发后执行

```
code-reviewer (Agent)
```

**Agent 审查维度（由 code-reviewer Agent 执行）：**
- 🔴 安全：SQL注入、XSS、硬编码密钥、CSRF
- 🟠 质量：错误处理、类型定义、命名规范
- 🟡 性能：N+1查询、内存泄漏、不必要的重渲染
- 🟢 测试：覆盖率 ≥ 80%、边界条件测试

**输出格式：总评分 + 分级问题列表（严重/重要/轻微）**

> 直接调用：`/auto:code-review`
