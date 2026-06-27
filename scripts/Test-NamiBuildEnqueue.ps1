# Smoke-test mobile build bridge enqueue + poll.
param(
    [string]$Task = "Add a one-line module docstring note that jobs live under data/build-queue/.",
    [int]$TurnCap = 5,
    [int]$PollSeconds = 10,
    [int]$MaxPolls = 60
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-DotEnvValue {
    param([string]$Name)
    $path = Join-Path $Root ".env"
    if (-not (Test-Path $path)) { return $null }
    foreach ($line in Get-Content $path) {
        if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.*)\s*$") {
            $val = $matches[1].Trim().Trim('"').Trim("'")
            return $val
        }
    }
    return $null
}

$token = $env:NAMI_BUILD_TOKEN
if (-not $token) { $token = Get-DotEnvValue "NAMI_BUILD_TOKEN" }
$port = $env:NAMI_BUILD_PORT
if (-not $port) { $port = Get-DotEnvValue "NAMI_BUILD_PORT" }
if (-not $port) { $port = "8770" }
$base = "http://127.0.0.1:$port"

if (-not $token) {
    Write-Error "NAMI_BUILD_TOKEN missing in .env"
}

Write-Host "Health check $base/api/build/health" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$base/api/build/health" -Method Get
$health | ConvertTo-Json -Depth 4

if (-not $health.cursor_api_key_set) {
    Write-Host ""
    Write-Host "WARN: CURSOR_API_KEY empty - jobs will enqueue but agent step will fail." -ForegroundColor Yellow
    Write-Host "Add key from https://cursor.com/dashboard/integrations to .env then restart bridge."
}

Write-Host ""
Write-Host "Enqueue test job..." -ForegroundColor Cyan
$body = @{
    task     = $Task
    source   = "pc-smoke-test"
    repo     = "linkup_mcp"
    turn_cap = $TurnCap
} | ConvertTo-Json

$created = Invoke-RestMethod -Method Post -Uri "$base/api/build/enqueue" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $body

$jobId = $created.job.id
Write-Host "Job id: $jobId status: $($created.job.status)"

for ($i = 0; $i -lt $MaxPolls; $i++) {
    Start-Sleep -Seconds $PollSeconds
    $status = Invoke-RestMethod -Uri "$base/api/build/jobs/$jobId" `
        -Headers @{ Authorization = "Bearer $token" }
    $s = $status.job.status
    Write-Host "[$i] status=$s"
    if ($s -in @("completed", "failed")) {
        Write-Host ""
        $status.job | ConvertTo-Json -Depth 4
        if ($s -eq "completed") {
            Write-Host "Review diff in Cursor on branch: $($status.job.branch)" -ForegroundColor Green
        }
        exit 0
    }
}

Write-Host "Timed out waiting for job - check bridge logs." -ForegroundColor Yellow
exit 1
