# MCP install is Mac-only (Hermes runtime host). WSL/bash on Windows is not supported.
Write-Host ""
Write-Host "install-nami-mcp-mac.sh runs on the MacBook only." -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. SSH:  ssh rannegerodias@Rannes-MacBook-Air.local"
Write-Host "  2. Run:  cd ~/Cursor/linkup_mcp && git pull"
Write-Host "  3. Run:  bash scripts/install-nami-mcp-mac.sh"
Write-Host ""
Write-Host "  Ensure LINKUP_API_KEY is in ~/Cursor/linkup_mcp/.env on the Mac."
Write-Host "  See docs/hermes/NAMI.md"
Write-Host ""
exit 1
