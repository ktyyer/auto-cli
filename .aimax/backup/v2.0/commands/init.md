---
description: CLAUDE.md 自动生成 - 扫描项目结构自动生成适配当前项目的 CLAUDE.md 配置文件
---

# Init CLAUDE.md 命令

`/aimax:init` 自动扫描当前项目，生成专属的 `CLAUDE.md` 配置文件。

---

## 功能说明

Claude Code 官方推荐在每个项目中维护 `CLAUDE.md`，但手写耗时且容易遗漏关键信息。本命令自动完成：

1. 检测项目技术栈（语言/框架/构建工具/测试框架）
2. 提取项目结构和关键模式
3. 读取现有配置（pom.xml / package.json / requirements.txt / go.mod）
4. 生成结构化的 `CLAUDE.md`
5. 可选：合并现有 `CLAUDE.md`（不覆盖已有自定义内容）

---

## 检测逻辑

### 技术栈检测

```yaml
检测文件 → 推断技术栈:
  pom.xml           → Java + Maven
  build.gradle      → Java + Gradle
  package.json      → Node.js / TypeScript
  requirements.txt  → Python
  pyproject.toml    → Python (Poetry/PDM)
  go.mod            → Go
  Cargo.toml        → Rust
  Gemfile           → Ruby on Rails
  composer.json     → PHP
  
框架进一步检测:
  pom.xml 含 spring-boot → Spring Boot
  package.json 含 react  → React
  package.json 含 vue    → Vue
  package.json 含 next   → Next.js
  requirements.txt 含 django → Django
  requirements.txt 含 fastapi → FastAPI
```

### 项目规模检测

```bash
# 文件数量
find src -name "*.java" | wc -l  # Java 文件数
find src -name "*.ts" | wc -l    # TS 文件数

# Git 历史
git log --oneline | wc -l        # 提交数
git log --format="%an" | sort -u | wc -l  # 贡献者数
```

---

## 生成的 CLAUDE.md 模板

### Spring Boot 项目示例

```markdown
# CLAUDE.md — [项目名称]

> 由 `/aimax:init` 于 2026-02-28 自动生成，请手动补充业务细节

## 项目概述

**类型**: Java 17 + Spring Boot 3.x 微服务
**模块**: eco-system / eco-order / eco-payment
**数据库**: MySQL 8.0 + Redis 7.x
**构建**: Maven 3.8

## 关键命令

```bash
# 构建
mvn clean compile -DskipTests

# 测试
mvn test

# 运行（本地）
mvn spring-boot:run -pl eco-gateway

# 代码检查
mvn checkstyle:check
```

## 架构规范

遵循如下分层（禁止跨层调用）:
Controller → Service Interface → ServiceImpl → Mapper → Database

详见 `.claude/rules/java-coding-style.md`

## 代码风格

- 响应统一用 `Result<T>` 包装
- Service 多步操作必须加 `@Transactional(rollbackFor = Exception.class)`
- MyBatis 一律用 `#{}` 参数化，禁止 `${}`
- 实体不直接返回前端，使用 DTO 转换

## 测试规范

- 覆盖率目标: ≥ 80%
- Service 层单元测试使用 Mockito
- Controller 层使用 MockMvc

## 重要文件

- 主配置: `eco-common/src/main/resources/application.yml`
- 数据库迁移: `sql/`
- API 文档: `http://localhost:8080/doc.html`（Knife4j）

## 可用命令

- `/aimax:deep-plan` - 复杂任务两阶段规划
- `/aimax:tdd` - 测试驱动开发
- `/aimax:code-review` - 代码审查
- `/aimax:security-scan` - 安全扫描
- `/aimax:evolve` - 持续优化门禁
```

### Node.js / TypeScript 项目示例

```markdown
# CLAUDE.md — [项目名称]

> 由 `/aimax:init` 自动生成

## 项目概述

**类型**: Next.js 14 + TypeScript + Prisma
**样式**: Tailwind CSS + shadcn/ui
**数据库**: PostgreSQL（通过 Prisma ORM）
**部署**: Vercel

## 关键命令

```bash
npm run dev          # 开发服务器
npm run build        # 构建
npm run test         # 运行测试（Vitest）
npm run lint         # ESLint
npm run type-check   # TypeScript 检查
```

## 代码规范

- 函数组件 + React Hooks（禁止 class component）
- 不可变操作（禁止直接修改 state/props）
- API 响应统一格式: `{ success: boolean, data?: T, error?: string }`
- 禁止 `console.log`（使用 `logger` 工具）
- 禁止硬编码密钥（使用 `.env.local`）
```

---

## 使用方式

```bash
# 基础用法（在项目根目录）
/aimax:init

# 强制覆盖现有 CLAUDE.md
/aimax:init --force

# 只检测，不生成（预览）
/aimax:init --dry-run

# 合并模式（保留已有自定义内容）
/aimax:init --merge
```

---

## 生成后的推荐步骤

1. **审查生成内容** — 确认技术栈检测正确
2. **补充业务细节** — 添加项目特定的规则和背景
3. **精简 CLAUDE.md** — 只保留每次对话都需要的信息
4. **将详细文档移出** — 用 `docs/` 目录存放，CLAUDE.md 中引用
5. **提交到版本控制** — `git add CLAUDE.md && git commit -m "docs: add CLAUDE.md"`

> **最佳实践**: CLAUDE.md 应保持在 100 行以内。
> 详细规范放 `.claude/rules/`，只在 CLAUDE.md 中引用。

---

## 与其他命令协作

- `/aimax:update-docs` — 更新 CLAUDE.md 当项目发生重大变更时
- `/aimax:repo-map` → 生成 `REPO_MAP.md`，在 CLAUDE.md 中引用
- `/aimax:deep-plan` — 生成 CLAUDE.md 后即可开始深度规划

---

## 开源借鉴

- **Claude Code 官方 `/init` 命令** — 自动生成 CLAUDE.md 概念
- **everything-claude-code** — CLAUDE.md 结构规范和最佳实践
- **cursor rules generator** — IDE 级别的项目配置自动生成
