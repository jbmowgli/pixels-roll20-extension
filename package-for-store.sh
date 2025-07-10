#!/bin/bash

# Chrome Web Store Packaging Script
# This script builds and packages the extension for submission to the Chrome Web Store

set -e  # Exit on any error

echo "🚀 Building Pixels Roll20 Extension for Chrome Web Store..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -f "manifest.json" ]]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Clean up any existing builds
print_status "Cleaning previous builds..."
rm -rf dist/
rm -f pixels-roll20-extension-store.zip

# Run linting
print_status "Running ESLint..."
if ! npm run lint; then
    print_error "Linting failed. Please fix errors before packaging."
    exit 1
fi

# Run tests
print_status "Running tests..."
if ! npm run test; then
    print_error "Tests failed. Please fix tests before packaging."
    exit 1
fi

# Build for production
print_status "Building for production..."
if ! npm run build:prod; then
    print_error "Production build failed."
    exit 1
fi

# Validate that essential files exist
print_status "Validating build output..."
required_files=(
    "dist/manifest.json"
    "dist/background/background.js"
    "dist/content/roll20.js"
    "dist/components/popup/popup.html"
    "dist/components/popup/popup.js"
    "dist/components/popup/popup.css"
    "dist/components/modifierBox/modifierBox.js"
    "dist/assets/images/logo-128.png"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        print_error "Required file missing: $file"
        exit 1
    fi
done

print_success "All required files present"

# Check manifest version
manifest_version=$(grep '"version"' dist/manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
print_status "Extension version: $manifest_version"

# Create the zip package
print_status "Creating Chrome Web Store package..."
cd dist
zip -r ../pixels-roll20-extension-store.zip . -x "*.map" "*.DS_Store"
cd ..

# Get file size
if command -v du &> /dev/null; then
    file_size=$(du -h pixels-roll20-extension-store.zip | cut -f1)
    print_success "Package created: pixels-roll20-extension-store.zip ($file_size)"
else
    print_success "Package created: pixels-roll20-extension-store.zip"
fi

# Final validation
print_status "Performing final validation..."
if [[ ! -f "pixels-roll20-extension-store.zip" ]]; then
    print_error "Package file was not created successfully"
    exit 1
fi

# Check package size (Chrome Web Store has a 20MB limit)
if command -v stat &> /dev/null; then
    size_bytes=$(stat -f%z pixels-roll20-extension-store.zip 2>/dev/null || stat -c%s pixels-roll20-extension-store.zip 2>/dev/null)
    size_mb=$((size_bytes / 1024 / 1024))
    
    if [[ $size_mb -gt 20 ]]; then
        print_warning "Package size (${size_mb}MB) exceeds Chrome Web Store limit (20MB)"
    else
        print_success "Package size OK (${size_mb}MB)"
    fi
fi

echo ""
print_success "🎉 Extension successfully packaged for Chrome Web Store!"
echo ""
echo "📦 Package file: pixels-roll20-extension-store.zip"
echo "📋 Version: $manifest_version"
echo ""
echo "Next steps:"
echo "1. Go to https://chrome.google.com/webstore/devconsole"
echo "2. Upload pixels-roll20-extension-store.zip"
echo "3. Fill out the store listing details"
echo "4. Submit for review"
echo ""
print_warning "Remember to test the packaged extension in a clean Chrome profile before submitting!"
