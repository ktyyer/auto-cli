# Self-bench（指令包自举基准）

**目的**：用 10 个固定、可复现的任务证明 auto-cli 在「纯 MD 指令包」场景的可靠性，**不**依赖完整 SWE-Bench 烧钱。

**运行方式**（手动或 `/auto` 实现策略逐题）：

```text
/auto self-bench #N <题干一句话>
```

每题记录到 `.auto/runs/self-bench-NN-<slug>/`，汇总表填下方「结果」列。

## 评分

| 结果 | 含义 |
| --- | --- |
| **pass** | 验收命令全绿且无 scope 扩张 |
| **partial** | 主要目标达成，有小缺陷 |
| **fail** | 未达验收或破坏定位 |

**通过率** = pass / 10（partial 计 0.5 可选）

## 题目

| # | 题干 | 策略建议 | 验收（CHECKER） |
| ---: | --- | --- | --- |
| 1 | 统一某文档 skills 计数与 `ls skills` 一致 | 修复 | `rg` 无矛盾 38/39 |
| 2 | CONTRIBUTING 与 package.json scripts 对齐 | 修复 | 无虚构 `lint`/`test:coverage` |
| 3 | 为当前 run 生成 metrics.json | 实现 | `test -f .auto/runs/<id>/metrics.json` |
| 4 | 重建上下文索引且 root 含 commands/ | 实现 | `node scripts/build-context-index.js` 输出含 commands |
| 5 | 写或更新 1 个 dogfood 案例 | 实现 | `docs/case-studies/` 非模板 md ≥1 |
| 6 | validate-run 对完整 run 返回 PASS | 修复/验证 | `node scripts/validate-run-completeness.js --run <id>` exit 0 |
| 7 | community hello-auto 结构通过 validate-references | 验证 | validate-references 无 community 错误 |
| 8 | 探索策略产出 route + 可行动清单（无代码） | 探索 | 有 route-decision 或等价摘要 |
| 9 | LEARN 分发 1 条 trap/pattern 到 insights | 实现 | insights 文件有本次 run 锚点 |
| 10 | 最小 diff 修 README 死链或过时「待创建」 | 修复 | 链接目标存在 |

## 基线（2026-07-24 Wave 0–2 dogfood）

| # | 结果 | 证据 run |
| ---: | --- | --- |
| 1 | pass | run-20260724-141527 |
| 2 | pass | run-20260724-141527 |
| 3 | pass | run-20260724-141527 / 142922 |
| 4 | pass | run-20260724-141527 |
| 5 | pass | auto-cli-self-host.md |
| 6 | pass | validate after P1-3 |
| 7 | pass | Wave2 hello-auto |
| 8 | pass | run-20260724-111116 |
| 9 | pass | Wave0/1 LEARN |
| 10 | pass | README Who's Using / discovery |

**基线通过率**: 10/10（本仓库 dogfood，非盲测）

## 规则

1. 不新增平行入口；不引入业务 runtime  
2. 每题 max 1 次 scope-expand  
3. 对外引用本表时标注「self-bench / dogfood」，勿与 SWE-Bench 混淆  
