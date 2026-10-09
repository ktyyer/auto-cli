---
name: version-and-release
description: 版本号 semver + 发布流程 + npm pack 产物管理
paths: ['package.json', 'CHANGELOG*', '**/*.tgz', '.npmrc']
---

# 版本与发布规范

## 版本号

- 遵循 semver：`MAJOR.MINOR.PATCH`
- 版本号定义在 `package.json` 中

## 发布流程

1. 固定待发布 commit；完整 CI（Node 24 Ubuntu/Windows 的 `npm test`、安全审计及 Node 18/22/24 安装兼容）通过后才进入发布 job。
2. `scripts/release-checks.js preflight` 在干净的固定 commit 执行完整检查；保留 `validate:run --allow-missing` 对干净发布树的支持。
3. `bump` 同步 `package.json`、`package-lock.json` 和 `.claude-plugin/plugin.json`；仅暂存这些版本文件后，`prepare` 重新核验版本和实际 tgz 内容，并记录源 commit、待提交 tree 和包 SHA256。
4. 仅在用户明确要求发布时提交版本变更；`verify` 确认提交 tree 和 tgz 均与检查记录一致，才允许原子推送分支与 tag。检查失败立即停止，不能用旧成功记录继续。
5. 发布同一个已验证的 tgz（`npm publish <checked.tgz>`），发布前再次核对摘要；检查产物放在 checkout 外部，不用目录重新打包替代已验包。GitHub Actions 的手动 Release workflow 执行此流程；本地验证不触发远端发布。

## 安装与卸载

- `npm run sync` — 复制 commands/agents/skills/hooks 到 ~/.claude/（主推路径）
- `npm run uninstall` — 移除已安装的文件

## 包产物管理

- 只保留当前需要的版本，旧 tgz 可在确认无用后删除
- 不提交 tgz 到 Git（已在 .gitignore 中排除）

## Git 约束

- 提交信息遵循 conventional commits：`feat:` / `fix:` / `docs:` / `chore:` / `refactor:` / `test:` / `perf:` / `ci:`
- 仅在用户明确要求时提交 commit
