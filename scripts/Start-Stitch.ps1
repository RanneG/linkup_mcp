<#
.SYNOPSIS
  Single entry point: open Stitch with the API in one workflow (pick a mode).

.DESCRIPTION
  - Bundled (default): one native window - built Vite UI + Flask (stitch_gui.py). Same process = UI + RAG + voice STT. Double-click Stitch.bat.
  - TauriDev: Tauri dev shell + separate minimized bridge on 8765. Double-click Stitch-Desktop.bat.

  Why two modes: bundled is closest to one EXE later; Tauri dev is for Rust/WebView iteration.

  From repo root:
    .\scripts\Start-Stitch.ps1
    .\scripts\Start-Stitch.ps1 -Mode TauriDev
    .\scripts\Start-Stitch.ps1 -Mode Bundled -SkipBuild
    .\scripts\Start-Stitch.ps1 -Mode TauriDev -SkipBridge
#>

param(
  [ValidateSet("Bundled", "TauriDev")]
  [string]$Mode = "Bundled",
  [switch]$SkipBuild,
  [switch]$SkipBridge
)

$ErrorActionPreference = "Stop"

$bundled = Join-Path $PSScriptRoot "Start-StitchBundledGui.ps1"
$tauri = Join-Path $PSScriptRoot "Start-StitchDesktop.ps1"

Write-Host ""
Write-Host "=== Stitch launcher ($Mode) ===" -ForegroundColor Cyan
if ($Mode -eq "Bundled") {
  Write-Host "One window: built web UI + Flask API on http://127.0.0.1:8765. Closing the window stops everything." -ForegroundColor DarkGray
} else {
  Write-Host "Tauri dev window + Flask bridge (minimized). Closing the Tauri terminal stops the UI; the bridge may keep running until you close its window." -ForegroundColor DarkGray
}
Write-Host ""

if ($Mode -eq "Bundled") {
  if ($SkipBridge) {
    Write-Warning '-SkipBridge applies to TauriDev only; ignored for Bundled.'
  }
  if ($SkipBuild) {
    & $bundled -SkipBuild
  } else {
    & $bundled
  }
} else {
  if ($SkipBuild) {
    Write-Warning '-SkipBuild applies to Bundled only; ignored for TauriDev.'
  }
  if ($SkipBridge) {
    & $tauri -SkipBridge
  } else {
    & $tauri
  }
}
