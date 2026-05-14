@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo ========================================
echo   Auto CLI - TGZ Installer
echo ========================================
echo.

set "SCRIPT_DIR=%~dp0"
set "TMPDIR=%TEMP%\auto-cli-install"
set "TGZ="

where tar >nul 2>&1
if errorlevel 1 (
    echo [ERROR] tar was not found. Please use a system with tar support.
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] node was not found. Please install Node.js first.
    exit /b 1
)

for /f "delims=" %%F in ('dir /b /a:-d /o-d "%SCRIPT_DIR%auto-cli-*.tgz" 2^>nul') do (
    if not defined TGZ set "TGZ=%SCRIPT_DIR%%%F"
)

if not defined TGZ (
    echo [ERROR] No auto-cli-*.tgz package was found in:
    echo %SCRIPT_DIR%
    exit /b 1
)

echo [INFO] Using package: %TGZ%

echo [1/4] Uninstalling previous version...
node "%SCRIPT_DIR%scripts\uninstall.js"
if errorlevel 1 (
    echo [ERROR] Failed to uninstall the previous version.
    exit /b 1
)

echo [2/4] Extracting package...
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
mkdir "%TMPDIR%"
tar -xzf "%TGZ%" -C "%TMPDIR%"
if errorlevel 1 (
    echo [ERROR] Failed to extract the package.
    if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
    exit /b 1
)

echo [3/4] Installing new version...
node "%TMPDIR%\package\scripts\install.js" --clean
if errorlevel 1 (
    echo [ERROR] Failed to install the new version.
    if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
    exit /b 1
)

echo [4/4] Cleaning temporary files...
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"

echo.
echo ========================================
echo   Installation completed successfully
echo ========================================
exit /b 0
