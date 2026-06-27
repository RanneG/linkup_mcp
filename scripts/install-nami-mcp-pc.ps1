# Register linkup_mcp as Hermes MCP server on Windows PC runtime.
param()

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Server = Join-Path $Root "server.py"

if (-not (Test-Path $Python)) {
    Write-Host "Creating venv and installing linkup_mcp..." -ForegroundColor Cyan
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        Push-Location $Root
        uv sync
        Pop-Location
    } else {
        python -m venv (Join-Path $Root ".venv")
        & (Join-Path $Root ".venv\Scripts\pip.exe") install -q -U pip
        & (Join-Path $Root ".venv\Scripts\pip.exe") install -q -e $Root
    }
    $Python = Join-Path $Root ".venv\Scripts\python.exe"
}

if (-not (Test-Path $Python)) {
    Write-Error "Python venv missing at $Python"
}

$envFile = Join-Path $Root ".env"
if (-not $env:LINKUP_API_KEY -and (Test-Path $envFile)) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*LINKUP_API_KEY=(.+)$') {
            $env:LINKUP_API_KEY = $Matches[1].Trim().Trim('"')
        }
    }
}

if (-not $env:LINKUP_API_KEY) {
    Write-Error "LINKUP_API_KEY missing. Add to $envFile"
}

$Hermes = Get-Command hermes -ErrorAction SilentlyContinue
if (-not $Hermes) {
    Write-Error "hermes not on PATH. Run: iex (irm https://hermes-agent.nousresearch.com/install.ps1)"
}

& hermes mcp add linkup --command $Python --args $Server
if ($LASTEXITCODE -ne 0) {
    Write-Host "hermes mcp add failed - check hermes mcp list" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Restart gateway: hermes gateway restart"
Write-Host "Telegram: /reload-mcp then test web search or RAG."
