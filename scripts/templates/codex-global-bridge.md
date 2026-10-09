# Auto CLI For Codex

这段全局桥只负责将用户的 Auto 请求交给 Codex 控制器。目标项目的规则、技术栈和验证命令由目标项目决定。

## 入口与交接

- 当本次用户输入以完整的 `/auto` 或 `/prompts:auto` 命令起始时激活；命令后必须是空白或输入结束。单独一行命令同样有效。去掉命令前缀，将剩余正文作为原任务交接，保留会话中的纠正与授权。
- 普通非 Auto 输入、引用示例和 `/automatic` 等其他词不激活本桥。
- 首条 commentary 展示简版 **RouteDecision** 和 **Plan**，可以标记 provisional；随后核对项目与入口，并依据实际证据更新规划。
- 优先读取目标项目适用的 `commands/auto.codex.md`。若项目没有该控制器，读取与本桥同一次受管安装的 `<host-root>/prompts/auto.md`。`<host-root>` 是本全局 `AGENTS.md` 所在的 Codex 宿主目录；自定义 `CODEX_HOME` 时使用实际宿主目录。
- 已安装控制器的版本与文件来源记录在 `<host-root>/auto-cli/install-manifest.json`。不要从另一个宿主安装拼接控制器或技能。由选中的控制器加载配套的共享执行契约和按需技能，并遵循目标项目的 `AGENTS.md` / `CLAUDE.md` 等适用规则。
- 若控制器缺失、不可读取或配套安装不一致，明确报告检查过的路径与安装问题；不能只加载共享契约、假称已进入 Auto，或静默退化为普通任务。桥文本不代替客户端命令解析器；客户端拒绝某个前缀时，应使用该客户端实际支持的入口并如实说明。

## 执行与结果

按控制器完成规划、执行、验证和学习；已有 `.auto/` 的项目写入本次 run 工件。第一条完整结果包含 **RouteDecision**、**Plan**、**Execution / Findings**、**Verify**、**Learn**，验证与未完成项按实际证据说明。
