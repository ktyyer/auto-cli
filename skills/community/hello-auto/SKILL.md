---
name: hello-auto
description: Community sample skill for auto-cli — greets install path checklist and verifies community skill discovery. Activate on "hello-auto", "community skill demo", "测试社区 skill", or validating skills/community after npm run sync.
tags: [community, sample, hello-auto, onboarding, install-check]
license: MIT
---

# Hello Auto — Community sample skill

> 官方样例：证明 `skills/community/<name>/SKILL.md` 可被校验与安装。非生产业务 skill。

## 使用时机

- 验证 community 安装链路（`npm run sync` 后是否出现 `community-hello-auto`）
- 新贡献者提交 community skill 前对照结构
- 用户说「测试社区 skill」「hello-auto」

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 确认本 skill 位于 `skills/community/hello-auto/SKILL.md`
- [ ] frontmatter `name` 与目录名一致
- [ ] 运行 `node scripts/validate-references.js` 无 community 错误
- [ ] `npm run sync` 后 Claude 侧存在 `community-hello-auto.md`（或 Codex `community-hello-auto/SKILL.md`）

**硬约束** (constraints):

- 不修改业务代码；只读检查 + 输出清单
- 不冒充核心 39 skills 之一

**输出模板** (output):

```text
hello-auto: OK
- source: skills/community/hello-auto/SKILL.md
- installed-as: community-hello-auto
- next: 用 skill-creator 写你的社区 skill
```

**反模式** (anti-patterns):

- 把示例 skill 当生产能力 → 误导用户
- 安装时不带 `community-` 前缀导致覆盖核心 skill 名

## 与 auto-cli 集成

| Phase   | 行为                                           |
| ------- | ---------------------------------------------- |
| SCAN    | 用户意图含 community 验证时纳入 selectedSkills |
| PLAN    | 单关只读检查即可                               |
| EXECUTE | 执行下方验收命令，输出清单                     |
| LEARN   | 可选 trap：community 未安装前缀                |

## 核心流程

1. 确认源文件存在
2. 跑 validate-references
3. 提示用户 `npm run sync`
4. 列出期望安装名 `community-hello-auto`

## 验收标准

```bash
test -f skills/community/hello-auto/SKILL.md
node scripts/validate-references.js
# sync 后（Claude）:
# test -f ~/.claude/skills/community-hello-auto.md
```

## 参考

见 `references/install-name.md`。
