# Register weekday 07:30 daily brief cron on Windows PC Hermes.
param(
    [string]$TelegramUserId = "8098932781",
    [string]$Schedule = "every weekday at 07:30",
    [string]$JobName = "nami-daily-brief"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command hermes -ErrorAction SilentlyContinue)) {
    Write-Error "hermes not on PATH. Open a new terminal after install."
}

Write-Host "=== Sync Nami skills ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "install-nami-hermes.ps1")

Write-Host ""
Write-Host "=== Home channel ===" -ForegroundColor Cyan
& hermes config set TELEGRAM_HOME_CHANNEL $TelegramUserId
Write-Host "TELEGRAM_HOME_CHANNEL=$TelegramUserId"

$prompt = @"
Run daily-brief-loop skill exactly: 3 bullets (Build, Products, This week), read-only.
Use /loop-checker before sending. Turn cap 8. Append LOOP_LOG.md on PASS or FAIL.
Skip web_search unless USER.md says otherwise.
"@

Write-Host ""
Write-Host "=== Cron job: $JobName ===" -ForegroundColor Cyan
$existing = & hermes cron list 2>&1 | Out-String
if ($existing -match $JobName) {
    Write-Host "Job '$JobName' already exists. Edit with: hermes cron edit $JobName --schedule `"$Schedule`"" -ForegroundColor Yellow
} else {
    & hermes cron create $Schedule $prompt `
        --skill brief `
        --skill loop-checker `
        --name $JobName `
        --deliver "telegram:$TelegramUserId"
}

Write-Host ""
Write-Host "=== Test now ===" -ForegroundColor Cyan
Write-Host "  hermes cron run $JobName"
Write-Host "  Or Telegram: /brief"
Write-Host ""
Write-Host "Docs: docs/hermes/DAILY_BRIEF.md"
