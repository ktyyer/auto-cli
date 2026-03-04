# 项目配置模板使用指南

## 目录结构

```
ai-max/
├── templates/
│   └── project-config/
│       ├── CLAUDE_TEMPLATE.md    # 通用配置模板
│       ├── aimax-loop-state-template.json # 状态机检查点模板
│       ├── README.md             # 本文件
│       └── examples/             # 示例配置（可选）
│           ├── spring-cloud.md   # Spring Cloud 项目示例
│           ├── vue3-typescript.md # Vue3 + TypeScript 项目示例
│           └── python-fastapi.md # Python FastAPI 项目示例
```

---

## 如何为其他项目创建配置

### 方法 1: 快速开始（推荐）

1. **复制模板到项目**:
```bash
# 进入你的项目目录
cd /path/to/your-project

# 创建 .claude 目录
mkdir -p .claude

# 复制模板
cp /path/to/ai-max/templates/project-config/CLAUDE_TEMPLATE.md .claude/CLAUDE.md
```

2. **编辑配置**:
打开 `.claude/CLAUDE.md`，根据项目填写以下内容：

```markdown
## 项目概述

**项目类型**: Vue3 + TypeScript

**技术栈**:
- Vue 3.3
- TypeScript 5.0
- Vite 4.3
- Pinia (状态管理)
- Element Plus (UI组件)

## 核心规则
1. 使用 Composition API + `<script setup>`
2. 严禁使用 `any` 类型
3. 组件命名使用 PascalCase
...
```

3. **开始使用**:
在 Claude Code 中工作时会自动遵循这些规则。

4. **可选：启用持续迭代门禁**:
```bash
mkdir -p .github/workflows
cp /path/to/ai-max/templates/ci/aimax-evolution-gates.yml .github/workflows/
cp /path/to/ai-max/templates/ci/aimax-pr-eval-comment.yml .github/workflows/
mkdir -p .aimax/state
cp /path/to/ai-max/templates/project-config/aimax-loop-state-template.json .aimax/state/loop-state.json
```
然后在 Claude Code 中使用：
```bash
/aimax:loop 对当前复杂任务做状态机编排并支持恢复
/aimax:evolve 为当前项目建立评估驱动的持续优化流程
```

---

### 方法 2: 基于现有项目配置

如果项目已经有类似技术栈，可以复制并修改：

```bash
# 复制 sy-new-cloud 的配置（适用于其他 Spring Cloud 项目）
cp D:\workSpace\sy-new-cloud\.claude\CLAUDE.md D:\workSpace\other-project\.claude\CLAUDE.md

# 然后根据新项目的特点修改
```

---

## 不同技术栈的配置示例

### Spring Boot / Spring Cloud 项目

参考: `D:\workSpace\sy-new-cloud\.claude\CLAUDE.md`

**核心内容**:
- 分层架构: Controller → Service → Manage → Mapper
- MyBatis Plus 规范
- 统一响应格式
- 事务管理规范

### Vue3 + TypeScript 项目

```markdown
## 核心规则

### 1. 组件规范
- 使用 `<script setup lang="ts">` 语法
- Props 必须定义类型接口
- Emits 必须声明
- 使用 Composition API

### 2. 类型安全
- 严禁使用 `any`
- 接口定义放在 `types/` 目录
- 使用 `ref<T>()` 和 `reactive<T>()` 指定类型

### 3. 文件命名
- 组件文件: PascalCase (如 `UserProfile.vue`)
- 工具文件: kebab-case (如 `format-date.ts`)
- 类型文件: kebab-case + `.types.ts` (如 `user.types.ts`)

### 4. API 调用
- 使用统一的 axios 封装
- 错误统一处理
- 请求/响应拦截器
```

### Python FastAPI 项目

```markdown
## 核心规则

### 1. 项目结构
```
app/
├── api/          # API 路由
├── models/       # 数据模型
├── schemas/      # Pydantic schemas
├── services/     # 业务逻辑
├── database/     # 数据库配置
└── main.py       # 应用入口
```

### 2. API 规范
- 使用 Pydantic 进行数据验证
- 统一响应格式: `{"code": 0, "data": ..., "message": "..."}`
- 异常统一处理
- 使用依赖注入

### 3. 代码风格
- 遵循 PEP 8
- 使用 type hints
- Docstrings 使用 Google 风格
```

### Node.js + Express 项目

```markdown
## 核心规则

### 1. 项目结构
```
src/
├── controllers/  # 控制器
├── services/     # 业务逻辑
├── models/       # 数据模型
├── middleware/   # 中间件
├── routes/       # 路由定义
└── app.js        # 应用入口
```

### 2. API 规范
- RESTful 设计
- 统一错误处理中间件
- 使用 async/await
- 输入验证使用 Joi 或 express-validator

### 3. 代码风格
- 使用 ESLint + Prettier
- 优先使用 const > let > var
- 使用模板字符串
```

---

## 配置文件最佳实践

### 1. 保持简洁

只包含关键规则，避免冗长：

```markdown
## ❌ 不推荐（过于详细）
Controller 层是负责接收用户请求的第一层。它的主要职责包括：接收来自前端的 HTTP 请求...（省略 500 字）

## ✅ 推荐（简洁明了）
### Controller 层
- 只接收请求、调用 Service、返回响应
- 不包含业务逻辑
```

### 2. 使用表格和列表

结构化信息更易读：

```markdown
## 命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件 | PascalCase | `UserProfile.vue` |
| 工具 | kebab-case | `format-date.ts` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
```

### 3. 提供代码示例

具体示例比抽象描述更有用：

```markdown
## ✅ 推荐（有示例）
### 组件定义
```vue
<script setup lang="ts">
interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})
</script>
```
```

### 4. 链接到详细文档

如果规则复杂，链接到详细文档：

```markdown
详细的架构和编码规范请参考：
- [完整架构文档](knowledge/project_architecture.md)
- [编码规范文档](knowledge/coding_standards.md)
```

---

## 常见问题

### Q1: 配置文件会被 Git 跟踪吗？

**A**: 是的，`.claude/CLAUDE.md` 应该提交到 Git 仓库，这样团队成员都能使用。

### Q2: 可以有多个配置文件吗？

**A**: Claude Code 只会加载 `CLAUDE.md`，但你可以：
- 在 CLAUDE.md 中引用其他文件
- 使用 `knowledge/` 目录存放详细文档

### Q3: 如何更新配置？

**A**:
1. 直接编辑 `.claude/CLAUDE.md`
2. 提交到 Git
3. Claude Code 会自动使用最新配置

### Q4: 不同环境需要不同配置吗？

**A**: 一般不需要。配置规则应该适用于所有环境。如果有特殊需求，可以在配置中说明。

### Q5: 配置文件太长怎么办？

**A**:
1. 提取详细内容到 `knowledge/` 目录
2. 在 CLAUDE.md 中引用这些文件
3. CLAUDE.md 只保留核心规则和快速参考

---

## 高级用法

### 1. 集成项目知识库

创建 `.claude/knowledge/` 目录存放详细文档：

```
.claude/
├── CLAUDE.md              # 核心规则（必须）
└── knowledge/             # 详细文档（可选）
    ├── architecture.md    # 架构文档
    ├── api.md             # API 文档
    └── workflows.md       # 工作流文档
```

然后在 `CLAUDE.md` 中引用：

```markdown
## 知识库参考

- [完整架构文档](knowledge/architecture.md)
- [API 文档](knowledge/api.md)
- [开发工作流](knowledge/workflows.md)
```

### 2. 添加项目特定技能

创建 `.claude/skills/` 目录：

```
.claude/
├── CLAUDE.md
├── skills/
│   ├── database-operations.md    # 数据库操作技能
│   ├── api-development.md         # API 开发技能
│   └── testing.md                 # 测试技能
```

### 3. 使用 AI MAX 全局配置

结合使用 AI MAX 的全局配置和项目配置：

```bash
# 1. 安装 AI MAX 通用规则（全局）
aimax install

# 2. 添加项目特定规则（项目级）
# .claude/CLAUDE.md 会覆盖或补充全局规则
```

---

## 维护建议

1. **定期审查**: 每季度检查配置是否需要更新
2. **团队协作**: 让团队成员贡献改进建议
3. **版本控制**: 所有配置变更都应提交到 Git
4. **文档同步**: 如果项目架构变更，及时更新配置

---

## 总结

- ✅ 每个项目一个 `.claude/CLAUDE.md` 配置
- ✅ 配置文件应该简洁、具体、有示例
- ✅ 详细文档放在 `knowledge/` 目录
- ✅ 配置应该提交到 Git 仓库
- ✅ 定期更新以保持与项目同步

**开始为你的项目创建定制化配置吧！** 🚀
