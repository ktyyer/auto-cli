---
name: performance-patterns
description: 性能优化模式库 — N+1 查询、缓存策略、懒加载、批量操作、React 渲染优化、防抖节流等常见性能反模式和修复方案。当用户提到性能慢、加载慢、N+1、缓存优化、数据库慢、页面卡顿、内存泄漏，或 architect agent 设计缓存/分库分表时，必须加载此 skill。
tags: [performance, optimization, caching, n+1, lazy-loading, react, database, batch, profiling]
---

# Performance Patterns — 性能优化模式库

> quest-designer 在 PHASE 2 设计 Quest 时参考，避免性能反模式。

## 快速使用

```
/auto 列表页加载慢，数据库查询耗时 3 秒
/auto React 组件频繁重渲染导致卡顿
/auto 添加 Redis 缓存层优化热点查询
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 数据库: 检查 N+1 查询，用批量查询或 JOIN 替代循环查询
- [ ] 缓存: 热点数据加 Redis 缓存，设置合理 TTL，使用 Cache-Aside 模式
- [ ] 前端: React 用 `React.memo` + `useMemo` + `useCallback`，长列表用虚拟化
- [ ] 通用: 防抖(输入搜索)、节流(滚动)、异步并行(`Promise.all`)
- [ ] 识别瓶颈: 用 profiling 工具确认慢点，不凭感觉优化

**硬约束** (constraints):

- 禁止循环内数据库查询（N+1）
- 禁止无过期时间的缓存（内存泄漏）
- 优化前必须先 profiling，禁止凭直觉优化

**输出模板** (output):

- 瓶颈点 → 根因 → 优化方案 → 预期提升 → 验证命令

**反模式** (anti-patterns):

- 过早优化 → 代码复杂化但无实际收益
- 所有数据都缓存 → 缓存雪崩、数据不一致

---

## 使用时机

**必须加载**：性能优化任务 | architect 设计缓存/分库分表 | code-reviewer 维度 4 审查
**按需加载**：数据库慢 → Section 1 | 缓存问题 → Section 2 | React 卡顿 → references | 通用优化 → references

---

## 一、数据库性能

### 1.1 N+1 查询

```
症状: 列表页 100 条数据产生 101 次查询
根因: 循环中逐条查询关联数据

反模式:
  for (const order of orders) {
    order.user = await userMapper.selectById(order.userId)
  }

修复: 批量查询
  const userIds = orders.map(o => o.userId)
  const users = await userMapper.selectBatchIds(userIds)
  const userMap = new Map(users.map(u => [u.id, u]))
  for (const order of orders) { order.user = userMap.get(order.userId) }
```

### 1.2 批量操作

```
反模式: 循环单条 INSERT → 修复: batchInsert(items)
MyBatis Plus: orderItemService.saveBatch(items, 500)
```

### 1.3 索引优化

```
规则: WHERE 条件字段建索引 / 联合索引最左前缀 / 避免索引列函数 / 覆盖索引避免回表
验证: EXPLAIN SELECT * FROM orders WHERE user_id = ? AND status = ?
```

---

## 二、缓存策略

### 2.1 缓存模式选择

| 模式          | 适用场景   | 一致性   | 复杂度 |
| ------------- | ---------- | -------- | ------ |
| Cache-Aside   | 通用读缓存 | 最终一致 | 低     |
| Write-Through | 写入频率低 | 强一致   | 中     |
| Write-Behind  | 写入频率高 | 最终一致 | 高     |
| Refresh-Ahead | 可预测访问 | 最终一致 | 中     |

### 2.2 缓存键设计

```
格式: {业务}:{实体}:{标识}:{版本}
示例: order:detail:12345:v2  user:list:page1:size20

注意: 避免键过短导致碰撞 / 包含版本号支持平滑过渡 / TTL: 热点 5min, 冷数据 1h
```

---

## 按需加载

> React 渲染优化、组件懒加载、列表虚拟化、异步并行、防抖节流、内存管理、性能检测工具
> → `performance-patterns.references/react-and-general.md`

---

## 验收标准

- [ ] Quest 设计阶段识别并规避 N+1、循环内 await 等常见反模式
- [ ] 优化方案包含量化指标（响应时间、内存占用、查询次数）
- [ ] 缓存策略包含失效机制（TTL/主动失效/容量控制）

## 与 auto-cli 集成

- **quest-designer**: Quest 设计中的"预判坑点"参考本模式库
- **code-reviewer**: 维度 4（性能）审查与本库模式对应
- **architect**: 缓存/分库分表参考第 2 节
