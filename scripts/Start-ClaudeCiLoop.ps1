# Launch Claude Code with a prefilled CI fix loop (Lane A).
# Cursor stays default for feature work — see docs/dev/CLAUDE_CODE.md
param(
    [int]$TurnCap = 8,
    [switch]$UseApiKey,
    [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

if ($RepoRoot) {
    $Root = (Resolve-Path $RepoRoot).Path
}
else {
    $Root = Split-Path -Parent $PSScriptRoot
}

Set-Location $Root

function Get-DotEnvValue {
    param([string]$Name, [string]$EnvPath)
    if (-not (Test-Path $EnvPath)) { return $null }
    foreach ($line in Get-Content $EnvPath -ErrorAction SilentlyContinue) {
        if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.+)\s*$") {
            $val = $matches[1].Trim()
            if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length - 2) }
            if ($val.StartsWith("'") -and $val.EndsWith("'")) { $val = $val.Substring(1, $val.Length - 2) }
            return $val
        }
    }
    return $null
}

if ($UseApiKey) {
    if (-not $env:ANTHROPIC_API_KEY) {
        $fromEnv = Get-DotEnvValue -Name "ANTHROPIC_API_KEY" -EnvPath (Join-Path $Root ".env")
        if ($fromEnv) {
            $env:ANTHROPIC_API_KEY = $fromEnv
            Write-Host "Using ANTHROPIC_API_KEY from .env (API billing)." -ForegroundColor Cyan
        }
    }
    if (-not $env:ANTHROPIC_API_KEY) {
        Write-Error "UseApiKey set but ANTHROPIC_API_KEY is missing. Add to .env or set `$env:ANTHROPIC_API_KEY before running."
    }
}
else {
    Write-Host "Using Claude subscription billing (interactive pool)." -ForegroundColor Yellow
    Write-Host "For unattended loops, prefer: .\scripts\Start-ClaudeCiLoop.ps1 -UseApiKey" -ForegroundColor Yellow
}

$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Error @"
claude CLI not found on PATH.
Install Claude Code: https://docs.anthropic.com/en/docs/claude-code
"@
}

$goal = @"
/goal Fix failing tests on this branch. Done = pytest exits 0.
Turn cap: $TurnCap rounds. Read-only on .env. Run pytest after each fix.
Read CLAUDE.md and AGENTS.md first. Do not commit unless Ranne asks.
Run loop-checker format from hermes-nami/skills/loop-checker.md before claiming done.
"@

Write-Host ""
Write-Host "=== Claude Code CI loop (Lane A) ===" -ForegroundColor Cyan
Write-Host "Repo: $Root"
Write-Host "Turn cap: $TurnCap"
Write-Host ""
Write-Host "Goal:" -ForegroundColor Cyan
Write-Host $goal
Write-Host ""

& claude $goal
exit $LASTEXITCODE
