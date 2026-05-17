---
name: requirement-clarifier
description: 需求模糊度评估与澄清 — 在 PLAN 阶段产出 QuestMap 前，检测需求里的歧义、未定义关键名词、多种合理理解，强制用 AskUserQuestion 工具回问最多 3 题。当用户需求出现"差不多"、"应该"、"看起来"、"那种"等模糊词，或关键名词无具体定义（"用户"是谁？"快"多快？"完整"包含什么？）时，必须加载此 skill。即使需求看起来明确，只要存在 ≥2 种合理实现路径就要触发。先问清楚，再动手。
tags: [requirements, clarification, ambiguity, ask-user, plan-phase, methodology]
---

# Requirement Clarifier — 需求澄清方法论

> 借鉴 [Cline](https://docs.cline.bot/core-workflows/plan-and-act) 的 Plan Mode + [Aider](https://aider.chat/docs/usage/modes.html) 的 `/ask` 模式。
> 核心原则：**模糊需求是返工源头。** 假设有歧义就停下来问，比做错重做便宜得多。

## 快速使用

```
/auto 给项目加个登录
/auto 做个看起来不错的导出
/auto 优化一下首页性能
```

以上三个需求都会触发本 skill — 因为「登录方式」「导出格式」「性能目标」都没说。

---

## 使用时机

**必须加载**：

- 需求中出现模糊副词：差不多 / 应该 / 看起来 / 那种 / 一般 / 大概
- 关键名词无定义：用户 / 系统 / 完整 / 标准 / 优化 / 主要
- 存在 ≥ 2 种合理实现路径
- 验收标准缺失：未说"做完算什么样"
- 范围未限定：未说"包含什么 / 不包含什么"

**不要触发**：

- 用户已经给出明确技术规范
- 单值修改 / 格式化 / 文档微调
- bug 修复且复现步骤明确

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 6 信号扫描: 模糊副词/关键名词未定义/≥2 种路径/验收标准缺失/范围未限定/隐含假设
- [ ] 命中 ≥ 1 项 → 触发澄清流程, 用 `AskUserQuestion` 回问(最多 3 题)
- [ ] 优先澄清: 范围(包含/不包含) > 验收标准 > 技术选型
- [ ] 澄清后更新 RouteDecision 或 QuestMap, 确保无歧义再动手

**硬约束** (constraints):

- 命中 ≥ 1 个模糊信号必须回问, 禁止猜测
- 单次最多 3 题（避免用户疲劳）
- 澄清结果必须写回 QuestMap, 不依赖"上下文记忆"

**输出模板** (output):

- 模糊信号 → 澄清问题 → 用户选择 → QuestMap 更新

**反模式** (anti-patterns):

- "这个需求我知道什么意思" → 自以为是, 做出来不是用户想要的
- 一次问太多(>5 题) → 用户不想回答, 跳过澄清

---

## 核心流程（3 步）

### 第一步：模糊度评估（6 信号清单）

逐项检查，命中 ≥ 1 项就要触发：

| 信号           | 例子                        | 命中？ |
| -------------- | --------------------------- | ------ |
| 模糊副词       | "差不多 / 应该 / 看起来"    | □      |
| 关键名词无定义 | "用户" 是谁？"完整"含什么？ | □      |
| 多种合理路径   | OAuth vs JWT vs session？   | □      |
| 验收标准缺失   | 什么时候算做完？            | □      |
| 范围未限定     | 包含什么、不包含什么？      | □      |
| 优先级冲突可能 | 性能 vs 兼容 vs 工期        | □      |

### 第二步：用 AskUserQuestion 工具回问

**硬约束**：最多 3 题，挑命中最严重的 3 个信号。每题：

- 题面 ≤ 30 字，能让用户秒懂
- 给 2-4 个选项，每个选项 ≤ 12 字标签 + 一行说明
- 第一个选项放推荐值并标注 `(推荐)`
- 标记是否多选（默认单选）

```javascript
AskUserQuestion({
  questions: [
    {
      question: '登录方式选哪种？',
      header: 'Auth',
      options: [
        { label: '邮箱 + 密码 (推荐)', description: '最通用，最快上线' },
        { label: 'OAuth (Google/GitHub)', description: '依赖第三方' },
        { label: 'Magic Link', description: '无密码，邮件链接' }
      ],
      multiSelect: false
    }
    // 最多 3 题
  ]
});
```

### 第三步：产出 clarification-record.md

强制结构化记录，写入 `.auto/runs/<runId>/clarification-record.md`：

```markdown
# Clarification Record

## 触发的模糊信号

- [x] 关键名词无定义：未定义"完整"包含什么
- [x] 多种合理路径：OAuth vs JWT vs session

## 提的问题与用户答案

| 问题             | 选项                           | 用户选择  |
| ---------------- | ------------------------------ | --------- |
| 登录方式？       | 邮箱+密码 / OAuth / Magic Link | 邮箱+密码 |
| 是否要"记住我"？ | 是 / 否                        | 是        |
| 密码重置走哪种？ | 邮件链接 / 短信验证码          | 邮件链接  |

## 锁定的需求

- 邮箱 + 密码登录
- 含"记住我" 7 天
- 密码重置走邮件链接

## 未问但已固定的假设

- 密码 hash 算法：bcrypt（默认）
- session 存储：默认 cookie
  （这些假设记录在 QuestMap.routeHintsUsed，但未单独问用户）

## 仍未澄清的次要项

- 登录失败次数限制（取默认值 5 次）
```

---

## 与 PHASE 协议的对接

| Phase                | 行为                                                 |
| -------------------- | ---------------------------------------------------- |
| PHASE 1 SCAN         | 不触发（route 阶段太早）                             |
| PHASE 2.3 假设声明   | **本 skill 的入口** — 6 信号检测命中即调本 skill     |
| PHASE 2.4 推理摘要   | clarification-record.md 中的"锁定的需求"作为推理基础 |
| PHASE 2.5 Quest 设计 | 只用澄清后的需求生成 QuestMap，不带原始模糊版本      |

---

## 反模式

| 反模式                | 后果                                        |
| --------------------- | ------------------------------------------- |
| 一次问 5+ 题          | 用户反感，下次不用了                        |
| 题面太长 / 选项太抽象 | 用户答非所问                                |
| 不给推荐选项          | 用户犹豫 → 等同没问                         |
| 问完不写 record       | 后续 quest 仍带模糊语义                     |
| 给"其他"选项当主选项  | AskUserQuestion 自动给 Other，不要重复      |
| 把"假设声明"当"澄清"  | 假设是 AI 自己列的；本 skill 是真的回问用户 |

---

## 与 auto-cli 集成

| 注入时机             | 说明                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| PHASE 2.3 假设声明   | 6 信号清单命中 ≥1 → 调用本 skill                                           |
| PHASE 2.5 Quest 设计 | quest-designer / 主窗口拿 clarification-record.md 当上下文，不再用原始需求 |
| PHASE 6 LEARN        | 频繁触发的模糊模式可沉淀为 `prompts.md`（提示模板），降低后续触发率        |

触发关键词（PHASE 2.2 表格）：
模糊需求 / 多种合理理解 / 关键名词缺定义

---

## 与现有 skill 的关系

| skill                   | 角色                           |
| ----------------------- | ------------------------------ |
| `prd-writer`            | 完整 PRD 生成（重量级）        |
| `requirement-clarifier` | 已有需求的轻量澄清（本 skill） |
| `research-analyst`      | 调研外部知识，不是问用户       |

三者可串联：先 clarifier 锁定需求 → research-analyst 调研 → prd-writer 沉淀正式 PRD。

---

## 验收标准

- [ ] 6 信号清单逐项过了一遍
- [ ] 触发问题数 ≤ 3
- [ ] 每题有推荐选项且标注 `(推荐)`
- [ ] clarification-record.md 含「锁定的需求」「未问但已固定的假设」
- [ ] 后续 QuestMap 只引用澄清后的需求
- [ ] 用户没被问到「与他刚刚说的话明显矛盾」的问题

## 来源

- Cline Plan & Act Mode：<https://docs.cline.bot/core-workflows/plan-and-act>
- Aider Chat Modes (`/ask`)：<https://aider.chat/docs/usage/modes.html>
