# One-time PC setup for mobile build bridge.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Nami mobile build setup (PC) ===" -ForegroundColor Cyan

if (-not (Test-Path ".venv")) {
    Write-Host "Creating .venv ..."
    python -m venv .venv
}

Write-Host "Installing nami-build extra ..."
& .\.venv\Scripts\pip install -e ".[nami-build]"

Write-Host ""
Write-Host "Install Cursor Agent CLI (Windows — required for build execution):" -ForegroundColor Cyan
Write-Host "  irm 'https://cursor.com/install?win32=true' | iex"
Write-Host "  agent --version"

if (-not (Test-Path ".env")) {
    Write-Host "WARN: No .env - copy from ENV_TEMPLATE.md" -ForegroundColor Yellow
}

$token = $null
if (Test-Path ".env") {
    foreach ($line in Get-Content ".env") {
        if ($line -match '^\s*NAMI_BUILD_TOKEN\s*=\s*(\S+)') {
            $token = $matches[1]
            break
        }
    }
}

if (-not $token) {
    $token = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    Add-Content -Path ".env" -Value "`nNAMI_BUILD_TOKEN=$token"
    Write-Host "Added NAMI_BUILD_TOKEN to .env"
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Add CURSOR_API_KEY to .env from https://cursor.com/dashboard/integrations"
Write-Host "2. Copy NAMI_BUILD_TOKEN to Mac ~/.hermes/.env (see docs/hermes/MOBILE_BUILD_MAC.env.example)"
Write-Host "3. Start bridge: .\Nami-Build-Bridge.bat  (uses .venv if present)"
Write-Host "4. Test: .\scripts\Test-NamiBuildEnqueue.ps1"
