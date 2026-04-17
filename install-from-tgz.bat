@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   Auto CLI v0.31.0 - 安装脚本
echo ========================================
echo.

set "TGZ=%~dp0auto-cli-0.31.0.tgz"
set "TMPDIR=%TEMP%\auto-cli-install"

if not exist "%TGZ%" (
    echo [错误] 找不到 %TGZ%
    pause
    exit /b 1
)

echo [1/4] 清理旧版...
if exist "%USERPROFILE%\.claude\commands\auto.md" (
    node "%~dp0package\scripts\uninstall.js" 2>nul
    if errorlevel 1 (
        node "%TMPDIR%\package\scripts\uninstall.js" 2>nul
    )
)

echo [2/4] 解压安装包...
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
mkdir "%TMPDIR%"
tar -xzf "%TGZ%" -C "%TMPDIR%"

echo [3/4] 安装...
node "%TMPDIR%\package\scripts\install.js" --clean

echo [4/4] 清理临时文件...
rmdir /s /q "%TMPDIR%"

echo.
echo ========================================
echo   安装完成！重启 Claude Code 生效
echo ========================================
pause
