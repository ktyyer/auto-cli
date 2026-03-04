---
name: code-simplifier
version: 2.0.0
description: 代码清理触发器 - 检测重构/清理意图，调度 refactor-cleaner Agent 执行系统化清理
author: ai-max
triggers:
  - "清理"
  - "优化代码"
  - "重构"
  - "简化"
  - "代码臃肿"
  - "消除重复"
priority: 70
builtin: true
---

# Code Simplifier — 重构触发器

> 触发器职责：检测到重构/清理意图 → 调度代码清理能力链

## 触发后执行

```
refactor-cleaner (Agent)
```

**Agent 执行的清理操作：**
- 提取魔法值为常量
- 简化复杂条件表达式（提前 return 替代嵌套 if）
- 消除重复代码（提取复用方法）
- 现代化语法（var→const、callback→async/await）
- 结构重组（单个函数 ≤30行、单文件 ≤400行）

**输出：清理报告（原行数/清理后行数/圈复杂度变化）**

> 直接调用：`/aimax:refactor-clean`
