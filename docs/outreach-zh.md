# 中文社区介绍草稿（Linux.do / 技术圈）

> 供维护者**人工**发帖。勿由 bot 冒充真人灌水。

## 建议标题

- `给 Claude Code 装一个「超级司令官」：auto-cli 纯 Markdown 指令包体验`
- `协议驱动的 /auto：6 阶段 + LearnCard，越用越懂你的仓库`

## 正文骨架

### 1. 一句话

auto-cli 不是又一个 SaaS Agent，而是装进 Claude Code / Codex 的 **纯 Markdown 指令包**：你说一句 `/auto …`，它走完 SCAN→PLAN→EXECUTE→VERIFY→SUMMARIZE→LEARN，并把经验写进 `.auto/insights`。

### 2. 和「直接问 Claude」的差别

| | 直接聊 | /auto |
| --- | --- | --- |
| 过程 | 即兴 | 固定 6 阶段 + 可审计协议对象 |
| 记忆 | 靠会话 | LearnCard → insights 跨 run |
| 验证 | 口头「应该行」 | 门禁 + 命令证据 |

### 3. 怎么装（30 秒）

```bash
git clone https://github.com/ktyyer/auto-cli.git
cd auto-cli && npm run sync
```

或 Claude Code：`/plugin marketplace add ktyyer/auto-cli` → install。

### 4. 试一句

```text
/auto 帮我分析一下当前项目，找 3 个可优化的点
```

看 `.auto/runs/` 和 `.auto/insights/`。

### 5. 诚实边界

- Loop 自动调度依赖宿主 runtime；不可用时会降级单次执行（文档已写）。  
- Node 只做安装/校验/观测，不是第二套 agent 运行时。  
- 我们在做发现与案例征集，欢迎生产使用故事（见 `docs/case-studies/`）。

### 6. 链接

- 仓库：https://github.com/ktyyer/auto-cli  
- AI 导航：`docs/llms.txt`  
- 收录草稿：`docs/discovery.md`  
- 自举基准：`docs/self-bench.md`

### 7. 求反馈

最想听：你在什么技术栈上用了 `/auto`？哪一关最省事、哪一关最吵？

---

**状态**: 草稿 · 未发布  
**更新**: 2026-07-24 Wave 2
