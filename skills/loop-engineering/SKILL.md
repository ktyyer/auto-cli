---
name: loop-engineering
description: 把 /auto 从一次性流水线升级为按节奏自主循环的「loop 引擎」 — 解析 interval 参数(5m/30m/2h)、分离 DOER 与 CHECKER、用 ScheduleWakeup/CronCreate 调度迭代、跨迭代收敛判定与学习回灌。当用户带时间间隔调用 /auto(如 /auto 5m 盯 CI)、要求后台盯盘/自主迭代/自愈/周期巡检时激活。
tags:
  [
    loop,
    loop-engineering,
    autonomous,
    scheduling,
    cron,
    convergence,
    doer-checker,
    self-healing,
    background,
    recurring,
    schedulewakeup
  ]
---

# Loop Engineering — /auto 自主循环引擎

> 核心洞察：`/auto` 的一次性 6 PHASE 是 **单次 loop**。Loop engineering 只做一件事 —— **给这单次 loop 装上节奏(DOER)与收敛判官(CHECKER)，让它按时重复，直到目标达成或预算耗尽**。auto-cli 的记忆(insights)、持久化(git hooks)、质量门禁(VERIFY gates)本就是 loop 三件套,只缺调度层。

## 理论基础

本 skill 融合 2026 年「loop engineering」范式与实证方法论：

| 方法论                                                   | 核心机制                                                               | 在本 skill 的映射                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Loop Engineering**（Boris Cherny / Addy Osmani, 2026） | "My job is to write loops" — harness 跑在定时器上,自我 spawn、自我喂料 | `/auto <interval> <goal>` = 写 loop;ScheduleWakeup = 定时器     |
| **DOER + CHECKER**（Anthropic 官方 loop 模型）           | DOER 是生产的 AI,CHECKER 是判定「够了没」的部分;CHECKER 才是难点       | auto-cli 6 PHASE = DOER;`clean-state` gate + 收敛判据 = CHECKER |
| **Ralph Loop**（社区 → 官方 ralph-loop 插件）            | Stop Hook 拦截 + Completion-Promise 退出条件,持续自纠直至完成          | 收敛判据未达 → ScheduleWakeup 续跑;达成 → 退出                  |
| **Agentic Budget Caps**（Agent SDK）                     | `max_turns` / `max_budget_usd` 兜底,防 3am 滚屏烧钱                    | `loopBudgets`(maxIterations / maxBudgetUsd / maxWallClock)      |
| **非退化性收敛**（Lyapunov 类比）                        | 每轮剩余失败数单调不增 → 有界有限步收敛                                | 每轮收敛度不得回退,回退即回滚 + 换策略                          |

**关键告诫**(2026 社区数据):过夜自主产出约 **25% 被丢弃**。原因不是模型,是 **CHECKER 缺位** —— 没人定义「done 长什么样」。**没有可度量的收敛判据,就不准开 loop。**

## 激活摘要

**何时激活**：

- 用户带 interval 调用 `/auto`:`/auto 5m <goal>` / `/auto 30m <goal>` / `/auto 2h <goal>`
- 用户语义要求循环:盯盘、自主迭代、自愈、周期巡检、CI babysit、持续重构
- 单次 `/auto` 已收敛但目标本身是长期持续性的(如「保持依赖最新」「守住测试覆盖率」)

**与相邻 skill/agent 的边界**：

| 场景                                    | 使用哪个                         |
| --------------------------------------- | -------------------------------- |
| 一次性任务,跑完即止                     | `/auto <task>`(不开 loop)        |
| 单次 run 内反复试错直到通过             | `feedback-loop`(I/O 自验证闭环)  |
| **按节奏重复跑 /auto 直至长期目标达成** | **`loop-engineering`(本 skill)** |
| 大规模并行重构(一次性,多 worktree)      | `using-git-worktrees` + `/batch` |

**interval 参数契约**：

| 写法                       | 含义                  | 默认 / 上限                       |
| -------------------------- | --------------------- | --------------------------------- |
| `<N>m`                     | 每 N 分钟             | 缺省 10m                          |
| `<N>h`                     | 每 N 小时             | —                                 |
| `<N>s`                     | 每 N 秒               | 仅低延迟巡检用                    |
| 无 interval + 目标是持续性 | 默认 10m,dynamic 模式 | 单 loop 最长 3 天(72h),到期自动停 |

**检查清单**(开 loop 前必过)：

- [ ] 收敛判据已写成**可度量条件**(命令退出码 / 正则 / 数值阈值),不是「感觉差不多了」
- [ ] 预算已设:`maxIterations` + `maxBudgetUsd`(或 token 上限)+ `maxWallClock`
- [ ] 关键路径已 commit,可回滚(loop 改坏能 `git reset`)
- [ ] 调度机制已选:会话内动态 → ScheduleWakeup;跨会话持久 → CronCreate
- [ ] 每轮产物落 `.auto/runs/<runId-iter-N>/`,跨迭代可追溯

**硬约束**：

- **无收敛判据不开 loop** —— 缺 CHECKER 的 loop = 烧钱机器
- **每轮必须跑 VERIFY clean-state** —— 未过 clean-state 的轮次产出不得沉淀,直接进下一轮重试
- **收敛度回退即回滚** —— 第 N 轮收敛度 < 第 N-1 轮,立即 `git reset` 当前轮,换策略再跑
- **预算耗尽必停** —— 不允许自动重启 loop;新会话由用户显式确认

---

## Step 1:参数识别与模式选择

解析 `/auto` 入参首 token,判定是否进 loop 模式:

```
/auto 5m 盯 CI 直到全绿                    → loop 模式, interval=5m, 固定间隔
/auto 30m 把测试覆盖率从 62% 提到 80%       → loop 模式, interval=30m, 目标收敛
/auto 把这个 bug 修了                       → 非 loop(无 interval, 单次 6 PHASE)
/auto --watch 盯着 PR 状态变化通知我        → loop 模式(dynamic, 用户语义触发)
/auto 把测试覆盖率提到 80%                  → loop 模式(收敛型语义自动触发, 默认 10m)
```

> 语义触发分两组:**持续型**(盯盘/巡检/持续/守住/保持/自主/自愈)和**收敛型**(直到/达到/提到/降到/收敛 + 可度量目标)。收敛型关键词是启发式,最终由下方硬约束「无 CHECKER 不开 loop」过滤误命中(如"达到 O(n) 性能"无可度量收敛判据 → 不开 loop)。

**三种 loop 模式**(按目标性质选):

| 模式             | 目标性质           | 退出条件                | 调度                |
| ---------------- | ------------------ | ----------------------- | ------------------- |
| **固定间隔巡检** | 周期性状态检查     | 用户停 / 到期(72h)      | CronCreate 或 定时  |
| **目标收敛**     | 达成可度量目标即停 | 收敛判据满足 / 预算耗尽 | ScheduleWakeup 动态 |
| **持续维持**     | 长期守住某指标     | 用户停(无自然终止)      | CronCreate 持久     |

> 默认走「目标收敛」—— 它有自然退出,最安全。无明确退出条件的改问用户或降级为单次。

---

## Step 2:定义 DOER + CHECKER(收敛契约)

**这是 loop 能不能成的关键**。开 loop 前必须把两件事写进 `.auto/runs/<loopId>/loop-contract.md`（`loopId` = 本 loop 首轮 run 的 `runId`；各迭代 run 以 `correlationId` 关联；loop-contract / loop-state / loop-summary 为派生对象，性质同 `quest-status.json`，不新增协议对象类型）:

**DOER(每轮干什么)** = 一轮聚焦的 6 PHASE:

- SCAN → 只看「上一轮遗留 + 本轮目标增量」,不全量重扫
- PLAN → 单关或 ≤3 关,不调 quest-designer(轻量)
- EXECUTE → 最小变更
- VERIFY → **必跑 clean-state gate**(本轮产物的硬门禁)
- LEARN → 跨迭代回灌(见 Step 6)

**CHECKER(够了没)** = 可度量收敛判据,三选一或组合:

```text
1. 命令退出码:  npm test ; [ $? -eq 0 ]   → 退出码 0 即收敛
2. 正则匹配:    npm test 2>&1 | grep -q "0 failing"   → 命中即收敛
3. 数值阈值:    覆盖率 ≥ 80% / bug 数 ≤ 0 / lint 错误 = 0
```

**反例(不合格的 CHECKER)**:

- ❌「代码质量提高了」(不可度量)
- ❌「看起来修好了」(无命令)
- ❌「测试基本通过」(无阈值)

> 经验:CHECKER 写不出来说明目标本身没想清楚。这时不开 loop,先回 `/auto` 单次把目标拆明白。

---

## Step 3:选择调度机制

| 机制             | 适用                             | 生命周期         | 推荐场景                     |
| ---------------- | -------------------------------- | ---------------- | ---------------------------- |
| `ScheduleWakeup` | 会话内动态自调度(/loop 动态模式) | 跟随当前 session | 目标收敛、短中期(< 数小时)   |
| `CronCreate`     | 跨会话持久定时                   | 可 durable 写盘  | 持续维持、跨天盯盘、重启不断 |

**选择规则**:

- 目标有自然终止 + 同一会话内能完成 → **ScheduleWakeup**(轻量,免持久化)
- 用户要关终端也不断 / 跨天 / 重启后仍跑 → **CronCreate(durable: true)**
- 默认 ScheduleWakeup;用户说「过夜」「挂着」「重启后继续」→ CronCreate

**Claude Code 侧**:优先用本 session 的 ScheduleWakeup,把 `/auto <interval> <goal> #loop=<loopId>` 作为下次唤醒的 prompt 回灌 —— `#loop=<loopId>` 是跨迭代状态锚点,下一轮 SCAN 据此定位 `.auto/runs/<loopId>/loop-state.json` 续上预算与收敛史(不带锚点则每轮 reset,`maxBudgetUsd` 永不耗尽、退化检测失效)。interval 转 `delaySeconds`(`5m`=300,但避开整点:`5m`→270s 或 330s 防 fleet 撞峰)。`CronCreate` 同理,prompt 字段同样带 `#loop=<loopId>`。

**Codex / 无 ScheduleWakeup 运行时降级**:用系统 `cron` / `schtasks`(Windows)/ `at` 外部调度,或退化为人手触发 —— 文档明示降级,不伪造「正在后台跑」。

---

## Step 4:单次迭代执行

每轮 tick 触发时,跑一轮**聚焦版** 6 PHASE(非完整重跑):

```text
[loop iter N] tick 触发
  ├─ 读 .auto/runs/<loopId>/loop-state.json(上轮收敛度 / 遗留)
  ├─ SCAN:增量扫(只看上轮 trap + 本轮目标)
  ├─ PLAN:≤3 关 Micro QuestMap
  ├─ EXECUTE:最小变更
  ├─ VERIFY:clean-state gate(硬门禁)
  ├─ CHECKER:跑收敛判据命令
  │    ├─ 达成 → 写 loop-state(converged=true),进 Step 5 终止
  │    ├─ 收敛度↑ → 写 state, ScheduleWakeup 续跑
  │    └─ 收敛度↓/回退 → git reset 本轮, 换策略, ScheduleWakeup 续跑
  └─ LEARN:跨迭代 trap/pattern 回灌(Step 6)
```

**loop-state.json**(每轮更新,跨迭代真源):

```json
{
  "loopId": "loop-<id>",
  "goal": "<目标>",
  "mode": "fixed | convergent | sustain",
  "interval": "5m",
  "iteration": 7,
  "converged": false,
  "convergenceHistory": [
    { "iter": 1, "metric": "覆盖率 62%", "status": "progress" },
    { "iter": 7, "metric": "覆盖率 79%", "status": "progress" }
  ],
  "budget": { "spentIterations": 7, "maxIterations": 20, "spentUsd": 1.2, "maxUsd": 10 },
  "lastStrategy": "补 service 层测试",
  "rollbackRef": "refs/auto-snapshots/<ts>"
}
```

---

## Step 5:收敛判定与终止

**终止条件**(满足任一即停 loop):

1. ✅ **CHECKER 达成** —— 收敛判据满足,写 LearnCard(pattern: 怎么收敛的),停
2. 🛑 **预算耗尽** —— `iteration ≥ maxIterations` 或 `spentUsd ≥ maxUsd`,写 LearnCard(trap: 卡在哪),停
3. 🛑 **到期** —— wall clock ≥ 72h,停
4. 🛑 **退化超阈** —— 连续 3 轮收敛度回退,写 LearnCard(trap: 根因假设),停
5. 👤 **用户中断** —— 停止调度（`CronDelete` / 不再续 `ScheduleWakeup`）或 Ctrl-C，停

**终止时必做**:

- 清理 ScheduleWakeup / CronCreate(避免幽灵 tick)
- 写 `.auto/runs/<loopId>/loop-summary.md`(N 轮 / 是否收敛 / 总成本 / 关键 trap)
- 收敛则 commit;未收敛则保留工作树 + session-continuity,交用户决策

---

## Step 6:跨迭代学习与防退化

loop 的飞轮靠**跨轮知识复用**:

| 机制                 | 说明                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| **trap 即时回灌**    | 第 N 轮 CHECKER 失败 → 立即写 LearnCard(trap) → 第 N+1 轮 SCAN 自动注入 pitfalls |
| **pattern 复用**     | 第 N 轮收敛度↑ 的策略 → 写 LearnCard(pattern) → 下轮优先复用                     |
| **退化检测**         | 收敛度 < 上轮 → 不写新 trap,先 git reset,根因分析后才记                          |
| **portablePatterns** | scope=stack/universal 的 loop 经验 → 写 skills.json,跨项目复用                   |

**防退化协议**(借鉴 feedback-loop 非退化性):

1. 每轮记录收敛度数值(metric)
2. 第 N 轮 metric < 第 N-1 轮 metric → **立即 git reset 本轮所有变更**
3. 连续 2 轮回退 → 强制换策略(不能只改措辞 / 重试同一路径)
4. 连续 3 轮回退 → 终止 loop,写 trap 请求人工介入

---

## 生产级防护

| 风险                  | 防护                                                            |
| --------------------- | --------------------------------------------------------------- |
| **3am 滚屏烧钱**      | `maxIterations` + `maxBudgetUsd` 硬上限,默认保守(iterations 20) |
| **改坏无法回滚**      | 关键路径先 commit;每轮 PreToolUse auto-snapshot hook 兜底       |
| **幽灵 tick**         | 终止时必清 ScheduleWakeup / CronCreate;loop-state 标 converged  |
| **25% 丢弃率**        | 强制 CHECKER(可度量判据)+ 每轮 clean-state gate,无判据不开 loop |
| **撞峰 fleet**        | interval 转秒时偏移(5m→270s/330s),不卡整点                      |
| ** Codex 无原生调度** | 降级外部 cron/schtasks 或人手触发,文档明示,不伪造后台运行       |

**成本经验值**(社区实测,供 maxBudgetUsd 估算):

- Sonnet 持续跑约 $10.42/h
- 每 15min tick 一次的 agent 约 $48/day
- 过夜 27h 自主会话可完成数十任务,但 ~25% 产出被弃

---

## 与 auto-cli 集成

| PHASE         | loop 模式下的变化                                             |
| ------------- | ------------------------------------------------------------- |
| SCAN 1.8      | 解析 interval → 判定 loop 模式 → 激活本 skill                 |
| SCAN          | 增量扫:读 loop-state.json + 上轮 trap,不全量重扫              |
| PLAN          | Micro QuestMap(≤3 关),不调 quest-designer                     |
| EXECUTE       | 最小变更;遵守 Touch-set Lock + 扩张词刹车                     |
| VERIFY        | **clean-state gate 硬门禁**;未过不沉淀                        |
| CHECKER       | 新增:跑收敛判据命令,更新 loop-state.convergenceHistory        |
| LEARN         | 跨迭代回灌:trap/pattern 即时写 insights,下轮 SCAN 自动注入    |
| RouteDecision | 增 `loopBudgets`(maxIterations / maxBudgetUsd / maxWallClock) |

## 参考 Skills

- **feedback-loop** — 单次 run 内 I/O 自验证闭环(loop 是它的「跨轮版」)
- **self-critique** — 每轮 CHECKER 的自纠视角
- **context-engineering** — 跨迭代上下文预算(loop 最容易烧 token)
- **robustness-patterns** — loop 本身的重试 / 熔断 / 限流
