@echo off
REM Free common local dev ports for this repo (8765 bridge/gui, 1420 Tauri, 5173 Vite).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Close-StitchDevPorts.ps1" %*
if errorlevel 1 pause
