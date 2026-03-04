---
name: pr-review-universal
description: 通用代码审查 - 5 个维度分别审查（适配任何语言）
version: 2.0
universal: true
---

# PR Review Toolkit — 通用代码审查

> 适用于任何编程语言

## 触发方式

```bash
# 通过 /aimax:auto 自动触发
/aimax:auto 审查最近改动的代码

# 直接使用
/aimax:review

# 分维度审查
/aimax:review --test        # 测试覆盖率
/aimax:review --errors      # 错误处理
/aimax:review --style       # 代码风格
/aimax:review --complexity  # 代码复杂度
/aimax:review --security    # 安全性
```

## 审查维度（通用）

### 1. 测试覆盖率审查

```bash
/aimax:review --test
```

**检查项**：

```yaml
test_coverage_checks:
  - 新增代码是否有测试？
  - 测试覆盖率是否达标？
  - 是否测试边界条件？
  - 是否测试异常情况？
```

**评分标准**：

| 覆盖率 | 评分 | 状态 |
|--------|------|------|
| >= 90% | 优秀 | ✅ |
| 80-90% | 良好 | ✅ |
| 70-80% | 及格 | ⚠️ |
| < 70% | 不及格 | ❌ |

**输出示例**：

```
📊 测试覆盖率审查

总体覆盖率：75% ⚠️

详细分析：
✅ 核心逻辑：90%
⚠️ 工具函数：70%
❌ UI 组件：50%

问题：
1. userService.login() 缺少错误情况测试
2. authController 缺少边界测试

建议：
- 添加异常情况测试
- 添加边界值测试
- 提高覆盖率到 80%+
```

---

### 2. 错误处理审查

```bash
/aimax:review --errors
```

**检查项**：

```yaml
error_handling_checks:
  - 是否验证输入参数？
  - 是否捕获所有异常？
  - 错误信息是否友好？
  - 是否记录错误日志？
  - 是否有回滚机制？
```

**评分标准**：

| 项目 | 评分 |
|------|------|
| 参数验证 | 优秀 ✅ |
| 异常捕获 | 良好 ✅ |
| 错误信息 | 良好 ✅ |
| 日志记录 | 优秀 ✅ |

**输出示例**：

```
🛡️ 错误处理审查

总体评分：良好 ✅

详细分析：
✅ 输入参数验证完善
✅ 捕获所有异常
⚠️ 部分错误信息不友好
✅ 错误日志记录完整

问题：
1. userService.delete() 错误信息不够具体
2. authController.login() 缺少日志记录

建议：
- 使用具体的错误信息
- 添加关键操作日志
```

---

### 3. 代码风格审查

```bash
/aimax:review --style
```

**检查项**：

```yaml
style_checks:
  - 命名是否符合规范？
  - 缩进是否一致？
  - 是否有过长行？
  - 是否有尾随空格？
  - 注释是否清晰？
```

**输出示例**：

```
🎨 代码风格审查

总体评分：优秀 ✅

详细分析：
✅ 命名符合规范
✅ 缩进一致
✅ 行长度合理
⚠️ 部分文件有尾随空格
✅ 注释清晰

问题：
1. userService.js:45 有尾随空格
2. authController.py 行长度超过 100

建议：
- 运行 linter 清理空格
- 分割长行
```

---

### 4. 代码复杂度审查

```bash
/aimax:review --complexity
```

**检查项**：

```yaml
complexity_checks:
  - 圈复杂度是否过高？（> 10）
  - 函数是否过长？（> 50 行）
  - 嵌套层级是否过深？（> 4）
  - 是否有重复代码？
  - 是否有过长参数列表？（> 5 个）
```

**评分标准**：

| 复杂度 | 评分 |
|--------|------|
| 圈复杂度 < 10 | 优秀 ✅ |
| 函数长度 < 50 行 | 优秀 ✅ |
| 嵌套层级 < 4 | 优秀 ✅ |
| 无重复代码 | 优秀 ✅ |

**输出示例**：

```
📐 代码复杂度审查

总体评分：良好 ✅

详细分析：
✅ 平均圈复杂度：6
⚠️ 2 个函数过长（> 50 行）
✅ 平均嵌套层级：2
⚠️ 发现 3 处重复代码
✅ 参数列表合理

问题：
1. userService.processData() 80 行，建议拆分
2. authController.validate() 有 5 层嵌套
3. 日期格式化逻辑重复 3 次

建议：
- 拆分长函数
- 简化嵌套
- 提取重复逻辑
```

---

### 5. 安全性审查

```bash
/aimax:review --security
```

**检查项**：

```yaml
security_checks:
  - 是否有硬编码密钥？
  - SQL 注入风险？
  - XSS 风险？
  - CSRF 保护？
  - 敏感数据日志？
  - 权限校验？
  - 输入验证？
```

**评分标准**：

| 项目 | 评分 |
|------|------|
| 密钥管理 | 优秀 ✅ |
| 注入防护 | 优秀 ✅ |
| XSS 防护 | 优秀 ✅ |
| CSRF 保护 | 良好 ✅ |
| 日志安全 | 优秀 ✅ |
| 权限校验 | 优秀 ✅ |
| 输入验证 | 优秀 ✅ |

**输出示例**：

```
🔒 安全性审查

总体评分：优秀 ✅

详细分析：
✅ 无硬编码密钥
✅ 参数化查询（防注入）
✅ 输出转义（防 XSS）
✅ CSRF 保护
✅ 敏感数据不记录日志
✅ 权限校验完善
✅ 输入验证完整

建议：
- 继续保持安全意识
```

---

## 综合审查

```bash
/aimax:review
```

**输出格式**：

```markdown
📊 PR Review 综合报告

---

## 总体评分：82/100 ✅

### 各维度得分

| 维度 | 得分 | 状态 |
|------|------|------|
| 📊 测试覆盖率 | 75/100 | ⚠️ 良好 |
| 🛡️ 错误处理 | 88/100 | ✅ 优秀 |
| 🎨 代码风格 | 90/100 | ✅ 优秀 |
| 📐 代码复杂度 | 80/100 | ✅ 优秀 |
| 🔒 安全性 | 95/100 | ✅ 优秀 |

---

## 必须修复（阻塞性问题）

无 ✅

---

## 建议修复（重要问题）

### 1. 测试覆盖率
- ⚠️ 总体覆盖率 75%，建议提高到 80%+
- 文件：userService.js
- 行号：45-80

### 2. 代码复杂度
- ⚠️ processData() 函数 80 行，建议拆分
- 文件：authController.py
- 行号：120-200

---

## 可选优化（改进建议）

### 1. 错误处理
- 💡 部分错误信息可以更具体
- 文件：userService.js
- 行号：55

### 2. 代码风格
- 💡 清理尾随空格
- 文件：多个文件

---

## 总结

✅ 代码质量良好，可以合并！

主要优点：
- 安全性高
- 代码风格一致
- 错误处理完善

改进空间：
- 提高测试覆盖率
- 降低代码复杂度
- 清理小问题

---

**审查时间**: 1.8 秒
**审查文件数**: 3 个
**代码行数**: 280 行
```

---

## 语言特定检查

### JavaScript/TypeScript

```yaml
javascript_specific:
  - 是否使用 const/let（不用 var）
  - 是否使用 async/await（不用回调）
  - 是否使用 ===（不用 ==）
  - 是否有 console.log（生产代码）
```

### Python

```yaml
python_specific:
  - 是否遵循项目现有 Python 规范（ruff/black/isort 或团队约定）
  - 是否使用 Type Hints
  - 是否有 print()（生产代码）
  - 是否使用 context managers
```

### Java

```yaml
java_specific:
  - 是否使用 Stream API
  - 是否使用 Optional
  - 是否有 System.out.println
  - 是否遵循项目现有 Java 规范（checkstyle/spotless/团队约定）
```

### Go

```yaml
go_specific:
  - 是否通过 go fmt
  - 是否处理所有错误
  - 是否有竞态条件
```

---

## 配置文件

```yaml
# .aimax/config.yml

code_review:
  # 审查模式：quick | full
  default_mode: quick

  # 严重问题是否阻止提交
  block_on_critical: false

  # 输出格式：text | json | html
  output_format: text

  # 审查维度
  dimensions:
    - test_coverage
    - error_handling
    - style
    - complexity
    - security

  # 评分阈值
  thresholds:
    excellent: 90
    good: 80
    pass: 70
```

---

## 快速命令

```bash
# 综合审查
/aimax:review

# 快速审查（只检查严重问题）
/aimax:review --quick

# 分维度审查
/aimax:review --test
/aimax:review --errors
/aimax:review --style
/aimax:review --complexity
/aimax:review --security

# 审查指定文件
/aimax:review userService.js

# JSON 输出
/aimax:review --format json

# 详细模式
/aimax:review --verbose
```

---

## Git Hook 集成

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "🔍 运行代码审查..."

STAGED_FILES=$(git diff --cached --name-only)

if [ -n "$STAGED_FILES" ]; then
    echo "发现 $(echo "$STAGED_FILES" | wc -l) 个文件"

    # 快速审查（不阻止提交）
    /aimax:review --quick
fi

echo "✅ Pre-commit 检查完成"
```

---

**让代码审查自动化！** 🔍
