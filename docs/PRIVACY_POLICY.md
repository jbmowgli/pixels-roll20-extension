# Privacy Policy

**Last Updated: June 23, 2026**

## Overview

The Pixels Roll20 Integration extension ("the Extension") is designed to connect Pixels dice to Roll20 via Bluetooth. This privacy policy explains how the Extension handles data.

## Data Collection

**The Extension does NOT collect, store, or transmit any personal data.**

### What the Extension Does:

- Connects to Pixels dice via Bluetooth (local connection only)
- Reads dice roll results from connected devices
- Injects roll results into Roll20 chat
- Stores modifier settings and saved profiles locally in your browser's extension storage

### What the Extension Does NOT Do:

- Collect personal information
- Track user behavior
- Store data on external servers
- Transmit data to third parties
- Access files outside of Roll20 pages

### Bluetooth Data

- Dice roll data is processed locally and immediately injected into Roll20
- No dice data is stored or logged
- Bluetooth connections are direct between your device and the dice
- Extension uses Web Bluetooth API (no special bluetooth permission needed in Manifest V3)

## Permissions

The Extension requests the following permissions:

### activeTab

- **Purpose**: Interact with Roll20 pages
- **Scope**: Only active Roll20 tabs
- **Usage**: Inject dice roll results into Roll20 chat

### tabs

- **Purpose**: Identify Roll20 tabs and communicate with content scripts
- **Scope**: Read tab URLs to verify Roll20 pages only
- **Usage**: Ensure extension only activates on Roll20 pages

### storage

- **Purpose**: Save modifier settings locally
- **Scope**: Local browser storage only
- **Usage**: Remember modifier box settings between sessions

### scripting

- **Purpose**: Inject content scripts into Roll20 pages
- **Scope**: Roll20 pages only
- **Usage**: Enable dice integration functionality

## Local Storage

The Extension stores the following data locally on your device:

### Modifier Settings and Profiles

- **Data**: Modifier box configuration (names, values, order) and any named profiles you save
- **Location**: Chrome's extension storage. Profiles are written to both `chrome.storage.local` and `chrome.storage.sync`; the active-profile marker and the minimized/full-size state are stored in `chrome.storage.local` only (per-device)
- **Purpose**: Remember your modifier preferences and let you switch between saved setups
- **Sharing**: Profiles sync across your browsers if your browser supports and is signed into extension sync (e.g. Chrome, Edge). Browsers that do not propagate extension sync (e.g. Brave, Opera) keep the data on-device only. No data is sent to us or any third party
- **Control**: Can be cleared via Chrome settings, deleted per-profile in the popup, or exported/imported as a local JSON file that never leaves your device unless you share it

### Profile Import/Export

- **Export** writes your saved profiles to a JSON file you choose to download; **Import** reads a JSON file you select
- These files are handled entirely on your device — the Extension does not upload, transmit, or otherwise access them beyond the local read/write you initiate

### Theme Preferences

- **Data**: UI theme detection cache
- **Location**: Temporary in-memory storage
- **Purpose**: Match Roll20's theme for consistent appearance
- **Sharing**: Not shared or stored permanently

## Third-Party Services

### Roll20

- The Extension interacts with Roll20's interface to display dice results
- No data is sent to Roll20 beyond normal chat messages
- Extension follows Roll20's existing privacy practices
- No data is collected from Roll20 beyond what's necessary for functionality

### Pixels Dice

- Direct Bluetooth connection to dice hardware
- No data is sent to Pixels servers or third parties
- Connection is local and temporary
- Extension only reads dice roll results, no device identification

## Data Security

- All processing happens locally on your device
- No network transmission of personal data
- Bluetooth connections use standard Web API security protocols
- No authentication or account information is collected
- Source code is fully open source and auditable

## User Control

### Data Management

- **Clear Storage**: Remove all saved modifiers via Chrome settings
- **Disable Extension**: Turn off via Chrome extensions page
- **Uninstall**: Removes all local data automatically

### Permissions Control

- All permissions can be reviewed in Chrome's extension settings
- Extension will not function if required permissions are denied
- No hidden or undisclosed data access

## Changes to Privacy Policy

We may update this privacy policy to reflect changes in the Extension. Any changes will be posted in this document with an updated "Last Updated" date.

## Contact

For questions about this privacy policy or the Extension's data practices:

- Open an issue on the project's GitHub repository
- Review the source code (fully open source and auditable)
- All code is available for independent security review

## Attribution

This project was originally inspired by the Pixels on Roll20 extension by Olivier Basille. This independent implementation follows the same privacy-first principles with no data collection or external transmission.
