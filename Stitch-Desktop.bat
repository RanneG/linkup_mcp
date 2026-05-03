@echo off
setlocal
cd /d "%~dp0"
title Stitch desktop launcher
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-StitchDesktop.ps1" %*
if errorlevel 1 pause
