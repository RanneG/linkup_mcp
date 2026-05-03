<#
.SYNOPSIS
  Launch Stitch as a Tauri desktop app with the RAG bridge (minimal typing).

.DESCRIPTION
  From the linkup_mcp repo root:
    .\scripts\Start-StitchDesktop.ps1
    .\scripts\Start-StitchDesktop.ps1 -SkipBridge   # bridge already running on 8765

  Double-click: use Stitch-Desktop.bat in the repo root (calls this script).

  Requires: temp_repo/stitch clone, Python venv or python on PATH, Node/npm, Rust + Tauri prerequisites.
#>

param(
  [switch]$SkipBridge
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  $candidates = @(
    (Split-Path -Parent $PSScriptRoot),
    (Join-Path $PSScriptRoot "..")
  )
  foreach ($c in $candidates) {
    if ([string]::IsNullOrWhiteSpace($c)) { continue }
    try {
      $full = (Resolve-Path -LiteralPath $c).Path
    } catch {
      continue
    }
    if (Test-Path -LiteralPath (Join-Path $full "pyproject.toml")) {
      return $full
    }
  }
  return $null
}

function Get-BridgePythonExe {
  param([Parameter(Mandatory)][string]$Root)
  $paths = @(
    (Join-Path $Root ".venv\Scripts\python.exe"),
    (Join-Path $Root "venv\Scripts\python.exe")
  )
  foreach ($rel in $paths) {
    if ([string]::IsNullOrWhiteSpace($rel)) { continue }
    if (Test-Path -LiteralPath $rel) {
      return (Resolve-Path -LiteralPath $rel).Path
    }
  }
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -and (Test-Path -LiteralPath $cmd.Source)) {
    return $cmd.Source
  }
  return $null
}

$repoRoot = Resolve-RepoRoot
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "Could not find repo root (pyproject.toml). Run from cursor_linkup_mcp clone; PSScriptRoot=$PSScriptRoot"
}

$desktopPkg = Join-Path $repoRoot "temp_repo\stitch\apps\desktop\package.json"
if (-not (Test-Path -LiteralPath $desktopPkg)) {
  throw "Stitch desktop not found: $desktopPkg - clone Stitch under temp_repo\stitch (see AGENTS.md)."
}

$venvPy = Get-BridgePythonExe -Root $repoRoot
if ([string]::IsNullOrWhiteSpace($venvPy)) {
  throw "Could not find Python. Create a venv at repo root (e.g. uv venv or python -m venv .venv) so .venv\Scripts\python.exe exists, or install Python on PATH. Repo: $repoRoot"
}

if (-not $SkipBridge) {
  Write-Host "Starting stitch_rag_bridge.py (minimized window)..."
  Write-Host "  Python: $venvPy"
  Start-Process -FilePath $venvPy -ArgumentList @("stitch_rag_bridge.py") -WorkingDirectory $repoRoot -WindowStyle Minimized
  Start-Sleep -Seconds 2
}

Write-Host "Syncing integrations/stitch -> temp_repo desktop..."
Push-Location $repoRoot
try {
  & (Join-Path $repoRoot "scripts\sync-integrations-stitch-to-desktop.ps1")
} finally {
  Pop-Location
}

Write-Host "Starting Tauri desktop (npm run dev in apps/desktop)..."
Push-Location (Join-Path $repoRoot "temp_repo\stitch\apps\desktop")
try {
  & npm run dev
} finally {
  Pop-Location
}
