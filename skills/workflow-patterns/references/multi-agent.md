---
name: workflow-patterns:multi-agent
description: 由 workflow-patterns.md 主文件按需加载。完整上下文见主文件。
---

# Multi-Agent 编排模式参考

> 由 `workflow-patterns.md` 主文件按需加载。完整上下文见主文件。

---

## 选择决策树

```
先确认委派授权、真实宿主能力及独立子任务收益；不满足则由当前执行者完成。
任务是否可拆分？
+-- 否 -> 当前单执行者
+-- 是 -> 子任务之间是否有依赖？
    +-- 有依赖 -> Sequential Chain（串行链）
    +-- 无依赖 -> 需要总协调者吗？
        +-- 需要 -> Orchestrator-Workers（主从模式）
        +-- 不需要 -> Parallel Fan-Out（并行扇出）

存在独立验收收益且已授权？-> 按需采用 Evaluator-Optimizer（评估优化）
```

## 模式详解

| 模式                 | 流程                   | 适用场景                | Quest 数量建议 |
| -------------------- | ---------------------- | ----------------------- | -------------- |
| Sequential Chain     | A -> B -> C            | 后一步依赖前一步输出    | 1-5 关         |
| Parallel Fan-Out     | Router -> [A, B, C]    | 子任务无依赖            | 6-15 关        |
| Orchestrator-Workers | 总指挥 -> 分配 -> 收集 | 复杂任务需协调          | 15+ 关         |
| Evaluator-Optimizer  | 产出 -> 审查 -> 迭代   | 质量要求高（最多 3 轮） | 追加于任何模式 |

## 最佳实践

1. **上下文隔离**：每个子 Agent 只接收它需要的上下文
2. **并行 Agent 不修改同一文件**：如有冲突需串行化
3. **失败不阻塞**：单个 Agent 失败设定超时和重试
4. **结果聚合**：owner 核对证据、解决冲突并验证最终产物；不按最新提交或票数判正确

## Skill 注入规则

编排时按技术栈和任务类型显式选择 Skill，不做 grep 匹配：

| 自动注入时机 | Skill                               | 条件                                 |
| ------------ | ----------------------------------- | ------------------------------------ |
| SCAN 阶段    | dependency-analyzer, init-project   | 如 CLAUDE.md 缺失则触发 init-project |
| PLAN 阶段    | workflow-patterns                   | Quest 设计参考                       |
| EXECUTE 阶段 | 按编排计划声明                      | Skill 内容写入 Agent prompt          |
| VERIFY 阶段  | code-style-enforcer, error-patterns | code-reviewer/verification 自动附带  |

| 技术栈   | 自动关联 Skill       |
| -------- | -------------------- |
| Java     | java-patterns        |
| 性能相关 | performance-patterns |
| 错误处理 | error-patterns       |

## Agent 交接规则

1. **上游产出 = 下游输入**：交接时显式声明数据类型和格式
2. **受控回流**：默认按依赖交接；失败时携证据回流对应阶段，不重复启动整个控制器
3. **失败处置**：连续两轮无进展时重新调查根因，必要时更换方法；不默认调用固定角色
4. **结果回传**：最终结果回传给编排器
