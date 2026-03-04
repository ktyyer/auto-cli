---
name: task-state-machine-universal
description: 通用任务状态机 - 分解复杂任务并支持中断恢复、重试与检查点持久化（适配任何语言）
version: 1.0
universal: true
---

# Task State Machine — 通用任务状态机

> 让复杂任务具备“可暂停、可恢复、可追踪”的执行能力

## 触发方式

```bash
# 通过 /aimax:auto 自动触发
/aimax:auto 用状态机方式执行这次跨模块重构并可恢复

# 直接使用
/aimax:loop 对这个需求做分步编排并支持中断恢复
```

## 状态流（语言无关）

```text
INTAKE -> CONTEXT -> DECOMPOSE -> EXECUTE -> VERIFY
VERIFY(pass) -> SUMMARIZE -> PERSIST -> END
VERIFY(fail) -> RECOVER -> EXECUTE
任意状态中断 -> PERSIST -> STOP
```

## 核心规则

1. 每个阶段结束必须写检查点
2. 每个步骤最多重试 3 次
3. 重试失败必须输出失败总结和下一步建议
4. 恢复执行时必须先读取快照，禁止从头盲跑

## 快照建议

- 路径：`.aimax/state/loop-state.json`
- 字段：`run_id/task/current_state/current_step_index/retries/gates/next_action/updated_at`

## 输出模板

```markdown
## 🔄 状态机进度

- 状态: EXECUTE
- 步骤: 2/5
- 重试: step-2 -> 0/3
- 门禁: build✅ test⏳ lint⏳
- 下一步: 执行 step-3
```
