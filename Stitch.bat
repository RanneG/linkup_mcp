@echo off
REM One double-click: venv (if needed), Python deps, Stitch web build, then pywebview + Flask.
cd /d "%~dp0"
title Stitch
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-StitchBundledGui.ps1" %*
if errorlevel 1 pause
