---
description: 自主演进命令 - 建立评估驱动闭环（基线、实验、门禁、回滚、经验沉淀），用于持续优化而非一次性修补。
---

# Evolve 命令

`/auto:evolve` 用于把“改进”变成可验证的工程闭环：

1. 建立基线（Baseline）
2. 生成最小实验（Patch）
3. 执行门禁验证（Gates）
4. 判定是否收敛（Pass/Fail）
5. 沉淀经验并进入下一轮

---

## 何时使用

在以下场景优先使用 `/auto:evolve`：

- 需要持续迭代，而不是一次性修复
- 需要“可度量”的优化结论（性能、稳定性、质量）
- 需要建立回归防护（CI 门禁）
- 需要跨项目复用一套可迁移的优化流程

---

## 核心流程

### Step 1: 明确目标与边界

- 业务目标：如响应延迟、错误率、吞吐量
- 工程目标：如覆盖率、构建稳定性、lint/type clean
- 风险边界：如不破坏公共 API、可随时回滚

### Step 2: 建立基线

- 收集当前指标（测试、覆盖率、构建、性能）
- 读取项目现有规范与代码风格
- 输出“本轮前状态”快照

### Step 3: 生成最小增量补丁

- 一轮只改一类问题，避免大范围盲改
- 每个补丁必须包含：
  - 预期收益
  - 影响范围
  - 回滚点

### Step 4: 执行门禁矩阵

```yaml
required:
  - build_or_compile
  - unit_tests
  - lint_typecheck
optional:
  - integration_tests
  - e2e_tests
  - security_scan
  - llm_eval
```

### Step 5: 门禁判定

```yaml
pass_conditions:
  tests: "all pass"
  regressions: "critical = 0"
  coverage: "not decreased"
  perf: "meet target or explain gap"
```

### Step 6: 失败恢复（最多 3 轮）

1. 微调当前方案（缩小改动）
2. 切换替代方案（不同实现路径）
3. 回滚并输出人工决策建议

### Step 7: 经验沉淀

- 记录成功模式（可复用）
- 记录失败反例（可规避）
- 更新下一轮默认约束

---

## 开源借鉴映射

`/auto:evolve` 采用了这些开源项目中可落地的模式：

- `OpenAI Evals`：先评估再优化，避免“感觉变好”
- `SWE-agent`：问题驱动 -> 补丁 -> 验证
- `Aider`：先建立仓库地图，减少上下文噪音
- `Continue`：把检查变成可在 PR 中执行的状态门禁
- `Promptfoo`：评估与红队测试可接入 CI
- `LiteLLM`：多模型路由、重试、fallback 提升执行韧性
- `MCP Servers`：按任务装配外部工具能力，减少硬编码集成

---

## 输出模板

```markdown
## 🔁 演进报告

### 目标
- ...

### 本轮改动
- 文件: ...
- 变更: ...

### 验证结果
- Build: ✅
- Tests: ✅
- Coverage: +1.8%
- Perf: P95 -15%
- Regression: 0 critical

### 结论
- 门禁: 通过/未通过
- 下一轮建议: ...
```

---

## 使用示例

```bash
/auto:evolve 对支付模块做持续优化，目标是 P95 降低 20%
```

```bash
/auto:evolve 为这个仓库建立可复用的回归门禁，覆盖 Node + Python 子项目
```

---

## 与其他命令协作

- 先用 `/auto:plan` 定义大任务分解
- 用 `/auto:tdd` 产出稳定测试护栏
- 用 `/auto:code-review` 做多维审查
- 用 `/auto:evolve` 驱动持续迭代与门禁收敛
