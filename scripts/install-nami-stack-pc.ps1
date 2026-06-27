# One-shot Nami stack on Windows PC: personality, RAG corpus, MCP, verify.
param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "=== 1/4 Personality + skills ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "install-nami-hermes.ps1")

Write-Host ""
Write-Host "=== 2/4 linkup MCP ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "install-nami-mcp-pc.ps1")

Write-Host ""
Write-Host "=== 3/4 Verify ===" -ForegroundColor Cyan
$checks = @()

if (Get-Command hermes -ErrorAction SilentlyContinue) { $checks += "OK  hermes on PATH" }
else { $checks += "FAIL hermes not found" }

$hermesHome = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:LOCALAPPDATA "hermes" }
if (Test-Path (Join-Path $hermesHome "SOUL.md")) { $checks += "OK  SOUL.md" }
else { $checks += "WARN SOUL.md missing" }

$venvPy = Join-Path $Root ".venv\Scripts\python.exe"
if (Test-Path $venvPy) { $checks += "OK  linkup_mcp venv" }
else { $checks += "WARN no .venv" }

$corpus = Join-Path $Root "data\nami-corpus"
if (Test-Path $corpus) { $checks += "OK  RAG corpus dir" }
else { $checks += "WARN RAG corpus — run nami_corpus.sync" }

$checks | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "=== 4/4 Next steps ===" -ForegroundColor Cyan
Write-Host "  hermes gateway setup    # first time"
Write-Host "  .\scripts\Start-NamiGateway.ps1"
Write-Host "  Optional build bridge: .\scripts\Start-NamiBuildBridge.ps1"
