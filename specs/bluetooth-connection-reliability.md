# Bluetooth Connection Reliability

**Status:** In Progress
**Created:** 2026-03-18

## Problem

Pixels dice frequently drop Bluetooth connections and the extension popup continues to show "connected" when the die is actually disconnected. Users must manually re-pair dice to restore functionality.

### Root Causes

1. **No modern reconnection APIs** — `getDevices()` and `watchAdvertisements()` are not used, so the extension can't silently reconnect to previously-permitted dice without a user gesture
2. **Stale UI state** — the popup only updates when it receives a message from the content script; silent disconnections leave the popup showing "connected"
3. **`_device` reference destroyed on disconnect** — `markDisconnected()` nulls `_device` (line 137 of PixelsBluetooth.js), making reconnection via the device reference impossible
4. **Duplicate `gattserverdisconnected` listeners** — each call to `connectToNewPixel()` adds a new listener (line 406) without removing old ones, causing multiple simultaneous reconnection attempts that compete with each other
5. **Wrong legacy UUID** — `PIXELS_LEGACY_NOTIFY_CHARACTERISTIC` is set to `6e400001-...` (the service UUID) instead of `6e400003-...` (the Nordic UART TX/notify characteristic)
6. **Polling-only reconnection** — 30-second interval polling is slow and can miss the die when it briefly comes back in range

## Solution

### 1. Fix Legacy Notify UUID

**File:** `src/content/modules/PixelsBluetooth.js`

Change `PIXELS_LEGACY_NOTIFY_CHARACTERISTIC` from `6e400001-b5a3-f393-e0a9-e50e24dcca9e` to `6e400003-b5a3-f393-e0a9-e50e24dcca9e`. The Nordic UART Service (NUS) defines:
- `6e400001` — Service UUID
- `6e400002` — RX (write) characteristic
- `6e400003` — TX (notify) characteristic

### 2. Preserve `_device` Reference Across Disconnections

**File:** `src/content/modules/PixelsBluetooth.js`

In `markDisconnected()`:
- Continue to null `_server` and `_notify` (these are invalidated on GATT disconnect)
- **Keep `_device` alive** — it holds the browser's permission grant and is needed for `device.gatt.connect()` and `device.watchAdvertisements()`
- Add a separate `destroy()` method for permanent removal (used by the 6-hour cleanup)

### 3. Fix Duplicate Event Listeners

**File:** `src/content/modules/PixelsBluetooth.js`

- Add a `_hasDisconnectListener` flag to each pixel
- Before adding `gattserverdisconnected` listener in `connectToNewPixel()`, check if one is already registered
- Use a named handler function that can be properly removed and re-added
- Re-register after successful reconnection

### 4. Dual-Path Reconnection Strategy

**File:** `src/content/modules/PixelsBluetooth.js`

Add a module-level variable:
```
let reconnectionStrategy = 'unknown'; // 'unknown' | 'watch' | 'poll'
```

On disconnect, determine reconnection approach:

```
if strategy is 'unknown':
    Race: start watchAdvertisements() vs 10-second timeout
    If advertisementreceived fires first:
        → set strategy = 'watch'
        → reconnect via device.gatt.connect()
    If timeout fires first:
        → abort watchAdvertisements()
        → set strategy = 'poll'
        → fall back to polling reconnection (current behavior)

if strategy is 'watch':
    Use watchAdvertisements() directly (no race needed)

if strategy is 'poll':
    Use polling reconnection directly (current exponential backoff)
```

This automatically detects Linux (where `watchAdvertisements()` silently fails) and caches the result so subsequent disconnects skip the detection phase.

### 5. `getDevices()` on Page Load

**File:** `src/content/modules/PixelsBluetooth.js` — `initialize()`

On module initialization:
1. Check if `navigator.bluetooth.getDevices` exists
2. Call `getDevices()` to retrieve previously-permitted Pixels dice
3. For each device, attempt reconnection using the dual-path strategy
4. Update popup status as dice reconnect
5. This enables silent reconnection after page refresh without requiring the user to click "Connect" again

### 6. Fix Stale Connection Status in Popup

**Files:** `src/content/modules/PixelsBluetooth.js`, `src/core/extensionMessaging.js`, `src/components/popup/popup.js`

Three changes:

**A. Active GATT verification on status request**
When the content script receives a `getStatus` message, verify the actual GATT connection state of each pixel before responding. Don't just read the cached `_isConnected` flag — check `device.gatt.connected` and update internal state if they disagree.

**B. Status push after every reconnection attempt**
After any reconnection attempt (success or failure), always call `sendStatusToExtension()` so the popup stays in sync.

**C. Popup-side polling**
When the popup is open, poll `getStatus` every 5 seconds. This catches any silent state changes that weren't pushed. Clear the interval when the popup closes (it naturally cleans up since popups are destroyed on close).

## Files to Modify

| File | Changes |
|------|---------|
| `src/content/modules/PixelsBluetooth.js` | UUID fix, preserve _device, fix listeners, dual-path reconnection, getDevices() |
| `src/core/extensionMessaging.js` | Active GATT verification in status response |
| `src/components/popup/popup.js` | 5-second status polling while open |

## Verification Plan

1. **Connect a Pixels die** — verify popup shows "connected"
2. **Turn die off or move out of range** — verify popup updates to "disconnected" within ~30 seconds
3. **Turn die back on** — verify automatic reconnection (instant on Windows/macOS via watchAdvertisements, polling-based on Linux)
4. **Refresh the Roll20 page** — verify `getDevices()` picks up previously-permitted dice and reconnects silently
5. **Open/close popup repeatedly** — verify status is always accurate, never stale
6. **Connect multiple dice, disconnect one** — verify correct count shown (e.g., "1/2 Pixels connected")
7. **Run existing tests** — `npm test` should pass
8. **Linux-specific test** — verify the strategy detection falls back to `'poll'` and reconnection still works via exponential backoff
