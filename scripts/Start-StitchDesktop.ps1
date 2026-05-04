<#
.SYNOPSIS
  Launch Stitch as a Tauri desktop app with the RAG bridge (minimal typing).

.DESCRIPTION
  From the linkup_mcp repo root:
    .\scripts\Start-StitchDesktop.ps1
    .\scripts\Start-StitchDesktop.ps1 -SkipBridge   # bridge already running on 8765

  Double-click: use Stitch-Desktop.bat in the repo root (calls this script).

  Requires: **stitch-app** (sibling `../stitch-app` or **STITCH_APP_ROOT**); Python venv or python on PATH; Node/npm; Rust + Tauri prerequisites.
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
  throw "Could not find repo root (pyproject.toml). Run from linkup_mcp clone; PSScriptRoot=$PSScriptRoot"
}

. (Join-Path $PSScriptRoot "StitchPaths.ps1")
$desktop = Get-StitchAppsDesktopDir -RepoRoot $repoRoot
if ([string]::IsNullOrWhiteSpace($desktop)) {
  throw "Stitch apps/desktop not found. Clone https://github.com/RanneG/stitch-app next to linkup_mcp (sibling folder) or set STITCH_APP_ROOT (see docs/stitch/MIGRATION.md)."
}

$venvPy = Get-BridgePythonExe -Root $repoRoot
if ([string]::IsNullOrWhiteSpace($venvPy)) {
  throw "Could not find Python. Create a venv at repo root (e.g. uv venv or python -m venv .venv) so .venv\Scripts\python.exe exists, or install Python on PATH. Repo: $repoRoot"
}

if (-not $SkipBridge) {
  Write-Host "Starting stitch_rag_bridge.py (minimized window)..."
  Write-Host "  Python: $venvPy"
  Start-Process -FilePath $venvPy -ArgumentList @("stitch_rag_bridge.py") -WorkingDirectory $repoRoot -WindowStyle Minimized

  $deadline = (Get-Date).AddSeconds(45)
  $ready = $false
  while ((Get-Date) -lt $deadline) {
    try {
      $h = Invoke-RestMethod -Uri "http://127.0.0.1:8765/api/health" -TimeoutSec 2
      if ($h.ok) {
        $ready = $true
        $vs = $h.voice_stt
        if ($vs) {
          Write-Host "  Bridge OK (voice_stt: $($vs | ConvertTo-Json -Compress))" -ForegroundColor Green
        } else {
          Write-Host "  Bridge OK" -ForegroundColor Green
        }
        break
      }
    } catch {
      # still starting
    }
    Start-Sleep -Milliseconds 400
  }
  if (-not $ready) {
    Write-Warning "Bridge did not answer on http://127.0.0.1:8765/api/health in time. Check the minimized Python window for errors; Tauri may show API failures until the bridge is up."
  }
}

Write-Host "Starting Tauri desktop (npm run dev in apps/desktop)..."
Push-Location $desktop
try {
  & npm run dev
} finally {
  Pop-Location
}
