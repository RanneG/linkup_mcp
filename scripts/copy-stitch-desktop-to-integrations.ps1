<#
.SYNOPSIS
  Copy Stitch desktop integration files from temp_repo/stitch into integrations/stitch for upstream PR prep.

.DESCRIPTION
  Run from the linkup_mcp repository root:
    .\scripts\copy-stitch-desktop-to-integrations.ps1

  Source:  temp_repo/stitch/apps/desktop/src/
  Target:  integrations/stitch/

  After copy, follow integrations/stitch/README.md to merge into the real Stitch repo (paths under apps/desktop/src/).
#>

$ErrorActionPreference = "Stop"

# $PSScriptRoot = .../linkup_mcp/scripts
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repoRoot "pyproject.toml"))) {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$srcRoot = Join-Path $repoRoot "temp_repo\stitch\apps\desktop\src"
$dstRoot = Join-Path $repoRoot "integrations\stitch"

if (-not (Test-Path $srcRoot)) {
  Write-Error "Source not found: $srcRoot (clone Stitch under temp_repo/stitch first)."
}

New-Item -ItemType Directory -Force -Path $dstRoot | Out-Null

$files = @(
  @{ Rel = "components\AppShell.tsx";           Dst = "AppShell.tsx" }
  @{ Rel = "components\AppearanceSection.tsx"; Dst = "AppearanceSection.tsx" }
  @{ Rel = "components\GoogleSignInPanel.tsx"; Dst = "GoogleSignInPanel.tsx" }
  @{ Rel = "components\GmailSubscriptionDiscovery.tsx"; Dst = "GmailSubscriptionDiscovery.tsx" }
  @{ Rel = "components\FaceVerificationPanel.tsx"; Dst = "FaceVerificationPanel.tsx" }
  @{ Rel = "components\LinkupRagPanel.tsx";       Dst = "LinkupRagPanel.tsx" }
  @{ Rel = "components\Dashboard.tsx";          Dst = "Dashboard.tsx" }
  @{ Rel = "components\WelcomeHero.tsx";        Dst = "WelcomeHero.tsx" }
  @{ Rel = "components\GamificationStats.tsx";  Dst = "GamificationStats.tsx" }
  @{ Rel = "components\SubscriptionCard.tsx"; Dst = "SubscriptionCard.tsx" }
  @{ Rel = "components\GamifiedSettingsView.tsx"; Dst = "GamifiedSettingsView.tsx" }
  @{ Rel = "components\SettingsPanel.tsx";      Dst = "SettingsPanel.tsx" }
  @{ Rel = "components\gamifyStorage.ts";     Dst = "gamifyStorage.ts" }
  @{ Rel = "components\animations.ts";         Dst = "animations.ts" }
  @{ Rel = "lib\stitchBridge.ts";                Dst = "stitchBridge.ts" }
)

Write-Host "Repo root: $repoRoot"
Write-Host "Copying into: $dstRoot`n"

foreach ($f in $files) {
  $from = Join-Path $srcRoot $f.Rel
  $to = Join-Path $dstRoot $f.Dst
  if (-not (Test-Path $from)) {
    Write-Warning "Skip (missing): $from"
    continue
  }
  Copy-Item -LiteralPath $from -Destination $to -Force
  Write-Host "  OK  $($f.Rel) -> integrations/stitch/$($f.Dst)"
}

Write-Host "`nDone. Next: open integrations/stitch/README.md and copy files into the Stitch repo tree; run typecheck/lint there."
