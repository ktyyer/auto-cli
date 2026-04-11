#!/bin/bash
set -euo pipefail
# auto-cli codemaps pre-commit hook
# Regenerates REPO_MAP.md when source files change
# NOTE: This hook requires an external codemaps CLI tool.
# If not available, the hook exits gracefully.
# Install: cp hooks/lib/codemaps-hook.sh .husky/pre-commit-codemaps

STAGED_JS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|mjs|ts)$' || true)

if [ -n "$STAGED_JS" ]; then
  if command -v auto >/dev/null 2>&1; then
    echo "[codemaps] Source files changed, regenerating symbol map..."
    if auto codemaps --dir "$(git rev-parse --show-toplevel)" 2>/dev/null; then
      if [ -f "REPO_MAP.md" ]; then
        git add REPO_MAP.md
        echo "[codemaps] Staged REPO_MAP.md"
      fi
    else
      echo "[codemaps] Warning: codemaps generation failed, skipping staging"
    fi
  else
    echo "[codemaps] 'auto' CLI not found, skipping codemaps generation"
  fi
fi
