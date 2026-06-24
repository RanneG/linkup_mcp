# Refresh Nami stack on Windows PC (build-time Nami + RAG corpus).
param(
    [string]$MacHost = "rannes-macbook-air.local",
    [string]$MacUser = "ranne",
    [switch]$SkipMac
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== 1/3 Sync RAG corpus ===" -ForegroundColor Cyan
python -m nami_corpus
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== 2/3 RAG smoke eval (needs Ollama + llama3.2) ===" -ForegroundColor Cyan
python scripts/nami_rag_eval.py
$evalExit = $LASTEXITCODE
if ($evalExit -ne 0) {
    Write-Host "WARN: RAG eval incomplete - corpus is synced; restart MCP anyway." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 3/3 Cursor MCP ===" -ForegroundColor Cyan
Write-Host "Toggle MCP to reload the index:"
Write-Host "  Cursor -> Settings -> MCP -> linkup-server -> Restart"
Write-Host ""
Write-Host "Test: rag_status tool, then rag - Stitch bridge port?"

if (-not $SkipMac) {
    Write-Host ""
    Write-Host "=== Mac (runtime Nami) ===" -ForegroundColor Cyan
    $reachable = $false
    try {
        ssh -o BatchMode=yes -o ConnectTimeout=8 "${MacUser}@${MacHost}" "echo ok" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $reachable = $true }
    }
    catch {
        $reachable = $false
    }
    if ($reachable) {
        Write-Host "Mac reachable - running install-nami-stack-mac.sh ..."
        $cmd = 'cd ~/Cursor/linkup_mcp; git pull; bash scripts/install-nami-stack-mac.sh; hermes gateway restart'
        ssh "${MacUser}@${MacHost}" $cmd
    }
    else {
        Write-Host "Mac not reachable ($MacHost). On the Mac, run:" -ForegroundColor Yellow
        Write-Host '  cd ~/Cursor/linkup_mcp; git pull; bash scripts/install-nami-stack-mac.sh; hermes gateway restart'
    }
}

exit 0
