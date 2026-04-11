# Multi-Agent 编排模式参考

> 由 `workflow-patterns.md` 主文件按需加载。完整上下文见主文件。

---

## 选择决策树

```
任务是否可拆分？
+-- 否 -> 单 Agent（quest-designer）
+-- 是 -> 子任务之间是否有依赖？
    +-- 有依赖 -> Sequential Chain（串行链）
    +-- 无依赖 -> 需要总协调者吗？
        +-- 需要 -> Orchestrator-Workers（主从模式）
        +-- 不需要 -> Parallel Fan-Out（并行扇出）

质量要求特别高？-> 追加 Evaluator-Optimizer（评估优化）
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
4. **结果聚合**：Union（审查类）/ Latest Wins（修复类）/ Vote（决策类）

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
2. **单向传递**：Agent 只向下游传递，不反向调用
3. **失败升级**：重试 2 次后仍失败，且已形成 `failureContext` → 升级到 build-error-resolver
4. **结果回传**：最终结果回传给编排器
