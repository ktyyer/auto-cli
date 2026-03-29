# 常用模式

## API 响应格式

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

## 仓储模式（Repository Pattern）

```typescript
interface Repository<T> {
  findAll(filters?: Filters): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateDto): Promise<T>
  update(id: string, data: UpdateDto): Promise<T>
  delete(id: string): Promise<void>
}
```

## 实现新功能时

1. 先搜索经过实战检验的骨架项目
2. 使用并行 Agent 评估选项（安全、可扩展性、相关性）
3. 克隆最佳匹配作为基础
4. 在经过验证的结构中迭代
