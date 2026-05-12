# Community Skills

> 社区贡献的 Skill 目录。遵循 [Agent Skills 标准](https://agentskills.io/specification) 和 auto-cli 扩展规范。

## 使用方法

将社区 Skill 放入此目录，重启 Claude Code 后 `/auto` 的 SCAN 阶段会自动发现：

```
skills/community/
├── your-skill.md              # Skill 主文件
└── your-skill.references/     # 可选：参考文档
```

## 贡献指南

每个 Skill 必须满足：

- [ ] frontmatter 含 `name`、`description`、`tags`（必填）
- [ ] `name` 与文件名一致，符合 Agent Skills 命名规范（小写+数字+中划线）
- [ ] `description` 含具体触发关键词（pushy 风格，≥ 10 字符，≤ 1024 字符）
- [ ] 含 `## 激活摘要` 段落（~25 行：checklist + constraints + output + anti-patterns）
- [ ] 含 `## 使用时机` 段落
- [ ] 含 `## 与 auto-cli 集成` 段落
- [ ] 含 `## 验收标准` 段落
- [ ] 主文件 ≤ 200 行（超长内容拆分到 `.references/`）
- [ ] 通过 `node scripts/validate-references.js` 校验

## 推荐可选的 Agent Skills 字段

| 字段            | 用途     | 示例                                  |
| --------------- | -------- | ------------------------------------- |
| `license`       | 许可证   | `MIT` / `Apache-2.0`                  |
| `compatibility` | 环境要求 | `requires: git, docker`               |
| `metadata`      | 元信息   | `author: your-name`, `version: "1.0"` |

## 提交流程

1. Fork 本仓库
2. 在 `skills/community/` 下创建 Skill 文件
3. 运行 `node scripts/validate-references.js` 确认无错误
4. 提交 PR 到 `dev` 分支

## 参考

- [Agent Skills 规范](https://agentskills.io/specification)
- [skill-creator](../skill-creator.md) — Skill 编写方法论
- [skill-evaluator](../skill-evaluator.md) — Skill 健康度评估
