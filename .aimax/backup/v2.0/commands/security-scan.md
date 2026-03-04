---
description: 安全扫描命令 - 对 Claude Code 配置和项目代码进行安全审计，借鉴 AgentShield 模式。
---

# Security Scan 命令

`/aimax:security-scan` 用于检测 Claude Code 配置和项目代码中的安全漏洞。

---

## 扫描范围

### 1. Claude Code 配置安全

| 检查项 | 说明 | 严重程度 |
|--------|------|----------|
| 密钥泄露 | CLAUDE.md、settings.json 中的硬编码密钥 | 🔴 Critical |
| MCP 服务器风险 | 不可信的 MCP 服务器配置 | 🔴 Critical |
| Hook 注入 | hooks.json 中的命令注入风险 | 🔴 Critical |
| Agent 配置 | agent 文件中的过度权限 | 🟡 Medium |
| 权限审计 | 工具权限是否最小化 | 🟡 Medium |

### 2. 项目代码安全

| 检查项 | 说明 | 严重程度 |
|--------|------|----------|
| SQL 注入 | 未参数化的 SQL 拼接 | 🔴 Critical |
| XSS 漏洞 | 未转义的用户输入输出 | 🔴 Critical |
| 凭证硬编码 | 代码中的 API Key、密码 | 🔴 Critical |
| 依赖漏洞 | 已知 CVE 的依赖包 | 🟡 Medium |
| 不安全的加密 | 弱哈希、明文传输 | 🟡 Medium |
| 路径遍历 | 未验证的文件路径操作 | 🟡 Medium |

---

## 扫描流程

### Step 1: 配置文件检测

```bash
# 扫描以下文件
scan_targets:
  - CLAUDE.md
  - .claude/settings.json
  - .claude/commands/**
  - .claude/agents/**
  - .claude/hooks.json
  - .claude/mcp-configs/**
  - .claude/skills/**
```

### Step 2: 密钥模式匹配

```yaml
secret_patterns:
  - "AKIA[0-9A-Z]{16}"           # AWS Access Key
  - "sk-[a-zA-Z0-9]{48}"        # OpenAI API Key
  - "sk-ant-[a-zA-Z0-9-]{95}"   # Anthropic API Key
  - "ghp_[a-zA-Z0-9]{36}"       # GitHub Token
  - "password\\s*[:=]\\s*.+"     # 硬编码密码
  - "secret\\s*[:=]\\s*.+"      # 硬编码密钥
```

### Step 3: Hook 注入分析

```yaml
hook_risks:
  - command_injection: "检查 hooks 中的 shell 命令是否可被注入"
  - file_exfiltration: "检查是否有将代码发送到外部的 hook"
  - privilege_escalation: "检查 hook 是否请求不必要的权限"
```

### Step 4: 依赖审计

```bash
# Node.js
npm audit --json

# Python
pip-audit --format json

# Java
mvn dependency-check:check
```

---

## 输出格式

```markdown
## 🛡️ 安全扫描报告

### 总评: B+ (良好)

### 🔴 Critical (0)
无

### 🟡 Medium (2)
1. `.claude/hooks.json` L12 — Hook 命令未做输入验证
   → 建议：添加输入白名单

2. `src/config.js` L45 — 硬编码的数据库连接字符串
   → 建议：使用环境变量

### 🟢 Info (3)
1. 建议启用 MCP 服务器白名单
2. Agent 权限可进一步收窄
3. 建议添加 .gitignore 排除敏感文件

### 门禁结果
- Critical: 0 (✅ 通过)
- Medium: 2 (⚠️ 建议修复)
- 总评: 可提交
```

---

## 使用示例

```bash
/aimax:security-scan
```

```bash
/aimax:security-scan 重点检查 MCP 配置和 hooks 的安全性
```

---

## CI 集成

可配合 `templates/ci/aimax-evolution-gates.yml` 在 CI 中运行：

```yaml
- name: Security scan
  run: |
    # 如果有 ecc-agentshield，使用它
    if command -v npx > /dev/null 2>&1; then
      npx ecc-agentshield scan --format json || true
    fi
```

---

## 与其他命令协作

- `/aimax:code-review` — 代码质量 + 安全双重审查
- `/aimax:evolve` — 安全扫描作为门禁之一
- `/aimax:deep-plan` — 规划阶段评估安全风险

---

## 开源借鉴

- **AgentShield** — Claude Code 配置安全审计（1282 测试、102 规则）
- **SonarQube** — 多维度代码安全扫描
- **npm audit / pip-audit** — 依赖漏洞检测
