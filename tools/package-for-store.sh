#!/bin/bash

# Chrome Web Store Package Script
# This script creates a clean ZIP package for Chrome Web Store submission

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Create package directory
PACKAGE_DIR="chrome-store-package"
SOURCE_DIR=$(pwd)

# Extract version from manifest.json
VERSION=$(node -p "require('./manifest.json').version")
ZIP_PATH="$SOURCE_DIR/PixelsRoll20Extension-v${VERSION}.zip"

echo -e "${GREEN}Creating Chrome Web Store package...${NC}"

# Remove existing package directory if it exists
if [ -d "$PACKAGE_DIR" ]; then
    rm -rf "$PACKAGE_DIR"
fi

# Create new package directory
mkdir -p "$PACKAGE_DIR"

# Files/folders to include in the package
INCLUDE_ITEMS=(
    "manifest.json"
    "LICENSE"
    "src"
    "assets"
    "docs/PRIVACY_POLICY.md"
    "docs/USER_GUIDE.md"
    "docs/INSTALLATION.md"
    "docs/QUICK_REFERENCE.md"
    "docs/TROUBLESHOOTING.md"
)

# Copy files to package directory
for item in "${INCLUDE_ITEMS[@]}"; do
    source_path="$SOURCE_DIR/$item"
    dest_path="$PACKAGE_DIR/$item"
    
    if [ -e "$source_path" ]; then
        # Create destination directory if needed
        dest_parent=$(dirname "$dest_path")
        mkdir -p "$dest_parent"
        
        if [ -d "$source_path" ]; then
            # It's a directory
            cp -r "$source_path" "$dest_path"
            echo -e "${YELLOW}Copied directory: $item${NC}"
        else
            # It's a file
            cp "$source_path" "$dest_path"
            echo -e "${YELLOW}Copied file: $item${NC}"
        fi
    else
        echo -e "${RED}Warning: $item not found${NC}"
    fi
done

# Create ZIP file
echo -e "${GREEN}Creating ZIP file...${NC}"
if [ -f "$ZIP_PATH" ]; then
    rm -f "$ZIP_PATH"
fi

# Change to package directory and create zip from there (cleaner structure)
cd "$PACKAGE_DIR"
zip -r "../$(basename "$ZIP_PATH")" . > /dev/null
cd "$SOURCE_DIR"

# Clean up temporary directory
rm -rf "$PACKAGE_DIR"

# Get file size in MB
if [ -f "$ZIP_PATH" ]; then
    file_size=$(du -m "$ZIP_PATH" | cut -f1)
    echo -e "${GREEN}Package created successfully: $ZIP_PATH${NC}"
    echo -e "${CYAN}Package size: ${file_size} MB${NC}"
    
    echo -e "\n${MAGENTA}Next steps:${NC}"
    echo -e "${WHITE}1. Go to: https://chrome.google.com/webstore/devconsole/${NC}"
    echo -e "${WHITE}2. Click 'New Item' and upload the ZIP file${NC}"
    echo -e "${WHITE}3. Fill in the store listing details${NC}"
    echo -e "${WHITE}4. Add screenshots and complete the submission${NC}"
else
    echo -e "${RED}Error: Failed to create ZIP file${NC}"
    exit 1
fi
