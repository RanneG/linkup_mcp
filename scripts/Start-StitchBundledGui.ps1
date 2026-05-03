<#
.SYNOPSIS
  Launch Stitch in one window with no manual terminal steps (double-click Stitch.bat).

.DESCRIPTION
  - Creates .venv with py or python if missing
  - pip install -e . and pywebview if imports fail
  - sync integrations -> temp_repo desktop
  - npm install + npm run build if -SkipBuild not set
  - runs stitch_gui.py

  Requires one-time installs on the machine: Python 3.12+, Node.js (npm), and a temp_repo/stitch clone.

  Double-click: Stitch.bat at repo root (or Stitch-Bundled-Gui.bat).
#>

param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

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
    Write-Host "ERROR $title`: $body" -ForegroundColor Red
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repoRoot "pyproject.toml"))) {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$desktop = Join-Path $repoRoot "temp_repo\stitch\apps\desktop"
$dist = Join-Path $desktop "dist"
$py = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path (Join-Path $desktop "package.json"))) {
  Show-ErrMsg "Stitch" "Clone the Stitch repo into:`n$desktop`n`nSee AGENTS.md (temp_repo/stitch)."
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
      Show-ErrMsg "Python" "Install Python 3.12+ from https://www.python.org/downloads/`nEnable 'Add python.exe to PATH', then double-click Stitch.bat again."
      exit 1
    }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $py)) {
  Show-ErrMsg "Stitch" "Could not create .venv under:`n$repoRoot"
  exit 1
}

$pyNeedsInstall = $false
if (-not (Test-PythonCanImport -PythonExe $py -ModuleName "flask")) { $pyNeedsInstall = $true }
if (-not (Test-PythonCanImport -PythonExe $py -ModuleName "webview")) { $pyNeedsInstall = $true }

if ($pyNeedsInstall) {
  Write-Host "Installing Python dependencies (first run can take several minutes; TensorFlow/OpenCV wheels are large)..."
  Push-Location $repoRoot
  $pipLog = Join-Path $repoRoot "stitch-pip-install.log"
  try {
    $code = Invoke-PythonQuiet -PythonExe $py -ArgumentList @("-m", "pip", "install", "-q", "--upgrade", "pip", "setuptools", "wheel")
    if ($code -ne 0) { throw "pip upgrade pip/setuptools/wheel failed (exit $code)" }
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
      & $py -m pip install -e "." 2>&1 | Tee-Object -FilePath $pipLog
      $code = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $oldEap
    }
    if ($code -ne 0) {
      $tail = ""
      if (Test-Path -LiteralPath $pipLog) {
        $tail = (Get-Content -LiteralPath $pipLog -Tail 40 -ErrorAction SilentlyContinue) -join "`n"
      }
      Show-ErrMsg "pip install failed" "Editable install failed (exit $code).`nLog: $pipLog`n`n--- last lines ---`n$tail"
      exit 1
    }
    $code = Invoke-PythonQuiet -PythonExe $py -ArgumentList @("-m", "pip", "install", "-q", "pywebview>=5,<6")
    if ($code -ne 0) { throw "pip install pywebview failed (exit $code)" }
  } finally {
    Pop-Location
  }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Show-ErrMsg "Node.js" "Install Node.js LTS from https://nodejs.org/`n/npm must be on PATH, then double-click Stitch.bat again."
  exit 1
}

if (-not $SkipBuild) {
  Write-Host "Syncing integrations -> desktop..."
  & (Join-Path $repoRoot "scripts\sync-integrations-stitch-to-desktop.ps1")
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
  Show-ErrMsg "Stitch build" "Missing dist\index.html after build.`nPath: $dist"
  exit 1
}

Write-Host "Opening Stitch window..."
& $py (Join-Path $repoRoot "stitch_gui.py") --dist $dist
