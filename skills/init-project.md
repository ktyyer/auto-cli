---
name: init-project
description: 项目智能初始化 - 为新项目生成结构化 CLAUDE.md，包含技术栈声明、编码规范、目录说明和 AI 行为约束，让 AI 从第一天就"懂"你的项目
version: 1.0.0
author: auto-cli
tags: [init, setup, claude-md, project-context, onboarding]
---

# Init Project -- CLAUDE.md 智能初始化

> 新项目第一步不是写代码，是让 AI 理解你的项目。本 Skill 提供结构化 CLAUDE.md 生成能力，
> 帮助 AI 从第一个会话就遵守你的规范、理解你的架构、知道你的禁区。

---

## 适用场景

- 新项目首次启动，还没有 CLAUDE.md
- 已有项目但没有 CLAUDE.md，AI 反复犯同样错误
- 团队协作时统一 AI 行为规范
- 项目重大重构后需要更新 CLAUDE.md

---

## 使用方式

### 方式 1：通过 /auto 命令

```
/auto 为当前项目生成 CLAUDE.md
```

### 方式 2：手动参考模板

直接复制下方模板，根据项目实际情况修改。

---

## CLAUDE.md 模板结构

一个优秀的 CLAUDE.md 应包含以下 7 个核心板块（按重要性排序）：

### 板块 1：项目概述（必填）

````markdown
```markdown
# 项目名称

> 一句话描述项目是做什么的

## 技术栈
- 语言: [TypeScript/JavaScript/Java/Python/Go]
- 框架: [Next.js/Spring Boot/Django/Gin]
- 运行时: [Node.js >=18 / JDK 17 / Python 3.11+]
- 包管理: [npm/pnpm/yarn/pip/maven/cargo]
- 测试: [vitest/jest/pytest/JUnit]
```
````

**为什么重要**: AI 看到技术栈就知道该用什么语法、什么 API、什么工具链。

### 板块 2：项目结构（必填）

````markdown
```markdown
## 目录结构

```
src/
  index.ts          # 入口文件
  config/           # 配置
  routes/           # 路由定义
  services/         # 业务逻辑
  models/           # 数据模型
  utils/            # 工具函数
tests/
  unit/             # 单元测试
  integration/      # 集成测试
```
```
````

**为什么重要**: AI 知道文件放哪里，不会把 service 放到 utils 里。

### 板块 3：编码规范（必填）

````markdown
```markdown
## 编码规范

### 必须遵守
- 使用 [ESLint + Prettier] 格式化代码
- 变量命名使用 [camelCase/snake_case]
- 函数不超过 [50] 行
- 文件不超过 [400] 行
- 所有函数必须有 [JSDoc/docstring] 注释

### 禁止
- 禁止使用 [var/any/System.out.println]
- 禁止直接修改 props/参数对象（不可变原则）
- 禁止忽略异常（空 catch 块）
- 禁止硬编码密钥和端口
```
````

**为什么重要**: "禁止" 比 "推荐" 更有效。明确告诉 AI 不要做什么，比告诉它做什么更节省 Token。

### 板块 4：测试要求（必填）

````markdown
```markdown
## 测试规范

- 测试框架: [vitest/jest/pytest]
- 最低覆盖率: [80%]
- 测试文件命名: [*.test.ts / test_*.py / *Test.java]
- 测试文件位置: [与源文件同目录 / tests/ 目录]
- 运行测试: [npm test / pytest / mvn test]
- 覆盖率报告: [npm run coverage / pytest --cov]
```
````

### 板块 5：Git 规范（推荐）

````markdown
```markdown
## Git 规范

### 提交信息格式
<type>: <description>

类型: feat, fix, refactor, docs, test, chore, perf, ci

### 分支策略
- main: 生产分支，禁止直接 push
- dev: 开发分支
- feature/*: 功能分支
```
````

### 板块 6：AI 行为约束（必填）

````markdown
```markdown
## AI 行为约束

### 工作流程
1. 先读取相关文件理解上下文，不要盲目修改
2. 修改代码前先确认理解了原始设计意图
3. 每次修改后运行测试验证
4. 不确定时主动提问，不要猜测

### 上下文管理
- 对话超过 30 分钟建议开新会话
- 关键决策和架构变更记录到 CLAUDE.md
- 修改公共接口时先搜索所有使用方

### 安全红线
- 不修改 .env 文件（除非明确要求）
- 不删除已有测试用例
- 不引入未在技术栈中声明的新依赖
```
````

**为什么重要**: 这是最有价值的部分。明确的"红线"能避免 AI 做出破坏性操作。

### 板块 7：已知问题/待办（可选）

````markdown
```markdown
## 已知问题

- [ ] 认证模块需要重构（当前使用 session，计划迁移到 JWT）
- [ ] 日志系统需要统一（当前混用了 console.log 和 winston）
- [ ] API 响应格式不统一（有的用 {data}，有的用 {result}）

## 技术债务
- utils.js 超过 800 行，需要拆分
- 3 个组件缺少单元测试
```
````

**为什么重要**: AI 看到这些信息，在修改相关代码时会主动考虑这些约束。

---

## 快速启动模板（复制即用）

以下是最小可用的 CLAUDE.md 模板，适合快速启动：

````markdown
```markdown
# [项目名]

> [一句话描述]

## 技术栈
- 语言: [填写]
- 框架: [填写]
- 测试: [填写]

## 项目结构
[简要描述核心目录和文件的作用]

## 编码规范
- [填写 3-5 条最重要的规范]

## 测试要求
- 覆盖率 >= 80%
- 修改代码必须运行测试

## AI 约束
- 先理解再修改
- 不引入新依赖
- 不删除测试
```
````

---

## 生成流程（给 quest-designer 参考）

当用户请求 "为当前项目生成 CLAUDE.md" 时，quest-designer 应：

1. **PHASE 1 DISCOVER**: 扫描项目（package.json/pom.xml/go.mod/pyproject.toml、src/ 目录结构、已有测试、已有配置文件）
2. **提取信息**: 从 package.json 提取技术栈和脚本、从 src/ 提取目录结构、从 .eslintrc 提取编码规范
3. **生成 CLAUDE.md**: 基于提取的信息 + 上方模板，生成项目专属的 CLAUDE.md
4. **PHASE 4 VERIFY**: 验证生成的 CLAUDE.md 格式正确、信息准确
5. **PHASE 6 LEARN**: 将 "项目已初始化 CLAUDE.md" 记录到知识沉淀

---

## 与 Auto CLI 的集成

- `/auto 为当前项目生成 CLAUDE.md` -- 自动触发本 Skill
- quest-designer 在 PHASE 2 分析时会检查 CLAUDE.md 是否存在，不存在时推荐使用本 Skill
- PHASE 6 LEARN 会记录 CLAUDE.md 的生成和后续更新
- `skills/unified-memory-system.md` 的 "策略 3: 活规则书" 与本 Skill 形成闭环

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 写了 1000 行的 CLAUDE.md | 控制在 200 行以内，AI 会忽略过长的文件 |
| 只写"代码要写好"这种废话 | 写具体规则："变量用 camelCase"、"函数不超过 50 行" |
| 一次写完再也不更新 | CLAUDE.md 是活文档，项目演进时同步更新 |
| 把密钥写进 CLAUDE.md | CLAUDE.md 会被提交到 Git，密钥只能放 .env |

---

## 会话恢复模板

当 Claude Code 会话中断或需要跨会话继续任务时，使用以下模板：

```markdown
# 会话恢复

## 任务描述
[一句话描述你在做什么]

## 已完成的步骤
1. [x] PHASE 1 DISCOVER 完成
2. [x] PHASE 2 Quest Map 已生成
3. [ ] PHASE 3 执行中（Quest 3/7）

## 关键决策记录
- 选择了 A 方案而非 B，因为 [原因]
- 修改了 [文件]，影响 [范围]

## 下一步
- 从 Quest 3 开始继续执行
- 注意 [预判坑点]
```

### 上下文管理要点

- 对话超过 30 条消息时，AI 容易"失忆"，建议开新会话并用上方模板恢复
- 每个 Agent 只接收需要的上下文（不要把整个项目传给子 Agent）
- 验收标准要具体可执行（"编译通过" > "写好点"）

### 知识沉淀

```bash
# 保存经验到知识库
auto save insight -c "发现 N+1 查询问题：循环中调用 selectList 应该先批量查出"
auto save insight -c "选择了 Event Sourcing 而非 CRUD" -t decision

# 搜索知识
auto save search -q "N+1"

# 列出统计
auto save list
```
