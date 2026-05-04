<#
.SYNOPSIS
  Launch Stitch in one window with no manual terminal steps (double-click Stitch.bat).

.DESCRIPTION
  - Creates .venv with py or python if missing
  - pip install -e ".[stitch-bridge,stitch-gui]" if Flask/webview imports fail
  - npm install + npm run build in stitch-app apps/desktop if -SkipBuild not set
  - runs stitch_gui.py

  Requires one-time installs on the machine: Python 3.12+, Node.js (npm), and a **stitch-app** clone (sibling folder `../stitch-app` or STITCH_APP_ROOT).

  Double-click: Stitch.bat at repo root.
#>

param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Write-Host ''
Write-Host 'Stitch - single-window mode (recommended one-click)' -ForegroundColor Cyan
Write-Host '  - Installs Python deps in .venv on first run (can take several minutes).' -ForegroundColor DarkGray
Write-Host '  - Builds the web app (npm run build) unless you pass -SkipBuild.' -ForegroundColor DarkGray
Write-Host '  - Opens one window: UI + API + voice STT share one process; closing it stops the bridge.' -ForegroundColor DarkGray
Write-Host ''

# Python writes tracebacks to stderr; with $ErrorActionPreference Stop, PowerShell treats that as a terminating error.
function Test-PythonCanImport {
  param(
    [Parameter(Mandatory)][string]$PythonExe,
    [Parameter(Mandatory)][string]$ModuleName
  )
  $oldEap = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $null = & $PythonExe -c "import $ModuleName" 2>&1
    return ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $oldEap
  }
}

function Invoke-PythonQuiet {
  param(
    [Parameter(Mandatory)][string]$PythonExe,
    [Parameter(Mandatory)][string[]]$ArgumentList
  )
  $oldEap = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $null = & $PythonExe @ArgumentList 2>&1
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $oldEap
  }
}

function Invoke-NpmQuiet {
  param([Parameter(Mandatory)][string[]]$ArgumentList)
  $oldEap = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $null = & npm @ArgumentList 2>&1
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $oldEap
  }
}

function Show-ErrMsg([string]$title, [string]$body) {
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop | Out-Null
    [System.Windows.Forms.MessageBox]::Show($body, $title, "OK", "Error") | Out-Null
  } catch {
    Write-Host ('ERROR ' + $title + ': ' + $body) -ForegroundColor Red
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repoRoot "pyproject.toml"))) {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

. (Join-Path $PSScriptRoot "StitchPaths.ps1")
$desktop = Get-StitchAppsDesktopDir -RepoRoot $repoRoot
$dist = if ($desktop) { Join-Path $desktop "dist" } else { $null }
$py = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not $desktop) {
      Show-ErrMsg 'Stitch' ('Could not find apps/desktop. Set STITCH_APP_ROOT to your stitch-app clone, or clone https://github.com/RanneG/stitch-app next to this repo (..\stitch-app). See docs\stitch\MIGRATION.md.')
  exit 1
}

if (-not (Test-Path $py)) {
  Write-Host "Creating Python venv (first run only)..."
  Push-Location $repoRoot
  try {
    if (Get-Command py -ErrorAction SilentlyContinue) {
      & py -3 -m venv .venv
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
      & python -m venv .venv
    } else {
      Show-ErrMsg 'Python' ('Install Python 3.12+ from https://www.python.org/downloads/' + [Environment]::NewLine + "Enable 'Add python.exe to PATH', then double-click Stitch.bat again.")
      exit 1
    }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $py)) {
  Show-ErrMsg 'Stitch' ('Could not create .venv under:' + [Environment]::NewLine + $repoRoot)
  exit 1
}

$pyNeedsInstall = $false
if (-not (Test-PythonCanImport -PythonExe $py -ModuleName "flask")) { $pyNeedsInstall = $true }
if (-not (Test-PythonCanImport -PythonExe $py -ModuleName "webview")) { $pyNeedsInstall = $true }

if ($pyNeedsInstall) {
  Write-Host 'Installing Python dependencies (first run can take several minutes; TensorFlow/OpenCV wheels are large)...'
  Push-Location $repoRoot
  $pipLog = Join-Path $repoRoot "stitch-pip-install.log"
  try {
    $code = Invoke-PythonQuiet -PythonExe $py -ArgumentList @("-m", "pip", "install", "-q", "--upgrade", "pip", "setuptools", "wheel")
    if ($code -ne 0) { throw "pip upgrade pip/setuptools/wheel failed (exit $code)" }
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
      & $py -m pip install -e ".[stitch-bridge,stitch-gui]" 2>&1 | Tee-Object -FilePath $pipLog
      $code = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $oldEap
    }
    if ($code -ne 0) {
      $tail = ""
      if (Test-Path -LiteralPath $pipLog) {
        $tail = (Get-Content -LiteralPath $pipLog -Tail 40 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
      }
      $pipMsg = "Editable install failed (exit $code)." + [Environment]::NewLine + "Log: $pipLog" + [Environment]::NewLine + [Environment]::NewLine + "--- last lines ---" + [Environment]::NewLine + $tail
      Show-ErrMsg "pip install failed" $pipMsg
      exit 1
    }
  } finally {
    Pop-Location
  }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Show-ErrMsg 'Node.js' ('Install Node.js LTS from https://nodejs.org/' + [Environment]::NewLine + 'npm must be on PATH, then double-click Stitch.bat again.')
  exit 1
}

if (-not $SkipBuild) {
  Write-Host "npm install + npm run build (Stitch apps/desktop)..."
  Push-Location $desktop
  try {
    $code = Invoke-NpmQuiet @("install", "--no-fund", "--no-audit")
    if ($code -ne 0) { throw "npm install failed (exit $code)" }
    $code = Invoke-NpmQuiet @("run", "build")
    if ($code -ne 0) { throw "npm run build failed (exit $code)" }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path (Join-Path $dist "index.html"))) {
  Show-ErrMsg 'Stitch build' ('Missing dist\index.html after build.' + [Environment]::NewLine + 'Path: ' + $dist)
  exit 1
}

Write-Host "Opening Stitch window..."
$gui = Join-Path $repoRoot 'stitch_gui.py'
& $py $gui --dist $dist
