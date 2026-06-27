# Start Nami mobile build bridge + background worker (PC).
param(
    [switch]$NoWorker
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

# Avoid duplicate bridges (stale processes keep old .env without CURSOR_API_KEY).
$listeners = Get-NetTCPConnection -LocalPort 8770 -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
    $listeners | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
        Write-Host "Stopping existing listener on 8770 (PID $_)" -ForegroundColor Yellow
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

if ($NoWorker) {
    $env:NAMI_BUILD_DISABLE_WORKER = "1"
}

if (-not $env:NAMI_BUILD_TOKEN) {
    $envFile = Join-Path $Root ".env"
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^\s*NAMI_BUILD_TOKEN\s*=\s*(.+)\s*$') {
                $env:NAMI_BUILD_TOKEN = $matches[1].Trim().Trim('"').Trim("'")
            }
        }
    }
}

if (-not $env:NAMI_BUILD_TOKEN) {
    Write-Host "WARN: NAMI_BUILD_TOKEN not set - enqueue will reject requests." -ForegroundColor Yellow
    Write-Host "Add NAMI_BUILD_TOKEN to .env - see docs/hermes/MOBILE_BUILD.md"
}

Write-Host "=== Nami build bridge ===" -ForegroundColor Cyan
Write-Host "Docs: docs/hermes/MOBILE_BUILD.md"
Write-Host "Health: http://127.0.0.1:8770/api/build/health"
Write-Host ""

$venvPy = Join-Path $Root ".venv\Scripts\python.exe"
if (Test-Path $venvPy) {
    & $venvPy nami_build_bridge.py
} else {
    python nami_build_bridge.py
}
