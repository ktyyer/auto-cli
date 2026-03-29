---
description: 交互式引导创建 Claude Code Hook。智能建议基于项目配置（TypeScript, Prettier, ESLint）的 Hook 模板。
---

# create-hook 命令

此命令提供交互式引导来创建 Claude Code Hook，无需手动编写 JSON 配置。

## 此命令的功能

1. **交互式问答** - 通过问题引导你完成 Hook 创建
2. **智能建议** - 基于项目配置自动推荐合适的 Hook 类型
3. **模板生成** - 为常见 Hook 场景提供预置模板
4. **语法验证** - 验证生成的 JSON 是否有效
5. **自动安装** - 可选择直接安装到项目中

## 何时使用

在以下情况使用 `/auto:create-hook`：
- 想要在特定操作前/后执行自定义脚本
- 需要强制执行代码规范（如 TDD）
- 想要阻止某些危险操作
- 需要在项目事件发生时执行自动化任务

## Hook 类型

支持以下 Hook 类型：

| Hook 类型 | 触发时机 | 用途 |
|-----------|---------|------|
| **PreToolUse** | 工具调用前 | 验证、修改输入、阻止操作 |
| **PostToolUse** | 工具调用后 | 自动格式化、检查、通知 |
| **PostCompaction** | 上下文压缩后 | 重新注入关键上下文 |
| **UserPromptSubmit** | 用户提交提示后 | 验证提示、注入上下文 |
| **TeammateIdle** | 队友空闲时 | 分配新任务 |
| **TaskCompleted** | 任务完成时 | 质量门禁、验证 |
| **Stop** | 会话结束时 | 最终检查、清理 |

## 使用示例

### 示例 1：创建 TDD 强制 Hook

```
用户：/auto:create-hook

Hook 创建助手：
欢迎使用 Hook 创建助手！让我通过几个问题来帮你创建 Hook。

问题 1：你想在什么时候触发 Hook？
1. 工具调用前 (PreToolUse)
2. 工具调用后 (PostToolUse)
3. 会话结束时 (Stop)
4. 其他

用户：1

问题 2：这个 Hook 的主要目的是什么？
1. 强制执行规范 (如 TDD)
2. 自动格式化代码
3. 阻止危险操作
4. 发送通知
5. 其他

用户：1

问题 3：需要对哪些文件类型生效？
（检测到项目配置：TypeScript, JavaScript）

建议的文件模式：
- \.(ts|tsx|js|jsx)$ - TypeScript/JavaScript 文件
- \.java$ - Java 文件
- \.py$ - Python 文件

用户：1

正在生成 TDD Guard Hook...

生成的 Hook 配置：
{
  "matcher": "(tool == \"Write\" || tool == \"Edit\") && tool_input.file_path matches \"\\\\.(ts|tsx|js|jsx)$\"",
  "hooks": [
    {
      "type": "command",
      "command": "#!/bin/bash\n# TDD Guard: 检查测试文件是否存在\n..."
    }
  ],
  "description": "TDD Guard: 强制测试驱动开发"
}

是否要将此 Hook 安装到项目中？ [Y/n]

用户：Y

✅ Hook 已安装到 hooks/hooks.json
📝 已添加 PreToolUse hook: TDD Guard
```

### 示例 2：创建代码格式化 Hook

```
用户：/auto:create-hook

Hook 创建助手：
...

问题 2：这个 Hook 的主要目的是什么？
1. 强制执行规范 (如 TDD)
2. 自动格式化代码
3. 阻止危险操作
4. 发送通知
5. 其他

用户：2

（检测到项目配置：Prettier, ESLint）

建议：创建自动格式化 Hook，使用 Prettier 和 ESLint

正在生成 Auto-Format Hook...

生成的 Hook 配置：
{
  "matcher": "tool == \"Edit\" && tool_input.file_path matches \"\\\\.(ts|tsx|js|jsx)$\"",
  "hooks": [
    {
      "type": "command",
      "command": "#!/bin/bash\n# Auto-format with Prettier\nprettier --write \"$file_path\"\n..."
    }
  ],
  "description": "Auto-format: Prettier + ESLint"
}

是否要安装？ [Y/n]

用户：Y

✅ Hook 已安装
```

## 常见 Hook 模板

### TDD Guard Hook
强制在编写代码前先编写测试。

### Auto-Format Hook
在编辑后自动运行 Prettier 和 ESLint。

### Secret Detection Hook
检测输入中的敏感信息（API 密钥、令牌）。

### Dev Server Blocker Hook
阻止在 tmux 外运行开发服务器。

### Git Push Review Hook
在 git push 前打开编辑器审查更改。

### Console.log Warning Hook
警告编辑文件中的 console.log 语句。

### Large File Warning Hook
警告编辑超过 500 行的文件。

## Hook 匹配器 (Matcher) 语法

```
# 匹配特定工具
tool == "Bash"
tool == "Write"
tool == "Edit"

# 匹配命令模式
tool_input.command matches "npm run dev"
tool_input.command matches "(npm|pnpm|yarn) install"

# 匹配文件路径
tool_input.file_path matches "\\.js$"
tool_input.file_path matches "(src/|lib/).*\\.ts$"

# 组合条件
(tool == "Write" || tool == "Edit") && tool_input.file_path matches "\\.js$"
tool == "Bash" && tool_input.command matches "git push"
```

## Hook 命令格式

Hook 命令是接收 JSON 输入的 bash 脚本：

```bash
#!/bin/bash
# 读取 JSON 输入
input=$(cat)

# 提取字段
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# 执行逻辑
if [ some_condition ]; then
  echo "[Hook] Warning message" >&2
  # 阻止操作
  exit 1
fi

# 传递原始输入
echo "$input"
```

## 退出代码

- **0** - 允许操作继续
- **1** - 阻止操作（PreToolUse）
- **2** - 拒绝并显示错误

## 与其他功能的集成

- 使用 `/auto` 配合 quest-designer 实现 TDD 工作流
- 使用 `/auto` 配合 code-reviewer Agent 进行代码审查
- 使用 `/auto:status` 查看已安装的 Hooks

## 现有 Hooks 参考

项目中的 `hooks/hooks.json` 包含多个现成的 Hook 示例，可以作为参考。
