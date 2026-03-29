---
name: reflection
description: 自我反思模式 - 让 AI 在执行过程中主动反思方案质量，发现偏差并及时纠正，社区验证可提升最终产出质量 40%
version: 1.0.0
author: auto-cli
tags: [reflection, self-correction, quality, iterative, meta-cognition]
---

# Reflection -- 自我反思模式

> Andrew Ng "AI Agent Design Patterns" 第一模式。不是"做完再审查"，而是"边做边想"。
> 与 `self-review.md` 互补：self-review 是提交前清单，Reflection 是执行中纠偏。

---

## 核心理念

1. **执行中反思 > 执行后审查** -- 越早发现偏差，修正成本越低
2. **显式思考 > 隐式假设** -- 把假设写出来，才能被质疑和修正
3. **多视角审视 > 单一视角** -- 从用户、维护者、安全三个角度重新审视
4. **量化评估 > 感性判断** -- 用指标替代"感觉还行"

---

## 何时触发 Reflection

| 场景 | 触发条件 | 反思深度 |
|------|---------|---------|
| Quest 执行中 | 每个 Quest 完成后 | 快速（1 分钟） |
| 阶段性检查 | PHASE 3 执行过半 | 标准（3 分钟） |
| 方案偏差 | 发现与预期不符 | 深度（5 分钟） |
| 最终交付前 | PHASE 4 VERIFY 前 | 完整（对照清单） |

---

## 四步反思流程

### Step 1: 回顾（Retrospect）

```
问题清单：
- 我刚才做了什么？（简述产出）
- 产出与原始需求一致吗？
- 有没有"顺手多做"的部分？（范围蔓延检测）
- 有没有跳过的步骤？（流程完整性检查）
```

### Step 2: 质疑（Challenge）

```
假设检验：
- 我基于什么假设做的？（列出 2-3 个关键假设）
- 这些假设成立吗？有没有反例？
- 如果假设不成立，方案需要怎么调整？

替代方案：
- 有没有更简单的实现方式？
- 有没有更安全的实现方式？
- 有没有更可维护的实现方式？
```

### Step 3: 评估（Evaluate）

```
量化打分（1-5 分）：
| 维度 | 分数 | 说明 |
|------|------|------|
| 功能完整性 | ? | 是否覆盖所有需求点 |
| 代码质量 | ? | 可读性、可维护性、可测试性 |
| 安全性 | ? | 输入验证、权限控制、敏感数据 |
| 性能 | ? | 有无 N+1、不必要拷贝、阻塞操作 |
| 兼容性 | ? | 是否破坏已有接口/行为 |

总分 < 15 分 = 需要修正后再继续
```

### Step 4: 纠偏（Correct）

```
如果发现偏差：
1. 记录偏差：期望 vs 实际 vs 原因
2. 评估影响：影响范围 + 修正成本
3. 选择策略：
   - 小偏差（< 10 分钟）→ 立即修正
   - 中等偏差（< 1 小时）→ 完成当前 Quest 后修正
   - 大偏差（> 1 小时）→ 暂停执行，回到 quest-designer 重新规划
4. 更新计划：记录修正决策和调整后的后续步骤
```

---

## 反思模板（嵌入 Quest 执行）

在 PHASE 3 每个 Quest 完成后，输出以下反思块：

```markdown
## Reflection Check [Quest X.Y]

### 回顾
- 产出：[1 句话描述]
- 需求匹配度：[高/中/低]
- 范围蔓延：[无/有（说明）]

### 质疑
- 关键假设：[列出]
- 风险：[列出]

### 评分
| 维度 | 分数 |
|------|------|
| 功能完整性 | ?/5 |
| 代码质量 | ?/5 |
| 安全性 | ?/5 |
| 性能 | ?/5 |
| 兼容性 | ?/5 |

### 决策
- [继续/修正/暂停]
- 原因：[说明]
```

---

## 与 Auto CLI 的集成

- **PHASE 3 EXECUTE**: 每个 Quest 完成后触发快速反思
- **PHASE 4 VERIFY**: 完整反思 + self-review 清单双重验证
- **Quest Map**: quest-designer 在高风险 Quest 中嵌入反思检查点
- **TodoManager**: 反思结果可记录为 Todo 项的 note 字段
- **能力分析器**: `src/todos/capability-analyzer.js` 提供项目能力画像，辅助反思

---

## 来源

- Andrew Ng "AI Agentic Design Patterns": Reflection 模式
- Anthropic "Metacognitive Prompting" 研究论文
- linux.do 社区实测："加了 Reflection 后，一次性通过率从 60% 提升到 85%"
- Google DeepMind "Let's Verify Step by Step"：过程奖励 > 结果奖励
