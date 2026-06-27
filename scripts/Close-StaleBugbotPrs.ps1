# Close open cursor/critical-bug-* PRs on RanneG/linkup_mcp (after consolidated merge).
param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) not found. Install gh and run: gh auth login"
}

$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "gh not authenticated. Run: gh auth login"
}

$prs = gh pr list --repo RanneG/linkup_mcp --state open --limit 100 --json number,headRefName,title |
    ConvertFrom-Json

$targets = $prs | Where-Object { $_.headRefName -like "cursor/critical-*" }
Write-Host "Found $($targets.Count) cursor/critical-* open PRs" -ForegroundColor Cyan

foreach ($pr in $targets) {
    $msg = "Superseded by consolidated triage on main (see docs/dev/PR_TRIAGE.md). Closing duplicate Bugbot PR."
    if ($DryRun) {
        Write-Host "[dry-run] close #$($pr.number) $($pr.headRefName)"
    }
    else {
        gh pr close $pr.number --repo RanneG/linkup_mcp --comment $msg
        Write-Host "Closed #$($pr.number)" -ForegroundColor Green
    }
}
