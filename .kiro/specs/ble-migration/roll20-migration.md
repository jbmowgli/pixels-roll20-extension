# Roll20 Extension — Migrate to @pxd/pixels-ble

## Overview

Replace the Roll20 Chrome extension's `src/content/modules/PixelsBluetooth.ts` (~600 lines) with the shared `@pxd/pixels-ble` NPM module, keeping the Roll20-specific integration layer thin.

## Prerequisites

- `@pxd/pixels-ble` package is published/available (Phase 1 complete)
- The package exposes: `DiceManager`, `Pixel`, `StorageAdapter`, event types

## Current Architecture

```
src/content/modules/PixelsBluetooth.ts    — BLE connection + protocol + reconnection
src/content/modules/PixelsCommand.ts      — Roll resolution, dice substitution, overlay
src/utils/knownDiceStorage.ts             — chrome.storage.local persistence
src/components/popup/popup.ts             — Known Dice UI (imperative DOM)
```

The extension uses a content script architecture:

- `PixelsBluetooth.ts` runs in the content script context
- It exposes globals: `window.pixels`, `window.connectToPixel`, `window.PixelsBluetooth`
- `PixelsCommand.ts` consumes roll events from individual Pixel instances
- The popup communicates via `chrome.runtime.sendMessage` to query dice status

## Migration Tasks

### Task 1: Install and configure

- [ ] `npm install @pxd/pixels-ble`
- [ ] Remove the `ramda` dependency (only used in PixelsBluetooth.ts)

### Task 2: Create ChromeStorageAdapter

- [ ] Create `src/utils/ChromeStorageAdapter.ts` implementing `StorageAdapter` from `@pxd/pixels-ble`
- [ ] Port logic from `knownDiceStorage.ts` into the adapter
- [ ] The adapter uses `chrome.storage.local` with key `pixels_known_dice`
- [ ] Store format: `Array<{ name, systemId, dieType, lastConnected }>`

### Task 3: Create PixelsBridge adapter

- [ ] Create `src/content/modules/PixelsBridge.ts` — thin adapter between `DiceManager` and Roll20
- [ ] Instantiate `DiceManager` with `ChromeStorageAdapter`
- [ ] On `DiceManager.dieConnected` → call `DiceManager.pixel.addEventListener('roll', ...)` to wire to `PixelsCommand.offerRoll()` or `RollBatcher`
- [ ] Preserve the face value → `offerRoll(dieType, diceValue)` interface
- [ ] Preserve the `window.pixelsAllowUnprompted` check for unprompted rolls
- [ ] Expose the same global API surface for backward compat:
  - `window.connectToPixel` → `diceManager.requestPixel()`
  - `window.pixels` → `Array.from(diceManager.dice.values())`
  - `window.PixelsBluetooth.disconnectAllPixels` → disconnect all
  - `window.PixelsBluetooth.getPixels` → get all Pixel instances
  - `window.PixelsBluetooth.initialize` → `diceManager.connectKnownDevices()`

### Task 4: Update popup communication

- [ ] The popup sends messages like `{ action: 'getConnectedDice' }` to the background/content script
- [ ] Update the message handler to query `DiceManager` instead of the old `pixels` array:
  - `connected` → `diceManager.connectedDice.map(p => p.name)`
  - `batteryLevels` → map from `diceManager.dice` values
  - `dieTypes` → map from `diceManager.dice` values
- [ ] `{ action: 'blinkByName' }` → `diceManager.getPixelByName(name).blink(...)`
- [ ] `{ action: 'disconnectByName' }` → `diceManager.disconnect(systemId)`
- [ ] `{ action: 'forgetByName' }` → `diceManager.forget(systemId)`
- [ ] `{ action: 'reconnect' }` → `diceManager.reconnect(systemId)`

### Task 5: Remove PixelsBluetooth.ts

- [ ] Delete `src/content/modules/PixelsBluetooth.ts`
- [ ] Update imports everywhere that referenced it
- [ ] Remove `knownDiceStorage.ts` (replaced by ChromeStorageAdapter)

### Task 6: Verify

- [ ] Extension builds without errors
- [ ] Connect to a Pixel die via popup
- [ ] Verify roll events reach PixelsCommand.offerRoll()
- [ ] Verify reconnection works (disconnect die, wait, wake it up)
- [ ] Verify popup shows correct connected/disconnected/battery status
- [ ] Verify forget/reconnect buttons work
- [ ] Verify dice substitution still works (d8→d4, etc.)

## Key Considerations

- **PixelsCommand.ts is untouched** — it consumes `offerRoll(dieType, faceValue)` which the bridge provides
- **The `_hasMoved` / settled detection** currently lives in PixelsBluetooth.ts (`handleFaceEvent`). The NPM module's Pixel class should only emit `roll` when the die is settled (event type 1 in RollState message). Verify the NPM module handles this correctly.
- **d100 face value**: The NPM module must emit `face * 10` for d100 (percentile) dice, matching the current behavior where `offerRoll(100, diceValue)` is called with values 10-100.
- **d10 face value**: Emit `face || 10` (0 → 10), matching current `offerRoll(10, diceValue)` with values 1-10.
