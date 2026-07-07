<#
.SYNOPSIS
    Registers the pixels-roll20-helper native messaging host for Firefox on Windows.

.DESCRIPTION
    Copies the built pixels-roll20-helper.exe to %LOCALAPPDATA%\PixelsRoll20\,
    writes a resolved native messaging host manifest next to it (from the
    template in native-host\manifests\), and points Firefox at that manifest
    via the HKCU\Software\Mozilla\NativeMessagingHosts registry key.

    Safe to re-run — each run overwrites its own prior install. Run
    uninstall-host.ps1 to remove everything this script sets up.

.EXAMPLE
    .\scripts\install-host.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# $IsWindows only exists on PowerShell 6+; Windows PowerShell 5.1 (no
# $IsWindows) only ever runs on Windows anyway, so it needs no check.
if ($PSVersionTable.PSVersion.Major -ge 6 -and -not $IsWindows) {
    throw 'This installer is Windows-only (Firefox native messaging host registration uses the Windows registry).'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeHostDir = Join-Path $repoRoot 'native-host'
$manifestTemplate = Join-Path $nativeHostDir 'manifests\pixels_roll20_helper.json'

if (-not (Test-Path $manifestTemplate)) {
    throw "Manifest template not found at $manifestTemplate"
}

# Prefer the explicit-target build (matches native-host/README.md and its
# statically-linked CRT config), but fall back to a plain `cargo build
# --release` output in case that's what the host toolchain's default
# target already resolved to.
$candidateExePaths = @(
    (Join-Path $nativeHostDir 'target\x86_64-pc-windows-msvc\release\pixels-roll20-helper.exe'),
    (Join-Path $nativeHostDir 'target\release\pixels-roll20-helper.exe')
)
$sourceExe = $candidateExePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $sourceExe) {
    throw "Could not find a built pixels-roll20-helper.exe. Build it first:`n  cd native-host`n  cargo build --release --target x86_64-pc-windows-msvc"
}

$installDir = Join-Path $env:LOCALAPPDATA 'PixelsRoll20'
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

$installedExe = Join-Path $installDir 'pixels-roll20-helper.exe'
Copy-Item -Path $sourceExe -Destination $installedExe -Force
Write-Host "Copied helper to $installedExe"

$manifest = Get-Content -Path $manifestTemplate -Raw | ConvertFrom-Json
$manifest.path = $installedExe
$installedManifest = Join-Path $installDir 'pixels_roll20_helper.json'
# Write UTF-8 without a BOM explicitly — PowerShell's -Encoding utf8 adds a
# BOM on Windows PowerShell 5.1, which some JSON readers choke on.
[System.IO.File]::WriteAllText($installedManifest, ($manifest | ConvertTo-Json -Depth 5))
Write-Host "Wrote manifest to $installedManifest"

$registryKeyPath = 'HKCU:\Software\Mozilla\NativeMessagingHosts\pixels_roll20_helper'
New-Item -Path $registryKeyPath -Force | Out-Null
Set-Item -Path $registryKeyPath -Value $installedManifest
Write-Host "Registered native messaging host at $registryKeyPath"

Write-Host ''
Write-Host 'Done. Next steps:'
Write-Host '  1. Build the Firefox extension:  npm run build:firefox'
Write-Host '  2. In Firefox, open about:debugging#/runtime/this-firefox'
Write-Host "  3. Click 'Load Temporary Add-on...' and select dist\firefox\manifest.json"
Write-Host '  4. Open a Roll20 game and click Connect in the extension popup'
Write-Host ''
Write-Host 'To remove this later, run scripts\uninstall-host.ps1'
