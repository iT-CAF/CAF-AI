# CAF AI - (c) 2026 CAF - iT CAF - by CAF. All rights reserved. See LICENSE.
# Windows (PowerShell):  irm https://raw.githubusercontent.com/iT-CAF/CAF-AI/main/install-caf-ai.ps1 | iex
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Repo = "iT-CAF/CAF-AI"
$CafHome = if ($env:CAF_HOME) { $env:CAF_HOME } else { Join-Path $env:LOCALAPPDATA "CAF-AI" }
Write-Host ""
Write-Host "  > CAF AI" -ForegroundColor Yellow
Write-Host "  by CAF · iT CAF · store.it-caf.com" -ForegroundColor DarkGray
Write-Host "  ----------------------------------------------------" -ForegroundColor DarkGray

$here = $PSScriptRoot
if ($here -and (Test-Path (Join-Path $here "app\server.js"))) { $AppDir = $here }
else {
  $AppDir = Join-Path $CafHome "app"
  Write-Host "  > Downloading CAF AI" -ForegroundColor Yellow
  $zip = Join-Path $env:TEMP "caf-ai.zip"; $tmp = Join-Path $env:TEMP "caf-ai-src"
  $ProgressPreference = "SilentlyContinue"
  Invoke-WebRequest "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip -UseBasicParsing
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive $zip -DestinationPath $tmp -Force
  if (Test-Path $AppDir) { Remove-Item $AppDir -Recurse -Force }
  New-Item -ItemType Directory -Force $CafHome | Out-Null
  Move-Item (Get-ChildItem $tmp | Select-Object -First 1).FullName $AppDir
  Remove-Item $zip -Force; Remove-Item $tmp -Recurse -Force
}

$BinDir = Join-Path $CafHome "bin"
New-Item -ItemType Directory -Force $BinDir | Out-Null
$shim = "@echo off`r`nchcp 65001 >nul`r`nset `"CAF_ARGS=%*`"`r`npowershell -NoProfile -ExecutionPolicy Bypass -File `"$AppDir\app\bootstrap.ps1`"`r`n"
[IO.File]::WriteAllText((Join-Path $BinDir "startcaf.cmd"), $shim, (New-Object Text.UTF8Encoding($false)))
$sh = "#!/usr/bin/env bash`n" + "exec cmd.exe //c startcaf.cmd `"`$@`"`n"
[IO.File]::WriteAllText((Join-Path $BinDir "startcaf"), $sh, (New-Object Text.UTF8Encoding($false)))
Write-Host "  OK  startcaf command installed" -ForegroundColor Green

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (($userPath -split ";") -notcontains $BinDir) {
  [Environment]::SetEnvironmentVariable("Path", ($userPath.TrimEnd(";") + ";" + $BinDir), "User")
  Write-Host "  OK  PATH updated - open a new terminal" -ForegroundColor Green
}
Write-Host ""
Write-Host "  Next:  startcaf" -ForegroundColor Yellow
Write-Host ""
