---
description: 使用 Canonical Router 智能路由到最合适的 Agent
---

# /auto:route — 智能 Agent 路由

> 基于 Canonical Router（权威路由器），自动分析用户意图并路由到最合适的 Agent

---

## 使用场景

当你不确定应该使用哪个 Agent 时，使用此命令：

```bash
# Claude Code 中
/auto:route 编写测试用例

# CLI 等价调用
auto route "<用户意图>"
auto route "<用户意图>" --json
auto route "<用户意图>" --debug
```

如果 auto CLI 未安装，则根据关键词手动匹配（数据源：`src/router/agent-registry.js`）。

---

## 路由逻辑

1. **意图分析**：提取关键词 + 评估复杂度 + 检测安全敏感性
2. **候选匹配**：基于关键词 + 能力 + 优先级评分
3. **安全优先**：安全相关意图自动提升 security-reviewer 优先级
4. **回退链**：主 Agent 失败时按优先级降级

优先级排序（高→低）：
- security-reviewer (95) → build-error-resolver (90) → architect (85)
- quest-designer (82) → tdd-guide (75) → verification (72)
- code-reviewer (70) → e2e-runner (65) → refactor-cleaner (55) → doc-updater (50)

---

## 输出格式

```
Router 分析
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

用户意图：
  <原始输入>

推荐结果：
  主 Agent：<name> - <displayName>
     优先级：<0-100>
     匹配原因：<matchReason>

  回退链（主 Agent 失败时）：
     1. <fallback1> - <displayName1>
```

---

## 错误处理

| 错误 | 处理 |
|------|------|
| 空意图 | 返回默认路由（quest-designer） |
| 无匹配 Agent | 返回默认路由（quest-designer） |
| CLI 未安装 | 降级到手动查表选择 Agent |
