# Pixels Roll20 Integration

Connect your Pixels dice to Roll20 via Bluetooth for seamless physical dice rolling.

## Acknowledgments

This project was originally inspired by the [Pixels on Roll20](https://github.com/obasille/PixelsRoll20ChromeExtension) extension by [Olivier Basille](https://github.com/obasille). While this implementation has evolved into a completely different codebase with extensive new features, modular architecture, and comprehensive testing, we acknowledge the original work that sparked the idea.

**Key Differences from Original:**

- Complete rewrite with modular architecture (7 focused modules)
- Advanced modifier box with drag/drop, theming, and persistence
- Comprehensive test suite (210+ automated tests)
- Modern Manifest V3 Chrome extension
- Professional documentation and publication readiness
- Extensive UI enhancements and error handling

## Features

- Connect Pixels dice via Bluetooth
- Multi-dice roll grouping with formula display (e.g., "Rolling 2d6")
- `/pixels` chat command for prompted rolls with full Roll20 dice syntax
- `/gmpixels` chat command for GM-only whispered prompted rolls
- Full Roll20 dice specification: keep/drop, count successes, exploding, compounding, penetrating, reroll
- Dynamic explosion slots — new dice slots appear as explosions trigger
- Silent auto-reconnect to previously connected dice
- Configurable roll window for building larger formulas with fewer dice
- Icon badge showing connected dice count
- Floating modifier box with custom values
- Drag and resize interface
- Pop the modifier box out into its own always-on-top window (Chrome/Edge 116+)
- Save, load, and update named modifier **profiles**
- Import/export all profiles, or export a single profile, as a JSON file (portable across browsers)
- Remembers minimized/full-size state between sessions
- Supports both modern and legacy Pixels dice
- Auto theme matching (light/dark)
- Multi-dice support
- BLE die type detection (d4, d6, d8, d10, d00, d12, d20)
- Percentile (d%) combo handling

## Quick Start

📦 **[Download Pre-built Extension](pixels-roll20-extension-store.zip)** or see **[Quick Install Guide](docs/QUICK_INSTALL.md)**

### Installation (2 minutes)

1. Download `pixels-roll20-extension-store.zip`
2. Extract → Load `dist/` folder in `chrome://extensions/`
3. Go to Roll20 → Click Pixels icon → Connect dice → Roll!

**Alternative**: Build from source - see **[Installation Guide](docs/INSTALLATION.md)**.

## Building from Source

```bash
git clone https://github.com/your-username/PixelsRoll20ChromeExtension.git
cd PixelsRoll20ChromeExtension
npm install
npm run build:prod  # Creates dist/ folder for Chrome
```

## Usage Overview

- **Connect dice**: Click extension icon → "Connect to Pixel"
- **Prompted rolls**: Type `/pix 2d6+5` in Roll20 chat to prompt for specific dice
- **GM whisper rolls**: Type `/gmpix 1d20+8` to whisper the result to the GM only
- **Unprompted rolls**: Roll connected dice any time — results post automatically
- **Toggle modes**: Use "Allow unprompted rolls" checkbox in the popup
- **Modifier box**: Toggle visibility from the popup (hidden when unprompted is off)
- **Roll window**: Adjust the slider in the modifier box to batch multiple rolls
- **Minimize box**: Click "−" button to collapse (state remembered between sessions)
- **Pop out box**: Click "⧉" to detach into an always-on-top window
- **Save a profile**: In the popup, type a name → "Save" to store current modifiers
- **Load/Update a profile**: Click "Load" on a saved profile; use "Update ↻" to overwrite the active profile with the current setup
- **Import/Export**: Back up or move profiles between browsers via the popup's "Export All"/"Import" buttons, or "Export" a single profile from its row
- **Roll dice**: Physical rolls automatically appear in chat

### Chat Display Behavior

- **Modifier box visible**: Shows detailed breakdown (die + modifier = total)
- **Modifier box hidden**: Shows simplified result (just final value)
- **Header adapts**: "Modifier Name" when visible, "Result" when hidden

## Documentation

- **[Installation Guide](docs/INSTALLATION.md)** - Complete setup instructions
- **[User Guide](docs/USER_GUIDE.md)** - Comprehensive usage documentation
- **[Quick Reference](docs/QUICK_REFERENCE.md)** - Essential actions and troubleshooting
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common problems and solutions
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Technical documentation

## Technical Notes

- **Modular Architecture**: Clean, maintainable codebase with focused modules
- **Comprehensive Testing**: 210+ automated tests ensuring reliability
- **Chrome Extension Manifest V3** compliant for modern browser support
- **Bluetooth Web API** for direct dice communication
- **Roll20 Integration** via chat injection and macro system

## License

MIT License - see LICENSE file for details.

## Quick Troubleshooting

For detailed help, see **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)**.

**Quick fixes:** Refresh Roll20 page → Reconnect dice → Check Bluetooth

## About Pixels

Pixels are smart dice with LEDs and sensors. Learn more at [gamewithpixels.com](https://gamewithpixels.com/).

## License

This project is licensed under the MIT License. Based on the original [Pixels Roll20 Chrome Extension](https://github.com/GameWithPixels/PixelsRoll20ChromeExtension) by the GameWithPixels team.
