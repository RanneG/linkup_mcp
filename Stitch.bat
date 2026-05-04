@echo off
REM RECOMMENDED one-click: one native window = built Stitch UI + Flask API + voice (same process).
REM (Tauri dev + separate bridge = Stitch-Desktop.bat)
cd /d "%~dp0"
title Stitch
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-Stitch.ps1" -Mode Bundled %*
if errorlevel 1 pause
