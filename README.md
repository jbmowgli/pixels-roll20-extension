# PixelLink for Roll20

Connect your Pixels dice to Roll20 via Bluetooth — system-independent, no character sheet required.

PixelLink works with any Roll20 game regardless of the game system, character sheet template, or campaign settings. It operates entirely through Roll20's chat, so there are zero dependencies on a specific character sheet, compendium, or API scripts. If you can type in Roll20's chat box, PixelLink works.

## Acknowledgments

This project is a fork of [jbmowgli/pixels-roll20-extension](https://github.com/jbmowgli/pixels-roll20-extension), which built on the original [Pixels Dice for Roll20](https://chromewebstore.google.com/detail/pixels-dice-for-roll20/lalcogidjgmjlfddpbiflchacijfdban) extension by [Olivier Basille](https://github.com/obasille) ([source](https://github.com/GameWithPixels/PixelsRoll20ChromeExtension)). Both are solid, fully functional extensions for connecting Pixels dice to Roll20. PixelLink takes the project in a different direction — focused on the `/pix` prompted-roll workflow, full Roll20 dice syntax support, and a system-independent design — but the foundation those authors built made this possible.

**PixelLink Features:**

- Full Roll20 dice syntax via `/pix` commands (keep/drop, exploding, count successes, reroll, compounding, penetrating)
- System-independent design — no character sheet, compendium, or API script dependencies
- Multi-dice roll batching with configurable roll window
- Modifier profiles with import/export (portable across browsers)
- Pop-out modifier box (Document Picture-in-Picture, always-on-top)
- Silent auto-reconnect via `watchAdvertisements()` / exponential-backoff polling
- BLE die-type detection for all Pixels shapes (d4–d20, d00)
- Percentile (d%) combo handling and dice substitution
- Comprehensive test suite (240+ automated tests)
- Modular ES-module architecture built with webpack (Manifest V3)

## Features

- **System-independent** — works with D&D 5e, Pathfinder, Shadowrun, FATE, or any system on Roll20
- **No character sheet dependency** — communicates via Roll20 chat only, never touches sheet macros or API scripts
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
3. Go to Roll20 → Click PixelLink icon → Connect dice → Roll!

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
- **Prompted rolls**: Type `/pix 2d6+5` in Roll20 chat — supports the full range of Roll20 dice formulas
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

**Works with every system** — Roll20 doesn't need to know about PixelLink. There's nothing to configure on the campaign, no API scripts to install, and no character sheet integration to set up. Just connect your dice and roll.

### Chat Display Behavior

| Modifier box visible                         | Modifier box hidden               |
| -------------------------------------------- | --------------------------------- |
| ![Roll with modifier](docs/RollModifier.png) | ![Simple roll](docs/Roll1d20.png) |

### Prompted Roll (/pix command)

| Prompt overlay                           | Result                                   |
| ---------------------------------------- | ---------------------------------------- |
| ![Dice prompt](docs/RollPrompt2d6+5.png) | ![Roll result](docs/RollResult2d6+5.png) |

## Documentation

- **[Installation Guide](docs/INSTALLATION.md)** - Complete setup instructions
- **[User Guide](docs/USER_GUIDE.md)** - Comprehensive usage documentation
- **[Quick Reference](docs/QUICK_REFERENCE.md)** - Essential actions and troubleshooting
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common problems and solutions
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Technical documentation

## Technical Notes

- **System-Independent**: Works with any Roll20 game — no character sheet, compendium, or API dependencies
- **Modular Architecture**: Clean, maintainable codebase with focused modules
- **Comprehensive Testing**: 210+ automated tests ensuring reliability
- **Chrome Extension Manifest V3** compliant for modern browser support
- **Bluetooth Web API** for direct dice communication
- **Roll20 Integration** via chat injection (no macros or sheet workers required)

## Quick Troubleshooting

For detailed help, see **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)**.

**Quick fixes:** Refresh Roll20 page → Reconnect dice → Check Bluetooth

## About Pixels

Pixels are smart dice with LEDs and sensors. Learn more at [gamewithpixels.com](https://gamewithpixels.com/).

## License

This project is licensed under the MIT License. Based on the original [Pixels Roll20 Chrome Extension](https://github.com/GameWithPixels/PixelsRoll20ChromeExtension) by the GameWithPixels team.
