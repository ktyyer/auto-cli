---
name: skill-evaluator
description: 评估和改进现有 Skill 的健康度 — 通过结构评分 + 效果评分双路径，发现最弱维度并做最小改动迭代，保留改进、回滚回归。当用户提到"评估 skill"、"skill 质量如何"、"优化现有 skill"、"skill 不触发"、"检查 skills 目录"、"skill 健康度"，或在 skills/ 目录下的 .md 被编辑后需要做健康检查时，必须加载此 skill。
tags: [skill, evaluation, evolution, quality-gate, verification]
---

# Skill Evaluator — Skill 健康度评估方法论

> 与 `skill-creator` 互补：`skill-creator` 负责**写出**新 skill，`skill-evaluator` 负责**养好**已有 skill。
> 借鉴 Evol-ai/SkillCompass 的评估维度与 alchaincyf/darwin-skill 的"双路径评分 + keep-or-revert"闭环，纯 Markdown 落地，不引入任何运行时依赖。

## 快速使用

```
/auto 评估所有 skill 的健康度
/auto workflow-patterns skill 触发不准，帮我诊断
/auto skill-evaluator 自评一下自己的质量
```

## 使用时机

**必须加载**：

- 用户要求评估 / 审计一个或多个 skill
- Skill 触发不准确（应触发未触发 / 不应触发却触发）
- `.auto/feedback/skills.json` 出现负向信号
- 新写完 skill 需要健康度体检
- 重构或简化现有 skill

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] D1-D7 结构分: 主 agent 直接 Read skill, 按 7 维度评分
- [ ] D8 效果分: 独立 verification agent 做 A/B 对比（有/无 skill 产出质量差异）
- [ ] 诊断最弱维度 → 最小改动改进 → 独立验证 → 保留或回滚
- [ ] 改进后验证: 触发准确率是否提升？产出质量是否改善？

**硬约束** (constraints):

- 结构分(D1-D7)和效果分(D8)必须分开跑，避免自评偏差
- 失败只回滚当前 skill，不影响其他 skill
- 改进必须是最小改动（单文件、单 section），不做大面积重写

**输出模板** (output):

- Skill 名 → D1-D7 分数 → D8 A/B 对比 → 最弱维度 → 改进方案 → 验证结果

**反模式** (anti-patterns):

- 只看结构分不看效果分 → 格式漂亮但触发不准
- 一次改太多维度 → 无法归因改进效果

---

## 核心循环（5 步）

```
评估 → 诊断最弱维度 → 最小改动改进 → 独立验证 → 保留或回滚
```

与 auto-cli 的 Quest 循环完全同构：每一次"评估-改进-验证"就是一个 Quest，失败只回滚当前 skill，不影响其他 skill。

### 第 1 步：评估（Evaluate）

评估分为两条独立路径，必须分开跑，避免自评偏差：

| 路径       | 评估者                                            | 维度            | 证据                        |
| ---------- | ------------------------------------------------- | --------------- | --------------------------- |
| **结构分** | 主 agent（直接 Read）                             | D1–D7（见下表） | SKILL.md 文本               |
| **效果分** | 独立验证者（`Task(subagent_type: verification)`） | D8              | 有/无 skill 的 A/B 产出对比 |

### 第 2 步：诊断（Diagnose）

按维度得分排序，锁定最弱维度（若 D1 + D2 同弱 ≤5，作为一对处理 — 它们共享 frontmatter 层）。

### 第 3 步：改进（Improve）

**单轮只改一维** — 同时改多维会让"改进-回归"的归因失效。

**约束**：

- 不改 skill 的核心功能与目的（只改"怎么写"和"怎么执行"）
- 不引入新依赖
- 改后 SKILL.md 体积 ≤ 原始 1.5 倍

### 第 4 步：验证（Verify）

重新跑评估：

- 结构分由主 agent 重新 Read SKILL.md 打分
- 效果分**必须**重新调度 `verification` sub-agent 做 A/B 比较
- 跳过效果分的情况：sub-agent 不可用时，标记 `dry_run` 用推理验证；不能直接省略该维度

### 第 5 步：保留或回滚（Keep or Revert）

- 新分 > 旧分 且 **无维度回退 > 2 分**：`status=keep`，写入 `.auto/feedback/skills.json` 与 `.auto/insights/patterns.md`
- 否则：`status=revert`，本关只回滚本 skill 文件（`git checkout -- skills/<name>.md`），并把失败上下文写入 `.auto/insights/traps.md`
- **不要**用 `git reset --hard` 或仓库级回滚

---

## 评估维度

| ID  | 维度                   | 所属层      | 主要证据                     | 常见失分                              |
| --- | ---------------------- | ----------- | ---------------------------- | ------------------------------------- |
| D1  | name 合规              | frontmatter | 全小写、中划线、文件名匹配   | 下划线、驼峰、与文件名不一致          |
| D2  | description 触发力     | frontmatter | 是否含具体关键词 + 场景      | 写成"这是一个 X 文档"；缺少"必须加载" |
| D3  | Progressive Disclosure | 主体结构    | 主文件行数、references/ 拆分 | 单文件 > 500 行、无 references/       |
| D4  | 使用时机清晰           | 主体段落    | "何时使用"段落 + 反例        | 只说"使用时"不说"不使用时"            |
| D5  | 步骤可执行             | 主体段落    | 步骤编号、输入输出           | 只有概念描述，缺具体动作              |
| D6  | 与 auto-cli 集成       | 主体段落    | PHASE/Quest/LearnCard 映射   | 与主流程脱节，孤立文档                |
| D7  | 验收标准               | 主体末段    | checklist 明确               | 无验收、无测试样例                    |
| D8  | 实际效果               | 外部观测    | 有/无 skill 的 A/B 产出差    | 加载后无行为差异、被忽略              |

**打分口径**：每维 0–10 分。阈值建议：

- 总分 ≥ 70：健康
- 总分 50–69：有提升空间
- 总分 < 50：需优先改进
- 任一维度 ≤ 3：必须处理（即使总分达标）

---

## 反馈信号（可选增强）

如果有 `.auto/feedback/skills.json` 的实际使用数据，按 60% 静态 + 40% 反馈加权：

| 字段                  | 含义                        |
| --------------------- | --------------------------- |
| `trigger_accuracy`    | 应触发时实际触发的比例      |
| `adoption_rate`       | 被触发后建议被采纳的比例    |
| `correction_count`    | 触发后被用户纠正的次数      |
| `correction_patterns` | 高频纠正类型（string 数组） |
| `ignore_rate`         | 明显相关但被忽略的比例      |
| `usage_frequency`     | 最近 N 次 run 中的调用次数  |

这些字段作为 `.auto/feedback/skills.json` 的扩展字段写入，由 `/auto:learn` 汇总维护。

---

## 执行流程

### 单 skill 评估

```
1. 主 agent Read skill.md，按 D1–D7 打分并给出理由
2. 调度 Task(subagent_type: "verification") 做 D8 A/B 对比
   - 构造 2–3 个真实测试提示（由用户确认）
   - 分别用"加载 skill"与"不加载 skill"两种条件跑同一提示
   - 比较产出质量差异，给出 D8 分数与证据
3. 汇总总分与最弱维度
4. 如决定改进：执行单轮单维改进（见改进策略）
5. 重新跑步骤 1+2 做验证
6. 保留或回滚
```

### 批量评估（skills/ 目录）

```
1. 按目录扫描每个 skill
2. 先跑静态 D1–D3（低成本，仅主 agent Read）
3. 按静态分倒序排列，从最弱开始
4. 对每个 skill 进入单 skill 评估循环
5. 每次完成一个 skill，写盘 .auto/runs/<runId>/quest-results.md，继续下一个
6. 全部完成后汇总 LearnCard 到 .auto/insights/patterns.md
```

---

## 改进策略（对应维度）

| 维度 | 典型改进动作                                        |
| ---- | --------------------------------------------------- |
| D1   | 重命名文件、修正 frontmatter.name                   |
| D2   | 重写 description，加入具体关键词 + "必须加载"风格句 |
| D3   | 把主文件拆分到 references/，主文件只保留路由层      |
| D4   | 增加"何时不使用"段落；补充反例                      |
| D5   | 把概念化描述改写为编号步骤；标注输入输出            |
| D6   | 增加 PHASE / Quest / LearnCard 映射小节             |
| D7   | 补充 checklist 与测试样例                           |
| D8   | 改写 description / 触发用语、精简上下文、重新测试   |

**单轮只改一维**：改 D5 就不要顺带改 D7；否则验证时无法归因。

---

## 与 auto-cli 集成

| 集成点          | 说明                                                                                   |
| --------------- | -------------------------------------------------------------------------------------- |
| PHASE 1 SCAN    | 能力快照读取 `skills/` 时，附带每个 skill 的上次评估分（如有）                         |
| PHASE 2 PLAN    | 发现计划里要用的 skill 总分 < 50 时，提醒用户考虑先改进再使用                          |
| PHASE 3 EXECUTE | "单 skill 评估"= 一个 Quest；"批量评估"= 多 Quest 顺序执行                             |
| PHASE 4 VERIFY  | `verification` agent 承担 D8 打分，与红蓝对抗复用同一基础设施                          |
| PHASE 6 LEARN   | 每轮评估结果写入 `.auto/feedback/skills.json`，模式卡写入 `.auto/insights/patterns.md` |
| Hook 联动       | 编辑 `skills/*.md` 后 PostToolUse 提示"考虑跑 skill 健康度自检"                        |

---

## 验收标准

- [ ] 结构分与效果分分别由不同评估者产生（避免自评偏差）
- [ ] 单轮只改一维；未单独改则标注"无法归因"
- [ ] 改后 SKILL.md 体积 ≤ 原始 1.5 倍
- [ ] 新分 > 旧分且无维度回退 > 2 分，才算"改进成功"
- [ ] 回滚时只动本 skill 文件，不做仓库级回滚
- [ ] 评估结果以 `LearnCard(category=pattern)` 或 `LearnCard(category=feedback)` 归档

---

## 参考

- 评估维度清单：[Evol-ai/SkillCompass](https://github.com/Evol-ai/SkillCompass)
- 闭环与双路径评分：[alchaincyf/darwin-skill](https://github.com/alchaincyf/darwin-skill)
- 配套创建方法论：`skill-creator`
- 独立验证者：`agents/verification.md`
