# Auto-push for commits made by Claude (Cowork sandbox can commit, but cannot push).
# Runs every minute from Windows Task Scheduler ("Deezy auto-push"). Pushes local main only when it is
# ahead of origin/main and not behind (plain fast-forward) - never forces, never merges.
# GitHub Actions then runs the tests and deploys to the VPS.
# Log: .git\auto-push.log (last 200 lines).
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo
$log = Join-Path $repo '.git\auto-push.log'

function Write-Log([string]$message) {
  $line = '{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $message
  $old = if (Test-Path $log) { @(Get-Content $log -Tail 199) } else { @() }
  Set-Content -Path $log -Value ($old + $line) -Encoding ascii
}

try {
  # Do not touch the repo while a rebase/merge is in progress.
  if ((Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply') -or (Test-Path '.git\MERGE_HEAD')) { exit 0 }
  if ((git rev-parse --abbrev-ref HEAD) -ne 'main') { exit 0 }

  git fetch --quiet origin main 2>$null
  $ahead = [int](git rev-list --count origin/main..main)
  $behind = [int](git rev-list --count main..origin/main)
  if ($ahead -eq 0) { exit 0 }
  if ($behind -gt 0) {
    Write-Log "skip: main is $ahead ahead and $behind behind origin/main - needs git pull --rebase"
    exit 0
  }

  $head = git log -1 --format='%h %s'
  git push --quiet origin main 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Log "push FAILED ($ahead commit(s), head $head)"; exit 1 }
  Write-Log "pushed $ahead commit(s): $head"
} catch {
  Write-Log "error: $($_.Exception.Message)"
  exit 1
}
