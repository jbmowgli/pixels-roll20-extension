# User Guide

## Overview

The Pixels Roll20 Chrome Extension connects your physical Pixels dice to Roll20 via Bluetooth, allowing your physical dice rolls to appear automatically in the Roll20 chat with optional modifier support.

### Key Features

- **Multi-Device Support**: Connect multiple Pixels dice simultaneously
- **Automatic Roll Detection**: Physical dice rolls appear in Roll20 chat
- **Modifier Management**: Add/edit/remove modifiers with a floating UI
- **Profiles**: Save, load, and update named sets of modifiers, and import/export them to a file
- **Persistent Layout**: Remembers the box's minimized/full-size state between sessions
- **Theme Adaptation**: Automatically matches Roll20's light/dark theme
- **Reliable Connection**: Robust Bluetooth connection management with device identification

## Getting Started

### Installation and Setup

For complete installation instructions, see the **[Installation Guide](INSTALLATION.md)**.

**Quick version**: Load extension in Chrome → Go to Roll20 → Click extension icon → Connect dice.

### First Time Connection

1. **Wake Dice**: Gently roll your Pixels dice to wake them
2. **Click Connect**: Press "Connect to Pixel" in the extension popup
3. **Select Device**: Choose your dice from the Bluetooth device list
4. **Confirm Connection**: You should see connection status in the popup

### Connecting Multiple Dice

The extension supports connecting multiple dice simultaneously:

1. **Connect First Die**: Follow the steps above
2. **Connect Additional Dice**: Click "Connect to Pixel" again
3. **Select Each Die**: Each die will appear as a separate device
4. **Manage Connections**: Each die maintains its own connection status

**Note**: Each die is identified by its unique device ID, so you can connect multiple dice of the same type without conflicts.

## Using the Modifier Box

### Show/Hide the Modifier Box

The modifier box is a floating interface that lets you add modifiers to your dice rolls.

- **Show**: Click "Show Modifier Box" in the extension popup
- **Hide**: Click "Hide Modifier Box" in the extension popup
- **Minimize**: Click the "−" button on the box (temporary hide)

> **Note**: The modifier box can only be completely shown/hidden from the extension popup. The "×" close button has been removed to prevent accidental closing.

### Managing Modifiers

#### Adding Modifiers

1. Click the "Add" button in the modifier box header
2. Edit the modifier name (e.g., "Attack Bonus", "Skill Check")
3. Set the modifier value (-99 to +99)
4. Select the radio button to make it active

#### Editing Modifiers

- **Name**: Click the text field and type a new name
- **Value**: Click the number field and enter a new value
- **Active**: Click the radio button to select which modifier applies

#### Removing Modifiers

- Click the "×" button next to any modifier row to remove it

### Positioning and Sizing

- **Move**: Drag the header to reposition the box
- **Resize**: Drag the resize handle in the bottom-right corner
- **Minimize**: Click "−" to collapse the box (click again to restore)

> **Note**: The minimized/full-size state is remembered between sessions. If you leave Roll20 with the box minimized, it will reappear minimized next time — independent of any saved profile.

## Saving and Loading Profiles

Profiles let you store a complete set of modifiers (their names, order, values, and which one is selected) and switch between them — for example, one profile per character or per encounter type. Profiles are managed from the **extension popup**, under **Saved Profiles**.

### Saving a Profile

1. Set up the modifiers you want in the modifier box
2. Open the extension popup and type a name in the **Profile name** field
3. Click **Save**

The saved profile becomes the **active** profile (shown in the banner at the top of the section and marked with a ● in the list). Saving over an existing name asks for confirmation first.

### Loading a Profile

- Click **Load** next to any saved profile. The modifier box updates immediately (and is shown if it was hidden), and that profile becomes active.

### Updating the Active Profile

- After loading a profile and tweaking your modifiers, click **Update ↻** in the active-profile banner to overwrite that profile with the current setup. No need to retype the name.

### Deleting a Profile

- Click **Delete** next to a profile to remove it. If it was the active profile, the active marker is cleared.

### Import and Export

Profiles sync automatically across devices on browsers that support extension sync (Chrome, Edge). On browsers that don't propagate extension sync (Brave, Opera, Vivaldi), use import/export to move them manually:

- **Export**: Click **Export** to download all profiles as a `.json` file.
- **Import**: Click **Import**, choose a previously exported `.json` file, and the profiles are merged in. If an imported name matches an existing profile, the import is kept under a new name (e.g. `Combat (2)`) so nothing is overwritten.

## Rolling Dice

### Physical Rolling

Simply roll your connected Pixels dice normally. The extension automatically:

1. Detects the dice face value
2. Applies the selected modifier (if box is visible)
3. Posts the result to Roll20 chat

### Chat Display Modes

The extension automatically adapts the chat display based on modifier box visibility:

#### Modifier Box Visible (Detailed Mode)

When the modifier box is shown, chat messages include full breakdown:

```
[Modifier Name]
Pixel Die: [4]
Modifier: [+2]
Total: [6]
```

#### Modifier Box Hidden (Simple Mode)

When the modifier box is hidden, chat messages show only the result:

```
Result
Pixel Dice: [6]
```

This creates a clean, uncluttered experience when you don't need modifier details.

## Advanced Features

### Multiple Dice Support

- Connect multiple Pixels dice
- Each die maintains independent connection
- All connected dice work simultaneously

### Theme Adaptation

- Interface automatically matches Roll20 theme (light/dark)
- Consistent visual integration with Roll20 UI

### Connection Management

- Extension monitors connection status
- Automatic reconnection attempts
- Connection status visible in popup

## Best Practices

### For Optimal Performance

1. **Keep dice charged**: Low battery affects Bluetooth reliability
2. **Stay close**: Keep dice within Bluetooth range (typically 30 feet)
3. **Wake dice before use**: Roll gently to activate if they've been idle
4. **One connection per device**: Don't connect dice to multiple devices simultaneously

### Display Optimization

- **Detailed When Learning**: Keep box visible when teaching or learning rules
- **Simple When Flowing**: Hide box during fast-paced combat for clean display
- **Minimize for Breaks**: Use minimize instead of hide for temporary pauses

## Additional Information

### Browser Compatibility

- **Supported**: Chrome, Chromium, Edge (Chromium-based)
- **Not Supported**: Safari (due to Bluetooth Web API limitations)
- **Requirements**: Chrome 56+ for Bluetooth Web API support

---

For installation help, see the **[Installation Guide](INSTALLATION.md)**.
For troubleshooting, see the **[Troubleshooting Guide](TROUBLESHOOTING.md)**.
For technical information, see the **[Developer Guide](DEVELOPER_GUIDE.md)**.
