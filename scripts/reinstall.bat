@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: Auto CLI 一键重装脚本 (Windows)
:: 打包 → 清理旧版 → 解压安装新版
::
:: 用法：双击运行或在仓库根目录执行 scripts\reinstall.bat

echo.
echo ================================
echo   Auto CLI 一键重装
echo ================================
echo.

:: 1. 打包
echo [1/4] 打包...
for /f "delims=" %%i in ('npm pack 2^>nul') do set TGZ=%%i
if "%TGZ%"=="" (
    echo ERROR: npm pack 失败
    exit /b 1
)
echo   产出: %TGZ%

:: 2. 清理旧版全局安装
echo [2/4] 清理旧版...
call npm uninstall -g auto-cli >nul 2>&1

:: 3. 解压并安装
echo [3/4] 解压并安装...
:: 创建临时目录
set "TMPDIR=%TEMP%\auto-cli-reinstall-%RANDOM%"
mkdir "%TMPDIR%"

:: 解压（用 node 内置能力）
node -e "const{execSync}=require('child_process');const fs=require('fs');const path=require('path');const tgz=process.argv[1];const tmp=process.argv[2];execSync('tar -xzf '+tgz+' -C '+tmp,{stdio:'inherit'});const pkgDir=fs.readdirSync(tmp).find(d=>d.startsWith('package'));if(pkgDir){process.chdir(path.join(tmp,pkgDir));execSync('node scripts/install.js --clean',{stdio:'inherit'});}" "%TGZ%" "%TMPDIR%"

:: 4. 清理
echo [4/4] 清理...
del /f /q "%TGZ%" 2>nul
rmdir /s /q "%TMPDIR%" 2>nul

echo.
echo 安装完成。请重启 Claude Code。
pause
