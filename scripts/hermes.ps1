# Hermes launcher — runtime Nami hosts on Mac only (see docs/hermes/MAC_SETUP.md).
$HermesExe = Join-Path $env:LOCALAPPDATA "hermes\hermes-agent\.venv\Scripts\hermes.exe"

if (-not (Test-Path $HermesExe)) {
    Write-Host ""
    Write-Host "Hermes is not installed on this PC (by design)." -ForegroundColor Yellow
    Write-Host "  Runtime Nami -> MacBook:  docs/hermes/MAC_SETUP.md"
    Write-Host "  Use from Windows:         docs/hermes/PC_CLIENT.md  (Telegram or SSH)"
    Write-Host "  Build in Cursor:          stay in this chat + linkup_mcp MCP"
    Write-Host ""
    exit 1
}

& $HermesExe @args
