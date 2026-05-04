<#
.SYNOPSIS
  Resolve apps/desktop folder for Stitch (stitch-app monorepo only).
#>
function Get-StitchAppsDesktopDir {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )
  $candidates = [System.Collections.Generic.List[string]]::new()
  $envRoot = $env:STITCH_APP_ROOT
  if ($envRoot -and $envRoot.Trim().Length -gt 0) {
    $candidates.Add([System.IO.Path]::GetFullPath((Join-Path $envRoot.Trim() "apps\desktop")))
  }
  $candidates.Add([System.IO.Path]::GetFullPath((Join-Path $repoRoot "..\stitch-app\apps\desktop")))
  foreach ($d in $candidates) {
    if (Test-Path -LiteralPath (Join-Path $d "package.json")) {
      return $d
    }
  }
  return $null
}
