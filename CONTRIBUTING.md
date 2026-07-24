# 贡献指南

感谢你对 Auto CLI 的关注。

## 项目定位

本仓库是 **纯 Markdown 指令包**（`commands/` / `agents/` / `skills/` / `rules/` / `hooks/` 声明），通过 Claude Code / Codex 的 slash command 机制运行。

`scripts/` 中的 Node 仅用于 **安装、校验、缓存、观测** 工具链，不是 slash 业务 runtime。

## 开发环境

```bash
git clone https://github.com/ktyyer/auto-cli.git
cd auto-cli
npm install

# 与 package.json 一致的检查（format + 引用/包/run 校验）
npm test
# 等价于
npm run check

# 仅格式检查 / 格式化
npm run format:check
npm run format

# 安装到本机 Claude/Codex
npm run sync
```

> 仓库 **没有** `npm run lint` 或 `npm run test:coverage`。请勿在文档或 CI 中引用不存在的脚本。

## 开发流程

1. Fork 本仓库
2. 创建分支：`git checkout -b feat/your-feature`
3. 按最小 diff 修改 Markdown / 工具脚本
4. 运行 `npm test` 与（如改了 md）`npm run format:check`
5. 使用 Conventional Commits 提交
6. 推送并创建 Pull Request

## 提交信息格式

```
<type>: <description>
```

类型：`feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `ci`

## 项目结构（现行）

```
auto-cli/
  commands/     # root：/auto 与子命令（Markdown）
  skills/       # dev：39 个正式 skill + community 占位
  agents/       # infra：10 个业务 Agent + 共享原则
  rules/        # guard：编码规范
  hooks/        # guard：hooks.json + lib 脚本
  scripts/      # Node 工具链（install / validate / metrics / index）
  docs/         # llms.txt、案例等
  tests/        # scripts 的单元测试
```

## 文档一致性

- 文档必须与真实行为一致；禁止承诺未实现能力
- skills 计数以 `skills/*/` 正式目录为准（当前 **39**；`community/` 为占位）
- 修改子命令后检查 Agent/Skill 引用是否存在

## 报告 Bug / 功能建议

- [Bug Report](https://github.com/ktyyer/auto-cli/issues/new?template=bug_report.yml)
- [Feature Request](https://github.com/ktyyer/auto-cli/issues/new?template=feature_request.yml)
