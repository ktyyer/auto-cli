#!/usr/bin/env bash
# Auto CLI 一键重装脚本
# 按文件归属同步当前源码；备份冲突，移除未修改的旧资源。
#
# 用法：
#   bash scripts/reinstall.sh
# 隔离安装目录使用 AUTO_CLI_INSTALL_HOME，与 install.js 保持一致。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/install.js" --clean "$@"
