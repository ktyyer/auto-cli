# Prompt Craft — 短小精悍的提示词

> 基于 Reddit r/PromptEngineering 社区智慧，精选最简洁高效的提示词模式。
>
> **核心理念**：几句话的设计，远比长篇大论更有力量。提示词不是越多越好，而是要打在要害上。

---

## 核心原则

### 1. 简洁 > 冗长
长篇 CLAUDE.md 往往会让输出质量下降。规则越多，模型越忙于"满足规则合规性"，而不是完成你真正想要的任务。

### 2. 诚实 > 讨好
AI 默认会点头、夸你、把问题包装成智慧。改变它需要明确指令。

### 3. 暴露假设 > 直接回答
AI 默认填补你的认知空白，把这个过程拿出来，你才知道自己在问什么。

---

## 万能提示词模板

| 场景 | 提示词 | 效果 |
|------|--------|------|
| **代码审查** | `"Assume I am wrong. Show me where."` | 让 AI 挑剔而非讨好 |
| **多步推理** | `"Think step by step before answering."` | 准确率显著提升 |
| **不确定处理** | `"If you don't know exactly, say UNKNOWN."` | 把不确定变成可识别信号 |
| **角色设定** | `"You are [role]. Never [role's common failure]."` | 一行完成角色设定 + 反模式封堵 |
| **系统化执行** | `在指令前加 "Systematically"` | Claude 会自动结构化任务 |

---

## 高级模式

### 假设暴露模式
**在回答前，先让 AI 说出你的隐含假设、常见错误、缺失信息：**

```
Before answering, state:
1. My implicit assumptions
2. Common mistakes people make
3. Missing information that would change the answer
4. Then ask me ONE key question
Wait for my answer before concluding.
```

**为什么有效**：AI 默认填补你的认知空白，而这个填补过程你是看不见的。把它拿出来，你才知道自己在问一个什么样的问题。

### 反讨好设定
**放在 CLAUDE.md 开头：**

```
Be honest, not agreeable.
As my senior advisor: don't validate me, don't soften the truth,
challenge my thinking, point out what I'm avoiding,
tell me the opportunity cost.
```

**陷阱警告**：命令 AI "停止赞同"可能让它变成表演批评的模型，而非真正提供有价值的反馈。太对抗性会产生疲惫感，而非突破感。

---

## 反模式

### ❌ 规则膨胀
每次 Claude 输出不好就加一条规则 → 三个月后攒了 30 条规则，其中有几条正在互相打架：
- "保持简洁" vs "始终解释你的推理过程"
- "用口语化语气" vs "使用专业术语"

### ✅ 定期审计
让 Claude 读取你的 CLAUDE.md、skills、rules，然后逐条审计：
1. 这条我不说你默认也会做吗？
2. 这条和别处的指令矛盾吗？
3. 这条是不是只为了修一次坏输出才加进来的？

### ❌ 复制粘贴提示词
公开流传的提示词，往往在你手里效果打折。因为提示词的输出高度依赖对话上下文，原作者隐性提供了大量背景，你复制的只是字面，不是那个上下文。

### ✅ 理解本质
真正的问题或许是：你到底需要 AI 给你答案，还是帮你想清楚问题本身？

---

## 适用场景

### 代码评审
```
Assume I am wrong. Show me where.
Focus on: security, performance, maintainability.
Don't validate — challenge.
```

### 逻辑验证
```
Think step by step before answering.
Show your reasoning chain.
Highlight any assumptions.
```

### 未知领域
```
If you don't know exactly, say UNKNOWN.
Don't guess — state what you're certain about vs what you're inferring.
```

### 架构设计
```
Systematically analyze: requirements → constraints → options → trade-offs → recommendation.
Show your work.
```

---

## 参考

- Reddit: [Tell me your shortest prompt lines that literally saved you](https://www.reddit.com/r/PromptEngineering/comments/1s1diik/tell_me_your_shortest_prompt_lines_that_literally/)
- X: [你的 Claude Code 越来越笨，是因为你管太多了](https://x.com/itsolelehmann/status/2036065138147471665)
