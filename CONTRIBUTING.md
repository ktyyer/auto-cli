# 贡献指南

感谢你对 Auto CLI 的关注！以下是参与贡献的指南。

## 开发环境

```bash
# 克隆仓库
git clone https://github.com/ktyyer/auto-cli.git
cd auto-cli

# 安装依赖
npm install

# 运行测试
npm test

# 运行测试（覆盖率）
npm run test:coverage

# 代码检查
npm run lint

# 格式化代码
npm run format
```

## 开发流程

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/your-feature`
3. 编写代码和测试
4. 确保通过所有检查：
   ```bash
   npm run lint
   npm run format:check
   npm test
   ```
5. 提交变更（遵循 Conventional Commits 格式）
6. 推送到你的 Fork 并创建 Pull Request

## 提交信息格式

```
<type>: <description>

<optional body>
```

**类型**：
- `feat` -- 新功能
- `fix` -- Bug 修复
- `refactor` -- 代码重构（不改变行为）
- `test` -- 添加或修改测试
- `docs` -- 文档更新
- `chore` -- 构建/工具/依赖变更
- `perf` -- 性能优化

## 项目结构

```
auto-cli/
  bin/cli.js          # CLI 入口
  src/                # 核心源码
    config.js         # 配置常量
    index.js          # 主入口
    installer.js      # 安装/卸载逻辑
    logger.js         # 日志工具
    loop-state-machine.js  # 循环状态机
    mcp-installer.js  # MCP 自动配置
    prompts.js        # CLI 交互
    utils.js          # 工具函数
  tests/              # 测试文件
  agents/             # Agent 定义（.md）
  commands/           # 斜杠命令定义（.md）
  plugins/            # 插件
  skills/             # 技能
  rules/              # 规则
```

## 代码规范

- **ESM 模块**：项目使用 `"type": "module"`，所有 import/export 使用 ES Modules 语法
- **ESLint**：使用 ESLint 9 flat config（`eslint.config.js`）
- **Prettier**：单引号、分号、尾逗号 none（`.prettierrc`）
- **测试**：使用 vitest，测试文件放在 `tests/` 目录
- **pre-commit**：husky + lint-staged 自动运行 ESLint 和 Prettier

## 报告 Bug

请使用 [Bug Report](https://github.com/ktyyer/auto-cli/issues/new?template=bug_report.yml) 模板。

## 提出功能建议

请使用 [Feature Request](https://github.com/ktyyer/auto-cli/issues/new?template=feature_request.yml) 模板。
