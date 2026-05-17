# React 性能优化 + 通用模式 + 性能检测

> 从 performance-patterns 主文件拆分。按需加载。

## React 性能

### 不必要的重渲染

```typescript
// 反模式
const [items, setItems] = useState([]);
const filteredItems = items.filter((i) => i.active); // 每次渲染重新计算

// 修复: useMemo
const filteredItems = useMemo(() => items.filter((i) => i.active), [items]);
```

### 组件懒加载

```typescript
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Settings = React.lazy(() => import('./pages/Settings'))

<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

### 列表虚拟化

```typescript
import { FixedSizeList } from 'react-window'

<FixedSizeList height={600} itemCount={10000} itemSize={50}>
  {({ index, style }) => <div style={style}>{items[index].name}</div>}
</FixedSizeList>
```

## 通用性能模式

### 异步并行

```typescript
// 反模式：顺序 await
const user = await getUser(id);
const orders = await getOrders(id);

// 修复：并行
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);
```

### 防抖与节流

```typescript
// 搜索防抖 300ms
const debouncedSearch = useDebounce(searchTerm, 300);

// 滚动节流 16ms ≈ 60fps
const throttledScroll = throttle(handleScroll, 16);
```

### 内存管理

```typescript
// 反模式：Map 无限增长
const cache = new Map();

// 修复：LRU 或定期清理
const cache = new LRUCache({ max: 1000 });
```

## 性能检测工具

| 工具                | 用途         | 命令                               |
| ------------------- | ------------ | ---------------------------------- |
| Chrome DevTools     | 前端性能     | Performance 面板                   |
| Lighthouse          | 页面评分     | `npx lighthouse URL`               |
| why-is-node-running | 进程挂起检测 | 检测未关闭句柄                     |
| clinic.js           | Node.js 瓶颈 | `npx clinic doctor -- node app.js` |
| EXPLAIN ANALYZE     | SQL 分析     | `EXPLAIN ANALYZE SELECT ...`       |
