---
name: auto:dashboard
description: 聚合最近 N 次 run 的执行数据，展示趋势和瓶颈
---

# /auto:dashboard — 运行数据聚合

> 从 `.auto/runs/` 历史数据中提取趋势，帮助用户了解 `/auto` 的长期表现。

## 数据来源

遍历 `.auto/runs/*/` 下的标准工件：

- `route-decision.md` → 策略分布、复杂度分布
- `verify-report.md` → gate 通过率、常见失败
- `quest-results.md` → Quest 数量、成功率
- `learn-cards.md` → 知识沉淀频率
- `index.md` → 变更统计

## 输出内容

### 1. 执行概览

```
最近 10 次 run:
  成功: 8 | 部分: 1 | 失败: 1
  策略分布: 探索 4 | 修复 3 | 实现 2 | 重构 1
  平均 Quest 数: 3.2
```

### 2. Gate 健康度

```
Gate 通过率（最近 10 次）:
  build:            10/10 (100%)
  test:             9/10  (90%)
  lint:             10/10 (100%)
  self-verification: 8/10  (80%)  ⚠️
  skill-activation:  7/10  (70%)  ⚠️
  knowledge-reuse:   6/10  (60%)  ⚠️
  clean-state:       9/10  (90%)
```

### 3. Skill 激活频率

```
Top-5 激活 Skill:
  1. systematic-debugging  (6 次)
  2. test-plan-writer      (5 次)
  3. workflow-patterns      (4 次)
  4. error-patterns         (3 次)
  5. code-style-enforcer    (3 次)

从未激活: init-project, java-patterns
```

### 4. 知识复用率

```
insight 引用命中率趋势:
  最近 5 次: 72% → 78% → 65% → 80% → 85%
  平均: 76%
  趋势: ↑ 上升
```

### 5. 瓶颈识别

```
最常失败的 gate: skill-activation (30% warning/fail)
最常重试的 Quest 类型: 测试关 (2 次平均重试)
建议: 检查 skill 激活证据记录是否充分
```

## 执行方式

### 自动聚合（推荐）

```bash
# 使用 dashboard.js 脚本聚合最近 N 次 run（默认 10）
node scripts/dashboard.js [limit]

# 示例
node scripts/dashboard.js 20  # 聚合最近 20 次 run
```

### 手动提取（兼容模式）

```bash
# 读取最近 N 次 run（默认 10）
ls -d .auto/runs/*/ | sort -r | head -10

# 对每个 run 提取关键指标
for run in $(ls -d .auto/runs/*/ | sort -r | head -10); do
  # 策略
  grep -o "strategy.*" "$run/route-decision.md" | head -1
  # gate 结果
  grep -c "status.*pass" "$run/verify-report.md"
  grep -c "status.*fail\|status.*warning" "$run/verify-report.md"
  # quest 数
  grep -c "questId" "$run/quest-results.md"
done
```

### 生成 metrics.json（首次使用）

```bash
# 为最近的 run 生成 metrics.json
node scripts/generate-metrics.js

# 为特定 run 生成
node scripts/generate-metrics.js run-20260629-135957

# 批量生成所有 run 的 metrics
for run in $(ls -d .auto/runs/run-* | xargs -n1 basename); do
  node scripts/generate-metrics.js "$run"
done
```

## 使用场景

- 定期回顾 `/auto` 表现（建议每 5-10 次 run 后）
- 诊断为什么某类任务总是需要重试
- 发现从未被激活的 skill（可能触发条件需要优化）
- 验证知识复用机制是否真正生效

## 与其他子命令的关系

- `/auto:status`：展示当前状态（单次快照）
- `/auto:dashboard`：展示历史趋势（多次聚合）
- `/auto:learn`：产出知识；dashboard 消费知识产出的统计
