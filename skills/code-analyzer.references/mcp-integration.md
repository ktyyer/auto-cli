# MCP 集成（可选增强）

> code-analyzer 的 MCP 增强方案。tree-sitter-analyzer MCP server 提供更高级的代码分析能力。

## MCP Tools

- `analyze_code(file_path: str) -> CodeStructure`
- `find_references(symbol: str) -> List[Location]`
- `get_call_graph(function: str) -> CallGraph`

## 集成方式

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
