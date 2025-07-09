# Project Structure

This document outlines the organization of the Pixels Roll20 Chrome Extension project.

## Directory Structure

```
PixelsRoll20ChromeExtension/
├── src/                          # Source code
│   ├── background/               # Background script
│   │   └── background.js         # Extension background script
│   ├── content/                  # Content scripts (injected into Roll20)
│   │   ├── modules/              # Modular Roll20 components
│   │   │   ├── Utils.js          # Utility functions and helpers
│   │   │   ├── PopupDetection.js # Roll20 popup window detection
│   │   │   ├── ExtensionMessaging.js # Chrome extension communication
│   │   │   ├── Roll20Integration.js  # Roll20 platform integration
│   │   │   ├── StorageManager.js     # Settings persistence management
│   │   │   ├── ModifierBoxManager.js # Modifier box coordination
│   │   │   └── PixelsBluetooth.js    # Bluetooth dice management
│   │   └── roll20.js             # Main coordinator (loads and coordinates modules)
│   ├── components/               # UI components
│   │   ├── modifierBox/          # Modifier box component (camelCase naming)
│   │   │   ├── index.js          # Main component entry point
│   │   │   ├── modifierBox.js    # Core modifier box functionality
│   │   │   ├── modifierBox.html  # HTML template
│   │   │   ├── themeManager.js   # Theme styling and updates
│   │   │   ├── dragHandler.js    # Drag functionality
│   │   │   ├── rowManager.js     # Row management (add/remove modifiers)
│   │   │   └── styles/           # CSS stylesheets
│   │   │       ├── modifierBox.css    # Base styles
│   │   │       ├── minimized.css      # Minimized state styles
│   │   │       └── lightTheme.css     # Light theme overrides
│   │   ├── popup/                # Extension popup
│   │   │   ├── popup.html        # Popup UI
│   │   │   ├── popup.css         # Popup styles
│   │   │   └── popup.js          # Popup logic and script injection
│   │   └── options/              # Extension options page
│   │       ├── options.html      # Options UI
│   │       ├── options.css       # Options styles
│   │       └── options.js        # Options logic
│   └── utils/                    # Shared utilities
│       ├── modifierSettings.js   # Modifier settings persistence (localStorage)
│       ├── themeDetector.js      # Roll20 theme detection module
│       ├── cssLoader.js          # CSS loading utility
│       └── htmlLoader.js         # HTML template loading utility
├── assets/                       # Static assets
│   ├── images/                   # Images and icons
│   │   └── logo-128.png         # Extension icon
│   ├── screenshots/              # Project screenshots
│   └── New Screenshots/          # Updated screenshots
├── tests/                        # Test infrastructure
│   └── jest/                     # Jest unit tests
│       ├── setup.js              # Test environment setup
│       ├── ModifierBox/          # ModifierBox component tests
│       │   ├── index.test.js     # Main component tests
│       │   ├── themeManager.test.js # Theme management tests
│       │   ├── dragHandler.test.js  # Drag functionality tests
│       │   └── rowManager.test.js   # Row management tests
│       ├── roll20-basic.test.js  # Basic Roll20 integration tests
│       ├── roll20-simple.test.js # Simple Roll20 functionality tests
│       ├── experimental/         # Experimental test suites
│       └── README.md            # Testing documentation
├── docs/                         # Documentation
│   ├── DEVELOPER_GUIDE.md       # Developer setup and guidelines
│   ├── INSTALLATION.md          # Installation instructions
│   ├── USER_GUIDE.md            # Comprehensive user documentation
│   ├── TROUBLESHOOTING.md       # Common issues and solutions
│   ├── QUICK_REFERENCE.md       # Quick command reference
│   ├── PROJECT_STRUCTURE.md     # This file
│   └── PRIVACY_POLICY.md        # Privacy policy
├── Copilot-Feedback/            # GitHub Copilot documentation (gitignored)
├── .github/                     # GitHub configuration
│   └── copilot-instructions.md  # GitHub Copilot configuration
├── .copilot/                    # Copilot configuration
│   └── instructions.md          # Development instructions for Copilot
├── .husky/                      # Git hooks
│   └── pre-commit              # Pre-commit hook script
├── coverage/                    # Test coverage reports (gitignored)
├── node_modules/               # Dependencies (gitignored)
├── manifest.json               # Chrome extension manifest
├── package.json                # NPM configuration and scripts
├── package-lock.json           # NPM dependency lock file
├── .prettierrc                 # Prettier configuration
├── .prettierignore            # Prettier exclusion rules
├── .gitignore                 # Git exclusion rules
├── README.md                  # Project documentation
├── LICENSE                    # License file
├── test.html                  # Manual testing page
└── test-resize.html           # UI resize testing page
```

## File Descriptions

### Core Extension Files

- **manifest.json**: Chrome extension configuration and permissions
- **README.md**: Project documentation and setup instructions
- **LICENSE**: Project license information

### Source Code (`src/`)

#### Background Scripts (`src/background/`)

- **background.js**: Extension background script handling extension lifecycle

#### Content Scripts (`src/content/`)

The content scripts are organized in a modular architecture for better maintainability and separation of concerns:

##### Modular Components (`src/content/modules/`)

The Roll20 integration has been refactored into focused, single-responsibility modules:

- **Utils.js**: Core utility functions and helpers
  - Common helper functions used across modules
  - Utility methods for data processing and validation
- **PopupDetection.js**: Roll20 popup window detection
  - Detects Roll20 popup windows (character sheets, journal entries)
  - URL pattern matching and window size detection
  - Prevents modifier box display in popup contexts
- **ExtensionMessaging.js**: Chrome extension communication
  - Message passing between content script and extension
  - Error handling for extension context invalidation
  - Communication state management
- **Roll20Integration.js**: Roll20 platform integration
  - Chat message posting to Roll20
  - Dice roll result formatting and display
  - Roll20 API interaction methods
- **StorageManager.js**: Settings persistence management
  - Coordinates with modifierSettings.js for data persistence
  - Handles loading and saving of extension state
  - Settings synchronization across sessions
- **ModifierBoxManager.js**: Modifier box coordination
  - Coordinates between the main script and ModifierBox component
  - Manages modifier box lifecycle and state
  - Handles show/hide operations and user interactions
- **PixelsBluetooth.js**: Bluetooth dice management
  - Bluetooth connection management with Pixels dice
  - Dice roll event handling and processing
  - Connection state monitoring and error recovery

##### Main Coordinator (`src/content/roll20.js`)

- **roll20.js**: Main coordinator script (193 lines, down from 846)
  - Loads and coordinates all modules in correct order
  - Sets up message listeners and initializes extension
  - Handles module integration and startup sequence
  - Lightweight orchestration layer for modular components

#### UI Components (`src/components/`)

##### ModifierBox Component (`src/components/modifierBox/`)

- **index.js**: Main component entry point and coordination
  - Component initialization and lifecycle management
  - Integration with Roll20 page and other components
- **modifierBox.js**: Core modifier box functionality (singleton pattern)
  - Main modifier box business logic
  - Component coordination and state management
  - HTML template loading and fallback handling
- **modifierBox.html**: HTML template
  - Clean separation of HTML structure
  - Logo URL placeholder for dynamic replacement
- **themeManager.js**: Theme styling and updates
  - Dynamic CSS injection and theme adaptation
  - External CSS file loading and management
  - Roll20 theme detection integration
- **dragHandler.js**: Drag functionality
  - Mouse-based drag and drop behavior
  - Position updating during drag operations
  - Event handling and state management
- **rowManager.js**: Row management
  - Add/remove modifier rows
  - Radio button and input event handling
  - Global variable synchronization
- **styles/**: CSS stylesheets directory
  - **modifierBox.css**: Base modifier box styles
  - **minimized.css**: Styles for minimized state with text truncation
  - **lightTheme.css**: Light theme color overrides

##### Popup (`src/components/popup/`)

- **popup.html**: Extension popup interface (clean HTML structure)
- **popup.css**: Popup styles (separated from HTML)
- **popup.js**: Popup logic and content script injection

##### Options (`src/components/options/`)

- **options.html**: Extension options page (clean HTML structure)
- **options.css**: Options styles (separated from HTML)
- **options.js**: Options configuration logic

#### Shared Utilities (`src/utils/`)

- **modifierSettings.js**: Modifier settings persistence using localStorage
  - Persistent storage of modifier values and names across browser sessions
  - Save/load/update/clear operations for modifier settings
  - Global scope exports for backward compatibility
  - Feature-based naming (focuses on what it does, not storage mechanism)
- **themeDetector.js**: Roll20 theme detection and monitoring
  - Automatic theme detection (light/dark)
  - Real-time theme change monitoring
  - Color extraction for UI adaptation
- **cssLoader.js**: CSS loading utility
  - Dynamic CSS file loading for Chrome extensions
  - Fallback handling for test environments
- **htmlLoader.js**: HTML template loading utility
  - External HTML template loading
  - Template caching and placeholder replacement

### Assets (`assets/`)

- **images/**: Extension icons and images (logo-128.png)
- **screenshots/**: Development and user screenshots
- **New Screenshots/**: Updated promotional screenshots

### Tests (`tests/`)

- **jest/**: Jest unit test infrastructure
  - **setup.js**: Jest test environment setup and mocks
  - **components/modifierBox/**: Component-specific test suites (camelCase directory)
    - **index.test.js**: Main modifier box component tests
    - **themeManager.test.js**: Theme management tests
    - **dragHandler.test.js**: Drag functionality tests
    - **rowManager.test.js**: Row management tests
  - **roll20.test.js**: Comprehensive Roll20 integration tests (using modular system)
  - **campaignIdValidation.test.js**: Campaign ID validation tests
  - **popup.test.js**: Popup functionality tests
  - **coreModules.test.js**: Core module loading and functionality tests
  - **experimental/**: Experimental test suites (in development)
  - **README.md**: Testing documentation and guidelines

### Development Configuration

- **.copilot/**: GitHub Copilot configuration
  - **instructions.md**: Development instructions for AI assistance
- **.github/**: GitHub-specific configuration
  - **copilot-instructions.md**: GitHub Copilot configuration
- **.husky/**: Git hooks configuration
  - **pre-commit**: Pre-commit hook for code quality
- **Copilot-Feedback/**: AI-generated documentation (gitignored)
- **.prettierrc**: Prettier code formatting configuration
- **.prettierignore**: Prettier exclusion rules
- **.gitignore**: Git exclusion rules
- **package.json**: NPM configuration, scripts, and dependencies
- **package-lock.json**: NPM dependency lock file

## Development Workflow

1. **Content Scripts**: Modify files in `src/content/` for Roll20 integration features
   - **Modular components**: Update focused modules in `src/content/modules/`
   - **Main coordinator**: Update orchestration logic in `src/content/roll20.js`
   - **Module order**: Ensure proper loading sequence in `manifest.json`
2. **UI Components**: Update component files in `src/components/` for interface changes
   - **ModifierBox**: Update component files in `src/components/modifierBox/`
   - **Popup**: Update extension interface in `src/components/popup/`
   - **Options**: Update settings page in `src/components/options/`
3. **Shared Utilities**: Update common functionality in `src/utils/`
   - **Settings**: Modify `modifierSettings.js` for persistence changes
   - **Theme detection**: Update `themeDetector.js` for UI adaptation
   - **Loaders**: Update CSS/HTML loading utilities as needed
4. **Testing**: Use comprehensive Jest test suite
   - **Unit Testing**: Run `npm test` for automated Jest tests (180 tests)
   - **Coverage**: Run `npm run test:coverage` for test coverage reports
   - **Watch Mode**: Run `npm run test:watch` for development
   - **Manual Testing**: Use `test.html` and `test-resize.html` for browser testing
5. **Code Quality**: Pre-commit hooks ensure quality
   - **Automatic formatting**: Prettier runs on all staged files
   - **Test validation**: All tests must pass before commit
6. **Assets**: Add images/icons to `assets/images/`

## Build Process

The extension uses a modular architecture that loads files directly from their organized locations with camelCase naming conventions. No build step is required - the manifest.json references all modules in the correct loading order:

### Module Loading Order

```javascript
// manifest.json content_scripts.js array:
[
  "src/utils/modifierSettings.js",     // Settings persistence
  "src/utils/themeDetector.js",        // Theme detection
  "src/utils/cssLoader.js",            // CSS loading utility
  "src/utils/htmlLoader.js",           // HTML loading utility
  "src/components/modifierBox/themeManager.js",
  "src/components/modifierBox/dragHandler.js",
  "src/components/modifierBox/rowManager.js",
  "src/components/modifierBox/dragDrop.js",
  "src/components/modifierBox/modifierBox.js",
  "src/content/modules/Utils.js",           // Core utilities
  "src/content/modules/PopupDetection.js",  // Popup detection
  "src/content/modules/ExtensionMessaging.js", // Extension communication
  "src/content/modules/Roll20Integration.js",  // Roll20 platform integration
  "src/content/modules/StorageManager.js",     // Storage coordination
  "src/content/modules/ModifierBoxManager.js", // ModifierBox coordination
  "src/content/modules/PixelsBluetooth.js",    // Bluetooth management
  "src/content/roll20.js"               // Main coordinator (loads last)
]
```

This modular approach provides:
- **Clear dependencies**: Each module has defined responsibilities
- **Easy maintenance**: Issues can be isolated to specific modules
- **Testable components**: Each module can be tested independently
- **Flexible architecture**: Modules can be modified without affecting others

### Code Quality Tools

- **Prettier**: Automatic code formatting (`.prettierrc` configuration)
- **Husky**: Git hooks for pre-commit validation
- **lint-staged**: Run formatting and tests on staged files only
- **Jest**: Comprehensive unit testing with 141 stable tests

## Testing Infrastructure

The project includes robust Jest test coverage with pre-commit validation:

### Working Test Suites (180 tests passing)

- **ModifierBox Components**: Component-specific tests covering UI, themes, drag & drop, row management
- **Roll20 Integration**: Comprehensive tests covering messaging, Bluetooth, error handling using modular system
- **Core Modules**: Module loading and functionality validation
- **Campaign Validation**: Campaign ID validation and edge cases
- **Popup Interface**: Extension popup functionality and communication

### Test Files Status

```
✅ tests/jest/components/modifierBox/index.test.js      - ModifierBox component tests
✅ tests/jest/components/modifierBox/dragHandler.test.js - Drag functionality tests  
✅ tests/jest/components/modifierBox/themeManager.test.js - Theme management tests
✅ tests/jest/components/modifierBox/rowManager.test.js  - Row management tests
✅ tests/jest/roll20.test.js                            - Comprehensive Roll20 integration (modular)
✅ tests/jest/campaignIdValidation.test.js              - Campaign ID validation
✅ tests/jest/popup.test.js                             - Popup functionality  
✅ tests/jest/coreModules.test.js                       - Core module loading

🧪 tests/jest/experimental/                             - Development test suites
   ├── BluetoothConnection.test.js                     - Bluetooth API mocking challenges
   ├── ExtensionMessaging.test.js                      - Chrome API mocking complexity  
   ├── ChatIntegration.test.js                         - DOM integration scenarios
   ├── Pixel.test.js                                   - Advanced Pixels dice scenarios
   └── roll20-*.test.js                                - Complex Roll20 integration tests
```

### Test Commands

```bash
# Run all stable tests (recommended)
npm test

# Run tests in watch mode for development
npm run test:watch

# Generate coverage reports
npm run test:coverage

# Run specific test suites
npm test -- tests/jest/components/modifierBox/
npm test -- tests/jest/roll20.test.js
```

### Pre-Commit Testing

- **Automatic execution**: All tests run before each commit
- **Quality gate**: Commits blocked if any tests fail
- **Fast feedback**: Tests complete in ~0.6 seconds

## Project Standards and Conventions

### Naming Conventions

The project follows consistent **camelCase** naming for files and directories:

- ✅ `src/components/modifierBox/` (not `ModifierBox/`)
- ✅ `src/utils/` (shared utilities with feature-based naming)
- ✅ `src/content/modules/` (modular architecture components)
- ✅ `tests/jest/components/modifierBox/` (test directories may use camelCase for clarity)

### Code Quality Standards

- **Prettier**: Automatic code formatting enforced via pre-commit hooks
- **Jest**: Comprehensive unit testing with 180 stable tests
- **ESLint**: Code quality and consistency (integrated with Jest)
- **Git Hooks**: Pre-commit validation prevents broken commits
- **Modular Architecture**: Clean separation of concerns with focused modules

### Documentation Standards

- **GitHub Copilot Integration**: All summary documents in `Copilot-Feedback/`
- **Comprehensive Docs**: Developer guides, troubleshooting, and API references
- **Inline Documentation**: JSDoc comments for complex functions
- **README Files**: Component-specific documentation where appropriate

### Development Environment

- **Node.js**: Package management and testing infrastructure
- **Chrome Extension APIs**: Manifest V3 compliance
- **Modern JavaScript**: ES6+ features with browser compatibility
- **Modular Architecture**: Clear separation of concerns and responsibilities

## Quick Reference

### Common Development Commands

```bash
# Setup and dependencies
npm install                    # Install dependencies and setup git hooks

# Testing
npm test                      # Run all stable tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Generate coverage reports

# Code quality
npm run format              # Format all files with Prettier
npm run format:check        # Check formatting without writing

# Manual testing
# Open test.html in browser for UI component testing
# Open test-resize.html for responsive behavior testing
```

### Key Configuration Files

- **manifest.json**: Chrome extension configuration
- **package.json**: NPM scripts and dependencies
- **.prettierrc**: Code formatting rules
- **.husky/pre-commit**: Git hook for quality checks
- **tests/jest/setup.js**: Test environment configuration

### Project Health

- ✅ **180 tests passing** with comprehensive coverage
- ✅ **Pre-commit hooks** enforcing code quality  
- ✅ **Modular architecture** with focused, single-responsibility modules
- ✅ **Consistent naming** following camelCase conventions and feature-based utilities
- ✅ **Modern tooling** with Prettier, Husky, and Jest
- ✅ **Documentation** up-to-date and comprehensive
