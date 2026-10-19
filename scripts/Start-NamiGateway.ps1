# Start Nami (default Hermes profile) Telegram gateway on Windows PC.
param()

$ErrorActionPreference = "Stop"

$Hermes = Get-Command hermes -ErrorAction SilentlyContinue
if (-not $Hermes) {
    Write-Host ""
    Write-Host "Hermes not installed." -ForegroundColor Yellow
    Write-Host "  Install: iex (irm https://hermes-agent.nousresearch.com/install.ps1)"
    Write-Host "  Docs:    docs/hermes/PC_SETUP.md"
    Write-Host ""
    exit 1
}

Write-Host "=== Nami (default profile) ===" -ForegroundColor Cyan
& hermes profile list 2>$null | Select-Object -First 5

$status = & hermes gateway status 2>&1 | Out-String
# "Gateway is not running" contains "running". Only skip start when status
# reports running and is not the stopped message.
$stopped = $status -match '(?i)not\s+running'
$mentionsRunning = $status -match '(?i)running'
if (-not $stopped -and $mentionsRunning) {
    Write-Host "Gateway already running."
    exit 0
}

& hermes gateway stop 2>$null
Start-Sleep -Seconds 1
& hermes gateway start
Write-Host ""
Write-Host "Test: message your Nami bot on Telegram."
