# Developer Guide

## Setup

### Requirements

- Chrome(ium) browser with Developer Mode
- Node.js 16+ and npm (for building from source)
- Code editor (VS Code, Sublime, etc.)
- Basic JavaScript knowledge

### Development Installation

For complete setup instructions, see the **[Installation Guide](INSTALLATION.md)**.

**Quick developer setup:**

1. Clone/download the repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build` or `npm run build:prod`
4. Load the `dist/` folder in Chrome Developer Mode
5. Use "Reload" button when making changes

### Build Commands

```bash
# Development build (with source maps)
npm run build

# Production build (optimized)
npm run build:prod

# Watch mode for development
npm run watch

# Build for Chrome Web Store
npm run build:store

# Create store package
npm run zip:store
```

### Key Files

**Main Entry Point:**
- `src/content/roll20.js` - Main coordinator (ES module architecture)

**Core Modules (ES Modules):**
- `src/content/modules/` - Core functionality modules:
  - `Utils.js` - Common utilities and logging
  - `PopupDetection.js` - Popup detection logic
  - `Roll20Integration.js` - Roll20 chat integration
  - `StorageManager.js` - Chrome storage management
  - `ModifierBoxManager.js` - Modifier box lifecycle
  - `PixelsBluetooth.js` - Bluetooth dice connection with multi-device support

**UI Components (ES Modules):**
- `src/components/modifierBox/` - Modifier box UI components:
  - `modifierBox.js` - Main modifier box UI
  - `themeManager.js` - Theme adaptation
  - `rowManager.js` - Row management
  - `dragHandler.js` - Drag functionality
  - `dragDropManager.js` - Drag & drop coordination

**Shared Utilities (ES Modules):**
- `src/utils/` - Shared utilities:
  - `modifierSettings.js` - Modifier storage utilities
  - `themeDetector.js` - Theme detection
  - `cssLoader.js` - Dynamic CSS loading
  - `htmlLoader.js` - Dynamic HTML loading

**Build Output:**
- `dist/` - Webpack build output (load this folder in Chrome)
- `manifest.json` - Extension configuration

## Development

### Architecture Overview

The extension uses a modern **ES module architecture** with webpack for building:

- **ES Modules**: All components use modern import/export syntax
- **Webpack Build**: Bundles modules for browser compatibility
- **Multi-Device Support**: Bluetooth connection supports multiple dice simultaneously
- **Theme Adaptation**: Automatic light/dark theme detection and UI adaptation

### Testing

**Unit Tests**: Run the Jest test suite:

```bash
npm test
```

**Integration Testing**: The extension has comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

**Manual Testing**: 
1. Build the extension: `npm run build`
2. Load `dist/` folder in Chrome Developer Mode
3. Test on Roll20 with real Pixels dice

### Debugging

- **Background script**: chrome://extensions/ → "Inspect views"
- **Content scripts**: F12 on Roll20 page → Console tab
- **Popup**: Right-click extension icon → "Inspect popup"
- **Build issues**: Check webpack output in terminal
- **Module errors**: Check browser console for import/export errors

### Hot Reload Development

For faster development:

```bash
# Terminal 1: Start webpack in watch mode
npm run watch

# Terminal 2: Load dist/ in Chrome, then reload extension when files change
```

## Code Guidelines

### JavaScript (ES Modules)

```javascript
// ES Module imports/exports
import { ThemeDetector } from '../utils/themeDetector.js';
import { CSSLoader } from '../utils/cssLoader.js';

// Export functions and classes
export class ModifierBox {
  constructor() {
    // Use camelCase for variables
    this.modifierValue = 0;
  }
}

// Export default for main classes
export default ModifierBox;

// Use UPPER_CASE for constants
const PIXELS_SERVICE_UUID = 'service-uuid';
```

### Webpack Configuration

The project uses webpack for building:

```javascript
// webpack.config.js handles:
// - ES module compilation
// - File copying (manifest.json, assets)
// - Development/production builds
// - Source maps for debugging
```

### CSS

```css
/* Use specific selectors to avoid conflicts */
#pixels-modifier-box .modifier-row {
  /* styles */
}

/* Use !important sparingly, only for Roll20 overrides */
.pixels-element {
  color: #ffffff !important;
}
```

## API Reference

### Core Modules

```javascript
// Utils module
window.PixelsUtils.log('Debug message');
const firstElement = window.PixelsUtils.getArrayFirstElement(array);

// Roll20 Integration
window.Roll20Integration.postChatMessage('Your message');

// Storage Manager
window.StorageManager.saveModifierData(data);
window.StorageManager.loadModifierData(callback);

// ModifierBox Manager
window.ModifierBoxManager.createModifierBox();
window.ModifierBoxManager.hideModifierBox();
window.ModifierBoxManager.showModifierBox();
```

### Legacy Compatibility

```javascript
// These still work for backward compatibility
window.log('Debug message');
window.getArrayFirstElement(array);
window.postChatMessage('Your message');
```

### Theme Detection

```javascript
// Get current theme
const colors = window.ThemeDetector.getThemeColors();

// Listen for theme changes
window.ThemeDetector.onThemeChange(newTheme => {
  console.log('Theme changed:', newTheme);
});
```

### Bluetooth

```javascript
// Connect to Pixels dice
async function connectPixel() {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PIXELS_SERVICE_UUID] }],
    });
    // handle connection
  } catch (error) {
    console.error('Connection failed:', error);
  }
}
```

## Messaging

### Message Passing

```javascript
// Popup to content script
chrome.tabs.sendMessage(tabId, {
  action: 'connect',
  data: { deviceId: 'pixels-001' },
});
```

## Testing

The project includes comprehensive Jest test coverage for all major components:

### Working Tests (141 tests passing)

**ModifierBox Tests (96 tests)**

- `tests/jest/modifierBox/index.test.js` - Core ModifierBox functionality
- `tests/jest/modifierBox/dragHandler.test.js` - Drag and drop behavior
- `tests/jest/modifierBox/themeManager.test.js` - Theme switching and detection
- `tests/jest/modifierBox/rowManager.test.js` - Row management and validation

**Roll20 Integration Tests (45 tests)**

- `tests/jest/roll20-basic.test.js` - Basic module loading and error handling
- `tests/jest/roll20-simple.test.js` - Message handling, Bluetooth, and ModifierBox integration

### Running Tests

```bash
# Run all working tests
npm test -- tests/jest/roll20-basic.test.js tests/jest/roll20-simple.test.js tests/jest/modifierBox/

# Run specific test suites
npm test -- tests/jest/modifierBox/        # ModifierBox tests only
npm test -- tests/jest/roll20-basic.test.js # Basic roll20 tests only
npm test -- tests/jest/roll20-simple.test.js # Simple integration tests only

# Run all tests (includes some failing advanced tests)
npm test
```

### Test Coverage

Current test coverage focuses on:

- ✅ **ModifierBox UI**: Components and interactions (ES modules)
- ✅ **Roll20 Integration**: Message handling and Chrome extension communication
- ✅ **Error Handling**: Edge cases and error scenarios
- ✅ **Bluetooth Connection**: Multi-device connection scenarios
- ✅ **DOM Interaction**: Safe DOM manipulation and event handling
- ✅ **Extension Lifecycle**: Background script and content script coordination
- ✅ **Theme Adaptation**: Light/dark theme switching
- ✅ **Storage Management**: Chrome storage operations

Test architecture includes:

- **ES Module Testing**: All tests use modern import/export syntax
- **Comprehensive Mocking**: Chrome APIs, Bluetooth APIs, DOM interactions
- **Multi-Device Testing**: Bluetooth connection with multiple dice
- **Theme Testing**: Light/dark theme adaptation
- **Error Boundary Testing**: Robust error handling validation

## Packaging for Distribution

### Chrome Web Store Package

The extension includes automated packaging for the Chrome Web Store:

```bash
# Build and create store package
npm run build:store
npm run zip:store

# This creates: pixels-roll20-extension-store.zip
```

Alternative packaging scripts:

```bash
# Unix/macOS/Linux
./scripts/package-for-store.sh

# Windows PowerShell
./tools/package-for-store.ps1
```

### Build Output Structure

The webpack build creates:

```
dist/
├── manifest.json          # Extension manifest
├── background/            # Background scripts
├── content/              # Content scripts (bundled)
├── components/           # UI components (bundled)
├── assets/              # Images and icons
└── popup/               # Extension popup
```

### Distribution Files

**For Chrome Web Store:**
- Use `pixels-roll20-extension-store.zip` (created by `npm run zip:store`)
- Contains only production files, no source code

**For Manual Distribution:**
- Include `dist/` folder contents
- Add documentation: `docs/USER_GUIDE.md`, `docs/INSTALLATION.md`
- Include `LICENSE` and `README.md`

### Development vs Production

**Development (`npm run build`):**
- Source maps included
- Verbose webpack output
- Faster build times

**Production (`npm run build:prod`):**
- Optimized and minified
- No source maps
- Smaller bundle size
- Used for store packaging

## Contributing

### Process

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Testing Checklist

- [ ] **Extension loads**: `npm run build` → load `dist/` in Chrome
- [ ] **No build errors**: Check webpack output
- [ ] **No console errors**: Check browser console
- [ ] **Modifier box works**: Test in light/dark themes
- [ ] **Multi-device Bluetooth**: Connect multiple dice simultaneously
- [ ] **Responsive UI**: Test with different screen sizes
- [ ] **All tests pass**: `npm test` returns 100% pass rate

### Multi-Device Testing

The extension now supports multiple dice connections:

- Test connecting 2+ dice simultaneously
- Verify each die maintains independent connection
- Check that all dice send rolls to Roll20 chat
- Ensure proper device identification and management

That's it! The codebase uses modern ES modules with webpack for a clean, maintainable architecture.
