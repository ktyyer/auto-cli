# Auto CLI

> Claude Code `/auto` 超级命令。本仓库的目标是让 `/auto` 统一发现、推理、编排并复用各类能力。

## 定位

纯 Markdown 指令仓库，通过 Claude Code 的 slash command 机制运行。不包含 JS 运行时代码。

## 项目结构
- `commands/auto.md`：`/auto` 主命令，定义 6 PHASE 工作流
- `commands/auto/`：子命令（doctor、learn、status、route、create-hook）
- `agents/`：内置 agent 清单与说明
- `skills/`：可复用技能知识
- `rules/`：编码规范
- `hooks/`：默认 hooks 配置

## 架构约束
- `/auto` 是唯一编排入口，新增能力优先接入 auto.md，不新增平行入口。
- 文档必须以当前真实行为为准，不能承诺尚未实现的功能。
- PHASE 1 SCAN 默认只读；只有显式 `--fix` 才允许执行安全自动修复。
- 子命令是自包含的 Markdown 指令，不依赖外部 JS 运行时。

## 编码规范
- 修改 Markdown 文件时保持最小 diff。
- 不顺手重构与当前需求无关的内容。
- 不新增无根据的兜底或兼容说明。

## 验证
- 修改后运行 `npm run format:check` 确保格式一致。
- 修改子命令后检查内部引用是否一致。

## 安装与卸载
- `npm run sync` — 复制 commands/agents/skills/hooks 到 ~/.claude/（主推路径）
- `npm run install` — `sync` 的向后兼容别名（与 `npm install` 名字易混，新脚本请用 sync）
- `npm run uninstall` — 移除已安装的文件

## Git 与发布
- 提交信息遵循 conventional commits：`feat: ...` / `fix: ...` / `docs: ...`
- 仅在用户明确要求时提交 commit。

## AI 工作方式
- 先读相关文件再改，不猜实现。
- 多文件或有多种实现路径的任务先规划再动手。
- 对删除文件、git 提交等可见操作要谨慎，按用户请求范围执行。
- 如果发现文档与实际行为冲突，优先修文档到一致。

## 架构分层（root/dev 模式）

借鉴 karpathy/llm.c 的 root/dev 分离设计：

| 层 | 目录 | 职责 | 复杂度容忍度 |
|----|------|------|-------------|
| **root** | `commands/` | 用户可直接调用的入口，简单可读 | 低 — 拒绝无显著收益的复杂度 |
| **dev** | `skills/` | 被 commands 调用的能力库，可实验 | 中 — 允许局部复杂 |
| **infra** | `agents/` | Agent 定义与协议 | 低 — 保持 < 450 行 |
| **guard** | `rules/` + `hooks/` | 编码规范与自动化 | 低 — 声明式为主 |

新增能力时优先放 `skills/`，不修改主命令。主命令只做路由和编排。

## 路线图

### 进行中

- [ ] `commands/auto.md` 精简：将 Skill 注入映射表等细节下沉到 skill 文件
- [ ] `.auto/runs/` 示例索引：沉淀典型 `/auto` 运行作为使用教程
- [ ] 社区 skills 机制：`skills/community/` 目录支持第三方扩展

### 计划中

- [ ] 多语言 README（英文版）
- [ ] Agent 效果分自动化：verification agent 定期评估 quest-designer 产出质量
- [ ] skills 自动发现：SCAN 阶段按标签自动匹配而非硬编码映射表

### 已完成

- [x] v0.32.0: scripts 抽 manifest + validator 识别表格
- [x] v0.32.0: skill-evaluator skill 集成
- [x] v0.31.0: 从 JS 运行时迁移到纯 Markdown 指令系统

## 当前仓库高价值关注点
- `commands/auto.md` 是统一动作入口。
- 子命令 md 中的能力描述需要持续与实际行为同步。
- 包产物只保留当前需要的版本，旧 tgz 可在确认无用后删除。
