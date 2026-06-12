---
name: plan-ensemble
description: 视角集成规划 — PLAN 阶段对高复杂度任务并行派出 2-3 个异质视角 subagent 各出计划草案，再以分歧点聚焦 + 评分矩阵合成唯一 QuestMap。当策略=重构、或策略=实现且复杂度 high、或 brainstorming 识别出 ≥2 条 trade-off 不明的实现路径、或用户要求"多角度规划"/"多方案对比择优"时，必须加载此 skill。普通任务禁止触发（维持单计划 + Premortem，零额外成本）。
tags: [plan-ensemble, planning, perspectives, parallel, synthesis, plan-phase, debate, methodology]
---

# Plan Ensemble — 视角集成规划方法论

> 理论依据：多视角辩论合成优于单计划与多数投票（NeurIPS 2025, arXiv:2510.12697）；视角多样性是收益的决定因素，同质视角收益消失（ChatEval）；一轮"异质出案 + 一次合成"即可获得大部分收益，无需多轮辩论（ACL 2026 受控研究）。隔离发散防锚定借鉴 ADHD skill（github.com/uditakhourii/adhd）。
> 与 `brainstorming` 的分工：brainstorming 是**方案级、用户选择**（OAuth vs JWT，串行列举）；plan-ensemble 是**视角级、并行竞争**（同一目标下不同规划哲学各自出完整计划草案，AI 合成）。brainstorming 命中升级条件时升级到本 skill。

## 快速使用

```
/auto 重构 .auto 协议对象的落盘结构
/auto --deep-think 把单体服务拆成模块化架构
/auto 从多个角度规划这次迁移，选最优方案执行
```

---

## 使用时机

**必须加载**（满足任一）：

- 策略 = 重构（架构级变更天然多视角冲突）
- 策略 = 实现 且 复杂度 = high（Quest 预估 ≥ 5 或跨 ≥ 3 模块）
- `brainstorming` 列出 ≥ 2 条路径后 trade-off 仍不明朗（利弊对冲，无明显推荐）
- 用户显式要求多角度规划 / 多计划对比择优

**不要触发**：

- 策略 = 探索 / 修复（单链已足够）
- 实现策略且复杂度 low/medium（现有单计划 + 2.4 Premortem 已覆盖）
- 上下文预算红区（成本约为单计划 2 倍，红区禁用）
- 用户已指定唯一方案且无架构分歧

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 触发门槛核验：重构 / 实现+high / brainstorming 升级 / 用户显式要求，四者满足其一
- [ ] 视角先选：从视角菜单选 2-3 个**真正异质**的视角（同质视角无收益）
- [ ] 隔离并行出案：每视角一个只读 subagent，最小上下文（需求原话 + 技术栈 + 视角章程），零共享，各产出 ≤ 30 行草案
- [ ] 分歧点清单先行：合成前先列出草案间分歧点（= 硬问题），写入 QuestMap.pitfalls
- [ ] 评分矩阵合成：目标契合 / 风险 / 成本 / 可演进四维选主案，嫁接 runner-up 最佳元素
- [ ] 产出唯一 QuestMap 走既有 2.6 流程，ensemble 过程落盘 plan-ensemble.md

**硬约束** (constraints):

- 视角数严格 2-3 个，禁止 ≥ 4（成本失控且评审疲劳）
- 发散期零共享上下文：subagent 之间不可见彼此草案（防锚定）
- 合成不是多数投票：必须给出评分矩阵 + 嫁接说明
- 门槛未命中时禁止触发；红区禁止触发

**输出模板** (output):

- 视角清单（含选择理由）→ 各视角草案（≤30 行/个）→ 分歧点清单 → 评分矩阵 → 合成决策（主案 + 嫁接项）→ 唯一 QuestMap

**反模式** (anti-patterns):

- 三个视角章程雷同（"都从工程角度"）→ 收益消失，纯烧 token
- 主窗口自己演三个视角 → 共享上下文锚定，等于没做
- 多数投票选计划 → 丢失 runner-up 的局部最优元素
- 给 subagent 传完整 QuestMap 或全部历史 → 违反最小上下文隔离

---

## 核心流程（4 步）

### 第 1 步：触发门槛核验

| 条件                                       | 判定         |
| ------------------------------------------ | ------------ |
| 策略 = 重构                                | 直接触发     |
| 策略 = 实现 且 复杂度 = high               | 触发         |
| brainstorming 后 ≥ 2 条路径 trade-off 不明 | 升级触发     |
| 用户显式要求多角度规划                     | 触发         |
| 上下文预算 = 红区                          | **一票否决** |

未命中 → 跳过本 skill，走既有单计划流程。

### 第 2 步：视角先选（2-3 个异质视角）

从菜单按任务信号选取，**必须异质**（覆盖不同失败模式）：

| 视角       | 章程（charter，注入 subagent prompt）                        | 适合任务信号        |
| ---------- | ------------------------------------------------------------ | ------------------- |
| 最小变更派 | 以最小 diff 达成目标，复用现有机制优先，宁可留 TODO 不动架构 | 改动波及面大        |
| 演进架构派 | 以 6 个月后的扩展需求为准设计，接受本次成本换长期可维护      | 架构级 / 平台型变更 |
| 风险回滚派 | 每步必须可独立回滚，失败半径最小化，优先保证可恢复性         | 生产系统 / 数据迁移 |
| 性能派     | 以延迟/吞吐/资源为第一目标，接受复杂度换性能                 | 性能需求显式        |
| 安全派     | 以攻击面最小化为第一目标，输入验证/权限/密钥优先             | route 标记安全敏感  |
| 运维派     | 以可观测/可诊断/可降级为第一目标                             | daemon / 长运行系统 |

选择规则：默认「最小变更派 + 演进架构派」二元对抗起步；任务信号命中第三视角时加选；安全敏感任务必含安全派。

### 第 3 步：隔离并行出案

每视角调度一个**只读** subagent（同一消息并行发出）：

- Claude Code：`Agent(subagent_type: "architect")`，prompt 注入视角章程；安全派用 `Agent(subagent_type: "security-reviewer")`
- Codex 等无 subagent 运行时：降级为同窗口分段独立推演，每段开头复读章程并显式禁止引用前一段结论（标注 `degraded: no-isolation`）

**最小上下文**（每个 subagent 只给这三样）：用户需求原话 + 技术栈/约束摘要（≤10 行）+ 本视角章程。禁止传入完整 QuestMap、历史会话、其他视角任何信息。

**草案合约**（≤ 30 行，非完整 QuestMap）：

```markdown
## 视角：<名称>

- 拆解大纲：<3-7 步，每步一句>
- 关键 trade-off：<本视角接受了什么代价，1-2 条>
- 风险清单：<2-3 条，含触发条件>
- 成本预估：<触及文件数 + 预估行数 + 是否需新依赖>
```

### 第 4 步：评审合成（非多数投票）

1. **分歧点清单先行**：对比草案，列出结构性分歧（拆解顺序 / 回滚策略 / 抽象层次等）。**分歧点 = 任务真正的硬问题**，全部写入 `QuestMap.pitfalls`
2. **评分矩阵**（每草案 0-10 × 4 维）：目标契合（对 userIntent 原话的覆盖）/ 风险（失败半径与可恢复性）/ 成本（token + 改动量）/ 可演进（后续需求兼容）
3. **选主案 + 嫁接**：最高分为主骨架；逐条检查 runner-up 草案，其单项更优的元素（如风险派的回滚步骤）嫁接进主案，标注来源视角
4. **合成唯一 QuestMap**：进入既有 2.6 流程（quest-designer 或 Micro QuestMap）；ensemble 全过程落盘 `.auto/runs/<runId>/plan-ensemble.md`

---

## 与 auto-cli 集成

| 集成点        | 说明                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| PHASE 2 PLAN  | 2.6 方案探索前置的升级分支；产出物是唯一 QuestMap 的输入，不替代 QuestMap                |
| brainstorming | 上游入口：brainstorming 列路径后 trade-off 不明 → 升级到本 skill；用户已明确选向则不升级 |
| PHASE 2.4     | 分歧点清单直接喂 Premortem / QuestMap.pitfalls                                           |
| Subagent 隔离 | 复用 VERIFY 的最小上下文原则（touchFiles + objective 级别的裁剪）                        |
| 上下文预算    | 绿区可 3 视角；黄区限 2 视角；红区禁用                                                   |
| PHASE 6 LEARN | 被采纳主案的视角记入 LearnCard(category=feedback)，长期统计哪类任务哪个视角胜率高        |

---

## 验收标准

- [ ] 触发时四条门槛至少一条成立，且非红区
- [ ] 视角章程两两可区分（覆盖不同失败模式）
- [ ] 每个草案 ≤ 30 行且含四要素（大纲/trade-off/风险/成本）
- [ ] 分歧点清单非空并进入 QuestMap.pitfalls（草案完全一致时记录"无分歧，ensemble 提前收敛"）
- [ ] 合成说明含评分矩阵 + 嫁接来源标注
- [ ] `.auto/runs/<runId>/plan-ensemble.md` 落盘完整过程

---

## 参考

- 多 agent 辩论评审：arXiv:2510.12697（NeurIPS 2025）
- 视角多样性决定收益：ChatEval / ACL 2026 受控研究（arXiv 索引见 run-20260613-plan-ensemble-research）
- 隔离发散防锚定：github.com/uditakhourii/adhd
- 分歧点聚焦评审：github.com/johannesjo/parallel-code
- 上游入口：`skills/brainstorming/SKILL.md`
