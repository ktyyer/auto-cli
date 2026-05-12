# CLAUDE.md 模板代码块

> 7 个核心板块的完整代码模板。按需加载，主 skill 文件只保留路由层。

## 板块 1：项目概述（必填）

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

## 板块 2：项目结构（必填）

```markdown
## 目录结构

src/
index.ts # 入口文件
config/ # 配置
routes/ # 路由定义
services/ # 业务逻辑
models/ # 数据模型
utils/ # 工具函数
tests/
unit/ # 单元测试
integration/ # 集成测试
```

## 板块 3：编码规范（必填）

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

## 板块 4：测试要求（必填）

```markdown
## 测试规范

- 测试框架: [vitest/jest/pytest]
- 最低覆盖率: [80%]
- 测试文件命名: [*.test.ts / test_*.py / *Test.java]
- 测试文件位置: [与源文件同目录 / tests/ 目录]
- 运行测试: [npm test / pytest / mvn test]
- 覆盖率报告: [npm run coverage / pytest --cov]
```

## 板块 5：Git 规范（推荐）

```markdown
## Git 规范

### 提交信息格式

<type>: <description>

类型: feat, fix, refactor, docs, test, chore, perf, ci

### 分支策略

- main: 生产分支，禁止直接 push
- dev: 开发分支
- feature/\*: 功能分支
```

## 板块 6：AI 行为约束（必填）

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

## 板块 7：已知问题/待办（可选）

```markdown
## 已知问题

- [ ] 认证模块需要重构（当前使用 session，计划迁移到 JWT）
- [ ] 日志系统需要统一（当前混用了 console.log 和 winston）
- [ ] API 响应格式不统一（有的用 {data}，有的用 {result}）

## 技术债务

- utils.js 超过 800 行，需要拆分
- 3 个组件缺少单元测试
```

## 快速启动模板（最小可用）

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

## 会话恢复模板

```markdown
# 会话恢复

## 任务描述

[一句话描述你在做什么]

## 已完成的步骤

1. [x] PHASE 1 SCAN 完成
2. [x] PHASE 2 Quest Map 已生成
3. [ ] PHASE 3 执行中（Quest 3/7）

## 关键决策记录

- 选择了 A 方案而非 B，因为 [原因]
- 修改了 [文件]，影响 [范围]

## 下一步

- 从 Quest 3 开始继续执行
- 注意 [预判坑点]
```
