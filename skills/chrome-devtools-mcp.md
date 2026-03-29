---
name: chrome-devtools-mcp
description: Chrome DevTools MCP 使用指南 - 通过 MCP 协议连接 Chrome DevTools，让 AI 直接调试浏览器中的前端应用
version: 1.0.0
author: auto-cli
tags: [chrome, devtools, mcp, debugging, frontend, browser]
---

# Chrome DevTools MCP -- 使用指南

> 让 AI 直接操作 Chrome DevTools。不再手动审查元素、查看 Network、
> 分析 Console 错误 -- AI 全部代劳。

---

## 是什么

Chrome DevTools MCP 是一个 MCP（Model Context Protocol）服务器，允许 Claude Code 通过标准化协议与 Chrome 浏览器的 DevTools 交互。

**能力**：
- 读取和修改 DOM 元素
- 查看 Console 日志和错误
- 分析 Network 请求和响应
- 执行 JavaScript 表达式
- 截取页面截图
- 模拟用户交互（点击、输入、滚动）

---

## 前置条件

1. Chrome 浏览器（版本 116+）
2. MCP 配置中已启用 `chrome-devtools` 服务器
3. Chrome 启动时带 `--remote-debugging-port=9222` 参数

### 启动 Chrome（带调试端口）

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222
```

### MCP 配置检查

在 `~/.claude/settings.json` 或项目 `.claude/settings.json` 中确认：

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

---

## 5 种典型用法

### 用法 1：调试前端 Bug

```
用户：页面上的按钮点击没反应，帮我排查

AI 会：
1. 定位到按钮元素
2. 检查事件监听器是否绑定
3. 查看 Console 有无错误
4. 检查 Network 请求是否发出
5. 给出修复建议
```

### 用法 2：验证 UI 样式

```
用户：检查登录页面的响应式布局是否正确

AI 会：
1. 截取不同视口尺寸的截图
2. 检查 CSS 断点是否生效
3. 验证元素布局和间距
4. 报告样式问题
```

### 用法 3：分析性能

```
用户：页面加载太慢，帮我分析

AI 会：
1. 查看 Network 请求瀑布图
2. 识别耗时最长的请求
3. 检查是否有阻塞渲染的资源
4. 分析 JavaScript 执行时间
5. 给出优化建议
```

### 用法 4：自动化测试辅助

```
用户：验证表单提交后的成功提示是否显示

AI 会：
1. 填写表单字段
2. 点击提交按钮
3. 等待响应
4. 检查成功提示是否出现
5. 报告结果
```

### 用法 5：E2E 调试

```
用户：E2E 测试在登录步骤失败了

AI 会：
1. 打开登录页面
2. 截取当前状态
3. 检查表单元素是否存在
4. 尝试填写并提交
5. 查看 Console 和 Network 错误
6. 定位失败原因
```

---

## 最佳实践

### 1. 先截图再分析

让 AI 先截取当前页面截图，再分析问题。截图比文字描述准确 10 倍。

### 2. 用 Console 日志定位

不要只描述现象，让 AI 查看 Console 日志。日志中有精确的错误信息和堆栈。

### 3. 增量验证

每次修改代码后，让 AI 在浏览器中立即验证，而不是改完一堆再验证。

### 4. 保存 Network 快照

对于复杂的前端 Bug，保存 Network 请求快照供 AI 分析。

---

## 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 连接超时 | Chrome 未启动调试端口 | 带 `--remote-debugging-port=9222` 重启 Chrome |
| 找不到元素 | 页面未加载完成 | 等待页面加载后再操作 |
| 权限不足 | Chrome 实例属于其他用户 | 使用同一用户启动 Chrome |
| MCP 断开 | Chrome 关闭或崩溃 | 重启 Chrome 和 MCP 服务器 |
| 截图空白 | 页面在后台标签页 | 切换到前台标签页 |

---

## 与 Auto CLI 的集成

- **/auto** 命令：前端 Bug 修复任务自动检测 chrome-devtools MCP 是否可用
- **e2e-runner Agent**：E2E 测试失败时可调用 Chrome DevTools 分析
- **build-error-resolver**：前端构建错误可通过 DevTools 排查
- **skills/frontend-patterns.md**：前端模式参考
