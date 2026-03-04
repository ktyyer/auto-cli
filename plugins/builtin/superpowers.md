---
name: superpowers
version: 2.0.0
description: TDD 流程触发器 - 检测功能开发意图，调度 tdd-guide Agent 使用 tdd-workflow Skill
author: ai-max
triggers:
  - "功能"
  - "特性"
  - "模块"
  - "系统"
  - "实现"
  - "TDD"
  - "新增"
priority: 80
builtin: true
---

# Superpowers — TDD 触发器

> 触发器职责：检测到功能开发意图 → 调度 TDD 能力链

## 触发后执行

检测到上述关键词时，按以下能力链执行：

```
tdd-guide (Agent) → tdd-workflow (Skill)
```

**能力链说明：**
- `tdd-guide` Agent：负责 TDD 流程决策（红灯→绿灯→重构）
- `tdd-workflow` Skill：包含完整 TDD 知识库（测试模板、断言策略、覆盖率）

**门禁要求：**
- 测试覆盖率 ≥ 80%
- 所有测试通过后再提交代码

> 📖 完整 TDD 指南请参阅 `skills/tdd-workflow/SKILL.md`
