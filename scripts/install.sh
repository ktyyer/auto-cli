#!/usr/bin/env bash
# Auto CLI 安装脚本 (macOS/Linux)
# 将本文件所在目录下的 commands/agents/skills/hooks 复制到 ~/.claude/
# 用法：bash scripts/install.sh

cd "$(dirname "$0")/.."

echo ""
echo "Auto CLI 安装"
echo ""

node scripts/install.js --clean
