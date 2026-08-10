# Extract Pixels BLE NPM Module — Design

## Architecture

```
@pxd/pixels-ble/
  src/
    index.ts              — Public exports
    Pixel.ts              — Pixel die class (connection, events, protocol)
    DiceManager.ts        — Manages collection of known dice + state
    ble/
      constants.ts        — UUIDs, message types
      protocol.ts         — Message serialization/deserialization
      session.ts          — GATT session management (connect, notify, write)
    reconnection/
      strategy.ts         — Dual-path reconnection (watch vs poll)
      monitor.ts          — GATT health monitoring
    types.ts              — Public type definitions
  dist/
    esm/                  — ES module build
    umd/                  — UMD build (for Foundry <script> tag)
    types/                — .d.ts files
```

## Key Classes

### `Pixel`

Represents a single connected (or known) Pixels die.

```typescript
interface PixelEvents {
  roll: { face: number; dieType: number }; // face value (1-indexed)
  status: { connected: boolean };
  battery: { level: number };
}

class Pixel extends EventEmitter<PixelEvents> {
  readonly systemId: string;
  readonly name: string;
  dieType: number | null; // 4, 6, 8, 10, 12, 20, 100
  batteryLevel: number | null;
  isConnected: boolean;

  connect(timeoutMs?: number): Promise<void>;
  disconnect(): Promise<void>;
  blink(color: { r: number; g: number; b: number }): Promise<void>;
  startConnectionMonitoring(): void;
  stopConnectionMonitoring(): void;
}
```

### `DiceManager`

Manages the collection of Pixel dice, handles discovery, and coordinates reconnection.

```typescript
interface DiceManagerEvents {
  dieAdded: Pixel;
  dieRemoved: Pixel;
  dieConnected: Pixel;
  dieDisconnected: Pixel;
  dieBatteryUpdate: { pixel: Pixel; level: number };
}

interface StorageAdapter {
  load(): Promise<KnownDie[]>;
  save(dice: KnownDie[]): Promise<void>;
}

interface KnownDie {
  name: string;
  systemId: string;
  dieType: number | null;
  lastConnected: number;
}

class DiceManager extends EventEmitter<DiceManagerEvents> {
  constructor(storage: StorageAdapter);

  readonly dice: ReadonlyMap<string, Pixel>; // keyed by systemId
  readonly connectedDice: Pixel[];

  requestPixel(): Promise<Pixel>; // Browser chooser
  getPixel(systemId: string): Pixel | undefined;
  connectKnownDevices(): Promise<void>; // Silent reconnect all
  reconnect(systemId: string): Promise<void>; // Reconnect specific die
  forget(systemId: string): Promise<void>; // Remove + revoke BT permission
}
```

### Storage Adapters (provided by consumers)

```typescript
// Roll20 extension adapter
class ChromeStorageAdapter implements StorageAdapter { ... }

// Foundry module adapter
class FoundrySettingsAdapter implements StorageAdapter { ... }
```

## BLE Protocol Details

### Service & Characteristic UUIDs

| Version | Service                                | Notify         | Write          |
| ------- | -------------------------------------- | -------------- | -------------- |
| Modern  | `a6b90001-7a5a-43f2-a962-350c8edc9b5b` | `a6b90002-...` | `a6b90003-...` |
| Legacy  | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | `6e400003-...` | `6e400002-...` |

### Message Types (incoming notifications)

| Type | Name         | Payload                                          |
| ---- | ------------ | ------------------------------------------------ |
| 2    | IAmADie      | byte[3] = dieTypeEnum, byte[20] = batteryLevel   |
| 3    | RollState    | byte[1] = event (1=settled), byte[2] = faceIndex |
| 34   | BatteryLevel | byte[1] = level (0-100)                          |

### Die Type Enum → Faces Mapping

```typescript
const DIE_TYPE_FACES: Record<number, number> = {
  0: 0, // Unknown
  1: 4, // D4
  2: 6, // D6
  3: 8, // D8
  4: 10, // D10
  5: 100, // D00 (percentile)
  6: 12, // D12
  7: 20, // D20
  8: 6, // D6 Pipped
  9: 6, // D6 Fudge
};
```

### Face Value Conversion

The raw face index from RollState needs conversion to a user-facing value:

- **d100 (percentile)**: `face === 0 ? 100 : face * 10` → values 10, 20, ..., 90, 100
- **d10**: `face === 0 ? 10 : face` → values 1-10
- **All others**: `face + 1` → values 1-N

### Commands (outgoing writes)

| Type  | Name                | Payload                  |
| ----- | ------------------- | ------------------------ |
| 1     | WhoAreYou           | (no payload)             |
| 33    | RequestBatteryLevel | (no payload)             |
| (TBD) | Blink               | color + duration + count |

## Reconnection Strategy

```
┌─────────────────────────────────────────────┐
│  Device disconnects                         │
│                                             │
│  Strategy = 'unknown'?                      │
│    ├── Try watchAdvertisements              │
│    │   ├── Success → strategy = 'watch'     │
│    │   └── Failure → strategy = 'poll'      │
│    │        └── Poll with backoff           │
│                                             │
│  Strategy = 'watch'?                        │
│    └── watchAdvertisements                  │
│        └── On advert → GATT reconnect      │
│                                             │
│  Strategy = 'poll'?                         │
│    └── Exponential backoff (5s, 10s, 20s…)  │
│        └── Max 5 attempts, then give up     │
└─────────────────────────────────────────────┘
```

## Connection Monitoring

Every 30 seconds while connected:

1. Check `device.gatt.connected`
2. If false → mark disconnected → trigger reconnection
3. Every 10th check (5 minutes) → send RequestBatteryLevel

## Build & Distribution

- **Build tool**: tsup (or rollup) producing ESM + UMD
- **Package manager**: npm
- **TypeScript**: strict mode, target ES2020
- **Output**:
  - `dist/esm/index.js` — for Roll20 extension (bundled by webpack)
  - `dist/umd/index.js` — for Foundry module (loaded via `<script>` in module.json)
  - `dist/types/index.d.ts` — type definitions

## Migration Path

### Roll20 Extension

1. `npm install @pxd/pixels-ble`
2. Replace `src/content/modules/PixelsBluetooth.ts` with a thin adapter that:
   - Creates a `DiceManager` with a `ChromeStorageAdapter`
   - Wires `roll` events to `PixelsCommand.offerRoll()` / `RollBatcher`
   - Exposes `connectToPixel`/`disconnectAllPixels`/`getPixels` via the existing global API

### Foundry Module

1. Replace `node_modules/@systemic-games/pixels-web-connect` with `@pxd/pixels-ble`
2. Update `module.json` to load the UMD bundle
3. Replace `PixelsManager` internals to use `DiceManager` with a `FoundrySettingsAdapter`
4. Wire `roll` events to `pendingRoll()` handler
5. Wire `status` events to the existing `handleStatus()` logic

## Decisions

- **No UI in the package** — the two consumers use incompatible rendering approaches (Chrome extension popup with imperative DOM vs Foundry's ApplicationV2 + Handlebars). Shared CSS custom properties could be documented for visual consistency, but rendering stays consumer-side.
- **EventEmitter pattern** — use a minimal built-in event emitter (no node `events` dep). ~20 lines of code.
- **Storage is injected** — Roll20 uses `chrome.storage.local`, Foundry uses `game.settings`. The `StorageAdapter` interface keeps the core package environment-agnostic.
