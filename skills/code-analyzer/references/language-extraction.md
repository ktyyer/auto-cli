# 语言特定代码提取

> tree-sitter 按语言的具体提取内容和查询语法。主 skill 文件只保留通用流程。

## JavaScript / TypeScript

**提取内容**：

- 函数声明（function、箭头函数）
- 类定义和方法
- 导入/导出语句
- 变量声明（const、let、var）

**tree-sitter 查询** (.scm):

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

## Python

**提取内容**：

- 函数定义（def）
- 类定义和方法
- 导入语句（import、from...import）
- 装饰器

```bash
tree-sitter parse src/**/*.py --json | jq '
  .. | select(.type == "function_definition" or .type == "class_definition")? |
  {type, name: (.children[] | select(.type == "identifier") | .text), line: .startPosition.row}
' > .auto/cache/python-structure.json
```

## Java

**提取内容**：

- 类定义和方法
- 接口定义
- 包声明和导入
- 注解

## Go

**提取内容**：

- 函数声明
- 结构体定义和方法
- 接口定义
- 包导入

## Rust

**提取内容**：

- 函数声明 (fn)
- 结构体定义和 impl 块
- 模块声明 (mod)
- use 导入
