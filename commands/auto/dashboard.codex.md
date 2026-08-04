---
name: auto:dashboard
description: Codex 版运行数据聚合 - 从 .auto/runs 提取趋势，不依赖 Claude hooks
---

# /auto:dashboard — Codex 运行数据聚合

> 从 `.auto/runs/` 历史数据中提取趋势。本文件是 Codex 侧真源；通用逻辑与 Claude 版一致，差异仅在运行时约束。

## Codex 运行时约束

- **无 Claude hooks**：不会有 SessionStart / Stop 自动补 `metrics.json` 或 dirty 累积；需要数据时主动跑脚本。
- **无 `~/.claude` 依赖**：只读仓库内 `.auto/runs/` 与可选的 `scripts/dashboard.js`。
- **优先脚本，其次手工**：有 `scripts/dashboard.js` 时用 Node 聚合；没有再降级为 grep 遍历。

## 数据来源

遍历 `.auto/runs/*/` 下的标准工件（**不限定 `run-` 前缀**；排除 `archive/`）：

- `route-decision.md` → 策略分布、复杂度分布
- `verify-report.md` → gate 通过率、常见失败
- `quest-results.md` → Quest 数量、成功率
- `learn-cards.md` → 知识沉淀频率
- `index.md` → 变更统计
- `metrics.json` → 若存在则优先（LEARN 6.1.1 / `generate-metrics.js`）

## 输出内容

与 Claude 版相同五块：执行概览、Gate 健康度、Skill 激活频率、知识复用率、瓶颈识别。数字必须来自真实文件或脚本输出，禁止编造。

## 执行方式

### 1. 自动聚合（推荐）

```bash
# 仓库根目录
node scripts/dashboard.js [limit]

# 示例：最近 20 次
node scripts/dashboard.js 20
```

### 2. 补齐 metrics（可选）

```bash
# 最新 run（自动发现，含无 run- 前缀历史目录）
node scripts/generate-metrics.js

# 指定 runId
node scripts/generate-metrics.js 20260523-ecosystem-enhancement-scan
```

### 3. 手动提取（无 Node / 脚本不可用时）

```bash
ls -d .auto/runs/*/ 2>/dev/null | grep -v '/archive' | sort -r | head -10

for run in $(ls -d .auto/runs/*/ 2>/dev/null | grep -v '/archive' | sort -r | head -10); do
  echo "== $run =="
  grep -E "strategy|complexity" "$run/route-decision.md" 2>/dev/null | head -3
  grep -c "pass" "$run/verify-report.md" 2>/dev/null
done
```

## 使用场景

- 定期回顾 `/auto` 表现（建议每 5–10 次 run）
- 诊断反复重试的 Quest / 低通过率 gate
- 发现从未激活的 skill
- 验证知识复用是否真的在涨

## 与其他子命令

- `/auto:status`：单次快照
- `/auto:dashboard`：多次趋势（本命令）
- `/auto:learn`：产出知识；dashboard 消费统计

## 反模式

- 把 Claude hooks 或 `ScheduleWakeup` 当成 Codex 已具备的能力来承诺
- 用 `run-*` glob 扫 runs（会漏掉历史 `<YYYYMMDD>-*` 目录）
- 无文件依据时编造通过率 / 次数
