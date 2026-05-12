---
name: performance-patterns
description: 性能优化模式库 — N+1 查询、缓存策略、懒加载、批量操作、React 渲染优化、防抖节流等常见性能反模式和修复方案。当用户提到性能慢、加载慢、N+1、缓存优化、数据库慢、页面卡顿、内存泄漏，或 architect agent 设计缓存/分库分表时，必须加载此 skill。
tags: [performance, optimization, caching, n+1, lazy-loading, react, database, batch, profiling]
---

# Performance Patterns — 性能优化模式库

> quest-designer 在 PHASE 2 设计 Quest 时参考，避免性能反模式。
> code-reviewer Agent 将维度 4（性能）的审查清单与此模式库关联。

## 快速使用

```
/auto 列表页加载慢，数据库查询耗时 3 秒
/auto React 组件频繁重渲染导致卡顿
/auto 添加 Redis 缓存层优化热点查询
```

## 使用时机

**必须加载**：

- 性能优化任务（用户提到性能、慢、卡顿）
- architect agent 设计缓存架构或分库分表方案时
- code-reviewer 执行维度 4（性能）审查时

**按需加载**（按场景）：

- 数据库慢 → Section 1（N+1、批量、索引）
- 缓存问题 → Section 2（缓存模式、键设计）
- React 卡顿 → Section 3（重渲染、懒加载、虚拟化）
- 通用优化 → Section 4（异步并行、防抖节流）

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 数据库: 检查 N+1 查询, 用批量查询或 JOIN 替代循环查询
- [ ] 缓存: 热点数据加 Redis 缓存, 设置合理 TTL, 使用 Cache-Aside 模式
- [ ] 前端: React 用 `React.memo` + `useMemo` + `useCallback`, 长列表用虚拟化
- [ ] 通用: 防抖(输入搜索)、节流(滚动)、异步并行(`Promise.all`)
- [ ] 识别瓶颈: 用 profiling 工具确认慢点, 不凭感觉优化

**硬约束** (constraints):

- 禁止循环内数据库查询（N+1）
- 禁止无过期时间的缓存（内存泄漏）
- 优化前必须先 profiling, 禁止凭直觉优化

**输出模板** (output):

- 瓶颈点 → 根因 → 优化方案 → 预期提升 → 验证命令

**反模式** (anti-patterns):

- 过早优化 → 代码复杂化但无实际收益
- 所有数据都缓存 → 缓存雪崩、数据不一致

---

## 一、数据库性能

### 1.1 N+1 查询

```
症状: 列表页加载慢（100 条数据产生 101 次查询）
根因: 循环中逐条查询关联数据

反模式：
  for (const order of orders) {
    order.user = await userMapper.selectById(order.userId)
  }

修复方案：
  const userIds = orders.map(o => o.userId)
  const users = await userMapper.selectBatchIds(userIds)
  const userMap = new Map(users.map(u => [u.id, u]))
  for (const order of orders) {
    order.user = userMap.get(order.userId)
  }
```

### 1.2 批量操作

```
反模式: 循环单条 INSERT
  for (const item of items) {
    await orderItemMapper.insert(item)
  }

修复方案: 批量 INSERT
  await orderItemMapper.batchInsert(items)

MyBatis Plus:
  orderItemService.saveBatch(items, 500)  // 每 500 条一批
```

### 1.3 索引优化

```
检查缺少索引的慢查询：
  EXPLAIN SELECT * FROM orders WHERE user_id = ? AND status = ?

规则：
- WHERE 条件字段建索引
- 联合索引遵循最左前缀
- 避免在索引列上使用函数
- 覆盖索引避免回表
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
示例: order:detail:12345:v2
      user:list:page1:size20

注意：
- 避免缓存键过短导致碰撞
- 包含版本号支持结构变更时平滑过渡
- TTL 设置：热点数据 5min，冷数据 1h
```

---

## 三、React 性能

### 3.1 不必要的重渲染

```
反模式：
  const [items, setItems] = useState([])
  const filteredItems = items.filter(i => i.active)  // 每次渲染都重新计算

修复方案：
  const filteredItems = useMemo(
    () => items.filter(i => i.active),
    [items]
  )
```

### 3.2 组件懒加载

```
// 路由级代码分割
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Settings = React.lazy(() => import('./pages/Settings'))

// 使用
<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

### 3.3 列表虚拟化

```
// 大列表（> 100 条）使用虚拟滚动
import { FixedSizeList } from 'react-window'

<FixedSizeList height={600} itemCount={10000} itemSize={50}>
  {({ index, style }) => <div style={style}>{items[index].name}</div>}
</FixedSizeList>
```

---

## 四、通用性能模式

### 4.1 异步并行

```
反模式：顺序 await
  const user = await getUser(id)
  const orders = await getOrders(id)

修复方案：并行 await
  const [user, orders] = await Promise.all([
    getUser(id),
    getOrders(id)
  ])
```

### 4.2 防抖与节流

```
// 搜索输入防抖（300ms）
const debouncedSearch = useDebounce(searchTerm, 300)
useEffect(() => {
  if (debouncedSearch) searchAPI(debouncedSearch)
}, [debouncedSearch])

// 滚动事件节流（16ms ≈ 60fps）
const throttledScroll = throttle(handleScroll, 16)
```

### 4.3 内存管理

```
反模式：Map 无限增长
  const cache = new Map()
  function set(key, value) { cache.set(key, value) }  // 永远不清理

修复方案：LRU 缓存
  const cache = new LRUCache({ max: 1000 })
  // 或定期清理
  setInterval(() => {
    for (const [key, entry] of cache) {
      if (Date.now() - entry.ts > TTL) cache.delete(key)
    }
  }, CLEANUP_INTERVAL)
```

---

## 五、性能检测工具

| 工具                | 用途             | 命令                               |
| ------------------- | ---------------- | ---------------------------------- |
| Chrome DevTools     | 前端性能分析     | Performance 面板                   |
| Lighthouse          | 页面性能评分     | `npx lighthouse URL`               |
| why-is-node-running | Node.js 进程挂起 | 检测未关闭的句柄                   |
| clinic.js           | Node.js 瓶颈分析 | `npx clinic doctor -- node app.js` |
| EXPLAIN             | SQL 查询分析     | `EXPLAIN ANALYZE SELECT ...`       |

---

## 验收标准

- [ ] Quest 设计阶段识别并规避了 N+1 查询、循环内 await 等常见反模式
- [ ] 性能优化方案包含量化指标（响应时间、内存占用、查询次数）
- [ ] 缓存策略包含失效机制（TTL/主动失效/容量控制）
- [ ] 优化后运行性能基线测试确认改善

## 六、与 auto-cli 集成

- **quest-designer**: Quest 设计中的"预判坑点"参考本模式库
- **code-reviewer**: 维度 4（性能）审查与 1-4 节模式对应
- **architect**: 架构设计中的缓存/分库分表参考第 2 节
- **PHASE 4 VERIFY**: 完整模式可选运行性能基线测试
