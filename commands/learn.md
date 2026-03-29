---
name: learn
description: 从当前会话提取可复用的编码模式并保存为 Skill
allowed_tools: ["Read", "Write"]
---

# /learn — 会话模式提取

> 分析当前会话，将有价值的编码模式、调试技巧或解决方案提取为可复用的 Skill。
> 来自 everything-claude-code 的轻量级知识沉淀能力。

---

## 使用时机

在会话中任何时候运行 `/learn`，当你解决了一个非平凡问题时。

---

## 提取内容类型

### 1. 错误解决模式
- 发生了什么错误？
- 根本原因是什么？
- 如何修复的？
- 是否可复用于类似错误？

### 2. 调试技巧
- 不明显的调试步骤
- 有效的工具组合
- 诊断模式

### 3. 变通方案
- 库的怪癖
- API 限制
- 特定版本修复

### 4. 项目特定模式
- 发现的代码库约定
- 架构决策
- 集成模式

---

## 输出格式

创建 Skill 文件于 `~/.claude/skills/learned/[pattern-name].md`：

```markdown
---
name: [descriptive-pattern-name]
description: Brief description of when this applies
version: 1.0.0
source: session-extraction
extracted_at: [ISO-date]
---

# [描述性模式名称]

**提取时间：** [Date]
**适用场景：** [Brief description of when this applies]

## 问题

[What problem this solves - be specific]

## 解决方案

[The pattern/technique/workaround]

## 示例

[Code example if applicable]

## 使用时机

[Trigger conditions - what should activate this skill]
```

---

## 工作流程

1. **审查会话** - 查找可提取的模式
2. **识别最有价值的洞察** - 专注于可复用的内容
3. **起草 Skill 文件** - 按标准格式组织
4. **请求用户确认** - 展示草稿等待批准
5. **保存到 learned 目录** - 持久化存储

---

## 不提取的内容

- ❌ 平凡修复（拼写错误、简单语法错误）
- ❌ 一次性问题（特定 API 中断等）
- ❌ 过于具体的内容（特定日期的故障）

## 专注提取

- ✅ 可复用的模式
- ✅ 跨项目适用的经验
- ✅ 节省未来时间的洞察

---

## 与 Auto CLI 集成

- 提取的 Skill 会被 quest-designer v4 在 PHASE 2 发现
- 补充 `unified-memory-system` 的知识沉淀能力
- 与 `/skill-create` 配合：会话级 + 历史级双模式

---

## 示例

解决了一个 TypeScript 泛型问题后，运行 `/learn` 可能生成：

```markdown
---
name: typescript-generic-inference
description: 处理 TypeScript 泛型推断边缘情况
version: 1.0.0
source: session-extraction
extracted_at: 2026-03-29
---

# TypeScript 泛型推断边缘情况

**提取时间：** 2026-03-29
**适用场景：** 当泛型类型推断失败时，特别是在条件类型中

## 问题

TypeScript 无法正确推断嵌套条件类型中的泛型参数，导致 `Type 'X' is not assignable to type 'Y'` 错误。

## 解决方案

使用中间类型别名和 `extends` 约束：

```typescript
// 不要这样
function parse<T>(input: string): T {
  return JSON.parse(input) as T;
}

// 使用类型推断辅助
type InferJSON<T> = T extends string
  ? JSON.parse(T)
  : never;

function parse<T extends string>(input: T): InferJSON<T> {
  return JSON.parse(input);
}
```

## 使用时机

- 泛型推断包含联合类型时
- 条件类型嵌套超过 2 层
- 出现 "Type instantiation is excessively deep" 错误
```

---

## 相关命令

- `/skill-create` - 从 Git 历史生成技能
- `auto save insight -c "..."` - 快速保存单条知识
- `/auto:update-codemaps` - 更新代码架构地图
