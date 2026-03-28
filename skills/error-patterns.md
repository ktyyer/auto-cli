---
name: error-patterns
description: 常见错误模式速查 - 编译错误、运行时错误、测试失败、CI/CD 故障的根因分析和速修方案，让 build-fix Agent 秒级定位问题
version: 1.0.0
author: auto-cli
tags: [error, debugging, patterns, build-fix, troubleshooting]
---

# Error Patterns -- 常见错误模式速查

> build-fix Agent 自动加载此知识库，快速定位错误根因并修复。

## 错误分类体系

### 1. Node.js / JavaScript 编译错误

| 错误关键词 | 根因 | 速修方案 |
|-----------|------|---------|
| `Cannot find module` | 模块未安装或路径错误 | `npm install` 或检查 import 路径 |
| `Unexpected token` | 语法错误（括号/引号不匹配） | 检查最近编辑的文件第 N 行 |
| `Cannot use import statement` | 使用 ESM 语法但未设 `"type": "module"` | package.json 加 `"type": "module"` |
| `ERR_MODULE_NOT_FOUND` | ESM import 路径缺少 `.js` 后缀 | 所有相对 import 加 `.js` 扩展名 |
| `ReferenceError: X is not defined` | 变量未声明或作用域错误 | 检查变量声明和 import |
| `SyntaxError: Unexpected end of input` | 缺少闭合括号/花括号 | 检查最近编辑区域的括号匹配 |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | 包的 exports 字段不包含此路径 | 检查包版本或换 import 路径 |

### 2. 测试框架错误

| 错误关键词 | 根因 | 速修方案 |
|-----------|------|---------|
| `vitest: TESTS_FAILED` | 测试断言不通过 | 逐个检查失败断言 |
| `TypeError: X is not a function` | mock 未正确设置 | 检查 `vi.mock()` 或 `vi.fn()` 配置 |
| `Cannot read properties of undefined` | 测试数据缺少字段 | 补全测试 fixture 的必需字段 |
| `Timeout - Async test` | 异步操作未 await 或缺少 cleanup | 加 `await` 或 `vi.useFakeTimers()` |
| `ENOENT: no such file` | 测试文件引用的 fixture 不存在 | 检查 `__fixtures__/` 路径 |
| ` vitest --coverage fails` | `@vitest/coverage-v8` 未安装 | `npm i -D @vitest/coverage-v8` |

### 3. Git / CI 错误

| 错误关键词 | 根因 | 速修方案 |
|-----------|------|---------|
| `Merge conflict` | 两个分支修改同一文件 | 手动解决冲突或 `git mergetool` |
| `Permission denied (publickey)` | SSH key 未配置 | `ssh-keygen` + 添加到 GitHub |
| `GH009: Protected branch` | 直接 push 到受保护分支 | 创建 PR 或换目标分支 |
| `Husky pre-commit failed` | 提交钩子检查不通过 | 修复 lint/test 错误后重试 |
| `npm ERR! 403 Forbidden` | npm 包名已被占用或无权限 | 换包名或检查 npm 登录状态 |

### 4. Claude Code 特有错误

| 错误关键词 | 根因 | 速修方案 |
|-----------|------|---------|
| `Context window exceeded` | 对话上下文过长 | 执行 `/clear` 或开新会话 |
| `Tool call failed` | 工具调用参数错误 | 检查工具参数格式 |
| `Agent timeout` | 子 Agent 执行超时 | 简化任务或增大 timeout |
| `MCP server disconnected` | MCP 服务器进程崩溃 | 检查 MCP 配置和 API Key |

### 5. 跨平台问题

| 错误关键词 | 根因 | 速修方案 |
|-----------|------|---------|
| `EACCES: permission denied` | Linux/Mac 文件权限 | `chmod` 或换安装目录 |
| `EPERM: operation not permitted` | Windows 文件被占用 | 关闭编辑器或用 `--force` |
| `spawn X ENOENT` | 系统命令不存在 | 安装对应工具或检查 PATH |
| `long path issues` | Windows 260 字符路径限制 | `git config core.longpaths true` |

## 修复策略模板

当 build-fix Agent 遇到错误时，按以下优先级尝试：

1. **精确匹配**：在上方表格中搜索错误关键词
2. **模式匹配**：提取错误文件名+行号，Read 该位置，分析根因
3. **依赖检查**：`npm ls` 检查依赖树是否完整
4. **版本回退**：`git stash` 暂存改动，验证是否是最近引入的
5. **搜索引擎**：通过 brave-search/tavily MCP 搜索错误信息

## 与 auto-cli 集成

- `/auto:build-fix` 自动加载此知识库
- quest-designer 在设计 Quest 时可参考反模式警告
- hooks 中的 TypeScript 检查和 Prettier 自动修复可参考此知识库
