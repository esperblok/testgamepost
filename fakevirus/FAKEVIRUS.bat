@echo off
setlocal enableextensions
title FAKEVIRUS - System Check
chcp 65001 >nul 2>nul
cd /d "%~dp0"

echo.
echo   ============================================
echo     FAKEVIRUS - SYSTEM CHECK
echo     everything below is simulated. nothing happens.
echo   ============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :nonode

node app.js %*
set "RC=%ERRORLEVEL%"

echo.
echo   [*] FAKEVIRUS is gestopt, uitvoering: %RC%
echo   Je computer is ongerept, zoals altijd.
echo.
if not "%RC%"=="0" pause
exit /b %RC%

:nonode
echo   [X] Node.js is niet gevonden op dit systeem.
echo.
echo   Installeer Node.js van https://nodejs.org en klik opnieuw,
echo   of volg de stappen in de README.md van deze folder.
echo.
pause
exit /b 1
