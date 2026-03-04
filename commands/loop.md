---
description: 任务状态机命令 - 对复杂任务执行分步编排，支持检查点、中断恢复、可控重试和可追踪门禁。
---

# Loop 命令

`/auto:loop` 用于执行“可恢复的复杂任务编排”。它不是直接写代码，而是先建立状态机执行框架，再推进各步骤。

---

## 此命令的功能

1. **状态建模** - 将任务映射到可追踪状态
2. **任务拆解** - 产出可执行步骤和依赖关系
3. **检查点持久化** - 每步落盘，支持恢复执行
4. **可控重试** - 每步最多 3 次，失败可回滚
5. **门禁追踪** - 构建/测试/lint 等结果纳入状态

---

## 何时使用

在以下情况优先使用 `/auto:loop`：

- 任务跨多个模块/阶段
- 执行过程可能被中断
- 需要“恢复上次进度”而非重新开始
- 需要明确记录每一步状态和门禁结果

---

## 状态机定义

```text
INTAKE    - 接收需求与边界
CONTEXT   - 收集上下文与依赖
DECOMPOSE - 拆解步骤与顺序
EXECUTE   - 执行当前步骤
VERIFY    - 校验门禁
RECOVER   - 失败恢复
SUMMARIZE - 汇总结果
PERSIST   - 写入检查点
```

### 典型流转

```text
INTAKE -> CONTEXT -> DECOMPOSE -> EXECUTE -> VERIFY
VERIFY(pass) -> SUMMARIZE -> PERSIST -> END
VERIFY(fail) -> RECOVER -> EXECUTE
```

---

## 检查点规范

### 默认路径

- `.aimax/state/loop-state.json`

### 快照字段

```json
{
  "run_id": "loop-20260226-001",
  "task": "重构支付模块",
  "current_state": "EXECUTE",
  "current_step_index": 2,
  "steps_total": 5,
  "retries": { "step-2": 1 },
  "gates": {
    "build": "pass",
    "tests": "pass",
    "lint": "pending"
  },
  "next_action": "继续执行 step-3",
  "updated_at": "2026-02-26T12:00:00Z"
}
```

---

## 执行策略

### 1. 先建状态，再执行业务

- 不允许“直接开改”跳过状态定义
- 每个阶段都要有进入条件和退出条件

### 2. 小步推进

- 一次只推进一个子步骤
- 每完成一步就写入检查点

### 3. 失败恢复

- 第 1 次失败：微调当前方案
- 第 2 次失败：替代实现路径
- 第 3 次失败：回滚并输出人工决策建议

---

## 输出示例

```markdown
## 🔄 Loop 执行状态

- run_id: loop-20260226-001
- 状态: VERIFY
- 进度: 3/5
- 门禁: build✅ test✅ lint❌
- 重试: step-3 -> 1/3
- 下一步: 进入 RECOVER 修复 lint
```

---

## 命令示例

```bash
/auto:loop 对订单结算链路做分步优化，支持中断恢复
```

```bash
/auto:loop 继续上次任务，从检查点恢复执行
```

### 终端执行器（可选）

如果你希望在终端里直接驱动检查点状态，可使用 `aimax loop`：

```bash
# 初始化
aimax loop init --task "重构订单结算" --steps "分析,重构,验证"

# 查看状态
aimax loop status

# 推进状态（VERIFY 时可带 pass/fail）
aimax loop next --verify pass
aimax loop next --verify fail --gates "build=pass,tests=fail"

# 恢复提示
aimax loop resume
```

---

## 与其他命令协作

- `/auto:plan`：先得到高层分解
- `/auto:loop`：执行状态机编排
- `/auto:tdd`：在 EXECUTE 阶段保证回归安全
- `/auto:evolve`：在 VERIFY/SUMMARIZE 阶段评估收敛
