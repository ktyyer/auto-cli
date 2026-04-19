# 版本与发布规范

## 版本号

- 遵循 semver：`MAJOR.MINOR.PATCH`
- 版本号定义在 `package.json` 中

## 发布流程

1. 更新 `package.json` 版本号
2. 运行 `npm run format:check` 确保格式一致
3. 提交：`chore: bump version to x.y.z`
4. 运行 `npm pack` 生成 tgz 包
5. 仅在用户明确要求时执行提交和发布

## 安装与卸载

- `npm run sync` — 复制 commands/agents/skills/hooks 到 ~/.claude/（主推路径）
- `npm run install` — `sync` 的向后兼容别名（与 `npm install` 名字易混，新脚本请用 sync）
- `npm run uninstall` — 移除已安装的文件

## 包产物管理

- 只保留当前需要的版本，旧 tgz 可在确认无用后删除
- 不提交 tgz 到 Git（已在 .gitignore 中排除）

## Git 约束

- 提交信息遵循 conventional commits：`feat:` / `fix:` / `docs:` / `chore:` / `refactor:` / `test:` / `perf:` / `ci:`
- 仅在用户明确要求时提交 commit
