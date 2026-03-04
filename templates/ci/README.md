# CI 门禁模板

这个目录提供 `/aimax:evolve` 可直接复用的 CI 模板，用于不同技术栈项目的“评估驱动迭代”。

## 文件说明

- `aimax-evolution-gates.yml`
  - 自动检测 Node/Python/Java/Go 项目
  - 按技术栈执行基础门禁（lint/test/build）
  - 支持可选 Promptfoo 评估门禁（若存在 `promptfooconfig.yaml`）
- `aimax-pr-eval-comment.yml`
  - 在 `aimax-evolution-gates` 完成后自动汇总结果
  - 以“可更新（sticky）评论”形式回写到 PR
  - 输出门禁统计、任务明细和下一步建议

## 快速使用

1. 复制到你的项目：

```bash
mkdir -p .github/workflows
cp templates/ci/aimax-evolution-gates.yml .github/workflows/
cp templates/ci/aimax-pr-eval-comment.yml .github/workflows/
```

2. 按项目实际情况调整命令：

- Node: `npm run lint/test/build`
- Python: `ruff`/`pytest`
- Java: `mvn test` 或 `./gradlew test`
- Go: `go test ./...`

3. 确保工作流权限允许写评论（默认 `GITHUB_TOKEN` 即可）。
4. 在 PR 中观察自动评论，失败时回到 `/aimax:evolve` 执行“失败恢复”流程。

## 推荐配套

- 用 `/aimax:loop` 先做状态机编排和中断恢复
- 用 `/aimax:tdd` 先补测试护栏
- 用 `/aimax:code-review` 补充安全/质量检查
- 用 `/aimax:evolve` 持续优化并收敛指标
