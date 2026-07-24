# Discovery assets (Wave 1 · P1-1)

> 发现层材料。awesome PR 需维护者账号提交；本文件提供可复制正文。

## Plugin marketplace copy

**Name**: auto-cli  
**Short** (≤120 chars):

```
Claude Code / Codex /auto: protocol-driven 6-phase agent orchestration + LearnCard knowledge loop
```

**Long** (plugin.json style):

```
Claude Code /auto 超级命令 — 6 PHASE（SCAN→PLAN→EXECUTE→VERIFY→SUMMARIZE→LEARN）+ 5 标准协议对象 + LearnCard 知识闭环。纯 Markdown 指令包；Node 仅 install/validate/metrics 工具链。
```

**Topics / keywords**: `claude-code`, `agent-skills`, `markdown`, `codex`, `orchestration`, `skills`

## Suggested `gh` commands (run where gh is installed)

```bash
gh repo edit ktyyer/auto-cli \
  --description "Claude Code / Codex /auto super-command: protocol-driven 6-phase orchestration + LearnCard knowledge loop" \
  --add-topic claude-code \
  --add-topic agent-skills \
  --add-topic markdown \
  --add-topic codex \
  --homepage "https://github.com/ktyyer/auto-cli"
```

## Draft PR body for awesome-claude-code

**Target**: https://github.com/hesreallyhim/awesome-claude-code  

**Suggested section**: Workflows / Orchestration / Skills packs  

**Entry**:

```markdown
- [auto-cli](https://github.com/ktyyer/auto-cli) - Protocol-driven `/auto` super-command for Claude Code & Codex: 6-phase pipeline, 5 audit objects, LearnCard knowledge loop, 39 skills. Pure Markdown instructions (Node tooling for install/validate only).
```

**Why it fits**:

- Native Claude Code plugin + `npm run sync` for Codex
- Differentiator: LearnCard → `.auto/insights` cross-run memory (not one-shot prompts)
- Honest positioning: instruction pack, not SaaS agent runtime

**Checklist before submit**:

- [ ] Wave 0 trust defaults merged to default branch
- [ ] README Who's Using has ≥1 case study
- [ ] Repo description + topics set
- [ ] Link to `docs/llms.txt` works

## Plugin.json keywords (current + recommended)

Keep existing keywords; ensure description stays under marketplace limits and matches README USP.
