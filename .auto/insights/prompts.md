# 有效 Prompt 和对话模板

> LEARN 阶段自动维护，记录可复用的输入模式。

### /auto 复杂功能请求模板

**标签**: auto, prompt-pattern
**置信度**: high

```
/auto 实现 [功能描述]，要求：
- [具体约束 1]
- [具体约束 2]
技术栈：[语言+框架]
参考文件：[已有类似实现的文件路径]
```

效果：触发 implement 策略，调用 quest-designer 生成完整 QuestMap。提供参考文件可显著提升蓝图质量。

---

### /auto 快速修复模板

**标签**: auto, prompt-pattern, fix
**置信度**: high

```
/auto 修复 [问题描述]
错误信息：[粘贴错误输出]
相关文件：[文件路径]
```

效果：触发 fix 策略，跳过 quest-designer，直接生成单关修复计划。提供错误信息可加速定位。

---

### quest-designer 上下文组装

**标签**: quest-designer, context
**置信度**: high

调用 quest-designer 时，按以下顺序组装上下文可获得最佳蓝图质量：

1. 【用户需求】原始需求（保留原文）
2. 【技术栈】语言+框架+版本
3. 【项目规范】CLAUDE.md 关键约束
4. 【现有代码】相关源码路径（quest-designer 会自行 Read）
5. 【历史经验】insights/ 中匹配的经验摘要
6. 【Router 推荐】主 Agent + 回退链

省略【编排计划】和【能力清单】对蓝图质量影响较小，可在轻量场景下跳过。

---
