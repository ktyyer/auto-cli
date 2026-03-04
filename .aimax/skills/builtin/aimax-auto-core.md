---
name: aimax-auto-core-universal
description: 通用智能路由核心 - 自动识别任务类型并调用合适的技能（适配任何语言和框架）
version: 3.0
universal: true
---

# aimax:auto — 通用智能路由核心

> **v3.0 新特性：零配置插件系统** - 自动发现并加载插件，无需任何配置！
> 适用于任何编程语言和框架

## 工作原理

```bash
用户输入：/aimax:auto 写一个用户登录接口

↓ 智能分析

任务类型识别：
  - "写一个...接口/函数/方法" → 函数/方法开发
  - "实现...功能/特性" → 完整功能开发
  - "修复...bug/错误/问题" → Bug 修复
  - "优化...性能/速度" → 性能优化
  - "测试...功能" → TDD 测试
  - "审查/检查...代码" → 代码审查
  - "清理/重构/简化...代码" → 代码简化

↓ 自动路由

调用对应的技能（适配目标语言）

---

## 🆕 插件系统（v3.0）

### 零配置自动发现

系统会**自动扫描**以下目录并加载插件：

```
.aimax/
├── skills/
│   ├── builtin/              # 内置核心技能（始终加载）
│   │   ├── aimax-auto-core.md
│   │   ├── super-tdd.md
│   │   ├── code-simplifier.md
│   │   ├── pr-review.md
│   │   ├── auto-evolution.md
│   │   └── task-state-machine.md
│   └── plugins/              # 用户插件（自动发现）
│       ├── javascript/       # JavaScript 插件
│       ├── python/           # Python 插件
│       ├── java/             # Java 插件
│       ├── go/               # Go 插件
│       └── custom/           # 自定义插件（用户添加）
│           └── my-plugin.md
```

### 插件定义格式

每个插件文件头部包含元数据：

```markdown
---
name: react-helper
version: 1.0.0
description: React 开发助手
author: your-name
triggers:
  - "React"
  - "Component"
  - "JSX"
priority: 10              # 优先级（1-100），数字越大优先级越高
language: javascript      # 适用语言（可选）
framework: react          # 适用框架（可选）
---

# React 助手

插件内容...
```

### 插件自动加载流程

```bash
用户输入：/aimax:auto 写一个 React 登录组件

↓ 系统分析输入

关键词检测：
  - "React" → 匹配 react-helper 插件
  - "组件" → 匹配 react-helper 插件
  - "迭代" → 匹配 auto-evolution 插件
  - "状态机" → 匹配 task-state-machine 插件
  - "登录" → 匹配内置 TDD 技能

↓ 自动加载插件

✅ 加载 react-helper.md
✅ 加载 super-tdd.md
✅ 加载 auto-evolution.md
✅ 加载 task-state-machine.md
✅ 应用 React + TypeScript 规范

↓ 生成代码

使用 React Hooks、TypeScript、Jest 测试
```

## 通用任务类型识别

| 关键词 | 任务类型 | 说明 |
|--------|---------|------|
| 接口、API、函数、方法 | 函数/方法开发 | 创建新的函数或方法 |
| 功能、特性、模块 | 完整功能开发 | 多个文件/组件的完整功能 |
| 修复、bug、错误、问题 | Bug 修复 | 修复已知问题 |
| 优化、性能、速度 | 性能优化 | 优化性能或代码质量 |
| 测试、test、spec | 测试开发 | 编写测试 |
| 审查、review、检查 | 代码审查 | 检查代码质量 |
| 清理、重构、简化 | 代码简化 | 清理和优化代码 |
| 迭代、演进、评估、基准、回归 | 自主演进 | 评估驱动持续优化与回归防护 |
| 状态机、分步执行、恢复执行、重试 | 任务编排 | 中断恢复与可控重试执行 |

## 语言自动检测

系统会自动检测项目类型，但**代码风格以项目现有实现为准**，不是套固定模板：

### 项目风格优先策略

```text
1) 先读取项目已有代码和配置（eslint/prettier/tsconfig/ruff/checkstyle 等）
2) 识别当前项目实际使用的约定（命名、分层、异常、测试栈）
3) 按已有约定生成最小增量代码
4) 仅在无样例时使用通用兜底建议
```

### 语言级兜底建议（仅无样例时）

| 语言 | 兜底建议 |
|------|---------|
| JavaScript/TypeScript | 避免回调地狱、优先清晰错误处理 |
| Python | 保持可读性、完善类型注释与异常处理 |
| Java | 保持分层清晰、对齐现有依赖注入与异常体系 |
| Go | 保持显式错误处理、遵循现有包结构 |
| Ruby | 对齐项目已有 lint/formatter 规则 |

## 使用示例

### 示例 1: 快速函数开发

```bash
/aimax:auto 写一个计算用户平均分的函数

# 自动执行：
1. 检测项目语言（如 JavaScript）
2. 对齐项目现有 JavaScript/TypeScript 风格
3. 生成函数代码
4. 添加注释和示例
```

**生成结果（JavaScript）**：
```javascript
/**
 * 计算用户平均分
 * @param {Array<number>} scores - 分数数组
 * @returns {number} 平均分
 */
function calculateAverageScore(scores) {
    if (!Array.isArray(scores) || scores.length === 0) {
        throw new Error('Invalid scores: must be a non-empty array');
    }

    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
}
```

### 示例 2: 完整功能开发

```bash
/aimax:auto 实现用户登录功能

# 自动执行：
1. 需求分析（输入：用户名密码，输出：token）
2. TDD 流程（先写测试）
3. 实现代码（让测试通过）
4. 代码清理
5. 多维审查
```

### 示例 3: Bug 修复

```bash
/aimax:auto 修复登录接口返回 500 错误

# 自动执行：
1. 错误分析
2. 查询已知问题
3. 自动修复
4. 记录解决方案
```

## 配置文件

系统会自动查找并应用配置文件：

```yaml
# .aimax/config.yml（自动生成）

project:
  # 语言：自动检测或手动指定
  language: auto  # javascript | python | java | go | ruby | php | rust | cpp

  # 框架：自动检测或手动指定
  framework: auto  # react | vue | spring | express | django | flask

  # 编码规范
  style:
    indent: 2           # 缩进空格数
    quotes: single      # single | double
    semicolons: true    # 是否使用分号（JS/TS）

  # 测试框架
  test_framework: auto  # jest | pytest | junit | go test

# 智能路由配置
auto_mode:
  auto_test: false      # 是否自动提示测试
  auto_review: false    # 是否自动审查
  auto_simplify: false  # 是否自动清理代码
```

## 自动化功能

### 1. 自动代码生成

根据项目类型生成代码，并遵循以下优先级：

1. 项目现有代码风格
2. 项目内配置和文档约定
3. 无样例时才使用语言通用兜底建议

### 2. 自动测试生成

```bash
/aimax:auto 测试用户登录功能

# 自动生成测试（适配项目测试框架）：
# - JavaScript: Jest/Mocha
# - Python: pytest
# - Java: JUnit
# - Go: testing
```

### 3. 自动代码审查

```bash
/aimax:auto 审查登录代码

# 通用审查维度：
✅ 命名规范
✅ 代码复杂度
✅ 错误处理
✅ 注释完整性
✅ 安全性检查
✅ 性能问题
```

### 4. 自动代码清理

```bash
/aimax:auto 清理登录代码

# 通用清理规则：
✅ 提取魔法值/常量
✅ 简化条件判断
✅ 消除重复代码
✅ 优化命名
✅ 添加注释
```

## 插件系统使用

### 创建自定义插件

**步骤 1：创建插件文件**

```markdown
---
name: my-custom-plugin
version: 1.0.0
description: 我的自定义插件
author: your-name
triggers:
  - "special"
  - "custom"
priority: 50
language: javascript
---

# 我的自定义插件

当检测到 "special" 或 "custom" 关键词时：

1. 使用我的特殊规范
2. 添加自定义注释
3. 应用特定代码模式
```

**步骤 2：复制到插件目录**

```bash
# 只需复制文件，无需任何配置！
cp my-custom-plugin.md .aimax/skills/plugins/custom/

# 立即生效！
```

**步骤 3：开始使用**

```bash
/aimax:auto 用 special 方式写一个用户验证函数

↓ 系统自动检测到 "special" 关键词

✅ 自动加载 my-custom-plugin 插件
✅ 应用自定义规范
✅ 生成符合要求的代码
```

### 官方插件仓库

内置插件（自动扫描）：

| 插件 | 目录 | 说明 |
|------|------|------|
| **JavaScript** | `plugins/javascript/` | React, Vue, Node.js |
| **Python** | `plugins/python/` | Django, Flask, FastAPI |
| **Java** | `plugins/java/` | Spring, Spring Boot |
| **Go** | `plugins/go/` | Gin, Echo |
| **Custom** | `plugins/custom/` | 用户自定义 |

### 插件优先级

当多个插件匹配时，按 `priority` 值排序：

```
priority: 100   # 最高优先级（自定义插件）
priority: 50    # 中等优先级（框架插件）
priority: 10    # 默认优先级（语言插件）
priority: 1     # 最低优先级（通用插件）
```

### 插件发现机制

```bash
# 启动时自动扫描
.aimax/skills/plugins/
├── javascript/
│   ├── react.md           # ✅ 自动加载
│   └── vue.md             # ✅ 自动加载
├── python/
│   └── django.md          # ✅ 自动加载
└── custom/
    └── my-plugin.md       # ✅ 自动加载

# 零配置！无需编辑任何配置文件
```

## 快速开始

### 第一次使用

```bash
# 1. 解压到项目根目录
unzip aimax-enhanced.zip

# 2. 运行安装脚本
bash .aimax/scripts/install.sh

# 3. 开始使用
/aimax:auto 写一个用户登录函数
```

### 配置项目

```bash
# 查看当前配置
/aimax:config

# 设置语言
/aimax:config set language javascript

# 设置框架
/aimax:config set framework react

# 查看可用选项
/aimax:config list
```

## 命令速查

```bash
# 智能路由
/aimax:auto [任务描述]

# 分维度命令
/aimax:tdd [功能描述]         # TDD 测试
/aimax:simplify               # 代码清理
/aimax:review                 # 代码审查
/aimax:fix [问题描述]         # Bug 修复
/aimax:test [功能描述]        # 生成测试

# 配置命令
/aimax:config                 # 查看配置
/aimax:config set <key> <value>
/aimax:config reset           # 重置配置

# 帮助命令
/aimax:help                   # 查看帮助
/aimax:version                # 查看版本
```

## 最佳实践

### ✅ DO

1. **使用自然语言描述任务**
   - ✅ "写一个用户登录的函数"
   - ❌ "login()"

2. **提供足够的上下文**
   - ✅ "写一个使用 JWT 的用户登录函数，包含错误处理"
   - ❌ "写登录函数"

3. **信任智能路由**
   - 让系统自动识别任务类型和语言

### ❌ DON'T

1. ❌ 不要指定具体实现细节
2. ❌ 不要混合多个任务
3. ❌ 不要使用过于简短的描述

## 故障排除

### Q: 语言检测错误？

```bash
# 手动指定语言
/aimax:config set language python
```

### Q: 框架检测错误？

```bash
# 手动指定框架
/aimax:config set framework django
```

### Q: 代码风格不对？

```bash
# 查看并修改配置
/aimax:config
# 编辑 .aimax/config.yml
```

## 更新日志

- **v3.0** (2026-02-25)
  - 🆕 **零配置插件系统** - 自动发现并加载插件
  - 🆕 支持自定义插件
  - 🆕 插件优先级机制
  - 🆕 更强大的智能路由
  - 改进的目录结构（builtin/ 和 plugins/）

- **v2.0** (2026-02-20)
  - 支持通用语言检测
  - 自动适配项目规范
  - 一键安装

- **v1.0** (2025-12-01)
  - 初始版本
  - 只支持 Spring Cloud

---

**适用于任何项目，任何语言！零配置插件系统！** 🚀
