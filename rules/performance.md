# 性能与设计模式

## 一、模型选择策略

**Haiku 4.5**（Sonnet 90% 能力，节省 3 倍成本）：
- 频繁调用的轻量级 agent
- 结对编程和代码生成
- 多 agent 系统中的工作 agent

**Sonnet 4.5**（最佳编码模型）：
- 主要开发工作
- 编排多 agent 工作流
- 复杂编码任务

**Opus 4.5**（最深度推理）：
- 复杂架构决策
- 最高推理需求
- 研究和分析任务

## 二、上下文窗口管理

在上下文窗口的最后 20% 避免：
- 大规模重构
- 跨多文件的功能实现
- 调试复杂交互

对上下文敏感度较低的任务：
- 单文件编辑
- 独立工具函数创建
- 文档更新
- 简单 Bug 修复

## 三、Ultrathink + Plan 模式

对于需要深度推理的复杂任务：
1. 使用 `ultrathink` 增强思考
2. 启用 **Plan 模式** 进行结构化方法
3. 通过多轮批评"预热引擎"
4. 使用分角色子 agent 进行多样化分析

## 四、构建故障排除

如果构建失败：
1. 使用 **build-error-resolver** agent
2. 分析错误信息
3. 增量修复
4. 每次修复后验证

## 五、常用设计模式

### API 响应格式

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}
```

### 仓储模式（Repository Pattern）

```typescript
interface Repository<T> {
  findAll(filters?: Filters): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateDto): Promise<T>
  update(id: string, data: UpdateDto): Promise<T>
  delete(id: string): Promise<void>
}
```

### 自定义 Hook 模式

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

### 实现新功能时

1. 先搜索经过实战检验的骨架项目
2. 使用并行 Agent 评估选项（安全、可扩展性、相关性）
3. 克隆最佳匹配作为基础
4. 在经过验证的结构中迭代
