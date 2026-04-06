# Auto CLI

> Claude Code 超级开发辅助工具。本仓库的目标是让 `/auto` 统一发现、推理、编排并复用各类能力，而不是把能力分散到彼此割裂的命令实现里。

## 技术栈
- 语言: JavaScript (ESM)
- 运行时: Node.js >= 18
- CLI: commander + chalk + inquirer + ora
- 测试: Vitest
- 代码质量: ESLint + Prettier
- 打包方式: `npm pack`

## 项目结构
- `bin/cli.js`：CLI 入口，负责命令解析和输出
- `src/index.js`：对外 facade，统一把 CLI 动作委派给 workflow orchestrator
- `src/workflow/`：6 PHASE 工作流核心（discover / execute-reason / execute / verify / commit / learn）
- `src/router/`：Canonical Router、Agent Registry、关键词提取与模型路由
- `src/indexer/`：REPO_MAP 和 symbol index 生成
- `src/knowledge/`：知识保存与反馈机制
- `commands/`：slash command 文档入口
- `skills/`：可复用技能知识
- `agents/`：内置 agent 清单与说明
- `hooks/`：默认 hooks 与辅助脚本
- `tests/`：Vitest 测试

## 产品与架构约束
- `/auto` 是统一编排入口，新增能力优先接入 orchestrator，而不是新增平行后端。
- 文档必须以当前真实运行时为准，不能承诺尚未实现或已下线的行为。
- PHASE 1 DISCOVER 默认只读；只有显式 fix 路径才允许执行安全自动修复。
- CLI 层尽量保持薄，只做参数解析、输出格式化和委派。
- 优先复用现有 phase、router、indexer、installer 模块，不新增重型子系统。

## 编码规范
- 使用 ESM 语法和现有代码风格，保持最小 diff。
- 优先不可变更新，不直接修改已有上下文对象。
- 不为一次性逻辑抽象新 helper；能在当前文件清晰表达就不要过度封装。
- 不顺手重构与当前需求无关的代码。
- 不新增无根据的兜底、兼容层或 feature flag。
- 不在非调试代码中保留 `console.log`。

## 测试与验证
- 修改代码后至少运行相关验证；交付前默认运行：
  - `npm test`
  - `npm run lint`
  - `npm run format:check`
- 如果改动 CLI 命令或文档承诺，补最小冒烟验证，例如：
  - `auto --help`
  - `auto doctor --json -d .`
  - `auto status --json -d .`
  - `auto learn --git --json -d .`
- 修测试优先修实现；只有测试明显错误时才改测试。

## Git 与发布
- 提交信息遵循 conventional commits：`feat: ...` / `fix: ...` / `docs: ...`
- 仅在用户明确要求时提交 commit 或执行全局安装。
- 本地安装最新源码版的标准流程：
  - `npm pack`
  - `npm install -g ./auto-cli-<version>.tgz`
  - `auto install -y`
- 发布前优先确认 README、commands 文档与实际 CLI 行为一致。

## AI 工作方式
- 先读相关文件再改，不猜实现。
- 多文件或有多种实现路径的任务先规划再动手。
- 修改代码后主动做代码审查或至少做一致性回归。
- 对删除文件、卸载/安装、全局环境修改、git 提交等可见操作要谨慎，按用户请求范围执行。
- 如果发现文档与运行时冲突，优先信任代码，再把文档修到一致。

## 当前仓库高价值关注点
- `src/workflow/workflow-orchestrator.js` 是统一动作入口。
- `src/workflow/phase-discover.js` 的只读 discover / doctor fix 边界不能被破坏。
- `src/index.js` 与 `bin/cli.js` 之间的 facade / CLI 一致性要保持。
- `commands/*.md`、`README.md`、`skills/*.md` 中的能力描述需要持续与真实实现同步。
- 包产物只保留当前需要的版本，旧 tgz 可在确认无用后删除。
