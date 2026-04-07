@echo off
chcp 65001 >nul 2>&1
:: Auto CLI 安装脚本 (Windows)
:: 将本文件所在目录下的 commands/agents/skills/hooks 复制到 ~/.claude/
:: 用法：双击此文件，或在任意目录执行 scripts\install.bat

:: 定位到脚本所在目录（支持从 tgz 解压后运行）
cd /d "%~dp0\.."

echo.
echo Auto CLI 安装
echo.

node scripts/install.js --clean

echo.
pause
