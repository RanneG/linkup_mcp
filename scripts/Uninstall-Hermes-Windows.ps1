# Remove local Hermes install (Windows offload). Close any running `hermes` first.
$root = Join-Path $env:LOCALAPPDATA "hermes"
$bin = Join-Path $root "bin"

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -and $userPath -like "*$bin*") {
    $parts = $userPath -split ';' | Where-Object { $_ -and $_ -ne $bin }
    [Environment]::SetEnvironmentVariable("Path", ($parts -join ';'), "User")
    Write-Host "Removed hermes from user PATH."
}

if (Test-Path $root) {
    Remove-Item -Recurse -Force $root -ErrorAction Stop
    Write-Host "Removed $root"
} else {
    Write-Host "Nothing to remove."
}

Write-Host "Runtime Nami -> Mac: docs/hermes/MAC_SETUP.md"
