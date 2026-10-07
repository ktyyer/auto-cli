@echo off
setlocal
rem Reconcile the current source through the same ownership and isolation checks.
node "%~dp0install.js" --clean %*
exit /b %errorlevel%
