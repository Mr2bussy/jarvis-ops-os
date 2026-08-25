#Requires -Version 5.1
<#
.SYNOPSIS
  Install JARVIS Operations OS as a Windows service via NSSM (or document node-windows fallback).

.DESCRIPTION
  Preferred: NSSM (Non-Sucking Service Manager).
  Fallback: prints node-windows scaffold commands if NSSM is missing.

.PARAMETER NssmPath
  Path to nssm.exe (default: nssm on PATH).

.PARAMETER InstallDir
  JARVIS repo / install root (default: parent of scripts/).

.PARAMETER ServiceName
  Windows service name (default: JarvisOpsOS).
#>
param(
  [string]$NssmPath = "nssm",
  [string]$InstallDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$ServiceName = "JarvisOpsOS",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
$node = if ($nodeCmd) { $nodeCmd.Source } else { $null }
$pnpm = if ($pnpmCmd) { $pnpmCmd.Source } else { $null }
$electron = Join-Path $InstallDir "node_modules\electron\dist\electron.exe"
$mainJs = Join-Path $InstallDir "dist-electron\main.js"
$launchBat = Join-Path $InstallDir "JARVIS-Launch.bat"

function Test-Nssm {
  try {
    & $NssmPath version | Out-Null
    return $true
  } catch {
    return $false
  }
}

if ($Uninstall) {
  if (Test-Nssm) {
    Write-Host "Stopping / removing $ServiceName ..."
    & $NssmPath stop $ServiceName
    & $NssmPath remove $ServiceName confirm
    Write-Host "Done."
    exit 0
  }
  Write-Host "NSSM not found — remove the service manually: sc.exe delete $ServiceName"
  exit 1
}

Write-Host "JARVIS Windows Service installer"
Write-Host "  InstallDir : $InstallDir"
Write-Host "  Service    : $ServiceName"

if (-not (Test-Path $mainJs) -and -not (Test-Path $launchBat)) {
  Write-Warning "Neither dist-electron/main.js nor JARVIS-Launch.bat found. Run pnpm run build first for production mode."
}

if (Test-Nssm) {
  $app = if (Test-Path $electron) { $electron } elseif ($pnpm) { $pnpm } else { $node }
  $args = if (Test-Path $electron) {
    "."
  } elseif (Test-Path $launchBat) {
    "/c `"$launchBat`""
  } else {
    "run start:prod"
  }

  Write-Host "Using NSSM → $app $args"
  & $NssmPath install $ServiceName $app $args
  & $NssmPath set $ServiceName AppDirectory $InstallDir
  & $NssmPath set $ServiceName DisplayName "JARVIS Operations OS"
  & $NssmPath set $ServiceName Description "JARVIS Ops OS background service (Electron / Hermes)"
  & $NssmPath set $ServiceName Start SERVICE_AUTO_START
  & $NssmPath set $ServiceName AppStdout (Join-Path $InstallDir "logs\service-stdout.log")
  & $NssmPath set $ServiceName AppStderr (Join-Path $InstallDir "logs\service-stderr.log")
  New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir "logs") | Out-Null
  Write-Host "Installed. Start with: nssm start $ServiceName  (or services.msc)"
  Write-Host "NOTE: Interactive Electron UI may not show under Session 0 — use service for headless gateway/cron only, or run JARVIS-Launch.bat for operator desktop."
  exit 0
}

Write-Host ""
Write-Host "NSSM not found on PATH."
Write-Host "Install NSSM: https://nssm.cc/download  — then re-run this script."
Write-Host ""
Write-Host "Fallback node-windows scaffold (optional dependency):"
Write-Host "  pnpm add -D node-windows"
Write-Host "  Then create scripts/register-node-windows.js:"
Write-Host @'
  const { Service } = require("node-windows");
  const path = require("path");
  const svc = new Service({
    name: "JarvisOpsOS",
    description: "JARVIS Operations OS",
    script: path.join(__dirname, "..", "dist-electron", "main.js"),
  });
  svc.on("install", () => svc.start());
  svc.install();
'@
Write-Host ""
Write-Host "Operator desktop (recommended): double-click JARVIS-Launch.bat / JARVIS.lnk"
exit 2
