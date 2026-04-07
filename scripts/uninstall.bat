@echo off
chcp 65001 >nul 2>&1
:: Auto CLI 卸载脚本 (Windows)
:: 用法：双击此文件

cd /d "%~dp0\.."

echo.
echo Auto CLI 卸载
echo.

node scripts/uninstall.js

echo.
pause
