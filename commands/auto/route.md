---
description: 使用 Canonical Router 智能路由到最合适的 Agent
---

# /auto:route — 智能 Agent 路由

> 基于 Canonical Router（权威路由器），自动分析用户意图并路由到最合适的 Agent

---

## 使用场景

当你不确定应该使用哪个 Agent 时，使用此命令：

```bash
# 示例 1：测试相关需求
/auto:route 编写测试用例
# -> 推荐 tdd-guide（优先级 75，回退链：code-reviewer）

# 示例 2：安全相关需求
/auto:route 检查密码泄露漏洞
# -> 推荐 security-reviewer（优先级 95，回退链：code-reviewer）

# 示例 3：架构设计需求
/auto:route 重构微服务架构
# -> 推荐 architect（优先级 85，回退链：quest-designer）

# 示例 4：构建错误
/auto:route TypeScript 编译失败
# -> 推荐 build-error-resolver（优先级 90，回退链：无）
```

---

## 执行方式

使用 auto CLI 工具执行路由：

```bash
# 基本路由
auto route "<用户意图>"

# JSON 格式输出
auto route "<用户意图>" --json

# 调试模式（显示详细决策过程）
auto route "<用户意图>" --debug
```

如果 auto CLI 未安装，则使用内置 Agent 列表手动匹配：

| 关键词 | 推荐 Agent | 优先级 | 回退链 |
|--------|-----------|--------|--------|
| 安全/密码/漏洞/auth | security-reviewer | 95 | code-reviewer |
| 构建/编译/error | build-error-resolver | 90 | 无 |
| 架构/重构/设计 | architect | 85 | quest-designer |
| quest/闯关/蓝图 | quest-designer | 82 | architect |
| 测试/tdd/coverage | tdd-guide | 75 | code-reviewer |
| 验证/对抗/边界 | verification | 72 | code-reviewer |
| 审查/review/质量 | code-reviewer | 70 | 无 |
| e2e/playwright | e2e-runner | 65 | tdd-guide |
| 清理/重构/dead-code | refactor-cleaner | 55 | 无 |
| 文档/readme | doc-updater | 50 | 无 |

---

## 输出格式

```
Router 分析
--------------------------------------------------

用户意图：
  <原始输入>

意图分析：
  - 关键词：[...]
  - 复杂度：low/medium/high
  - 安全敏感：是/否

推荐结果：
  主 Agent：<name> - <displayName>
     优先级：<0-100>
     匹配原因：<matchReason>

  回退链（主 Agent 失败时）：
     1. <fallback1> - <displayName1>
     2. <fallback2> - <displayName2>
     ...

建议：
  <根据路由结果给出的建议>
```

---

## 集成到主 /auto 流程

在 `/auto` 命令的 PHASE 1.4 之后调用 Router：

1. PHASE 1.4 输出健康报告
2. Router 推荐：执行 `auto route "<userIntent>"` 或查表
3. PHASE 2: quest-designer（带上 Router 推荐）

---

## 错误处理

| 错误 | 处理 |
|------|------|
| 空意图 | 返回默认 Router（quest-designer） |
| 无匹配 Agent | 返回默认 Router（quest-designer） |
| CLI 未安装 | 降级到手动查表选择 Agent |
