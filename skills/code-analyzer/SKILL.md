---
name: code-analyzer
description: tree-sitter 驱动的代码分析 Skill — 使用 tree-sitter CLI 生成 AST，提取函数签名、类定义、依赖关系，产出结构化代码地图。帮助 quest-designer 理解现有代码结构，避免重复造轮子。当策略=implement 或 refactor 且项目包含源码文件（非纯 Markdown）时自动触发。
tags: [code-analysis, tree-sitter, ast, code-structure, static-analysis]
---

# Code Analyzer — tree-sitter 驱动的代码分析

> 使用 tree-sitter CLI 生成 AST，提取代码结构，为 AI 提供精准的代码理解能力。

## 快速使用

```
/auto 分析项目代码结构
/auto 重构认证模块（需先理解现有代码）
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 检测项目语言: 从 package.json/pom.xml/go.mod 等推断
- [ ] 检查 tree-sitter CLI 可用性，不可用时降级 grep/ctags
- [ ] 生成 AST → 提取函数/类/导入 → 写入 `.auto/cache/code-structure.json`
- [ ] 排除 node_modules 和大文件 (>10k 行)

**硬约束** (constraints):

- 纯 Markdown 项目不触发（无需 AST 分析）
- tree-sitter 不可用时必须降级，不阻塞流程
- 必须排除 node_modules 和第三方依赖

**输出模板** (output):

- `.auto/cache/code-structure.json`: `{ functions[], classes[], imports[], metadata }`

**反模式** (anti-patterns):

- 不检查 C 编译器直接装 tree-sitter → 安装失败
- 解析 node_modules → 性能极差
- 不处理解析失败 → 单文件语法错误导致全量失败

---

## 使用时机

**必须加载**：策略 = `implement` 或 `refactor` + 项目包含源码文件（非纯 MD）
**不要触发**：纯 Markdown 项目、新项目无现有代码、只修改配置文件

---

## 核心流程（4 步）

### 第一步：检测项目语言

| 检测文件                    | 推断语言   | tree-sitter grammar      |
| --------------------------- | ---------- | ------------------------ |
| `package.json` + `*.js`     | JavaScript | `tree-sitter-javascript` |
| `package.json` + `*.ts`     | TypeScript | `tree-sitter-typescript` |
| `requirements.txt` + `*.py` | Python     | `tree-sitter-python`     |
| `pom.xml` + `*.java`        | Java       | `tree-sitter-java`       |
| `go.mod` + `*.go`           | Go         | `tree-sitter-go`         |
| `Cargo.toml` + `*.rs`       | Rust       | `tree-sitter-rust`       |

### 第二步：安装 tree-sitter CLI

```bash
if ! command -v tree-sitter &> /dev/null; then
  npm install -g tree-sitter-cli
fi

# 检查 C 编译器依赖
if ! command -v gcc &> /dev/null && ! command -v clang &> /dev/null; then
  echo "Warning: C compiler required. Install build-essential or xcode-select --install"
fi
```

### 第三步：生成 AST 并提取结构

```bash
# 生成 AST JSON
tree-sitter parse src/**/*.js --json > .auto/cache/ast.json

# 提取函数、类、导入
jq '.. | select(.type == "function_declaration" or .type == "method_definition")? |
  {type, name: (.children[] | select(.type == "identifier" or .type == "property_identifier") | .text),
   line: .startPosition.row, params: [.children[] | select(.type == "formal_parameters") | .. |
   select(.type == "identifier")? | .text]}' .auto/cache/ast.json > .auto/cache/functions.json
```

### 第四步：生成结构化代码地图

```bash
jq -s '{functions: .[0], classes: .[1], imports: .[2],
  metadata: {language: env.DETECTED_LANGUAGE, totalFiles: (.[0] | length),
  analyzedAt: now | strftime("%Y-%m-%dT%H:%M:%S")}}' \
  .auto/cache/functions.json .auto/cache/classes.json .auto/cache/imports.json \
  > .auto/cache/code-structure.json
```

---

## 输出格式

```json
{
  "functions": [
    {
      "type": "function_declaration",
      "name": "calculateTotal",
      "line": 15,
      "params": ["items", "taxRate"]
    }
  ],
  "classes": [{ "name": "UserService", "line": 42, "methods": ["findById", "create", "update"] }],
  "imports": [{ "source": "./utils", "line": 1 }],
  "metadata": { "language": "JavaScript", "totalFiles": 23, "analyzedAt": "2026-05-12T12:30:00" }
}
```

---

## 降级策略

tree-sitter 不可用时：

```bash
# 降级 1: grep 提取函数名
grep -rn "function\|def\|func\|class" src/ > .auto/cache/code-structure-fallback.txt

# 降级 2: ctags（如可用）
if command -v ctags &> /dev/null; then
  ctags -R --fields=+n --output-format=json src/ > .auto/cache/code-structure.json
fi
```

---

## 按需加载

| 内容             | 文件                                              | 何时加载       |
| ---------------- | ------------------------------------------------- | -------------- |
| 语言特定提取细节 | `code-analyzer.references/language-extraction.md` | 非 JS/TS 项目  |
| MCP 集成增强     | `code-analyzer.references/mcp-integration.md`     | 项目已配置 MCP |

---

## 性能优化

| 策略              | 说明                       |
| ----------------- | -------------------------- |
| 增量解析          | 只解析变更文件（git diff） |
| 跳过大文件        | 跳过 >10k 行的文件         |
| 跳过 node_modules | 排除第三方依赖             |
| 缓存结果          | 文件未变更时复用           |

**性能基准**：小项目 <5s / 中项目 <30s / 大项目 <2min

---

## 与 auto-cli 集成

| 注入时机        | 说明                                                 |
| --------------- | ---------------------------------------------------- |
| PHASE 1 SCAN    | 生成 code-structure.json                             |
| PHASE 2 PLAN    | quest-designer 消费 code-structure.json 理解现有代码 |
| PHASE 3 EXECUTE | code-reviewer 使用 AST 进行语义审查                  |

---

## 验收标准

- [ ] 自动检测项目语言
- [ ] tree-sitter CLI 可用或已降级
- [ ] 生成 `.auto/cache/code-structure.json`（函数 + 类 + 导入）
- [ ] 排除 node_modules 和大文件
- [ ] 支持 JS/TS/Python，性能达标
