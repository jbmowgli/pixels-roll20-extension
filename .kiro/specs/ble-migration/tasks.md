# Extract Pixels BLE NPM Module — Tasks

## Phase 1: Create the NPM Package

### Task 1.1: Initialize package structure

- [ ] Create new repo/directory at `/Users/stephen/git/pixels-ble`
- [ ] `npm init` with name `@pxd/pixels-ble` (or chosen scope)
- [ ] Install dev deps: `typescript`, `tsup` (bundler), `vitest` (testing)
- [ ] Configure `tsconfig.json` (strict, ES2020 target, ESM module)
- [ ] Configure `tsup.config.ts` for ESM + UMD dual output
- [ ] Add `.gitignore`, `LICENSE`

### Task 1.2: Implement BLE constants and protocol layer

- [ ] `src/ble/constants.ts` — service UUIDs (modern + legacy), characteristic UUIDs, message type enums
- [ ] `src/ble/protocol.ts` — parse IAmADie (extract dieType, battery), parse RollState (extract event + face), parse BatteryLevel; serialize WhoAreYou, RequestBatteryLevel, Blink commands
- [ ] `src/types.ts` — public types: `PixelEvents`, `KnownDie`, `StorageAdapter`, `DiceManagerEvents`, `DieType`

### Task 1.3: Implement EventEmitter utility

- [ ] `src/EventEmitter.ts` — minimal typed event emitter (addEventListener, removeEventListener, emit), no deps, ~30 lines

### Task 1.4: Implement Pixel class

- [ ] `src/Pixel.ts`:
  - Constructor takes `BluetoothDevice` + optional known info
  - `connect()` — GATT connect, discover service (try modern then legacy), get notify characteristic, start notifications, send WhoAreYou
  - `disconnect()` — remove listeners, GATT disconnect
  - Notification handler — dispatch to `roll`/`status`/`battery` events based on message type
  - Face value conversion (d100: `face*10`, d10: `face||10`, others: `face+1`)
  - `blink(color)` — write blink command to write characteristic
  - `startConnectionMonitoring()` / `stopConnectionMonitoring()` — 30s interval checking `device.gatt.connected`, battery poll every 5 min
  - Properties: `name`, `systemId`, `dieType`, `batteryLevel`, `isConnected`

### Task 1.5: Implement reconnection strategy

- [ ] `src/reconnection/strategy.ts`:
  - `attemptReconnection(device, pixel)` — dual-path: try watch, fall back to poll
  - `attemptWatchReconnection(device, pixel)` — `watchAdvertisements()` + `advertisementreceived` listener → GATT reconnect
  - `attemptPollReconnection(device, pixel)` — exponential backoff (5s, 10s, 20s, 40s, 60s), max 5 attempts
  - Strategy detection: 'unknown' → try watch → success='watch', failure='poll'
- [ ] `src/reconnection/monitor.ts`:
  - `startMonitoring(pixel)` — 30s interval, check GATT, trigger reconnect on loss

### Task 1.6: Implement DiceManager class

- [ ] `src/DiceManager.ts`:
  - Constructor takes `StorageAdapter`
  - `requestPixel()` — `navigator.bluetooth.requestDevice()` with Pixels filters, create/reuse Pixel instance, connect, add to map
  - `getPixel(systemId)` — lookup from map
  - `connectKnownDevices()` — `navigator.bluetooth.getDevices()`, watch for advertisements, connect on sight
  - `reconnect(systemId)` — reconnect a specific die (by name filter in chooser if silent fails)
  - `forget(systemId)` — disconnect, `device.forget()`, remove from storage
  - State management: Map of Pixel instances, emit events on changes
  - Wire `gattserverdisconnected` on each device to trigger auto-reconnect

### Task 1.7: Build and verify

- [ ] Run `tsup` build, verify ESM + UMD outputs exist
- [ ] Verify TypeScript types are generated
- [ ] Write basic unit tests for protocol parsing and face value conversion
- [ ] Write integration test stubs (mocked Web Bluetooth) for DiceManager flow

### Task 1.8: Publish

- [ ] `npm publish` (or link locally for initial integration testing)
- [ ] Tag v0.1.0

---

## Phase 2: Migrate Roll20 Extension (separate spec)

See `/Users/stephen/git/pixels-roll20-extension/.kiro/specs/ble-migration/roll20-migration.md`

---

## Phase 3: Migrate Foundry Module (separate spec)

See `/Users/stephen/git/pixels/.kiro/specs/foundry-migration.md`
