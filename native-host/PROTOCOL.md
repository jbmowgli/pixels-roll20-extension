# pixels-roll20-helper — native messaging protocol

The helper speaks Firefox's [native messaging](https://extensionworkshop.com/documentation/develop/native-messaging/)
wire format on stdin/stdout: every message, both directions, is a **4-byte
little-endian length prefix** followed by that many bytes of UTF-8 JSON. No
delimiters, no newline. The helper exits as soon as it observes EOF on
stdin (the browser closed the pipe) — it disconnects all dice first.

## Extension → host (`cmd`)

| Message | Effect |
|---|---|
| `{"cmd":"connect"}` | Start a 5s BLE scan; auto-connect (no picker) to every discovered Pixels die, and keep tracking/reconnecting them until `disconnect` is sent or the pipe closes. |
| `{"cmd":"disconnect"}` | Stop scanning, disconnect and forget every tracked die. |
| `{"cmd":"status"}` | Reply with a `status` event listing currently tracked dice. |

Unrecognized `cmd` values are ignored (logged to stderr, not stdout — stderr
is not part of the framed protocol and is safe to use for diagnostics).

## Host → extension (`event`)

| Message | Meaning |
|---|---|
| `{"event":"dieConnected","id":"...","name":"..."}` | A die finished connecting and subscribing to notifications. |
| `{"event":"dieDisconnected","id":"...","name":"..."}` | A previously-connected die dropped. The host keeps retrying to reconnect it in the background (exponential backoff, capped at 10 attempts / 60s) — no action needed from the extension. |
| `{"event":"notification","id":"...","name":"...","data":[<bytes>]}` | Raw bytes from the die's notify characteristic, unmodified. The extension parses these with the same logic Chrome uses (`rollProcessor.processNotification`). |
| `{"event":"scanDone","found":<n>}` | The initial 5s scan window closed; `found` is how many dice are tracked at that point (a connect may still be in flight for late-discovered dice). |
| `{"event":"error","message":"..."}` | A scan, connect, or subscribe operation failed. Non-fatal — the host keeps running. |
| `{"event":"status","dice":[{"id","name","connected"}]}` | Reply to a `status` command. |

`id` is an opaque, per-process-stable string identifying the BLE peripheral
(derived from btleplug's `PeripheralId`). It is **not** guaranteed stable
across helper restarts — treat it as an opaque handle, not a persistent
device identifier. `name` is the die's advertised local name.

## Notes

- The helper never writes to a die — it only scans, connects, and subscribes
  to the notify characteristic. All roll/formula logic lives in the
  extension.
- Scanning for Pixels dice matches on the modern service UUID
  (`a6b90001-...`), the legacy Nordic UART service UUID (`6e400001-...`), or
  an advertised name starting with `Pixel` — same filter as the Chrome
  Web Bluetooth path in `PixelsBluetooth.js`.
- The notify characteristic is resolved the same way as the Chrome path:
  try the known UUID first (`a6b90002-...` / `6e400003-...`), then fall back
  to any notifiable characteristic in the matched service.
