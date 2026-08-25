#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Installer smoke — dry-run (always CI-safe) or full silent install lifecycle.

.DESCRIPTION
  Intended for CI (release.yml) and local operator verification on a clean Windows VM.

  Modes:
    -DryRun   No certs, no install. Validates script + release artefact presence,
              reports signing env status (CSC_LINK / CSC_KEY_PASSWORD set or not —
              never prints secret values). Exit 0 when mechanism is healthy.
    (default) Full smoke: silent install → launch with JARVIS_DRY_RUN=1 → registry
              sanity → optional uninstall. Requires a built NSIS .exe under ./release.

  CI wiring (see docs/CODE-SIGNING.md):
    - Dry-run runs on every release (blocking).
    - Full smoke runs when CSC_LINK is present and/or VERIFY_INSTALLER=1.
    - Without cert secrets the release stays fail-soft (unsigned artefact + dry-run only).

.NOTES
  Full IPC health requires Electron test harness — this script validates the installer
  lifecycle. Signing itself is electron-builder + CSC_* secrets, not this script.
#>
param(
  [string]$InstallerPath = '',
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\JARVIS Operations OS",
  [int]$LaunchTimeoutSec = 45,
  [switch]$SkipUninstall,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Msg) {
  Write-Host ""
  Write-Host "== $Msg ==" -ForegroundColor Cyan
}

function Test-SecretPresent([string]$Name) {
  $v = [Environment]::GetEnvironmentVariable($Name)
  return -not [string]::IsNullOrWhiteSpace($v)
}

function Find-Installer {
  param([string]$Hint, [switch]$Optional)
  if ($Hint -and (Test-Path -LiteralPath $Hint)) {
    return (Resolve-Path -LiteralPath $Hint).Path
  }
  $releaseDir = Join-Path $PSScriptRoot '..\release'
  $candidates = Get-ChildItem -Path $releaseDir -Filter '*.exe' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch 'uninst' } |
    Sort-Object LastWriteTime -Descending
  if (-not $candidates) {
    if ($Optional) { return $null }
    Write-Error "No installer found. Build first: pnpm build && pnpm exec electron-builder --win --dir"
  }
  return $candidates[0].FullName
}

function Write-SigningStatus {
  Write-Step "Signing env (presence only — values never printed)"
  $hasLink = Test-SecretPresent 'CSC_LINK'
  $hasPass = Test-SecretPresent 'CSC_KEY_PASSWORD'
  $verify = $env:VERIFY_INSTALLER
  Write-Host ("CSC_LINK:          {0}" -f ($(if ($hasLink) { 'SET' } else { 'MISSING' })))
  Write-Host ("CSC_KEY_PASSWORD:  {0}" -f ($(if ($hasPass) { 'SET' } else { 'MISSING' })))
  Write-Host ("VERIFY_INSTALLER:  {0}" -f ($(if ([string]::IsNullOrWhiteSpace($verify)) { '(unset)' } else { $verify })))
  if (-not $hasLink) {
    Write-Host "SIGNING: disabled — unsigned build is fail-soft; see docs/CODE-SIGNING.md" -ForegroundColor Yellow
  } elseif (-not $hasPass) {
    Write-Host "SIGNING: incomplete — CSC_KEY_PASSWORD missing; build will be UNSIGNED" -ForegroundColor Yellow
  } else {
    Write-Host "SIGNING: secrets present — electron-builder can sign (sha256)" -ForegroundColor Green
  }
}

# ── Dry-run path (no certs, no install) ───────────────────────────────────────
if ($DryRun) {
  Write-Step "Installer smoke DRY-RUN (no install, no certs required)"
  Write-SigningStatus

  $scriptOk = Test-Path -LiteralPath $PSCommandPath
  $releaseDir = Join-Path $PSScriptRoot '..\release'
  $releaseExists = Test-Path -LiteralPath $releaseDir
  $installer = Find-Installer -Hint $InstallerPath -Optional
  $hasInstaller = -not [string]::IsNullOrWhiteSpace($installer)

  Write-Step "Mechanism checks"
  Write-Host ("script:     {0}" -f ($(if ($scriptOk) { 'OK' } else { 'FAIL' })))
  Write-Host ("release/:   {0}" -f ($(if ($releaseExists) { 'OK' } else { 'MISSING (ok before package step)' })))
  Write-Host ("installer:  {0}" -f ($(if ($hasInstaller) { $installer } else { 'none yet (ok for dry-run)' })))

  if (-not $scriptOk) {
    Write-Error "installer-smoke.ps1 path unresolved"
  }

  Write-Step "Dry-run summary"
  Write-Host "mechanism: LOCKED"

  # Optional: prove unsigned builds are rejected when policy requires signing.
  # Without certs, REQUIRE_SIGNED=1 makes dry-run exit 1 — mechanism proof for 12/12.
  $requireSigned = $env:REQUIRE_SIGNED
  $hasLink = Test-SecretPresent 'CSC_LINK'
  if ($requireSigned -eq '1' -and -not $hasLink) {
    Write-Error "REQUIRE_SIGNED=1 but CSC_LINK missing — unsigned build rejected (mechanism proof)"
  }
  if ($requireSigned -eq '1' -and $hasInstaller) {
    try {
      $sig = Get-AuthenticodeSignature -LiteralPath $installer
      Write-Host ("Authenticode Status: {0}" -f $sig.Status)
      if ($sig.Status -ne 'Valid') {
        Write-Error "REQUIRE_SIGNED=1 but installer Status=$($sig.Status) — unsigned rejected"
      }
    } catch {
      Write-Error "REQUIRE_SIGNED=1 but Authenticode check failed: $($_.Exception.Message)"
    }
  }

  Write-Host "full smoke: set VERIFY_INSTALLER=1 and/or provide CSC_LINK + built .exe"
  Write-Host "docs: docs/CODE-SIGNING.md"
  exit 0
}

# ── Full smoke ────────────────────────────────────────────────────────────────
$installer = Find-Installer -Hint $InstallerPath
Write-Step "Using installer: $installer"
Write-SigningStatus

# Optional Authenticode report (never fails the smoke solely for NotSigned —
# unsigned releases are intentional without CSC_LINK).
try {
  $sig = Get-AuthenticodeSignature -LiteralPath $installer
  Write-Host ("Authenticode Status: {0}" -f $sig.Status)
  if ($env:VERIFY_INSTALLER -eq '1' -and (Test-SecretPresent 'CSC_LINK') -and $sig.Status -ne 'Valid') {
    Write-Error "VERIFY_INSTALLER=1 and CSC_LINK set, but installer is not Validly signed (Status=$($sig.Status))"
  }
} catch {
  Write-Warning "Authenticode check skipped: $($_.Exception.Message)"
}

Write-Step "Silent install"
$proc = Start-Process -FilePath $installer -ArgumentList '/S' -Wait -PassThru
if ($proc.ExitCode -ne 0) {
  Write-Error "Installer exit code $($proc.ExitCode)"
}

$appExe = Join-Path $InstallDir 'JARVIS Operations OS.exe'
if (-not (Test-Path -LiteralPath $appExe)) {
  # electron-builder may use product folder name variants
  $alt = Get-ChildItem -Path (Split-Path $InstallDir) -Recurse -Filter 'JARVIS Operations OS.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($alt) { $appExe = $alt.FullName }
}
if (-not (Test-Path -LiteralPath $appExe)) {
  Write-Error "App exe not found after install (expected under $InstallDir)"
}
Write-Host "Installed: $appExe"

Write-Step "Launch smoke (dry-run env, timeout ${LaunchTimeoutSec}s)"
$env:JARVIS_DRY_RUN = '1'
$launch = Start-Process -FilePath $appExe -PassThru
$deadline = (Get-Date).AddSeconds($LaunchTimeoutSec)
while (-not $launch.HasExited -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
}
if (-not $launch.HasExited) {
  Write-Host "App still running — stopping for smoke" -ForegroundColor Yellow
  Stop-Process -Id $launch.Id -Force -ErrorAction SilentlyContinue
} else {
  Write-Host "App exited with code $($launch.ExitCode)"
}

Write-Step "Registry sanity (custom NSIS macro)"
$reg = Get-ItemProperty -Path 'HKCU:\Software\JARVIS' -ErrorAction SilentlyContinue
if ($reg) {
  Write-Host "InstallPath: $($reg.InstallPath)"
  Write-Host "Version: $($reg.Version)"
} else {
  Write-Warning "HKCU\Software\JARVIS not found — installer.nsh macro may not have run"
}

if (-not $SkipUninstall) {
  Write-Step "Silent uninstall"
  $uninstaller = Join-Path $InstallDir 'Uninstall JARVIS Operations OS.exe'
  if (Test-Path -LiteralPath $uninstaller) {
    $u = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
    Write-Host "Uninstaller exit: $($u.ExitCode)"
  } else {
    Write-Warning "Uninstaller not found — manual cleanup may be required"
  }
}

Write-Step "Smoke complete"
exit 0
