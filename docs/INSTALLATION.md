# Installation

## Requirements

- Chrome(ium) browser
- Bluetooth-enabled computer
- Pixels dice
- Roll20 account

## Install Steps

### 1. Get the Extension

- Download zip from GitHub or clone the repo
- Extract to a folder if needed

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Turn on "Developer mode" (top-right)
3. Click "Load unpacked"
4. Select the extension folder (containing `manifest.json`)

### 3. Test It

1. Go to a Roll20 game
2. Click the Pixels icon in Chrome toolbar
3. You should see "Connect" and "Show Modifier Box" buttons

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

### Manual Updates

#### Git Repository Updates

```bash
cd PixelsRoll20ChromeExtension
git pull origin main
```

#### File Replacement Updates

1. Download latest version
2. Replace old files with new ones
3. Reload extension in Chrome
4. Test functionality after update

### Reload Extension

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
