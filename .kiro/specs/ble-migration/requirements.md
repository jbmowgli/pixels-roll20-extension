# Extract Pixels BLE NPM Module — Requirements

## Overview

Extract the Bluetooth Low Energy (BLE) connection logic from the Roll20 Chrome extension (`pixels-roll20-extension`) into a standalone NPM package (`@pxd/pixels-ble` or similar), then have both the Roll20 extension and the Foundry VTT module consume it.

## Background

The Roll20 extension (`/Users/stephen/git/pixels-roll20-extension`) contains a mature BLE implementation in `src/content/modules/PixelsBluetooth.ts` that handles:

- Device discovery via Web Bluetooth API
- Dual-path reconnection strategy (watchAdvertisements vs polling)
- GATT connection monitoring
- Automatic reconnection on disconnect events
- Message parsing (IAmADie, RollState, BatteryLevel)
- Silent reconnection to previously-permitted devices

The Foundry VTT module (`/Users/stephen/git/pixels`) currently uses `@systemic-games/pixels-web-connect` which has simpler reconnection (just `repeatConnect` with retries). The Roll20 extension's approach is significantly faster and more reliable.

Both projects share nearly identical "Known Dice" UI patterns (dark theme, green borders for connected, battery indicators, reconnect/forget buttons) but render through different frameworks.

## Functional Requirements

### FR-1: NPM Package Creation

The new package must:

- Be a standalone npm module publishable to npm (scoped or unscoped)
- Export ES modules and a UMD bundle (for Foundry which loads via `<script>` tag)
- Have zero runtime dependencies (no Ramda, no framework deps)
- Be written in TypeScript with full type definitions

### FR-2: Core BLE Connection API

The module must expose:

- `requestPixel()` — opens browser Bluetooth chooser filtered to Pixels dice
- `getPixel(systemId: string)` — returns a known Pixel by system ID (silent, no chooser)
- `connectKnownDevices()` — silently watches for all previously-permitted devices
- `Pixel` class/interface with:
  - `connect()` / `disconnect()`
  - `name`, `systemId`, `dieType` (number of faces: 4, 6, 8, 10, 12, 20, 100)
  - `batteryLevel`, `isConnected`
  - Event emitter: `roll`, `status`, `battery`
  - `blink(color)` — LED confirmation
  - `startConnectionMonitoring()` — GATT health checks

### FR-3: Reconnection Strategy

The module must implement the dual-path reconnection from the Roll20 extension:

- `watchAdvertisements()` path for instant reconnection when available
- Polling fallback with exponential backoff
- Automatic strategy detection on first disconnect
- Auto-reconnect on `gattserverdisconnected` events
- Configurable max retry attempts

### FR-4: Protocol Support

- Modern Pixels BLE UUIDs: service `a6b90001-...`, notify `a6b90002-...`, write `a6b90003-...`
- Legacy Pixels BLE UUIDs: service `6e400001-...`, notify `6e400003-...`, write `6e400002-...`
- Message parsing: IAmADie (type 2), RollState (type 3), BatteryLevel (type 34)
- Commands: WhoAreYou (type 1), RequestBatteryLevel (type 33), Blink

### FR-5: Known Dice Persistence (Headless)

The module must provide:

- A `DiceManager` class that tracks known dice, connection states, battery levels, die types
- Event emitter for state changes (dice added/removed, connected/disconnected, battery updated)
- Abstract storage interface (consumers provide their own persistence backend)

### FR-6: No UI

The module must NOT include any rendering or DOM manipulation. UI remains the responsibility of each consumer (Roll20 popup, Foundry ApplicationV2).

## Non-Functional Requirements

### NFR-1: Bundle Size

- The UMD bundle should be under 30KB minified (the current `pixels-web-connect` UMD is ~148KB)

### NFR-2: Browser Compatibility

- Chrome 100+, Edge 100+ (Web Bluetooth required)
- Must gracefully degrade when `watchAdvertisements` is unavailable

### NFR-3: No Side Effects

- No globals, no `window` mutations
- All state contained within instantiated classes

## Out of Scope

- React Native support
- LED animation programming (beyond simple blink)
- Firmware updates
- The Roll20 or Foundry specific integration code (those are separate specs)
