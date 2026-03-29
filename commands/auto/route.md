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
# → 推荐 tdd-guide（优先级 75，回退链：code-reviewer）

# 示例 2：安全相关需求
/auto:route 检查密码泄露漏洞
# → 推荐 security-reviewer（优先级 95，回退链：code-reviewer）

# 示例 3：架构设计需求
/auto:route 重构微服务架构
# → 推荐 quest-designer（优先级 90，回退链：architect）

# 示例 4：构建错误
/auto:route TypeScript 编译失败
# → 推荐 build-error-resolver（优先级 90，回退链：无）
```

---

## 输出格式

```
🧠 路由分析
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 用户意图：
  <原始输入>

🔍 意图分析：
  • 关键词：[...]
  • 复杂度：low/medium/high
  • 安全敏感：是/否

🎯 推荐结果：
  ✅ 主 Agent：<name> - <displayName>
     优先级：<0-100>
     匹配原因：<matchReason>

  🔄 回退链（主 Agent 失败时）：
     1. <fallback1> - <displayName1>
     2. <fallback2> - <displayName2>
     ...

💡 建议：
  <根据路由结果给出的建议>
```

---

## 实现

### 步骤 1：初始化 Router

```javascript
import { CanonicalRouter } from '../../src/router/canonical-router.js';
import { AgentRegistry } from '../../src/router/agent-registry.js';

const registry = new AgentRegistry();
const router = new CanonicalRouter(registry);
await router.initialize();
```

### 步骤 2：分析用户意图

从用户输入中提取原始需求：

```javascript
// 用户输入：/auto:route <intent>
const userIntent = args.join(' ');
```

### 步骤 3：调用 Router

```javascript
const result = await router.route(userIntent, {
  // 可选：传递额外上下文
  files: affectedFiles,
  scope: 'on-demand'
});
```

### 步骤 4：格式化输出

```javascript
if (result.isDefault) {
  console.log(`⚠️  无精确匹配，使用默认路由：${result.agent.name}`);
} else {
  console.log(`✅ 推荐使用：${result.agent.name}`);
  console.log(`   原因：${result.matchReason}`);
}
```

---

## 高级用法

### 带上下文的路由

```javascript
const result = await router.route('代码审查', {
  files: ['src/auth/login.ts', 'src/user/profile.ts'],
  flags: { securityReview: true }  // 强制安全审查
});
// → 强制路由到 security-reviewer
```

### 调试模式

```bash
/auto:route --debug 实现用户登录功能
# → 显示完整的路由决策过程
#    - 候选列表
#    - 评分详情
#    - 过滤步骤
```

---

## 集成到主 /auto 流程

在 `/auto` 命令的 PHASE 1.4 之后调用 Router：

```javascript
// PHASE 1.4 输出健康报告 ✅

// 🆕 Router 推荐
const routeResult = await router.route(userIntent);
console.log(`\n💡 Router 推荐：${routeResult.agent.name}`);

// PHASE 2: quest-designer（带上 Router 推荐）
Agent({
  subagent_type: 'quest-designer',
  prompt: `...【Router 推荐】${routeResult.agent.name}...`
});
```

---

## 错误处理

| 错误 | 处理 |
|------|------|
| 空意图 | 返回默认 Router（quest-designer） |
| 无匹配 Agent | 返回默认 Router（quest-designer） |
| Registry 未初始化 | 自动初始化后再路由 |
| Router 初始化失败 | 降级到手动选择 Agent |

---

## 测试

```javascript
describe('/auto:route', () => {
  it('should route to tdd-guide for testing intent', async () => {
    const result = await router.route('编写测试用例');
    expect(result.agent.name).toBe('tdd-guide');
  });

  it('should route to security-reviewer for security intent', async () => {
    const result = await router.route('检查密码泄露漏洞');
    expect(result.agent.name).toBe('security-reviewer');
  });

  it('should return default for empty intent', async () => {
    const result = await router.route('');
    expect(result.isDefault).toBe(true);
  });
});
```
