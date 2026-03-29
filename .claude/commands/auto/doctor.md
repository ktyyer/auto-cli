---
description: 环境诊断 - 检查 Node.js 版本、Claude Code 配置、MCP 连接性、依赖状态，输出健康报告和修复建议
---

# /auto:doctor -- 环境诊断

> 一键检查开发环境健康状态，发现问题时自动给出修复建议。

## 执行步骤

### 1. Node.js 环境检查

```
Bash("node --version")
  → >= 18.0.0 → PASS
  → < 18.0.0 → FAIL: "请升级 Node.js 到 18+"

Bash("npm --version")
  → 存在 → PASS
  → 不存在 → WARN: "npm 未找到，请检查 Node.js 安装"

Bash("git --version")
  → 存在 → PASS
  → 不存在 → WARN: "git 未安装，版本控制功能受限"
```

### 2. Claude Code 配置检查

```
Bash("test -d ~/.claude && echo EXISTS || echo MISSING")
  → MISSING → FAIL: "~/.claude 目录不存在，请先运行 auto install"

Bash("ls ~/.claude/agents/*.md 2>/dev/null | wc -l")
  → >= 5 → PASS
  → < 5 → WARN: "Agent 文件不完整，建议重新 auto install"

Bash("ls ~/.claude/commands/auto/*.md 2>/dev/null | wc -l")
  → >= 10 → PASS
  → < 10 → WARN: "Command 文件不完整，建议重新 auto install"

Bash("ls ~/.claude/skills/**/*.md 2>/dev/null | wc -l")
  → >= 10 → PASS
  → < 10 → WARN: "Skill 文件不完整，建议重新 auto install"
```

### 3. MCP 服务器连接性检查

```
Read("~/.claude/mcp-configs/mcp-servers.json")
  → 对每个 mcpServers 条目：
    - 含 YOUR_*_HERE → SKIP: "需配置 API Key"
    - stdio 类型 → 检查 command 是否可执行
    - http 类型 → 仅检查 URL 格式是否合法
```

### 4. 项目配置检查

```
Glob("CLAUDE.md")
  → 存在 → PASS
  → 不存在 → WARN: "缺少 CLAUDE.md，建议运行 /auto:init 生成"

Glob("REPO_MAP.md")
  → 存在 → PASS
  → 不存在 → INFO: "缺少 REPO_MAP.md，建议运行 /auto:update-codemaps"

Glob(".auto/cache/capability-snapshot.json")
  → 存在 → PASS (检查是否过期)
  → 不存在 → INFO: "首次使用，缓存将在首次 /auto 后生成"
```

### 5. 依赖安装检查

```
Glob("package.json")
  → 存在 → Bash("test -d node_modules && echo OK || echo MISSING")
    → MISSING → FAIL: "依赖未安装，请运行 npm install"
  → 不存在 → INFO: "非 Node.js 项目，跳过"
```

### 6. 输出诊断报告

```markdown
## Auto CLI 环境诊断报告

### 基础环境
- Node.js: v20.11.0 -- PASS
- npm: 10.2.4 -- PASS
- git: 2.43.0 -- PASS

### Claude Code 配置
- ~/.claude 目录: PASS
- Agents (11): PASS
- Commands (16): PASS
- Skills (18): PASS
- Plugins (17): PASS

### MCP 服务器
- memory: READY
- sequential-thinking: READY
- playwright: READY
- github: NEEDS_CONFIG (缺少 GITHUB_PERSONAL_ACCESS_TOKEN)
- brave-search: NEEDS_CONFIG (缺少 BRAVE_API_KEY)
- [其他...]

### 项目配置
- CLAUDE.md: PASS
- REPO_MAP.md: PASS
- capability-snapshot.json: PASS (2h ago)

### 发现的问题
1. [WARN] 2 个 MCP 服务器需要配置 API Key
   → 修复: 编辑 ~/.claude.json 替换 YOUR_*_HERE

### 总结
- PASS: 12 项
- WARN: 2 项 (非阻塞)
- FAIL: 0 项
```

## 核心原则

1. **只读诊断** -- doctor 不修改任何文件，只报告状态
2. **分级报告** -- PASS/WARN/FAIL 三级，WARN 不阻塞正常使用
3. **修复建议** -- 每个问题附带具体修复命令
