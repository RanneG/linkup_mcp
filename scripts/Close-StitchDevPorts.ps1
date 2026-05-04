<#
.SYNOPSIS
  Stop processes that are LISTENing on common local Stitch / web dev ports.

.DESCRIPTION
  Targets loopback dev servers for this repo only (defaults below). Does not "close localhost"
  itself; it ends the processes holding those TCP listen sockets.

  Default ports: 8765 (stitch_rag_bridge / stitch_gui), 1420 (Tauri dev), 5173 (Vite).

  If STITCH_RAG_BRIDGE_PORT is set to a number, that port is included even if not in -Ports.

.PARAMETER Ports
  Extra port numbers to clear (merged with defaults unless -NoDefaults).

.PARAMETER NoDefaults
  If set, only scan -Ports plus STITCH_RAG_BRIDGE_PORT (no 8765/1420/5173 preset list).

.PARAMETER DryRun
  List listeners and PIDs only; do not stop processes.

.EXAMPLE
  .\scripts\Close-StitchDevPorts.ps1
  .\scripts\Close-StitchDevPorts.ps1 -Ports 3000,8080
  .\scripts\Close-StitchDevPorts.ps1 -DryRun
#>

param(
  [int[]]$Ports = @(),
  [switch]$NoDefaults,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$defaultSet = @(8765, 1420, 5173)
$all = New-Object System.Collections.Generic.HashSet[int]
if (-not $NoDefaults) {
  foreach ($p in $defaultSet) { [void]$all.Add($p) }
}
foreach ($p in $Ports) { [void]$all.Add($p) }
if ($env:STITCH_RAG_BRIDGE_PORT -match '^\d+$') {
  [void]$all.Add([int]$env:STITCH_RAG_BRIDGE_PORT)
}

$portList = @($all | Sort-Object)
if ($portList.Count -eq 0) {
  Write-Host "No ports to scan." -ForegroundColor Yellow
  exit 0
}

Write-Host "Scanning LISTEN on ports: $($portList -join ', ')" -ForegroundColor Cyan

function Get-ListenPids([int]$port) {
  $pids = New-Object System.Collections.Generic.HashSet[int]
  try {
    $rows = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($r in $rows) {
      $op = [int]$r.OwningProcess
      if ($op -gt 0) { [void]$pids.Add($op) }
    }
  } catch {
    # Older Windows without cmdlet detail
  }
  if ($pids.Count -eq 0) {
    # Fallback: netstat (locale-dependent but common on Windows)
    $ns = netstat -ano 2>$null | Select-String ":$port\s.*LISTENING\s+(\d+)\s*$"
    foreach ($m in $ns) {
      if ($m.Matches[0].Groups.Count -gt 1) {
        $op = [int]$m.Matches[0].Groups[1].Value
        if ($op -gt 0) { [void]$pids.Add($op) }
      }
    }
  }
  return @($pids)
}

$skip = @{ 0 = $true; 4 = $true }
$toStop = @{}
foreach ($port in $portList) {
  foreach ($pid in (Get-ListenPids $port)) {
    if ($skip.ContainsKey($pid)) { continue }
    if (-not $toStop.ContainsKey($pid)) {
      $toStop[$pid] = New-Object System.Collections.Generic.HashSet[int]
    }
    [void]$toStop[$pid].Add($port)
  }
}

if ($toStop.Count -eq 0) {
  Write-Host "No listeners found on those ports." -ForegroundColor DarkGray
  exit 0
}

foreach ($pair in $toStop.GetEnumerator() | Sort-Object Name) {
  $procId = [int]$pair.Key
  $portsFor = @($pair.Value | Sort-Object) -join ","
  $name = "(unknown)"
  try {
    $name = (Get-Process -Id $procId -ErrorAction Stop).ProcessName
  } catch { }
  Write-Host "  PID $procId ($name) ports: $portsFor" -ForegroundColor Yellow
}

if ($DryRun) {
  Write-Host "DryRun: no processes stopped." -ForegroundColor Green
  exit 0
}

foreach ($procId in ($toStop.Keys | Sort-Object)) {
  if ($skip.ContainsKey($procId)) { continue }
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host "Stopped PID $procId" -ForegroundColor Green
  } catch {
    Write-Warning "Could not stop PID ${procId}: $($_.Exception.Message)"
  }
}

Write-Host "Done." -ForegroundColor Cyan
