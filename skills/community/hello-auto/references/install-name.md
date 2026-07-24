# Install name for community skills

Community skills are installed with a **`community-` prefix** to avoid shadowing core skills:

| Source                                 | Claude target                              | Codex target                                    |
| -------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| `skills/community/hello-auto/SKILL.md` | `~/.claude/skills/community-hello-auto.md` | `~/.codex/skills/community-hello-auto/SKILL.md` |

Core skills remain unprefixed (`skills/foo` → `foo.md`).
