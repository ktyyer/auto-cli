---
name: architect-editor
version: 1.0.0
description: 双模型协同策略 - 将逻辑推理与精确代码编辑解耦
author: ai-max
priority: 95
builtin: true
---

# Architect / Editor 双模型系统

借鉴 Aider 和 Cline 的优秀实践，ai-max v5.0 将大语言模型在软件开发中的角色明确拆分为「架构师」与「编辑」。

## 为什么需要双模型？

复杂任务如果让单一模型完成（既要思考系统架构，又要输出几百行精确代码），容易导致：
1. **Token 爆炸**：上下文过长，模型注意力分散。
2. **逻辑遗漏**：写着写着忘了前置条件。
3. **格式错误**：复杂的 diff 容易少写大括号或缩进错误。

解耦后：
- **Architect (推理模型，如 Opus或o1)**：擅长慢思考、长逻辑链、架构设计。
- **Editor (编辑模型，如 Sonnet或GPT-4o)**：擅长快思考、精准编辑、Diff 生成。

---

## 核心工作流

### 1. 触发条件
- 任务复杂度评估为 **中等 (Moderate)** 或 **复杂 (Complex)**。
- 或用户明确指定 `--architect` 标志。
- 简单任务将直接使用 Editor 模型执行以节省延迟和成本。

### 2. Architect 阶段 (思考与规划)
- **输入**：用户需求 + REPO_MAP + 相关文件内容
- **职责**：
  - 澄清需求，识别潜在风险。
  - 制定架构级决策（如应该用哪个现有服务、是否需要建立新表）。
  - 输出确切的修改清单（需要改哪些文件，增加什么组件）。
- **输出**：`《编辑计划单 (Edit Plan)》`
- **护栏**：此阶段绝对**不会**直接修改任何代码。

### 3. Editor 阶段 (精准编辑)
- **输入**：Architect 生成的《编辑计划单》 + 要修改的具体文件
- **职责**：
  - 忠实地执行计划单的指令。
  - 采用 **Diff-First** 策略，使用搜索/替换块生成最小代码变更。
  - 保证项目规范和代码风格的一致性。
- **输出**：精确的文件修改 (File edits)

---

## Diff-First 编辑策略

Editor 在执行修改时，强制采用 Diff 策略而非全文替换：

```udiff
#示例：Editor 输出的变更块
<<<<
// 原有业务逻辑
function validateUser(id) {
    return db.users.find(id);
}
====
// Architect 要求增加缓存逻辑
function validateUser(id) {
    const cached = cache.get(`user_${id}`);
    if (cached) return cached;
    const user = db.users.find(id);
    cache.set(`user_${id}`, user);
    return user;
}
>>>>
```

### 降级策略
如果连续 2 次 Diff 匹配失败（如上下文行不一致），Editor 将自动回退为统一修改模式，或者请求提示用户人工干预。

---

## 与 auto-core 集成

在 `auto-core.md` 中的具体位置：
`步骤 3`：评估完任务复杂度后，路由大脑会自动拉起此双模型流转。
`步骤 6`：如果不幸测试失败，错误信息会优先发给 Editor 处理；如果是难以解决的设计错误，会自动退回到 Architect 重新思考。
