# Hermes launcher — runtime Nami on Windows PC (see docs/hermes/PC_SETUP.md).
$HermesExe = Join-Path $env:LOCALAPPDATA "hermes\hermes-agent\.venv\Scripts\hermes.exe"

# Hermes installer may use venv\Scripts or hermes-agent subpaths — try PATH first.
$HermesCmd = Get-Command hermes -ErrorAction SilentlyContinue
if ($HermesCmd) {
    & hermes @args
    exit $LASTEXITCODE
}

if (Test-Path $HermesExe) {
    & $HermesExe @args
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Hermes is not installed on this PC." -ForegroundColor Yellow
Write-Host "  Install:  iex (irm https://hermes-agent.nousresearch.com/install.ps1)"
Write-Host "  Setup:    docs/hermes/PC_SETUP.md"
Write-Host "  VPS later: docs/hermes/VPS_MIGRATION.md"
Write-Host "  Build:    Cursor chat + linkup_mcp MCP"
Write-Host ""
exit 1
