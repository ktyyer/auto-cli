@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "PACKAGE="
set "NPM_PREFIX="
set "NPM_ROOT="
set "CLAUDE_COMMANDS_DIR=%USERPROFILE%\.claude\commands"

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  exit /b 1
)

for /f "delims=" %%F in ('dir /b /a:-d /o-d "%SCRIPT_DIR%auto-cli-*.tgz" 2^>nul') do (
  if not defined PACKAGE set "PACKAGE=%%F"
)

if not defined PACKAGE (
  echo [ERROR] No auto-cli-*.tgz package was found in:
  echo %SCRIPT_DIR%
  exit /b 1
)

set "PACKAGE_PATH=%SCRIPT_DIR%%PACKAGE%"

echo [INFO] Package selected by modified time: %PACKAGE%
echo [INFO] Checking existing global installation...

for /f "delims=" %%P in ('call npm prefix -g 2^>nul') do (
  if not defined NPM_PREFIX set "NPM_PREFIX=%%P"
)

if not defined NPM_PREFIX (
  echo [ERROR] Failed to determine the global npm prefix.
  exit /b 1
)

for /f "delims=" %%R in ('call npm root -g 2^>nul') do (
  if not defined NPM_ROOT set "NPM_ROOT=%%R"
)

if not defined NPM_ROOT (
  echo [ERROR] Failed to determine the global npm node_modules path.
  exit /b 1
)

if exist "%NPM_ROOT%\auto-cli" (
  echo [INFO] Existing auto-cli detected. Removing previously installed Claude resources...
  if exist "%NPM_PREFIX%\auto.cmd" (
    call "%NPM_PREFIX%\auto.cmd" uninstall -y
    if errorlevel 1 (
      echo [ERROR] Failed to uninstall previously installed Claude resources.
      exit /b 1
    )
  ) else (
    where auto >nul 2>&1
    if not errorlevel 1 (
      call auto uninstall -y
      if errorlevel 1 (
        echo [ERROR] Failed to uninstall previously installed Claude resources.
        exit /b 1
      )
    ) else (
      echo [WARN] Existing auto-cli package found, but auto command is unavailable.
      echo [INFO] Removing deterministic legacy /auto namespace paths directly...
      call :remove_if_exists "%CLAUDE_COMMANDS_DIR%\auto\auto.md"
      call :remove_dir_if_exists "%CLAUDE_COMMANDS_DIR%\auto\auto"
    )
  )

  echo [INFO] Removing old global auto-cli package...
  call npm uninstall -g auto-cli
  if errorlevel 1 (
    echo [ERROR] Failed to uninstall the existing auto-cli package.
    exit /b 1
  )
) else (
  echo [INFO] No existing auto-cli installation found.
)

echo [INFO] Installing %PACKAGE%...
call npm install -g "%PACKAGE_PATH%"
if errorlevel 1 (
  echo [ERROR] Failed to install %PACKAGE%.
  exit /b 1
)

if exist "%NPM_PREFIX%\auto.cmd" (
  echo [INFO] Running auto install -y -f...
  call "%NPM_PREFIX%\auto.cmd" install -y -f
  if errorlevel 1 (
    echo [ERROR] auto install -y -f failed.
    exit /b 1
  )

  call "%NPM_PREFIX%\auto.cmd" --version
  if errorlevel 1 (
    echo [ERROR] Failed to verify the installed auto-cli version.
    exit /b 1
  )

  echo [INFO] Installation completed successfully.
  exit /b 0
)

where auto >nul 2>&1
if errorlevel 1 (
  echo [WARN] auto.cmd was not found after installation.
  echo [WARN] Run this manually in a new terminal:
  echo        auto install -y -f
  exit /b 1
)

echo [INFO] Running auto install -y -f...
call auto install -y -f
if errorlevel 1 (
  echo [ERROR] auto install -y -f failed.
  exit /b 1
)

call auto --version
if errorlevel 1 (
  echo [ERROR] Failed to verify the installed auto-cli version.
  exit /b 1
)

echo [INFO] Installation completed successfully.

exit /b 0

:remove_if_exists
if exist "%~1" del /f /q "%~1" >nul 2>&1
exit /b 0

:remove_dir_if_exists
if exist "%~1" rmdir /s /q "%~1" >nul 2>&1
exit /b 0
