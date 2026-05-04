@echo off
setlocal
cd /d "%~dp0"
title Stitch Tauri + bridge
REM Dev: Tauri window + minimized Python bridge (two processes). For a single window use Stitch.bat instead.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-Stitch.ps1" -Mode TauriDev %*
if errorlevel 1 pause
