# CAF AI - (c) 2026 CAF - iT CAF - by CAF. All rights reserved. See LICENSE.
# Prepares Node.js (system or portable in %LOCALAPPDATA%\CAF-AI) then runs the command.
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Root = Split-Path -Parent $PSScriptRoot
if (-not $env:CAF_HOME) { $env:CAF_HOME = Join-Path $env:LOCALAPPDATA "CAF-AI" }
$Runtime = Join-Path $env:CAF_HOME "runtime"
$CmdArgs = @(); if ($env:CAF_ARGS) { $CmdArgs = $env:CAF_ARGS -split '\s+' | Where-Object { $_ } }
$NodeExe = $null

$local = Join-Path $Runtime "node\node.exe"
if (Test-Path $local) { $NodeExe = $local }
else {
  $sys = Get-Command node -ErrorAction SilentlyContinue
  if ($sys) { $major = [int](& $sys.Source -p "process.versions.node.split('.')[0]"); if ($major -ge 18) { $NodeExe = $sys.Source } }
}
if (-not $NodeExe) {
  Write-Host "  > CAF AI - preparing Node.js runtime (one time)" -ForegroundColor Yellow
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
  $base = "https://nodejs.org/dist/latest-v22.x"
  $sums = (Invoke-WebRequest "$base/SHASUMS256.txt" -UseBasicParsing).Content -split "`n"
  $line = $sums | Where-Object { $_ -match "node-v[\d.]+-win-$arch\.zip$" } | Select-Object -First 1
  if (-not $line) { Write-Host "No internet connection" -ForegroundColor Red; exit 1 }
  $hash, $file = ($line.Trim() -split "\s+")
  New-Item -ItemType Directory -Force $Runtime | Out-Null
  $zip = Join-Path $Runtime $file
  $ProgressPreference = "SilentlyContinue"
  Invoke-WebRequest "$base/$file" -OutFile $zip -UseBasicParsing
  if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $hash.ToLower()) { Remove-Item $zip; Write-Host "Checksum failed" -ForegroundColor Red; exit 1 }
  $tmp = Join-Path $Runtime "node-extract"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive $zip -DestinationPath $tmp -Force
  if (Test-Path (Join-Path $Runtime "node")) { Remove-Item (Join-Path $Runtime "node") -Recurse -Force }
  Move-Item (Get-ChildItem $tmp | Select-Object -First 1).FullName (Join-Path $Runtime "node")
  Remove-Item $tmp -Recurse -Force; Remove-Item $zip -Force
  $NodeExe = $local
}
Set-Location $Root
& $NodeExe "app\cli.js" @CmdArgs
exit $LASTEXITCODE
