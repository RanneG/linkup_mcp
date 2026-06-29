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
$NamiSkillsSrc = Join-Path $Root "hermes-nami\skills"

New-Item -ItemType Directory -Force -Path $SkillsDir, $MemDir | Out-Null

Copy-Item (Join-Path $Root "hermes-nami\SOUL.md") (Join-Path $HermesHome "SOUL.md") -Force
Copy-Item (Join-Path $Root "hermes-nami\AGENTS.md") (Join-Path $HermesHome "AGENTS.md") -Force

$skillNames = @("brief", "loop-checker", "linkup-mcp", "mobile-build-request", "model-routing")
foreach ($skill in $skillNames) {
    $srcDir = Join-Path $NamiSkillsSrc $skill
    $destDir = Join-Path $SkillsDir $skill
    $skillFile = Join-Path $srcDir "SKILL.md"
    if (-not (Test-Path $skillFile)) {
        Write-Host "WARN: missing $skillFile" -ForegroundColor Yellow
        continue
    }
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item $skillFile (Join-Path $destDir "SKILL.md") -Force
}

# Remove legacy flat skill files (pre agentskills.io layout).
$legacyFlat = @(
    "daily-brief-loop.md", "loop-checker.md", "linkup-mcp.md",
    "mobile-build-request.md", "model-routing.md"
)
foreach ($name in $legacyFlat) {
    $legacyPath = Join-Path $SkillsDir $name
    if (Test-Path $legacyPath) {
        Remove-Item $legacyPath -Force
        Write-Host "Removed legacy flat skill: $name"
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

$loopLog = Join-Path $MemDir "LOOP_LOG.md"
if (-not (Test-Path $loopLog)) {
    Copy-Item (Join-Path $Root "hermes-nami\memories\LOOP_LOG.md") $loopLog
}

$weekly = Join-Path $SupplyRoot "skills\weekly-focus.md"
if (Test-Path $weekly) {
    $weeklyDir = Join-Path $SkillsDir "weekly-focus"
    New-Item -ItemType Directory -Force -Path $weeklyDir | Out-Null
    $weeklySkill = Join-Path $weeklyDir "SKILL.md"
    if (-not (Test-Path $weeklySkill)) {
        @(
            "---",
            "name: weekly-focus",
            'description: "Weekly priority and park list for Ranne."',
            "version: 1.0.0",
            "---",
            ""
        ) + (Get-Content $weekly) | Set-Content $weeklySkill -Encoding utf8
    }
    if (Test-Path (Join-Path $SkillsDir "weekly-focus.md")) {
        Remove-Item (Join-Path $SkillsDir "weekly-focus.md") -Force
    }
} else {
    Write-Host "Note: supplyme-crew not at $SupplyRoot - skipped weekly-focus" -ForegroundColor Yellow
}

Write-Host "Installed Nami files to $HermesHome"
Write-Host "Skills: $($skillNames -join ', ') (use /brief, /loop-checker, etc.)"

$venvPy = Join-Path $Root ".venv\Scripts\python.exe"
if (Test-Path $venvPy) {
    & $venvPy -m nami_corpus.sync
} else {
    Write-Host "No .venv - run uv sync or pip install -e . first for RAG corpus sync" -ForegroundColor Yellow
}
