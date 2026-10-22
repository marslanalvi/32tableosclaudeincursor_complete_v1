# Run this checkout's full dev stack on its own ports so it can run alongside
# other checkouts of the project. Each role runs detached; logs go to $LogDir.
# Stop with scripts/dev-isolated-stop.ps1. The database comes from DATABASE_URL
# in the root .env (not committed).
param(
  [int]$ApiPort = 3200,
  [int]$RealtimePort = 3202,
  [int]$WebPort = 5283,
  [int]$PublicPort = 5284,
  [int]$RedisDb = 1,
  [string]$LogDir = (Join-Path $PSScriptRoot "..\.data\logs")
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
New-Item -ItemType Directory -Force $LogDir | Out-Null

$env:PORT = "$ApiPort"
$env:REALTIME_PORT = "$RealtimePort"
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
$env:REDIS_URL = "redis://localhost:6379/$RedisDb"
$env:APP_URL = "http://localhost:$WebPort"
$env:API_URL = "http://localhost:$ApiPort"
$env:PUBLIC_APP_URL = "http://localhost:$PublicPort"
$env:TABLEOS_WEB_PORT = "$WebPort"
$env:TABLEOS_PUBLIC_PORT = "$PublicPort"
$env:TABLEOS_API_PROXY = "http://localhost:$ApiPort"
$env:TABLEOS_REALTIME_PROXY = "ws://localhost:$RealtimePort"
$env:VITE_PUBLIC_APP_URL = "http://localhost:$PublicPort"

$roles = [ordered]@{
  api      = "--filter @tableos/server dev"
  realtime = "--filter @tableos/server dev:realtime"
  worker   = "--filter @tableos/server dev:worker"
  relay    = "--filter @tableos/server dev:relay"
  web      = "--filter @tableos/web dev"
  public   = "--filter @tableos/public dev"
}

foreach ($name in $roles.Keys) {
  $logFile = Join-Path $LogDir "$name.log"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npx pnpm@9.15.0 $($roles[$name]) > `"$logFile`" 2>&1" `
    -WorkingDirectory $root -WindowStyle Hidden
  Write-Host "started $name -> $logFile"
}

Write-Host ""
Write-Host "Web:    http://localhost:$WebPort"
Write-Host "Public: http://localhost:$PublicPort"
Write-Host "API:    http://localhost:$ApiPort/health"
