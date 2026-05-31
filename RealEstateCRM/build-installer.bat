@echo off
REM =====================================================================
REM Hashmi Real Estate Builders - Production Installer Build Script
REM
REM RIGHT-CLICK this file and choose "Run as administrator".
REM Admin rights are required only to create the macOS symlinks inside
REM the electron-builder winCodeSign cache. They do NOT affect the
REM final installer or end users in any way.
REM =====================================================================

setlocal

REM --- Auto-elevate to Administrator if not already ----------------------
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  echo Requesting Administrator privileges via UAC prompt...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

cd /d "%~dp0"
title Hashmi Real Estate Builders - Installer Build

echo.
echo === [1/3] Building frontend (React) ===
call npm --prefix frontend run build
if %errorlevel% NEQ 0 goto :fail

echo.
echo === [2/3] Building backend (TypeScript) ===
call npm --prefix backend run build
if %errorlevel% NEQ 0 goto :fail

echo.
echo === [3/3] Packaging Setup.exe and Portable.exe ===
call npx electron-builder --win nsis portable --x64
if %errorlevel% NEQ 0 goto :fail

echo.
echo =====================================================================
echo  Build complete. Output is in the "dist" folder:
echo    - Hashmi Real Estate Builders-1.0.0-Setup.exe   (NSIS installer wizard)
echo    - Hashmi Real Estate Builders-1.0.0-Portable.exe (single-file portable)
echo =====================================================================
echo.
pause
exit /b 0

:fail
echo.
echo  [X] Build failed. See log above.
echo.
pause
exit /b 1
