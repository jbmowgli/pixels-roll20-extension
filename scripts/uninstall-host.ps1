<#
.SYNOPSIS
    Removes the pixels-roll20-helper native messaging host registration
    installed by install-host.ps1.

.DESCRIPTION
    Deletes the HKCU\Software\Mozilla\NativeMessagingHosts registry key and
    the installed copy of the helper + manifest under
    %LOCALAPPDATA%\PixelsRoll20\. Safe to run even if nothing is installed.

.EXAMPLE
    .\scripts\uninstall-host.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$registryKeyPath = 'HKCU:\Software\Mozilla\NativeMessagingHosts\pixels_roll20_helper'
if (Test-Path $registryKeyPath) {
    Remove-Item -Path $registryKeyPath -Force
    Write-Host "Removed registry key $registryKeyPath"
} else {
    Write-Host "Registry key $registryKeyPath was not present"
}

$installDir = Join-Path $env:LOCALAPPDATA 'PixelsRoll20'
if (Test-Path $installDir) {
    Remove-Item -Path $installDir -Recurse -Force
    Write-Host "Removed $installDir"
} else {
    Write-Host "$installDir was not present"
}

Write-Host ''
Write-Host 'pixels-roll20-helper native messaging host uninstalled.'
