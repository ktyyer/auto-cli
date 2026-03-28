---
name: project-init
version: 1.0.0
description: 项目初始化 - 自动扫描项目生成 CLAUDE.md 配置，智能检测技术栈
author: ai-max
tags: [init, claude-md, config, project-setup]
---

# Project Init — 项目初始化

> 自动扫描项目结构，智能生成 CLAUDE.md 配置文件

## 功能特性

### 智能检测

- **语言检测**: 自动识别 Java, JavaScript, TypeScript, Python, Go, Rust 等
- **框架检测**: 识别 Spring Boot, Vue, React, Next.js, Django, FastAPI 等
- **数据库**: 检测 PostgreSQL, MySQL, MongoDB 等数据库配置
- **测试框架**: 识别 Jest, Vitest, JUnit, Pytest 等
- **构建工具**: 检测 Maven, Gradle, npm, yarn, pnpm 等

### 生成内容

生成的 CLAUDE.md 包含：

1. **项目概述** - 项目类型、技术栈
2. **核心规则** - 根据检测到的框架生成的编码规范
3. **目录结构** - 自动扫描的项目目录
4. **常用命令** - 包管理、测试、构建命令
5. **开发检查清单** - 提交前检查项
6. **Git 工作流** - 分支和提交信息规范
7. **AI 辅助开发** - Auto CLI 命令列表

---

## 使用方法

### 基本用法

```bash
# 在当前项目目录运行
node skills/project-init/lib/claude-md-generator.js
```

### 指定项目目录

```bash
# 分析指定目录
node skills/project-init/lib/claude-md-generator.js --dir /path/to/project
```

### 指定输出位置

```bash
# 输出到指定文件
node skills/project-init/lib/claude-md-generator.js --output ./CLAUDE.md
```

---

## 支持的技术栈

### 前端框架

| 框架 | 检测文件 | 生成的规则 |
|------|----------|------------|
| Vue.js | package.json | Composition API, scoped styles, TypeScript strict mode |
| React | package.json | Functional components, hooks, TypeScript/PropTypes |
| Next.js | next.config.js | App Router, Server Components, Route Handlers |
| Nuxt | nuxt.config.ts | Composition API, auto-imports, server routes |

### 后端框架

| 框架 | 检测文件 | 生成的规则 |
|------|----------|------------|
| Spring Boot | pom.xml | Controller-Service-Repository, MyBatis Plus, Bean Validation |
| Express | package.json | Express Router, middleware pattern, error handling |
| NestJS | package.json | Module-based, DI container, class-validator |
| FastAPI | requirements.txt | APIRouter, async/await, Pydantic models |
| Django | manage.py | MVT pattern, Django ORM, app-based architecture |

### 测试框架

- Jest / Vitest (JavaScript/TypeScript)
- JUnit (Java)
- Pytest (Python)

---

## 生成的 CLAUDE.md 示例

### Spring Boot 项目

```markdown
# my-project

## 项目概述

**项目类型**: 后端应用 (Spring Boot)

**主要语言**: Java

**框架和库**:
- Spring Boot

**数据库**: PostgreSQL

**测试框架**: JUnit

---

## 核心规则（必须遵守）

### Spring Boot 规则

- **Architecture**: Controller → Service → Repository
- **Database**: MyBatis Plus or JPA
- **Validation**: Bean Validation with @Valid

### Java 编码规范

- **分层架构**: 严格遵守 Controller → Service → Repository
- **依赖注入**: 使用构造函数注入，避免字段注入
- **异常处理**: 使用自定义业务异常，统一异常处理器
...
```

### Vue.js 项目

```markdown
# my-vue-app

## 项目概述

**项目类型**: 前端应用 (Vue.js)

**主要语言**: TypeScript

**框架和库**:
- Vue.js

**测试框架**: Vitest

---

## 核心规则（必须遵守）

### Vue.js 规则

- **Script syntax**: Composition API with <script setup>
- **Style pattern**: scoped styles with BEM naming
- **Type rules**: TypeScript strict mode, no any

### JavaScript/TypeScript 编码规范

- **类型安全**: TypeScript 项目使用严格模式，避免 any
- **组件命名**: 组件使用 PascalCase，工具函数使用 camelCase
...
```

---

## 集成到 Auto CLI

### 作为安装后步骤

```bash
# 1. 安装 Auto CLI
npm install -g auto-cli

# 2. 在项目目录生成 CLAUDE.md
auto-cli init

# 3. 重启 Claude Code
```

### 持续更新

当项目技术栈发生变化时（如添加新框架），重新运行生成器更新配置：

```bash
auto-cli init --force
```

---

## 高级用法

### 自定义模板

编辑 `templates/project-config/CLAUDE_TEMPLATE.md` 来定制默认模板。

### 环境特定配置

为不同环境生成不同的配置：

```bash
# 开发环境
node claude-md-generator.js --output .claude/CLAUDE.dev.md

# 生产环境
node claude-md-generator.js --output .claude/CLAUDE.prod.md
```

---

## 检测原理

### 语言检测

通过查找以下文件：

| 语言 | 检测文件 |
|------|----------|
| Java | pom.xml, build.gradle |
| TypeScript | tsconfig.json |
| JavaScript | package.json |
| Python | requirements.txt, pyproject.toml |
| Go | go.mod |
| Rust | Cargo.toml |

### 框架检测

通过在配置文件中搜索特征字符串：

- Spring Boot: `spring-boot`, `springframework` in pom.xml
- Vue: `vue` in package.json dependencies
- React: `react` in package.json dependencies
- Django: `django` in requirements.txt

---

## 最佳实践

### 何时使用

1. **新项目** - 初始化时立即生成
2. **接手老项目** - 快速了解项目结构
3. **技术栈变更** - 更新配置以反映新变化
4. **团队协作** - 统一项目规范

### 维护建议

1. 定期更新 CLAUDE.md 以保持与项目同步
2. 将项目特定规则添加到生成的配置中
3. 使用版本控制跟踪 CLAUDE.md 变更
4. 在代码审查中检查 CLAUDE.md 是否需要更新

---

## 常见问题

### Q: 生成的配置不完整怎么办？

A: 生成器提供基础配置，需要根据项目特点补充：

```markdown
## 项目特定注意事项

1. 使用自定义的认证中间件
2. 所有 API 响应必须包含 requestId
3. 禁止在生产环境使用 console.log
```

### Q: 如何支持更多技术栈？

A: 在 `claude-md-generator.js` 中添加检测规则：

```javascript
const TECH_DETECTION = {
  your_framework: {
    files: ['config.file'],
    patterns: [/pattern/],
    name: 'Your Framework',
    category: 'backend',
    config: {
      rule1: 'value1',
      rule2: 'value2'
    }
  }
};
```

---

## 开源借鉴

- **everything-claude-code** - CLAUDE.md 最佳实践
- **Cline** - 项目结构自动检测
- **Cursor** - 智能配置生成
