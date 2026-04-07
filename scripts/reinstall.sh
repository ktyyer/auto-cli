#!/usr/bin/env bash
# Auto CLI 一键重装脚本
# 打包 → 清理旧版 → 解压安装新版
#
# 用法：
#   bash scripts/reinstall.sh          # 在仓库根目录执行
#   bash scripts/reinstall.sh /path/to # 指定安装到其他目录

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP_DIR=$(mktemp -d)

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

cd "$ROOT_DIR"

# 1. 打包
echo "[1/4] 打包..."
TGZ=$(npm pack 2>/dev/null | tail -1)
if [ -z "$TGZ" ]; then
  echo "ERROR: npm pack 失败"
  exit 1
fi
TGZ_PATH="$ROOT_DIR/$TGZ"
echo "  产出: $TGZ"

# 2. 清理旧版全局安装
echo "[2/4] 清理旧版..."
npm uninstall -g auto-cli 2>/dev/null || true

# 3. 解压到临时目录并执行安装
echo "[3/4] 解压并安装..."
tar -xzf "$TGZ_PATH" -C "$TMP_DIR"
cd "$TMP_DIR/package"
node scripts/install.js --clean

# 4. 清理 tgz
echo "[4/4] 清理..."
rm -f "$TGZ_PATH"

echo ""
echo "安装完成。请重启 Claude Code。"
