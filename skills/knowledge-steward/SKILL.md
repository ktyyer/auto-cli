---
name: knowledge-steward
version: 0.1.0
description: 知识管家 - 一句话保存灵感、踩坑经验、架构决策
---

# Knowledge Steward（知识管家）

## 功能

- **一键保存**：通过 `/auto:save` 或 CLI `auto save insight` 快速保存知识条目
- **智能分类**：自动识别内容类型，路由到正确的知识文件
- **Git 自动提交**：保存后自动执行 git commit
- **知识搜索**：按关键词搜索已有知识

## 分类规则

| 分类 | 文件 | 描述 |
|------|------|------|
| prompt | `.auto/insights/prompts.md` | 有效 Prompt 和对话模板 |
| trap | `.auto/insights/traps.md` | 踩坑经验和问题排查 |
| pattern | `.auto/insights/patterns.md` | 设计模式和编码最佳实践 |
| decision | `.auto/insights/decisions.md` | 架构决策和技术选型记录 |

## 使用方式

### Claude Code 内

```
用户：保存这个提示词
用户：记录这个踩坑经验
用户：保存决策：选用 XX 方案
```

### CLI

```bash
# 保存知识
auto save insight -c "内容" -t prompt --tags react,hooks

# 查看统计
auto save list

# 搜索
auto save search -q "react"
```

## 存储

知识条目存储在项目根目录的 `.auto/insights/` 下，格式为 Markdown：

```markdown
### [标题]

**日期**: YYYY-MM-DD HH:mm:ss
**标签**: tag1, tag2

[内容]

---
```

## 相关文件

- `src/knowledge/knowledge-steward.js` - 核心实现
- `src/knowledge/categories.js` - 分类规则
- `commands/save.md` - `/auto:save` 命令定义
- `bin/cli.js` - CLI `save` 子命令注册
