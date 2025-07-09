# Pixels Roll20 Integration

Connect your Pixels dice to Roll20 via Bluetooth for seamless physical dice rolling.

## Acknowledgments

This project was originally inspired by the [Pixels on Roll20](https://github.com/obasille/PixelsRoll20ChromeExtension) extension by [Olivier Basille](https://github.com/obasille). While this implementation has evolved into a completely different codebase with extensive new features, modular architecture, and comprehensive testing, we acknowledge the original work that sparked the idea.

**Key Differences from Original:**

- Complete rewrite with modular architecture (7 focused modules)
- Advanced modifier box with drag/drop, theming, and persistence
- Comprehensive test suite (180+ automated tests)
- Modern Manifest V3 Chrome extension
- Professional documentation and publication readiness
- Extensive UI enhancements and error handling

## Features

- Connect Pixels dice via Bluetooth
- Physical rolls appear instantly in Roll20 chat
- Floating modifier box with custom values
- Drag and resize interface
- Supports both modern and legacy Pixels dice
- Auto theme matching (light/dark)
- Multi-dice support

## Quick Start

For detailed setup instructions, see **[Installation Guide](docs/INSTALLATION.md)**.

**TL;DR**: Load extension in Chrome, go to Roll20, click extension icon, connect dice, roll!

## Usage Overview

- **Connect dice**: Click extension icon → "Connect"
- **Show/hide modifier box**: Use popup buttons (only way to fully close)
- **Add modifiers**: Click "Add" in the modifier box
- **Minimize box**: Click "−" button to temporarily hide
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
- **Comprehensive Testing**: 180+ automated tests ensuring reliability
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
