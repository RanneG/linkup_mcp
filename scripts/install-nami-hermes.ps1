# Copy Nami SOUL/AGENTS + skills into %LOCALAPPDATA%\hermes (Windows PC runtime).
param(
    [string]$SupplyRoot = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $SupplyRoot) {
    $SupplyRoot = Join-Path (Split-Path -Parent $Root) "supplyme-crew"
}

$HermesHome = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:LOCALAPPDATA "hermes" }
$SkillsDir = Join-Path $HermesHome "skills"
$MemDir = Join-Path $HermesHome "memories"

New-Item -ItemType Directory -Force -Path $SkillsDir, $MemDir | Out-Null

Copy-Item (Join-Path $Root "hermes-nami\SOUL.md") (Join-Path $HermesHome "SOUL.md") -Force
Copy-Item (Join-Path $Root "hermes-nami\AGENTS.md") (Join-Path $HermesHome "AGENTS.md") -Force

$skills = @(
    "linkup-mcp.md", "model-routing.md", "loop-checker.md",
    "daily-brief-loop.md", "mobile-build-request.md"
)
foreach ($skill in $skills) {
    $src = Join-Path $Root "hermes-nami\skills\$skill"
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $SkillsDir $skill) -Force
    }
}

$userMd = Join-Path $MemDir "USER.md"
$memoryMd = Join-Path $MemDir "MEMORY.md"
if (-not (Test-Path $userMd)) {
    Copy-Item (Join-Path $Root "hermes-nami\memories\USER.md") $userMd
}
if (-not (Test-Path $memoryMd)) {
    Copy-Item (Join-Path $Root "hermes-nami\memories\MEMORY.md") $memoryMd
}

$weekly = Join-Path $SupplyRoot "skills\weekly-focus.md"
if (Test-Path $weekly) {
    Copy-Item $weekly (Join-Path $SkillsDir "weekly-focus.md") -Force
} else {
    Write-Host "Note: supplyme-crew not at $SupplyRoot — skipped weekly-focus" -ForegroundColor Yellow
}

Write-Host "Installed Nami files to $HermesHome"

$venvPy = Join-Path $Root ".venv\Scripts\python.exe"
if (Test-Path $venvPy) {
    & $venvPy -m nami_corpus.sync
} else {
    Write-Host "No .venv — run uv sync or pip install -e . first for RAG corpus sync" -ForegroundColor Yellow
}
