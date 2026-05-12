---
name: code-analyzer
description: tree-sitter 驱动的代码分析 Skill — 使用 tree-sitter CLI 生成 AST，提取函数签名、类定义、依赖关系，产出结构化代码地图。帮助 quest-designer 理解现有代码结构，避免重复造轮子，生成更精准的 QuestMap。
tags: [code-analysis, tree-sitter, ast, code-structure, static-analysis]
---

# Code Analyzer — tree-sitter 驱动的代码分析

> 使用 tree-sitter CLI 生成 AST，提取代码结构，为 AI 提供精准的代码理解能力。

## 快速使用

```
/auto 分析项目代码结构
/auto 重构认证模块（需要先理解现有代码）
```

---

## 使用时机

**必须加载**：

- 策略 = `implement` 或 `refactor`
- 项目包含源码文件（非纯 Markdown）
- 需要理解现有代码结构

**不要触发**：

- 纯 Markdown 项目
- 新项目（无现有代码）
- 只修改配置文件

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 检测项目语言: 从 package.json/pom.xml/go.mod 等推断
- [ ] 检查 tree-sitter CLI 可用性, 不可用时降级 grep/ctags
- [ ] 生成 AST → 提取函数/类/导入 → 写入 `.auto/cache/code-structure.json`
- [ ] 排除 node_modules 和大文件 (>10k 行)

**硬约束** (constraints):

- 纯 Markdown 项目不触发（无需 AST 分析）
- tree-sitter 不可用时必须降级, 不阻塞流程
- 必须排除 node_modules 和第三方依赖

**输出模板** (output):

- `.auto/cache/code-structure.json`: { functions[], classes[], imports[], metadata }

**反模式** (anti-patterns):

- 不检查 C 编译器直接装 tree-sitter → 安装失败
- 解析 node_modules → 性能极差
- 不处理解析失败 → 单个文件语法错误导致全量失败

---

## 核心流程（4 步）

### 第一步：检测项目语言

自动检测项目主要语言：

| 检测文件                    | 推断语言   | tree-sitter grammar      |
| --------------------------- | ---------- | ------------------------ |
| `package.json` + `*.js`     | JavaScript | `tree-sitter-javascript` |
| `package.json` + `*.ts`     | TypeScript | `tree-sitter-typescript` |
| `requirements.txt` + `*.py` | Python     | `tree-sitter-python`     |
| `pom.xml` + `*.java`        | Java       | `tree-sitter-java`       |
| `go.mod` + `*.go`           | Go         | `tree-sitter-go`         |
| `Cargo.toml` + `*.rs`       | Rust       | `tree-sitter-rust`       |

### 第二步：安装 tree-sitter CLI

检查并安装 tree-sitter CLI：

```bash
# 检查是否已安装
if ! command -v tree-sitter &> /dev/null; then
  echo "Installing tree-sitter CLI..."
  npm install -g tree-sitter-cli
fi

# 检查 C 编译器（tree-sitter 依赖）
if ! command -v gcc &> /dev/null && ! command -v clang &> /dev/null; then
  echo "Warning: C compiler not found. tree-sitter requires gcc or clang."
  echo "Install: sudo apt-get install build-essential (Linux) or xcode-select --install (Mac)"
  exit 1
fi
```

### 第三步：生成 AST 并提取结构

使用 tree-sitter CLI 生成 AST：

```bash
# 生成 AST（JSON 格式）
tree-sitter parse src/**/*.js --json > .auto/cache/ast.json

# 提取函数定义
jq '
  .. |
  select(.type == "function_declaration" or .type == "method_definition")? |
  {
    type: .type,
    name: (.children[] | select(.type == "identifier" or .type == "property_identifier") | .text),
    line: .startPosition.row,
    params: [.children[] | select(.type == "formal_parameters") | .. | select(.type == "identifier")? | .text]
  }
' .auto/cache/ast.json > .auto/cache/functions.json

# 提取类定义
jq '
  .. |
  select(.type == "class_declaration")? |
  {
    name: (.children[] | select(.type == "identifier") | .text),
    line: .startPosition.row,
    methods: [.. | select(.type == "method_definition")? | .children[] | select(.type == "property_identifier")? | .text]
  }
' .auto/cache/ast.json > .auto/cache/classes.json

# 提取导入关系
jq '
  .. |
  select(.type == "import_statement" or .type == "import_declaration")? |
  {
    source: (.children[] | select(.type == "string")? | .text),
    line: .startPosition.row
  }
' .auto/cache/ast.json > .auto/cache/imports.json
```

### 第四步：生成结构化代码地图

合并提取结果，生成统一的代码结构文件：

```bash
jq -s '{
  functions: .[0],
  classes: .[1],
  imports: .[2],
  metadata: {
    language: env.DETECTED_LANGUAGE,
    totalFiles: (.[0] | length),
    analyzedAt: now | strftime("%Y-%m-%dT%H:%M:%S")
  }
}' .auto/cache/functions.json .auto/cache/classes.json .auto/cache/imports.json \
  > .auto/cache/code-structure.json
```

---

## 输出格式

**code-structure.json** 结构：

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
  "classes": [
    {
      "name": "UserService",
      "line": 42,
      "methods": ["findById", "create", "update", "delete"]
    }
  ],
  "imports": [
    {
      "source": "./utils",
      "line": 1
    }
  ],
  "metadata": {
    "language": "JavaScript",
    "totalFiles": 23,
    "analyzedAt": "2026-05-10T12:30:00"
  }
}
```

---

## 与 auto-cli 集成

| 注入时机        | 说明                                                  |
| --------------- | ----------------------------------------------------- |
| PHASE 1 SCAN    | 调用 code-analyzer，生成 code-structure.json          |
| PHASE 2 PLAN    | quest-designer 消费 code-structure.json，理解现有代码 |
| PHASE 3 EXECUTE | code-reviewer 使用 AST 进行语义审查                   |

触发关键词（PHASE 2.2 表格）：
实现 / 重构策略 + 项目包含源码文件

---

## 性能优化

| 策略              | 说明                            |
| ----------------- | ------------------------------- |
| 增量解析          | 只解析变更文件（通过 git diff） |
| 跳过大文件        | 跳过 >10k 行的文件              |
| 跳过 node_modules | 排除第三方依赖                  |
| 缓存结果          | 文件未变更时复用缓存            |

**性能基准**：

- 小项目（<100 文件）：< 5 秒
- 中项目（100-500 文件）：< 30 秒
- 大项目（>500 文件）：< 2 分钟

---

## 语言支持

### JavaScript / TypeScript

**提取内容**：

- 函数声明（function、箭头函数）
- 类定义和方法
- 导入/导出语句
- 变量声明（const、let、var）

**tree-sitter 查询**（.scm 文件）：

```scheme
(function_declaration
  name: (identifier) @function.name
  parameters: (formal_parameters) @function.params)

(class_declaration
  name: (identifier) @class.name
  body: (class_body
    (method_definition
      name: (property_identifier) @method.name)))
```

### Python

**提取内容**：

- 函数定义（def）
- 类定义和方法
- 导入语句（import、from...import）
- 装饰器

### Java

**提取内容**：

- 类定义和方法
- 接口定义
- 包声明和导入
- 注解

### Go

**提取内容**：

- 函数声明
- 结构体定义和方法
- 接口定义
- 包导入

---

## 反模式

| 反模式            | 后果                     |
| ----------------- | ------------------------ |
| 不检查 C 编译器   | tree-sitter 安装失败     |
| 解析 node_modules | 性能极差，耗时数分钟     |
| 不处理解析失败    | 语法错误导致整个分析失败 |
| 不缓存结果        | 每次重复解析，浪费时间   |
| 解析超大文件      | 内存溢出或超时           |

---

## 降级策略

当 tree-sitter 不可用时，降级到简单的文本分析：

```bash
# 降级方案 1：使用 grep 提取函数名
grep -rn "function\|def\|func\|class" src/ > .auto/cache/code-structure-fallback.txt

# 降级方案 2：使用 ctags（如果可用）
if command -v ctags &> /dev/null; then
  ctags -R --fields=+n --output-format=json src/ > .auto/cache/code-structure.json
fi
```

---

## 与 MCP 集成（可选增强）

使用 `tree-sitter-analyzer` MCP server 提供更高级功能：

**MCP Tools**:

- `analyze_code(file_path: str) -> CodeStructure`
- `find_references(symbol: str) -> List[Location]`
- `get_call_graph(function: str) -> CallGraph`

**集成方式**：

```bash
# 检查 MCP server 是否可用
if mcp list-servers | grep -q "tree-sitter-analyzer"; then
  # 使用 MCP（更强大）
  mcp call tree-sitter-analyzer analyze_code --file src/utils.js
else
  # 降级到 CLI（基础功能）
  tree-sitter parse src/utils.js --json
fi
```

---

## 验收标准

- [ ] 自动检测项目语言
- [ ] 检查并安装 tree-sitter CLI
- [ ] 生成 AST（JSON 格式）
- [ ] 提取函数、类、导入关系
- [ ] 写入 `.auto/cache/code-structure.json`
- [ ] 支持 JavaScript / TypeScript / Python
- [ ] 性能：中项目 < 30 秒
- [ ] 降级策略：tree-sitter 不可用时使用 grep

---

## 示例

### JavaScript 项目

**源码** (`src/auth.js`):

```javascript
import bcrypt from 'bcrypt';

export class AuthService {
  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
}

export function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET);
}
```

**生成的代码结构**:

```json
{
  "functions": [
    {
      "type": "function_declaration",
      "name": "generateToken",
      "line": 13,
      "params": ["userId"]
    }
  ],
  "classes": [
    {
      "name": "AuthService",
      "line": 3,
      "methods": ["hashPassword", "verifyPassword"]
    }
  ],
  "imports": [
    {
      "source": "bcrypt",
      "line": 1
    }
  ],
  "metadata": {
    "language": "JavaScript",
    "totalFiles": 1,
    "analyzedAt": "2026-05-10T12:30:00"
  }
}
```

---

## 来源

- [tree-sitter 官方文档](https://tree-sitter.github.io/tree-sitter/)
- [tree-sitter-analyzer PyPI](https://pypi.org/project/tree-sitter-analyzer/)
- [Tree-Sitter Turned Everyone Into a Toolsmith](https://understandingdata.com/posts/tree-sitter-turned-everyone-into-a-toolsmith/)
