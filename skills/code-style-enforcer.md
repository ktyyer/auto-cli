---
name: code-style-enforcer
description: 代码风格自动检查和修正 — 覆盖 TypeScript/JavaScript/Java 三大语言，提供格式化、命名规范、文件大小和导入排序的自动化检查规则
version: 1.0.0
author: auto-cli
tags: [style, lint, format, naming, quality, enforcement, typescript, javascript, java]
---

# Code Style Enforcer — 代码风格自动检查

> 与 PHASE 4 VERIFY 门禁集成，自动检查代码风格合规性。
> quest-designer 在 PHASE 2 设计 Quest 时参考此规则，build-error-resolver 修复后验证。

---

## 一、TypeScript / JavaScript 规则

### 1.1 格式化（Prettier 自动修复）

```
规则：
- 单引号（singleQuote: true）
- 无分号（semi: false）
- 2 空格缩进（tabWidth: 2）
- 行宽 100（printWidth: 100）
- 尾逗号 es5（trailingComma: 'es5'）

验证命令：
  npx prettier --check "src/**/*.{ts,tsx,js,jsx}"
自动修复：
  npx prettier --write "src/**/*.{ts,tsx,js,jsx}"
```

### 1.2 命名规范

| 类型         | 规范               | 合法示例                   | 非法示例              |
| ------------ | ------------------ | -------------------------- | --------------------- |
| 变量/函数    | camelCase          | `getUserById`              | `get_user_by_id`      |
| 常量         | UPPER_SNAKE_CASE   | `MAX_RETRY_COUNT`          | `maxRetryCount`       |
| 类/接口/类型 | PascalCase         | `UserService`              | `user_service`        |
| 文件名       | kebab-case         | `user-service.ts`          | `UserService.ts`      |
| 私有字段     | #前缀 或 \_前缀    | `#privateField`            | `privateField`        |
| 布尔变量     | is/has/should 前缀 | `isValid`, `hasPermission` | `valid`, `permission` |
| 事件处理     | handle/on 前缀     | `handleClick`              | `clickHandler`        |

```bash
# 检测命名违规
grep -rn "const [A-Z]" --include="*.ts" src/ | grep -v "const [A-Z_]* ="  # 大写常量
grep -rn "function [A-Z]" --include="*.ts" src/  # PascalCase 函数（应为类）
```

### 1.3 文件大小限制

```
规则：
- 单文件 <= 400 行（推荐 200-300 行）
- 单函数 <= 50 行
- 嵌套深度 <= 3 层（最多 4 层）

验证命令：
  find src/ -name "*.ts" -exec wc -l {} + | sort -rn | head -10
```

### 1.4 导入排序

```
规则（按优先级排列）：
1. Node.js 内置模块（node:*）
2. 外部依赖（react, lodash...）
3. 内部模块（@/ 开头或相对路径）
4. 类型导入（type 关键字）

// 合法
import { readFile } from 'node:fs/promises'
import { useState } from 'react'
import { UserService } from '@/services/user-service'
import type { UserDTO } from '@/types/user'

验证命令：
  npx eslint --rule 'import/order: error' src/
```

---

## 二、Java / Spring Boot 规则

### 2.1 命名规范

| 类型     | 规范             | 示例                        |
| -------- | ---------------- | --------------------------- |
| 类名     | UpperCamelCase   | `SysUserController`         |
| 方法名   | lowerCamelCase   | `findByUsername`            |
| 常量     | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`           |
| 包名     | 全小写           | `com.eco.system.controller` |
| 数据库表 | lower_snake_case | `sys_user`                  |

### 2.2 分层架构约束

```
Controller → Service Interface → ServiceImpl → Mapper → Database
  |            只调用 Service        只调用 Mapper       |
  |            不直接用 Mapper       不调用其他 Mapper    |
  +--- 不可跨层调用 ---+
```

### 2.3 注解顺序

```java
// 类注解顺序（固定）
@RestController → @RequestMapping("/path") → @Tag(name="名称")

// 方法注解顺序（固定）
@Operation(summary="描述") → @GetMapping("/path") → @PreAuthorize("@ss.hasPermi('xxx')")
```

---

## 三、通用规则

### 3.1 禁止项

| 禁止        | 检测命令                                                  | 替代方案                      |
| ----------- | --------------------------------------------------------- | ----------------------------- | ------------------------------- | ---------------- |
| console.log | `grep -rn "console\\.log" --include="*.ts" src/`          | 使用 Logger                   |
| 硬编码密钥  | `grep -rn "api[_-]?key\\                                  | password\\                    | secret" --include="\*.ts" src/` | 使用 process.env |
| any 类型    | `grep -rn ": any" --include="*.ts" src/`                  | 使用具体类型                  |
| 空 catch 块 | `grep -A1 "catch" --include="*.ts" src/ \| grep "^\\s*}"` | 至少 log.error                |
| 可变操作    | 直接对象赋值 `obj.x = y`                                  | 展开运算符 `{ ...obj, x: y }` |
| var 声明    | `grep -rn "\\bvar\\b " --include="*.ts" src/`             | 使用 const/let                |

### 3.2 强制项

- 所有公共方法有 JSDoc/JavaDoc
- 所有用户输入有验证（zod / Bean Validation）
- 所有错误有处理（try/catch + 日志）
- 所有新代码有测试覆盖（>= 80%）

---

## 四、与 auto-cli 集成

- **PHASE 4 VERIFY**: 门禁自动运行格式化和类型检查
- **SUMMARIZE 后、提交前**: 建议先运行 `prettier --check`；如执行 `prettier --write`，需重新执行 VERIFY
- **code-reviewer Agent**: 参考 3.1 禁止项作为审查清单
- **PostToolUse Hook**: 编辑后自动触发格式化（已配置）
