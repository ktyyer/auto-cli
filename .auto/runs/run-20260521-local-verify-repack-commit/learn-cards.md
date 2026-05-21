# LearnCards · run-20260521-local-verify-repack-commit

## Card 1
- summary: 安装闭环应先跑仓库 check，再做 uninstall/pack/install，避免无效打包。
- confidence: high
- recommendedAction: 未来发布前保持 `npm run check -> uninstall -> pack -> install-from-tgz` 的顺序。

## Card 2
- summary: 安装后需校验目标路径文件存在与更新时间，才能确认安装真正生效。
- confidence: high
- recommendedAction: 固定检查 `~/.codex/prompts/auto.md` 与 `~/.claude/commands/auto.md`。
