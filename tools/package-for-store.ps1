# Chrome Web Store Package Script
# This script creates a clean ZIP package for Chrome Web Store submission

# Create package directory
$packageDir = "chrome-store-package"
$sourceDir = Get-Location
$zipPath = "$sourceDir\PixelsRoll20Extension-v1.0.0.zip"

Write-Host "Creating Chrome Web Store package..." -ForegroundColor Green

# Remove existing package directory if it exists
if (Test-Path $packageDir) {
    Remove-Item $packageDir -Recurse -Force
}

# Create new package directory
New-Item -ItemType Directory -Path $packageDir | Out-Null

# Files/folders to include in the package
$includeItems = @(
    "manifest.json",
    "LICENSE",
    "src",
    "assets",
    "docs\PRIVACY_POLICY.md",
    "docs\USER_GUIDE.md",
    "docs\INSTALLATION.md",
    "docs\QUICK_REFERENCE.md",
    "docs\TROUBLESHOOTING.md"
)

# Copy files to package directory
foreach ($item in $includeItems) {
    $sourcePath = Join-Path $sourceDir $item
    $destPath = Join-Path $packageDir $item
    
    if (Test-Path $sourcePath) {
        if (Test-Path $sourcePath -PathType Container) {
            # It's a directory
            $destParent = Split-Path $destPath -Parent
            if (!(Test-Path $destParent)) {
                New-Item -ItemType Directory -Path $destParent -Force | Out-Null
            }
            Copy-Item $sourcePath $destPath -Recurse
            Write-Host "Copied directory: $item" -ForegroundColor Yellow
        } else {
            # It's a file
            $destParent = Split-Path $destPath -Parent
            if (!(Test-Path $destParent)) {
                New-Item -ItemType Directory -Path $destParent -Force | Out-Null
            }
            Copy-Item $sourcePath $destPath
            Write-Host "Copied file: $item" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Warning: $item not found" -ForegroundColor Red
    }
}

# Create ZIP file
Write-Host "Creating ZIP file..." -ForegroundColor Green
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($packageDir, $zipPath)

# Clean up temporary directory
Remove-Item $packageDir -Recurse -Force

Write-Host "Package created successfully: $zipPath" -ForegroundColor Green
Write-Host "Package size: $([math]::Round((Get-Item $zipPath).Length / 1MB, 2)) MB" -ForegroundColor Cyan

Write-Host "`nNext steps:" -ForegroundColor Magenta
Write-Host "1. Go to: https://chrome.google.com/webstore/devconsole/" -ForegroundColor White
Write-Host "2. Click 'New Item' and upload the ZIP file" -ForegroundColor White
Write-Host "3. Fill in the store listing details" -ForegroundColor White
Write-Host "4. Add screenshots and complete the submission" -ForegroundColor White
