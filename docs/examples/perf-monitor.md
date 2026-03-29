# 性能监测工具使用示例

## 基础用法

```javascript
import { perfMonitor } from '../src/utils/perf.js';

// 方式 1：手动开始和结束计时
perfMonitor.start('data-processing');

// ... 执行代码
const data = processData();

const result = perfMonitor.end('data-processing');
console.log(result);
// {
//   label: 'data-processing',
//   duration: '12.45ms',
//   memoryUsed: '0.12MB',
//   timestamp: '2026-03-29T04:00:00.000Z'
// }
```

## 异步函数测量

```javascript
import { perfMonitor } from '../src/utils/perf.js';

// 自动测量异步函数的执行时间
const result = await perfMonitor.measure('fetch-users', async () => {
  const response = await fetch('/api/users');
  return response.json();
});

// 控制台输出：[fetch-users] 124.32ms (内存: 1.45MB)
```

## 性能报告

```javascript
import { perfMonitor } from '../src/utils/perf.js';

// 执行多个操作
await perfMonitor.measure('query-db', async () => {
  await db.query('SELECT * FROM users');
});

await perfMonitor.measure('process-data', async () => {
  await processData(largeDataSet);
});

// 生成性能报告
perfMonitor.report();
```

**输出示例**：
```
性能报告:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. query-db
   执行时间: 124.32ms
   内存使用: 1.45MB
   时间戳: 2026-03-29T04:00:00.000Z

2. process-data
   执行时间: 56.78ms
   内存使用: 0.89MB
   时间戳: 2026-03-29T04:00:01.000Z

总计: 2 次测量
总耗时: 181.10ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 实际应用场景

### 场景 1：API 端点性能监测

```javascript
export async function getUsersHandler(req, res) {
  const result = await perfMonitor.measure('get-users', async () => {
    const users = await db.users.findMany();
    return users.map(u => ({ id: u.id, name: u.name }));
  });

  res.json(result);
}
```

### 场景 2：批量操作性能优化

```javascript
async function processBatch(items) {
  for (const item of items) {
    await perfMonitor.measure(`process-${item.id}`, async () => {
      await processItem(item);
    });
  }

  // 查看所有操作的性能
  perfMonitor.report();
}
```

### 场景 3：函数对比测试

```javascript
async function compareApproaches() {
  const data = generateTestData();

  // 方法 1
  const result1 = await perfMonitor.measure('method-1', async () => {
    return method1(data);
  });

  // 方法 2
  const result2 = await perfMonitor.measure('method-2', async () => {
    return method2(data);
  });

  perfMonitor.report();
  // 选择性能更好的方法
}
```

## 高级用法

### 自定义日志输出

```javascript
import { PerformanceMonitor } from '../src/utils/perf.js';

const monitor = new PerformanceMonitor();

await monitor.measure('task', async () => {
  // 你的代码
}, (result) => {
  // 自定义输出
  console.log(`任务完成！耗时: ${result.duration}`);
});
```

### 持续监测

```javascript
import { perfMonitor } from '../src/utils/perf.js';

// 监测整个请求生命周期
perfMonitor.start('request');

// ... 数据库查询
perfMonitor.start('db-query');
await db.query('...');
perfMonitor.end('db-query');

// ... 业务逻辑
perfMonitor.start('business-logic');
await processBusinessLogic();
perfMonitor.end('business-logic');

// ... 响应处理
perfMonitor.end('request');

console.log(perf.getMeasurements());
```

## 注意事项

1. **start/end 配对**：确保每次 start() 都有对应的 end()
2. **标签唯一性**：同时只能有一个相同标签的计时器
3. **异步上下文**：measure() 方法会自动处理异步函数
4. **内存测量**：Node.js 环境，测量堆内存使用变化

## 集成到现有代码

```javascript
// 在现有代码中导入
import { perfMonitor } from './utils/perf.js';

// 在关键路径添加监测
export async function existingFunction() {
  return perfMonitor.measure('existing-function', async () => {
    // 原有的代码逻辑
    return await doSomething();
  });
}
```
