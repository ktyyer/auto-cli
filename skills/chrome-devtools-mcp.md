---
name: chrome-devtools-mcp
description: Chrome DevTools MCP 使用指南 - 通过 MCP 协议连接 Chrome DevTools，让 AI 直接调试浏览器中的前端应用
version: 1.1.0
author: auto-cli
tags: [chrome, devtools, mcp, debugging, frontend, browser]
---

# Chrome DevTools MCP -- 快速参考

> 让 AI 通过 MCP 协议操作 Chrome DevTools，直接调试前端应用。

## 前置条件

1. Chrome 116+，启动时带 `--remote-debugging-port=9222`
2. MCP 配置中启用 `chrome-devtools` 服务器：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/chrome-devtools-mcp"]
    }
  }
}
```

## 5 种典型用法

| 用法 | 说明 |
|------|------|
| 调试前端 Bug | 定位元素 -> 检查事件监听 -> 查看 Console/Network |
| 验证 UI 样式 | 截取不同视口截图，检查 CSS 断点 |
| 分析性能 | Network 瀑布图 -> 识别慢请求 -> 阻塞资源分析 |
| 自动化测试辅助 | 填写表单 -> 提交 -> 检查响应 |
| E2E 调试 | 截图 -> 检查元素 -> Console/Network 错误定位 |

## 最佳实践

1. 先截图再分析（截图比文字描述准确 10 倍）
2. 用 Console 日志定位（日志中有精确错误和堆栈）
3. 增量验证（每次改代码后立即在浏览器中验证）
4. 保存 Network 快照（复杂 Bug 供 AI 分析）

## 与 Auto CLI 集成

- e2e-runner Agent：E2E 测试失败时调用 Chrome DevTools 分析
- build-error-resolver：前端构建错误可通过 DevTools 排查
