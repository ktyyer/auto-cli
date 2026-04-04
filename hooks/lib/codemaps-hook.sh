#!/bin/bash
# auto-cli codemaps pre-commit hook
# Regenerates REPO_MAP.md when source files change
# Install: cp hooks/lib/codemaps-hook.sh .husky/pre-commit-codemaps

STAGED_JS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|mjs|ts)$' || true)

if [ -n "$STAGED_JS" ]; then
  echo "[codemaps] Source files changed, regenerating symbol map..."
  if npx auto codemaps --dir "$(git rev-parse --show-toplevel)"; then
    if [ -f "REPO_MAP.md" ]; then
      git add REPO_MAP.md
      echo "[codemaps] Staged REPO_MAP.md"
    fi
  else
    echo "[codemaps] Warning: codemaps generation failed, skipping staging"
  fi
fi
