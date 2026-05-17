#!/usr/bin/env bash
# Auto CLI 卸载脚本 (macOS/Linux)
# 移除 ~/.claude/ 与 ~/.codex/ 中由 install.js 安装的文件
# 用法：bash scripts/uninstall.sh

cd "$(dirname "$0")/.."

echo ""
echo "Auto CLI 卸载"
echo ""

node scripts/uninstall.js
