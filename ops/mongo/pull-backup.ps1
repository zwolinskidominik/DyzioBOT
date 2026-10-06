<#
.SYNOPSIS
  Pobiera kopie zapasowe MongoDB z VPS na ten komputer (kopia poza serwerem).

.DESCRIPTION
  VPS co noc o 3:30 robi kopie bazy (ops/mongo/backup.sh) i trzyma je 7 dni. Ten skrypt
  sciaga przez scp wszystkie kopie, ktorych jeszcze nie ma lokalnie, i usuwa lokalne kopie
  starsze niz -KeepDays (domyslnie 30 dni, czyli dluzsza historia niz na VPS).

  Wymaga logowania do VPS kluczem SSH bez pytania o haslo (zadanie dziala w tle).
  Sprawdzenie:  ssh -o BatchMode=yes ubuntu@57.128.214.153 echo ok

.EXAMPLE
  # Jednorazowo: zarejestruj codzienne zadanie w Harmonogramie zadan
  powershell -ExecutionPolicy Bypass -File ops\mongo\pull-backup.ps1 -Register

.EXAMPLE
  # Recznie, od razu
  powershell -ExecutionPolicy Bypass -File ops\mongo\pull-backup.ps1
#>
param(
  [string]$RemoteHost = "ubuntu@57.128.214.153",
  [string]$RemoteDir = "/srv/deezy-secure/backups",
  [string]$LocalDir = "$env:USERPROFILE\Desktop\Chicken\MongoDB\backups",
  [int]$KeepDays = 30,
  [string]$At = "10:00",
  [switch]$Register
)

$ErrorActionPreference = "Stop"
$TaskName = "Deezy - kopia MongoDB z VPS"

if ($Register) {
  $scriptPath = $MyInvocation.MyCommand.Path
  $argsLine = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`" -RemoteHost `"$RemoteHost`" -LocalDir `"$LocalDir`" -KeepDays $KeepDays"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argsLine
  $trigger = New-ScheduledTaskTrigger -Daily -At $At
  # StartWhenAvailable: jesli komputer byl wylaczony o tej godzinie, zadanie ruszy po wlaczeniu.
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Codziennie pobiera kopie zapasowe bazy Deezy z VPS do $LocalDir" -Force | Out-Null
  Write-Host "Zarejestrowano zadanie '$TaskName' (codziennie o $At, nadrobi po wlaczeniu komputera)."
  Write-Host "Uruchom teraz, zeby sprawdzic:  Start-ScheduledTask -TaskName '$TaskName'"
  exit 0
}

New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
$log = Join-Path $LocalDir "pull-backup.log"
function Write-Log([string]$message) {
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}

try {
  # BatchMode: nigdy nie czekaj na haslo (w tle nikt go nie wpisze) - po prostu zglos blad.
  $sshOpts = @("-o", "BatchMode=yes", "-o", "ConnectTimeout=20")
  $remoteList = & ssh @sshOpts $RemoteHost "ls -1 $RemoteDir/deezy-*.archive.gz 2>/dev/null"
  if ($LASTEXITCODE -ne 0 -and -not $remoteList) {
    throw "Nie udalo sie polaczyc z $RemoteHost albo brak kopii w $RemoteDir (kod $LASTEXITCODE)."
  }

  $downloaded = 0
  foreach ($remotePath in @($remoteList)) {
    if (-not $remotePath) { continue }
    $name = Split-Path -Leaf $remotePath.Trim()
    if ($name -notmatch '^deezy-[0-9-]+\.archive\.gz$') { continue }
    $target = Join-Path $LocalDir $name
    if (Test-Path $target) { continue }

    $partial = "$target.partial"
    # -p zachowuje date utworzenia kopii na VPS - od niej liczymy rotacje i "czy kopia jest swieza".
    & scp @sshOpts -q -p "${RemoteHost}:$RemoteDir/$name" $partial
    if ($LASTEXITCODE -ne 0) { throw "scp nie pobral $name (kod $LASTEXITCODE)." }
    Move-Item -Force $partial $target
    $downloaded++
    Write-Log ("Pobrano {0} ({1:N1} MB)" -f $name, ((Get-Item $target).Length / 1MB))
  }

  $cutoff = (Get-Date).AddDays(-$KeepDays)
  Get-ChildItem -Path $LocalDir -Filter "deezy-*.archive.gz" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object { Remove-Item $_.FullName; Write-Log "Usunieto stara kopie $($_.Name)" }

  $newest = Get-ChildItem -Path $LocalDir -Filter "deezy-*.archive.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $newest) {
    Write-Log "UWAGA: brak jakiejkolwiek kopii w $LocalDir."
    exit 1
  }
  if ($newest.LastWriteTime -lt (Get-Date).AddDays(-2)) {
    Write-Log "UWAGA: najnowsza kopia ($($newest.Name)) ma ponad 2 dni - sprawdz cron na VPS (backup.log)."
    exit 1
  }
  Write-Log "OK: nowych kopii: $downloaded, najnowsza: $($newest.Name)"
}
catch {
  Write-Log "BLAD: $($_.Exception.Message)"
  exit 1
}
