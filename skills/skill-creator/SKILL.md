---
name: skill-creator
description: 创建、改进和评估 Skill 的方法论 — 通过意图捕获、用户访谈、SKILL.md 编写、测试迭代的完整流程，引导生成高质量 Skill。当用户提到"创建一个 skill"、"写一个 skill"、"帮我写 skill"、"怎么写 skill"、"如何让 AI 自动调用某个技能"，或当现有 skill 质量不佳、需要优化触发准确性时，必须加载此 skill。
tags: [skill, authoring, evaluation, testing, workflow, template]
---

# Skill Creator — Skill 编写方法论

> 基于 [anthropics/skills/skill-creator](https://github.com/anthropics/skills/tree/master/skills/skill-creator) 编写方法论。
> 任何 auto-cli 用户都可以通过本 Skill 学会写 Skill，auto-cli 自身也用本 Skill 持续优化 `skills/` 目录。

## 快速使用

```
/auto 帮我创建一个 Django REST Framework 的 skill
/auto 现有的 java-patterns skill 触发不准确，帮我优化
```

## 使用时机

**必须加载**：

- 用户提到"创建一个 skill"、"写一个 skill"、"帮我写 skill"
- 发现现有 skill 触发不准确或质量不佳时
- 优化 skill 的 `description` 以提升触发精度时
- 需要建立项目专属 Skill 时

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 捕获意图：Skill 要做什么？何时触发？输出格式？
- [ ] 用户访谈：痛点是什么？典型触发语句 3-5 个？边界在哪？
- [ ] 编写 SKILL.md：frontmatter(name+description+tags) + 使用时机 + 核心流程 + 验收标准
- [ ] 测试迭代：触发是否准确？输出是否可用？迭代至合格

**硬约束** (constraints):

- description 必须写清触发条件（用户说什么时激活）
- tags 必须覆盖触发关键词
- 必须包含验收标准（可执行命令/可验证结果）

**输出模板** (output):

- 完整 SKILL.md 文件（含 frontmatter + 使用时机 + 流程 + 验收标准）

**反模式** (anti-patterns):

- description 太泛导致误触发 → 浪费上下文
- 缺少验收标准 → 质量不可控
- Skill 内容超过 400 行不拆分 → 激活时占用过多上下文

---

## 核心流程（4 步）

### 第一步：Capture Intent — 意图捕获

从对话历史中提取：

1. 这个 Skill 要让 AI 学会做什么？
2. 什么时候应该触发？（用户说什么时 / 什么上下文）
3. 期望的输出格式是什么？
4. 需要测试用例来验证效果吗？

如果对话中没有完整流程，主动询问用户补全。

### 第二步：Interview — 用户访谈

主动询问以下问题（根据实际情况筛选）：

- 这个 Skill 解决的最大痛点是什么？
- 触发这个 Skill 的典型用户语句有哪些？（至少 3-5 个）
- 触发和不该触发的边界在哪里？
- 输出是一次性的还是多步骤的？
- 有没有依赖的工具或外部服务？

### 第三步：Write SKILL.md — 编写 Skill

根据 Anthropic 标准格式编写：

```markdown
---
name: my-skill
description: 简短描述这个 Skill 做什么，以及何时触发。
  触发描述要具体（包含具体关键词和场景）。
tags: [...]
---

# My Skill

> 一句话说明这个 Skill 的目的。

## 何时使用

（什么时候触发）

## 如何使用

（具体步骤）

## 输出格式

（如果有固定格式要求）
```

#### 关键原则：Progressive Disclosure（三层加载）

```
Layer 1: name + description  (~100 words, 始终在 context)
Layer 2: SKILL.md body       (<500 lines, 触发时全加载)
Layer 3: references/         (按需加载，无限内容)
```

| 层      | 内容                             | 何时加载             |
| ------- | -------------------------------- | -------------------- |
| Layer 1 | frontmatter (name + description) | 始终加载 ~100 words  |
| Layer 2 | SKILL.md body                    | 触发 Skill 时全加载  |
| Layer 3 | references/\*.md                 | 主文件引用时按需加载 |

**SKILL.md 主文件越短越好**（<500 lines）。如果接近 500 行，拆出详细内容到 `references/` 子目录，主文件只保留路由层。

### 第四步：Test — 测试迭代

1. 编写 2-3 个真实测试提示（用户可能实际说的话）
2. 用有 Skill 和无 Skill 两种配置各跑一次
3. 对比结果，记录 Skill 带来的改善
4. 重复直到满意

#### 测试提示示例

```json
{
  "skill_name": "my-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "用户可能说的话",
      "expected_output": "期望的输出结果"
    }
  ]
}
```

---

## Skill 命名规范

| 字段             | 规范                        | 示例                             |
| ---------------- | --------------------------- | -------------------------------- |
| 文件名           | `xxx.md`（全小写，中划线）  | `error-patterns.md`              |
| frontmatter.name | `xxx-xxx`（中划线）         | `error-patterns`                 |
| description      | 触发条件 + 用途，pushy 风格 | "当用户提到 bug/错误 时必须加载" |
| tags             | `lower-case, hyphenated`    | `[skill, error, debugging]`      |

---

## Agent Skills 标准兼容

auto-cli 的 skill frontmatter 兼容 [Agent Skills 标准](https://agentskills.io/specification)（Anthropic 发布的行业规范）。映射关系：

| 字段            | 标准要求     | auto-cli 现状 | 说明                                             |
| --------------- | ------------ | ------------- | ------------------------------------------------ |
| `name`          | **必填**     | **必填**      | 完全兼容                                         |
| `description`   | **必填**     | **必填**      | 完全兼容                                         |
| `tags`          | —            | **必填**      | auto-cli 扩展字段，用于动态发现匹配度计算        |
| `license`       | 可选         | 可选          | 标准字段。创建分享给外部的 skill 时建议填写      |
| `compatibility` | 可选         | 可选          | 标准字段。有环境依赖（如需要 docker/node）时填写 |
| `metadata`      | 可选         | 可选          | 标准字段。可存放 `author`、`version` 等元信息    |
| `allowed-tools` | 可选(实验性) | 可选          | 标准字段。限制 skill 可用工具白名单              |

auto-cli 技能可发布为 Agent Skills 标准 Skill：只需在 frontmatter 中补充 `license`（如 `Apache-2.0`），其余字段按需添加。

---

## Description 优化技巧

Description 是主要触发机制。写法要点：

**✅ 正确（pushy，具体）**：

```
"当用户提到 bug、error、编译失败、测试不通过时，必须加载此 skill。
即使用户没有说 'skill' 这个词，只要描述的问题现象匹配，也要考虑触发。"
```

**❌ 错误（模糊，不触发）**：

```
"这是一个错误处理的参考文档。"
```

**技巧**：Description = **触发条件**（何时用）+ **内容摘要**（做什么），不需要写"How to use"。

---

## 与 auto-cli 集成

| 集成点       | 说明                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| PHASE 2 PLAN | quest-designer 生成 QuestMap 时，如果发现某类任务没有对应 Skill，建议使用本 Skill 创建 |
| skills/ 维护 | auto-cli 的 `skills/` 目录本身用本方法论持续迭代                                       |
| skill 自审   | 发现 Skill 触发不准时，用本 Skill 的流程优化 description                               |

---

## 健康度评估

新 skill 写完后，用 `skill-evaluator` 做体检：

- 结构分（D1–D7）由主 agent 直接 Read 打分
- 效果分（D8）由 `Task(subagent_type: "verification")` 独立 A/B 跑出
- 单轮只改一维，保留改进、回滚回归

详见 `skills/skill-evaluator/SKILL.md`。

---

## 验收标准

- [ ] 每个 Skill 的 description 包含具体触发关键词（不是"这是一个 X 文档"）
- [ ] 主 SKILL.md 文件 < 500 行（超长内容拆到 references/）
- [ ] 每个 Skill 有至少 2 个真实测试提示
- [ ] 新 Skill 发布前经过至少 1 次有/无 Skill 对比测试
- [ ] Skill 命名符合 `name: xxx-xxx` 格式，description 以触发条件开头

## 参考

- Anthropic 官方 Skill Creator：<https://github.com/anthropics/skills/tree/master/skills/skill-creator>
- 完整 SKILL.md 格式规范：<https://github.com/anthropics/skills/blob/master/skills/skill-creator/SKILL.md>
- Skill 评估 Schemas：<https://github.com/anthropics/skills/blob/master/skills/skill-creator/references/schemas.md>
