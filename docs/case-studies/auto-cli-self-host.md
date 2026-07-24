# Case Study: auto-cli 自托管 dogfood

**Name**: auto-cli（本仓库）  
**Website**: https://github.com/ktyyer/auto-cli  
**Industry**: Open Source / AI Developer Tooling  
**Team Size**: 核心维护者少量（git shortlog 显示高度集中）  
**Project Type**: CLI 指令包（Claude Code / Codex slash commands）

---

## Usage Overview

**Start Date**: 2026（持续 dogfood）  
**Frequency**: 每个重大审计 / 发布前用 `/auto` 跑探索或实现策略  
**Primary Use Cases**:

- [x] 代码审查 / 世界级差距分析
- [x] 文档与协议一致性修复
- [x] 工具链（metrics / 上下文索引）加固
- [x] 知识沉淀（LearnCard → insights）

---

## Tech Stack

**Languages**: Markdown（主）, JavaScript（`scripts/` 工具链 only）  
**Frameworks**: Claude Code slash commands + hooks  
**Project Size**: ~39 skills · 10 agents · 22 hook entries · 纯指令为主

---

## What we ran

| Run | 策略 | 目标 |
| --- | --- | --- |
| `run-20260629-135957` | 探索 | 世界级标准初审 |
| `run-20260724-110043` | 探索 | 脚手架 vs 完成真值刷新 |
| `run-20260724-111116` | 探索 | **按项目定位**重标差距 + Wave 0 决策 |
| `run-20260724-141527` | 实现 | Wave 0 信任默认落地（P0-1→P0-4） |

### 可度量结果（Wave 0）

| 指标 | 之前 | 之后 |
| --- | --- | --- |
| Skills 对外计数 | 38/39 混用 | **统一 39**（community 单独说明） |
| CONTRIBUTING scripts | 虚构 `lint` / `test:coverage` | 与 `package.json` 对齐（`npm test` = check） |
| metrics 默认路径 | 脚本存在、多数 run 无文件 | LEARN 强制 + Stop hook 补齐 |
| 上下文索引 | 误判 nodejs/esm，root 空 | `markdown-instructions` + commands/skills/agents/rules |
| 生产案例 | 0 | **1**（本文） |

---

## What worked

1. **协议写盘** — 审计 run 的 route / gap / action-plan 可回溯，Wave 0 可直接按文件施工  
2. **定位过滤器** — 拒绝企业分布式伪 P0，把带宽留给信任默认  
3. **LearnCard** —「脚手架≠完成」「纯 MD 边界话术」写入 traps，防回归  

## Pain points

1. 历史 run 协议残缺率仍高，dashboard 需 incomplete 标注  
2. GitHub 发现层（stars / description）仍弱，需人工 `gh repo edit` 与 awesome PR  
3. Loop 自动调度依赖宿主 runtime gate，文档已降级说明  

---

## Quote

> 指令包的世界级首先是**诚实默认**，不是 skill 数量。

---

**Last updated**: 2026-07-24  
**Evidence runs**: `run-20260724-111116`, `run-20260724-141527`
