# Sync Nami RAG corpus (Windows)
Set-Location (Split-Path -Parent $PSScriptRoot)
python -m nami_corpus
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done. Restart Cursor MCP or Hermes gateway to pick up new index."
