---
name: example-custom-plugin
version: 1.0.0
description: 示例自定义插件 - 展示如何创建自己的插件
author: your-name
triggers:
  - "特殊格式"
  - "special format"
  - "custom-style"
priority: 100  # 最高优先级，确保自定义插件优先加载
language: auto  # 适用于所有语言
---

# 自定义插件示例

这是一个示例插件，展示如何创建你自己的插件。

## 何时创建自定义插件？

当你有以下需求时：

1. **公司特定编码规范** - 需要应用公司统一的代码风格
2. **项目特定模式** - 项目有特殊的架构模式或设计模式
3. **特殊注释格式** - 需要特定格式的文档注释
4. **自定义代码模板** - 需要生成特定格式的代码
5. **集成内部工具** - 需要调用公司内部的 API 或服务

## 插件结构

```markdown
---
name: plugin-name              # 插件名称（唯一）
version: 1.0.0                 # 版本号
description: 插件描述         # 插件说明
author: your-name              # 作者
triggers:                      # 触发关键词列表
  - "关键词1"
  - "关键词2"
priority: 100                 # 优先级（1-100）
language: javascript          # 适用语言（可选）
framework: react               # 适用框架（可选）
---

# 插件内容

在这里定义插件的具体行为...
```

## 实际示例

### 示例 1：公司特定注释格式

```markdown
---
name: company-comment-style
version: 1.0.0
triggers:
  - "公司格式"
  - "company style"
priority: 100
---

# 公司注释格式插件

生成代码时应用公司统一的注释格式：

```javascript
/**
 * @function 函数名
 * @description 函数描述
 * @param {类型} 参数名 - 参数说明
 * @returns {类型} 返回值说明
 * @author 作者名
 * @date 创建日期
 */
```

### 示例 2：项目特定错误处理

```markdown
---
name: project-error-handler
version: 1.0.0
triggers:
  - "统一错误处理"
  - "unified error"
priority: 90
---

# 统一错误处理插件

所有函数返回统一的错误格式：

```typescript
type Result<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}
```

### 示例 3：特定设计模式

```markdown
---
name: repository-pattern
version: 1.0.0
triggers:
  - "仓储模式"
  - "repository pattern"
priority: 80
---

# 仓储模式插件

强制使用仓储模式进行数据访问：

```typescript
interface Repository<T> {
  findAll(): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: Omit<T, 'id'>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}
```

## 安装自定义插件

### 步骤 1：创建插件文件

创建 `my-plugin.md` 文件：

```markdown
---
name: my-plugin
version: 1.0.0
description: 我的插件
author: Your Name
triggers:
  - "my-keyword"
priority: 100
---

# 插件内容
定义你的插件行为...
```

### 步骤 2：复制到插件目录

```bash
# 只需复制，无需配置！
cp my-plugin.md .aimax/skills/plugins/custom/

# 立即生效
```

### 步骤 3：开始使用

```bash
/aimax:auto 用 my-keyword 方式写一个用户验证函数

↓ 系统自动检测到 "my-keyword"

✅ 自动加载 my-plugin 插件
✅ 应用你定义的规范
✅ 生成符合要求的代码
```

## 高级特性

### 插件组合

多个插件可以同时生效：

```bash
/aimax:auto 用 React 写一个登录组件

↓ 系统加载多个插件

✅ react-helper (JavaScript + React)
✅ super-tdd (内置 TDD 流程)
✅ pr-review (内置代码审查)

组合使用，生成高质量代码！
```

### 插件优先级

当多个插件匹配时，按优先级排序：

```
priority: 100   # 自定义插件（最高）
priority: 50    # 框架插件
priority: 10    # 语言插件
priority: 1     # 通用插件（默认）
```

### 条件触发

插件可以根据条件决定是否应用：

```markdown
---
triggers:
  - "keyword1"
  - "keyword2"
language: javascript  # 只在 JavaScript 项目中生效
framework: react      # 只在 React 项目中生效
---
```

## 最佳实践

1. **命名规范**：使用描述性的插件名称
2. **关键词选择**：选择独特但不冲突的关键词
3. **优先级设置**：自定义插件使用较高优先级（80-100）
4. **文档完善**：在插件中写清楚使用说明
5. **版本控制**：使用语义化版本号

## 插件示例库

- `company-style.md` - 公司统一代码风格
- `project-patterns.md` - 项目设计模式
- `error-handling.md` - 统一错误处理
- `logging-format.md` - 日志格式规范
- `api-client.md` - API 客户端生成

## 开始创建你的插件

```bash
# 1. 复制此模板
cp skills/plugins/custom/example-plugin.md my-plugin.md

# 2. 编辑插件内容
vim my-plugin.md

# 3. 安装插件
cp my-plugin.md .aimax/skills/plugins/custom/

# 4. 开始使用
/aimax:auto 使用你的插件功能
```

**零配置！复制即用！** 🚀
