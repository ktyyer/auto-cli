---
name: react-helper
version: 1.1.0
description: React 开发助手 - 严格遵循项目现有代码风格
author: ai-max
triggers:
  - "React"
  - "react"
  - "Component"
  - "component"
  - "JSX"
  - "jsx"
  - "Hook"
  - "hook"
  - "useState"
  - "useEffect"
  - "props"
  - "state"
priority: 50
language: javascript
framework: react
---

# React 开发助手（项目风格优先）

> 第一原则：**沿用项目已有写法**，不要强行套默认 React 模板。

## 规则优先级

1. **项目现有代码**
2. **项目配置文件**（`tsconfig.json`、`eslint`、`prettier`、`editorconfig`）
3. **项目文档约定**（README/CONTRIBUTING）
4. **本插件兜底建议**（仅无样例时使用）

## 执行流程

### Step 1: 先探测项目风格

生成代码前先确认：

- JS 还是 TS（不要默认强推 TS）
- 组件组织方式（函数组件、文件结构、导出方式）
- 状态方案（`useState`/`useReducer`/Redux/Zustand/Context）
- 样式方案（CSS Modules/Tailwind/Styled Components/SCSS）
- 表单方案（原生受控表单/react-hook-form/Formik）
- 请求方案（fetch/axios/react-query/swr）
- 测试方案（Jest/Vitest/RTL）

### Step 2: 按现有样本对齐

至少参考同目录 2-3 个组件或 Hook，再生成新代码。必须对齐：

- 命名和目录结构
- import 顺序和路径别名
- 事件命名、错误处理、返回结构
- 测试文件写法

### Step 3: 最小增量实现

- 只实现当前需求，不顺手改全项目风格
- 不引入项目未使用的新库
- 不把 JS 项目直接改成 TS 项目

## 强制约束（不可违反）

1. 项目未使用 Tailwind 时，禁止默认输出 Tailwind class。
2. 项目未使用 react-hook-form 时，禁止强制引入。
3. 项目未使用 Zustand/Redux 时，禁止强制引入全局状态库。
4. 项目使用 Vitest 时，禁止生成 Jest-only 测试模板。

## 输出要求

实现说明中必须明确：

- 参考了哪些现有组件/Hook 文件
- 对齐了哪些项目约定
- 哪些约定无法判定并需要用户确认（如果有）

## 兜底建议（仅无样例时）

仅在项目缺少可参考代码时，使用以下默认建议：

- 函数组件 + Hooks
- 明确 Props 类型（若项目使用 TS）
- 基本错误处理和加载状态
- 可测试结构（组件逻辑可分离）
