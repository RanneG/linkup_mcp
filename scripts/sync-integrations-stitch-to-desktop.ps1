<#
.SYNOPSIS
  Copy gamified Stitch files from integrations/stitch into temp_repo desktop (what Vite actually runs).

.DESCRIPTION
  The repo workflow keeps canonical copies under integrations/stitch/, but
  npm run dev:browser uses temp_repo/stitch/apps/desktop. Run this after UI
  changes in integrations/stitch so the browser app picks them up.

  Most files sync from integrations/stitch/*.tsx to desktop src/components/.
  Theme: integrations/stitch/context/ThemeContext.tsx -> src/context/.
  AppearanceSection.tsx lives next to other stitch modules under integrations/stitch/
  (import ./context/...) and is rewritten on copy to ../context/ for desktop src/components/.

  From repo root:
    .\scripts\sync-integrations-stitch-to-desktop.ps1
#>

$ErrorActionPreference = "Stop"
# $PSScriptRoot = .../cursor_linkup_mcp/scripts
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repoRoot "pyproject.toml"))) {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$src = Join-Path $repoRoot "integrations\stitch"
$dstComponents = Join-Path $repoRoot "temp_repo\stitch\apps\desktop\src\components"
$dstContext = Join-Path $repoRoot "temp_repo\stitch\apps\desktop\src\context"
$dstLib = Join-Path $repoRoot "temp_repo\stitch\apps\desktop\src\lib"

if (-not (Test-Path $dstComponents)) {
  Write-Error "Desktop components folder not found: $dstComponents"
}
if (-not (Test-Path $dstContext)) {
  New-Item -ItemType Directory -Force -Path $dstContext | Out-Null
}
if (-not (Test-Path $dstLib)) {
  New-Item -ItemType Directory -Force -Path $dstLib | Out-Null
}

$componentFiles = @(
  "AppShell.tsx", "Dashboard.tsx", "WelcomeHero.tsx", "GamificationStats.tsx", "SubscriptionCard.tsx",
  "GamifiedSettingsView.tsx", "SettingsPanel.tsx", "gamifyStorage.ts", "animations.ts",
  "GoogleSignInPanel.tsx", "GmailSubscriptionDiscovery.tsx", "FaceVerificationPanel.tsx",
  "LinkupRagPanel.tsx", "voiceCommands.ts", "SignInPage.tsx", "StitchAppRoot.tsx"
)

foreach ($f in $componentFiles) {
  $from = Join-Path $src $f
  if (-not (Test-Path $from)) { Write-Warning "Skip (missing): $from"; continue }
  Copy-Item -Force $from (Join-Path $dstComponents $f)
  Write-Host "OK components\$f"
}

$appearanceFrom = Join-Path $src "AppearanceSection.tsx"
if (-not (Test-Path $appearanceFrom)) { Write-Warning "Skip (missing): $appearanceFrom" }
else {
  $raw = Get-Content -LiteralPath $appearanceFrom -Raw
  $patched = $raw.Replace('from "./context/ThemeContext"', 'from "../context/ThemeContext"')
  [System.IO.File]::WriteAllText((Join-Path $dstComponents "AppearanceSection.tsx"), $patched)
  Write-Host "OK components\AppearanceSection.tsx"
}

$themeFrom = Join-Path $src "context\ThemeContext.tsx"
if (-not (Test-Path $themeFrom)) { Write-Warning "Skip (missing): $themeFrom" }
else {
  Copy-Item -Force $themeFrom (Join-Path $dstContext "ThemeContext.tsx")
  Write-Host "OK context\ThemeContext.tsx"
}

$bridgeFrom = Join-Path $src "stitchBridge.ts"
if (-not (Test-Path $bridgeFrom)) { Write-Warning "Skip (missing): $bridgeFrom" }
else {
  Copy-Item -Force $bridgeFrom (Join-Path $dstLib "stitchBridge.ts")
  Write-Host "OK lib\stitchBridge.ts"
}

Write-Host "`nDone. Restart or refresh Vite (npm run dev:browser) if HMR did not apply."
