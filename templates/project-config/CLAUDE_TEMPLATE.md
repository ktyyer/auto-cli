# 项目配置模板

> 将此文件复制到你的项目根目录 `.claude/CLAUDE.md`
> 然后根据你的项目技术栈进行定制

---

## 项目概述

**项目类型**: [Spring Boot / Vue3 / Next.js / Python / 其他]

**技术栈**:
- [语言和版本]
- [主要框架]
- [数据库]
- [其他重要技术]

---

## 核心规则（必须遵守）

### 1. 项目架构

[描述你的项目架构]

例如：
```
前端: Vue3 + TypeScript + Vite
后端: Spring Boot + MyBatis Plus
```

### 2. 代码规范

[列出你的代码规范要求]

例如：
- 使用 TypeScript 严格模式
- 组件命名采用 PascalCase
- 文件命名采用 kebab-case

### 3. 接口规范

[如果你的项目有API，描述规范]

例如：
- RESTful API 设计
- 统一响应格式: `{ code, data, message }`
- 错误处理规范

---

## 命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 文件 | [规则] | [示例] |
| 变量 | [规则] | [示例] |
| 函数 | [规则] | [示例] |
| 类 | [规则] | [示例] |

---

## 目录结构

```
项目根目录/
├── src/
│   ├── [主要目录1]
│   ├── [主要目录2]
│   └── [主要目录3]
├── tests/
└── docs/
```

---

## 开发检查清单

在开发新功能时，确保：

- [ ] [检查项1]
- [ ] [检查项2]
- [ ] [检查项3]

---

## 常用命令

```bash
# 开发
npm run dev

# 构建
npm run build

# 测试
npm test

# 其他常用命令
```

---

## 项目特定注意事项

1. [重要注意事项1]
2. [重要注意事项2]
3. [重要注意事项3]

---

## 知识库参考

如果项目有详细文档，可以在这里引用：

- [架构文档](knowledge/project_architecture.md)
- [编码规范](knowledge/coding_standards.md)
- [API文档](docs/api.md)

---

## 定制说明

### 如何使用此模板

1. 复制此文件到项目根目录: `.claude/CLAUDE.md`
2. 填写项目概述和技术栈
3. 根据项目特点修改核心规则
4. 添加项目特定的命名规范
5. 更新目录结构
6. 添加常用命令
7. 删除不需要的章节

### 不同技术栈的示例

#### 前端项目 (Vue3 + TypeScript)

```markdown
## 核心规则

1. **组件规范**:
   - 使用 `<script setup>` 语法
   - Props 必须定义类型
   - 使用 Composition API

2. **类型安全**:
   - 严禁使用 `any`
   - 接口定义放在 `types/` 目录
   - 使用 `ref` 和 `reactive` 时指定类型

3. **样式规范**:
   - 使用 scoped 样式
   - BEM 命名法
```

#### 后端项目 (Spring Boot)

```markdown
## 核心规则

1. **分层架构**:
   - Controller → Service → Repository
   - Controller 只处理请求响应
   - Service 包含业务逻辑

2. **数据库操作**:
   - 使用 MyBatis Plus
   - 逻辑删除字段: deleted
   - 统一时间字段: create_time, update_time

3. **异常处理**:
   - 自定义业务异常
   - 统一异常处理器
```

---

**提示**: 定期更新此配置以保持与项目发展同步。
