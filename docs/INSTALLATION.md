# Installation Guide

## Requirements

- Chrome(ium) browser (version 88 or later)
- Bluetooth-enabled computer
- Pixels dice
- Roll20 account

**Development Only**:
- Node.js (version 14 or later) - only needed if building from source

## Installation Options

### Option 1: Pre-built Package (Recommended) ⚡

**Fastest method**: Download and install the ready-to-use extension in under 2 minutes.

#### Steps:
1. **Download the Extension**
   - Download `pixels-roll20-extension-store.zip` from the [latest release](../../releases)
   - Or get it directly from the repository root

2. **Extract the Package**
   - Unzip the downloaded file to any folder
   - You'll see a `dist/` folder containing the built extension

3. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" ON (top-right corner)
   - Click "Load unpacked" button
   - Navigate to and select the **`dist`** folder (must contain `manifest.json`)
   - Extension icon should appear in Chrome toolbar

4. **Verify Installation**
   - Look for the Pixels dice icon in Chrome toolbar
   - Click it to open the popup interface
   - Ready to connect your dice!

### Option 2: Build from Source (Developers)

**For developers**: Build the extension yourself from the source code with webpack.

#### Prerequisites:
```bash
# Ensure you have Node.js installed
node --version  # Should be 14 or later
npm --version   # Should be 6 or later
```

#### Steps:
1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/PixelsRoll20ChromeExtension.git
   cd PixelsRoll20ChromeExtension
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Extension with Webpack**
   ```bash
   # For development build (faster, includes source maps)
   npm run build

   # For production build (optimized, minified)
   npm run build:prod
   ```

4. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" ON (top-right corner)
   - Click "Load unpacked" button
   - Navigate to and select the **`dist`** folder (created by webpack)
   - Extension icon should appear in Chrome toolbar

## Verification

After installation (either method):

1. **Extension Loaded**: Look for the Pixels dice icon in Chrome toolbar
2. **Popup Works**: Click the icon - popup should open without errors
3. **Permissions Granted**: Extension should have all required permissions
4. **Ready for Roll20**: Navigate to a Roll20 game to test

## Development Setup (Optional)

If you plan to modify the extension or contribute to development:

### Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
npm run lint:fix  # Auto-fix issues

# Format code
npm run format

# Development builds
npm run build          # Development build (fast, includes source maps)
npm run watch          # Development build with auto-rebuild on file changes

# Production builds
npm run build:prod     # Optimized production build
npm run build:store    # Full store package (lint + test + build)
npm run zip:store      # Create zip package from dist/ folder
```

### Development Workflow

1. **Make Changes**: Edit files in the `src/` directory
2. **Build**: Run `npm run build` or `npm run watch` (auto-rebuild)
3. **Reload Extension**: 
   - Go to `chrome://extensions/`
   - Click the reload button (🔄) next to the extension
4. **Test Changes**: Verify functionality in Roll20

1. **Make Changes**: Edit files in the `src/` directory
2. **Build**: Run `npm run build` to rebuild the `dist/` folder
3. **Reload Extension**: Click the reload button (🔄) in `chrome://extensions/`
4. **Test Changes**: Verify your changes work in Roll20

## First Use

### Connect Dice

1. Wake your dice (roll them gently)
2. Click "Connect" in the extension popup
3. Select your dice from the list
4. You should see "Connected" status

### Test Modifier Box

1. Click "Show Modifier Box" in popup
2. A floating box should appear on your Roll20 page
3. You can drag it around and resize it
4. Click "Hide Modifier Box" in popup to close it
5. Use "−" button to minimize (temporary hide)

### Test Chat Display

1. **With modifier box visible**: Roll dice → See detailed breakdown
2. **With modifier box hidden**: Roll dice → See simple result
3. Chat format automatically adapts to box visibility

That's it! Roll your dice and they should appear in Roll20 chat.

### Prepare Your Dice

#### Charge Your Dice

- Ensure all Pixels dice are fully charged
- Charging typically takes 1-2 hours
- Check battery status using Pixels official app

#### Test Dice Functionality

- Roll dice to wake them up
- Verify they're responding to movement
- Check LED functionality

### Configure Roll20

#### Browser Settings

- Allow Chrome to access microphone/camera if needed
- Disable pop-up blockers for Roll20 domain
- Clear browser cache if experiencing issues

#### Roll20 Account

- Ensure you're logged into Roll20
- Join or create a game session
- Verify chat functionality works normally

## Verification Steps

### Extension Health Check

1. **Extension Icon**: Visible in Chrome toolbar
2. **Popup Function**: Opens when clicked
3. **Permissions**: All required permissions granted
4. **Console Errors**: No errors in browser console (F12)

### Bluetooth Connectivity

1. **Device Discovery**: Pixels dice appear in Bluetooth picker
2. **Connection**: Dice connect successfully
3. **Status Display**: Extension shows connection status
4. **Roll Detection**: Physical rolls trigger responses

### Roll20 Integration

1. **Page Recognition**: Extension works on Roll20 game pages
2. **Chat Integration**: Rolls appear in Roll20 chat
3. **Modifier Box**: Floating interface appears correctly
4. **Theme Adaptation**: Interface matches Roll20 theme

## Troubleshooting Installation

### Common Installation Issues

#### Extension Not Loading

**Problem**: "Load unpacked" fails or extension doesn't appear

**Solutions**:

- Verify you selected the correct folder (containing manifest.json)
- Check that all files are present and not corrupted
- Ensure Chrome Developer Mode is enabled
- Try refreshing the extensions page

#### Permission Errors

**Problem**: Extension can't access required features

**Solutions**:

- Manually grant permissions in Chrome settings
- Check that antivirus isn't blocking the extension
- Restart Chrome after installation
- Clear browser data and reinstall

#### Bluetooth Not Working

**Problem**: Can't connect to Pixels dice

**Solutions**:

- Verify Bluetooth is enabled on computer
- Check that dice are charged and responsive
- Ensure no other devices are connected to dice
- Try restarting Bluetooth service

### Advanced Troubleshooting

#### Developer Console

1. Press F12 to open developer tools
2. Check Console tab for error messages
3. Look for red error messages related to the extension
4. Copy error messages for further troubleshooting

#### Extension Logs

1. Go to `chrome://extensions/`
2. Find Pixels Roll20 extension
3. Click "Inspect views: background page"
4. Check console for background script errors

#### Clean Reinstall

1. Remove extension from Chrome
2. Clear browser cache and cookies
3. Restart Chrome browser
4. Reinstall extension from scratch

## Updating the Extension

### Pre-built Package Updates

1. **Download Latest Version**: Get the newest `pixels-roll20-extension-store.zip` 
2. **Remove Old Extension**: 
   - Go to `chrome://extensions/`
   - Find Pixels Roll20 extension
   - Click "Remove" button
3. **Install New Version**: 
   - Extract new package
   - Load the `dist/` folder using "Load unpacked"
4. **Verify Update**: Test that new features/fixes are working

### Source Build Updates

#### Update Source Code

```bash
cd PixelsRoll20ChromeExtension
git pull origin main
npm install  # Update dependencies if needed
npm run build:prod  # Rebuild with webpack
```

#### Reload Extension in Chrome

1. Go to `chrome://extensions/`
2. Find Pixels Roll20 extension
3. Click reload button (🔄)
4. Verify extension works after reload

## Uninstalling the Extension

### Complete Removal

1. **Remove from Chrome**:
   - Go to `chrome://extensions/`
   - Find Pixels Roll20 extension
   - Click "Remove" button
   - Confirm removal

2. **Clean Up Files**:
   - Delete extension folder from computer
   - Clear any cached data
   - Remove from browser bookmarks if added

3. **Reset Settings**:
   - Clear extension data from Chrome storage
   - Reset any modified browser permissions
   - Restart Chrome to complete cleanup

## Getting Help

### Before Seeking Help

1. **Check Requirements**: Verify system meets all requirements
2. **Try Basic Fixes**: Restart browser, reconnect dice, refresh page
3. **Read Documentation**: Review USER_GUIDE.md for detailed help
4. **Check Console**: Look for error messages in developer console

### Documentation Resources

- **USER_GUIDE.md**: Comprehensive usage instructions
- **QUICK_REFERENCE.md**: Fast troubleshooting guide
- **PROJECT_STRUCTURE.md**: Technical documentation

### Community Support

- GitHub Issues: Report bugs and request features
- Pixels Community: Connect with other Pixels users
- Roll20 Forums: General Roll20 integration questions

---

**Installation complete!** You're now ready to bring the magic of Pixels dice to your Roll20 sessions. Roll on! 🎲
