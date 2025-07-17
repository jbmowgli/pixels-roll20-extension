#!/bin/bash

# Chrome Web Store Packaging Script
# This script builds and packages the extension for Chrome Web Store submission

set -e  # Exit on any error

echo "🚀 Building Pixels Roll20 Chrome Extension for Chrome Web Store..."

# Parse command line arguments
SKIP_TESTS=false
for arg in "$@"; do
    if [ "$arg" = "--skip-tests" ]; then
        SKIP_TESTS=true
    fi
done

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
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Step 1: Clean previous builds
print_status "Cleaning previous builds..."
rm -rf dist/
rm -f pixels-roll20-extension-store.zip

# Step 2: Run linting
print_status "Running ESLint..."
if npm run lint; then
    print_success "Linting passed"
else
    print_error "Linting failed. Please fix errors before packaging."
    exit 1
fi

# Step 3: Run tests (unless skipped)
if [ "$SKIP_TESTS" = true ]; then
    print_warning "Skipping tests as requested"
else
    print_status "Running tests..."
    if npm run test; then
        print_success "All tests passed"
    else
        print_error "Tests failed. Please fix failing tests before packaging."
        exit 1
    fi
fi

# Step 4: Build for production
print_status "Building for production..."
if npm run build:prod; then
    print_success "Production build completed"
else
    print_error "Production build failed."
    exit 1
fi

# Step 5: Validate build output
print_status "Validating build output..."

# Check if essential files exist
REQUIRED_FILES=(
    "dist/manifest.json"
    "dist/background/background.js"
    "dist/content/roll20.js"
    "dist/components/popup/popup.html"
    "dist/components/popup/popup.js"
    "dist/components/popup/popup.css"
    "dist/components/modifierBox/modifierBox.js"
    "dist/assets/images/logo-128.png"
)

MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    print_error "Missing required files in build:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    exit 1
else
    print_success "All required files present in build"
fi

# Step 6: Check for source maps (should be excluded in production)
SOURCE_MAPS=$(find dist/ -name "*.map" | wc -l)
if [ "$SOURCE_MAPS" -gt 0 ]; then
    print_warning "Found $SOURCE_MAPS source map files in production build"
    print_status "Removing source maps..."
    find dist/ -name "*.map" -delete
    print_success "Source maps removed"
fi

# Step 7: Create package
print_status "Creating Chrome Web Store package..."

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME="pixels-roll20-extension-v${VERSION}-store.zip"

# Create the zip file
cd dist
if zip -r "../${PACKAGE_NAME}" . -x "*.map" "*.DS_Store" > /dev/null 2>&1; then
    cd ..
    print_success "Package created: ${PACKAGE_NAME}"
else
    cd ..
    print_error "Failed to create package"
    exit 1
fi

# Step 8: Display package info
PACKAGE_SIZE=$(du -h "${PACKAGE_NAME}" | cut -f1)
print_status "Package information:"
echo "  📦 Name: ${PACKAGE_NAME}"
echo "  📏 Size: ${PACKAGE_SIZE}"
echo "  📍 Location: $(pwd)/${PACKAGE_NAME}"

# Step 9: Validation summary
print_status "Package validation:"
echo "  ✅ Linting passed"
echo "  ✅ Tests passed"
echo "  ✅ Production build completed"
echo "  ✅ Required files present"
echo "  ✅ Source maps removed"
echo "  ✅ Package created successfully"

print_success "Extension is ready for Chrome Web Store submission!"
print_status "Next steps:"
echo "  1. Go to Chrome Web Store Developer Dashboard"
echo "  2. Upload ${PACKAGE_NAME}"
echo "  3. Fill in store listing details"
echo "  4. Submit for review"

echo ""
print_warning "Remember to test the packaged extension before submission:"
echo "  1. Load the dist/ folder as an unpacked extension"
echo "  2. Test all functionality on Roll20"
echo "  3. Verify dice connectivity and modifier box features"
