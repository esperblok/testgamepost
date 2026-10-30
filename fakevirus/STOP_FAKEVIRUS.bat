@echo off
setlocal
title FAKEVIRUS - Stopping
chcp 65001 >nul 2>nul
cd /d "%~dp0"

echo.
echo   Stopping every fake virus process...
echo.

where node >nul 2>nul
if not errorlevel 1 node "%~dp0app.js" --stop

powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*fakevirus*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo   Done. Nothing was ever on your computer.
echo   Je pc is netjes. Er was niks, er is niks.
echo.
timeout /t 3 >nul
