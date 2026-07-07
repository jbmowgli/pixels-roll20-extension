# Firefox Support via Native Messaging Bridge — Implementation Plan

## Context

The extension connects Pixels Bluetooth dice to Roll20 using the Web Bluetooth API, which Firefox does not implement and has formally rejected (Mozilla classifies it as "harmful"). To support Firefox, Bluetooth must be handled outside the browser by a **native messaging host**: a small companion binary that Firefox launches on demand and talks to over stdin/stdout JSON. The extension's BLE usage is narrow and notify-only (scan, connect, subscribe to one notify characteristic, parse 3-byte face events — never writes to the die), so the helper is small.

Decisions already made:

- **Helper stack:** Rust + `btleplug` (single static binary, best Windows BLE reliability)
- **Target OS first:** Windows (the maintainer's Firefox runs on Windows; the dev machine is WSL2, which has no BLE stack)
- **Connect UX in Firefox:** auto-connect to all discovered Pixels dice (no picker; Web Bluetooth's chooser dialog doesn't exist on this path)
- Onboarding flow / signed installers are **explicitly deferred** — manual install script + docs only for now.

## Architecture

```
Roll20 page (content script)
  ├─ Chrome:  PixelsBluetooth.js ──── navigator.bluetooth (unchanged)
  └─ Firefox: PixelsNativeBridge.js ── runtime port ──► background script
                                                          └─ runtime.connectNative()
                                                               └─ pixels-roll20-helper.exe (Rust/btleplug)
Shared: rollProcessor.js — face-event parsing, formulas, chat posting (extracted, used by both paths)
```

Key constraint driving this shape: **content scripts cannot call `connectNative()` in Firefox** — only the background script can, so the background relays between a content-script `runtime.connect` port and the native port.

Implementation selection at init: feature-detect `navigator.bluetooth` in `roll20.js` — present → existing Web Bluetooth path; absent → native bridge. One codebase, per-browser manifests.

## Milestone 1 — Extract the shared roll-processing seam (no behavior change)

- **New `src/content/modules/rollProcessor.js`**: move out of `PixelsBluetooth.js` the roll formulas (`pixelsFormulaWithModifier`, `pixelsFormulaSimple`, lines 40–43), `formatModifierSign` (line 60), and the body of `handleFaceEvent` (lines 224–287, incl. modifier-box sync, crit/fumble decoration, `postChatMessage`/`sendTextToExtension` calls). Export `processNotification(dieName, dieState, dataView)` handling the `getUint8(0) === 3` dispatch and per-die `hasMoved`/`face` state.
- **Modify `src/content/modules/PixelsBluetooth.js`**: `handleNotifications`/`handleFaceEvent` inside `createPixel` delegate to `rollProcessor`. Everything else (GATT logic, reconnection strategies) stays put — it is Web-Bluetooth-specific and correctly stays on the Chrome path.
- Add jest tests for `rollProcessor` (the repo already tests roll formatting in `tests/jest/modifierSignFormatting.test.js` — follow that pattern). Existing tests must stay green: `npm test`, `npm run lint`.

## Milestone 2 — Dual-browser build

- Split webpack config using **`webpack-merge` (already a devDependency)**: `webpack.config.js` becomes a shared base; add `--env browser=chrome|firefox` handling that outputs to `dist/chrome/` and `dist/firefox/`.
- Manifests: keep `src/manifest.json` as the Chrome manifest. Generate the Firefox variant via a CopyWebpackPlugin `transform` that patches:
  - `background`: `{ "scripts": ["background/background.js"] }` (Firefox MV3 uses event pages, not `service_worker`)
  - `permissions`: add `"nativeMessaging"`
  - `browser_specific_settings.gecko.id`: fixed ID (e.g. `pixels-roll20@jtoddy.github.io`) — **required** so the native host manifest can allowlist the extension
- npm scripts: `build:chrome`, `build:firefox`, `build` runs both; update `package:store`/`zip:store` paths in `package.json` and `scripts/package-for-store.sh` for the new `dist/chrome` layout.

## Milestone 3 — Rust native helper (`native-host/`)

New top-level `native-host/` Rust crate (`Cargo.toml`, `src/main.rs`, plus modules):

- **Native messaging framing**: 4-byte little-endian length prefix + UTF-8 JSON, both directions on stdio. Exit cleanly when stdin closes (browser shut the port).
- **Protocol** (document in `native-host/PROTOCOL.md`):
  - ext → host: `{"cmd":"connect"}` (scan + auto-connect all Pixels), `{"cmd":"disconnect"}`, `{"cmd":"status"}`
  - host → ext: `{"event":"dieConnected","id","name"}`, `{"event":"dieDisconnected","id","name"}`, `{"event":"notification","id","name","data":[bytes]}`, `{"event":"scanDone","found":n}`, `{"event":"error","message"}`
- **BLE behavior** (mirror the UUID logic in `PixelsBluetooth.js:22–31, 364–413`): scan filtered on modern service `a6b90001-7a5a-43f2-a962-350c8edc9b5b` and legacy `6e400001-b5a3-f393-e0a9-e50e24dcca9e` plus name prefix `Pixel`; on connect, find the notify characteristic — known UUID first (`a6b90002-…` / `6e400003-…`), then any notifiable characteristic in the service as fallback; subscribe and forward raw notification bytes unmodified (all parsing stays in JS).
- **Reconnection lives here**: btleplug disconnect events → rescan/reconnect loop with backoff, emitting `dieConnected`/`dieDisconnected`. This replaces the watch/poll strategy dance on the Firefox path entirely.
- **CLI test mode**: `pixels-roll20-helper --cli` prints human-readable scan/roll events instead of framed JSON, so BLE can be verified on Windows without a browser.
- Build target `x86_64-pc-windows-msvc` (build on the Windows side; document `cargo build --release` there — WSL2 has no BLE for testing anyway).

## Milestone 4 — Wire the extension's Firefox path

- **New `src/content/modules/PixelsNativeBridge.js`**: same public surface as `PixelsBluetooth.js` (`initialize`, `connectToPixel`, `disconnectAllPixels`, `getPixels`, `getConnectedPixelsList`, plus the `window.*` legacy globals). Maintains lightweight die objects (name/id/connected/lastFaceUp — the shape `sendStatusToExtension` in `src/core/extensionMessaging.js:35` inspects; adjust its GATT-specific checks to duck-type). Opens `chrome.runtime.connect({name:'pixels-native'})`, sends `connect`/`disconnect` commands, and for `notification` events wraps `data` bytes in a `DataView` and calls `rollProcessor.processNotification` — reusing all Milestone 1 logic.
- **Modify `src/background/background.js`**: on `runtime.onConnect` for port name `pixels-native`, open `runtime.connectNative('pixels_roll20_helper')`, pipe messages both ways, tear down the native port when the content port closes. If `connectNative` fails (host not installed), reply `{"event":"hostMissing"}` — the content script surfaces "Companion app not installed — see setup instructions" via the existing `sendTextToExtension`. (Full onboarding UX deferred.)
- **Modify `src/content/roll20.js` (~lines 9–37, 159)**: select implementation at `initializeExtension()` — `navigator.bluetooth` present → `PixelsBluetooth`, else → `PixelsNativeBridge`; assign the chosen module's functions to the existing `window.connectToPixel` etc. so `extensionMessaging.js`'s `connect`/`disconnect` actions work unchanged.
- Add the new module to the webpack `entry` map and the Firefox manifest's `content_scripts` list.

## Milestone 5 — Host registration + docs

- `native-host/manifests/pixels_roll20_helper.json` template: `{"name":"pixels_roll20_helper","path":"<install path>","type":"stdio","allowed_extensions":["pixels-roll20@jtoddy.github.io"]}`.
- `scripts/install-host.ps1`: copies the exe to `%LOCALAPPDATA%\PixelsRoll20\`, writes the manifest with the resolved path, sets registry key `HKCU\Software\Mozilla\NativeMessagingHosts\pixels_roll20_helper`. Companion `uninstall-host.ps1`.
- README + `docs/`: Firefox setup section (build helper, run install script, load extension), protocol doc, note that signed installers/onboarding come later.

## Verification

1. **Unit**: `npm test` and `npm run lint` green after each milestone; new jest tests for `rollProcessor` and the background port relay (mock `chrome.runtime`).
2. **Chrome regression**: load `dist/chrome/` unpacked in Chrome, connect a die, roll, confirm the chat message — must be unchanged after Milestones 1 and 2.
3. **Helper standalone** (on Windows): `pixels-roll20-helper --cli` → wake a die → see scan, connect, and face events printed.
4. **End-to-end Firefox** (on Windows): run `install-host.ps1`, load `dist/firefox/` as a temporary add-on via `about:debugging`, open a Roll20 game, click Connect in the popup, roll the die, confirm the roll posts to Roll20 chat; kill/restart the die to confirm the helper's reconnection path.

## Future: same bridge on Chrome and other browsers (after Firefox ships)

The native path should eventually be available on Chrome/Edge too. The design already supports this — keep these cheap by construction now:

- The helper, protocol, background relay, and `PixelsNativeBridge` are browser-agnostic; nothing Firefox-specific goes in them.
- Chrome/Edge native messaging differs only in registration: the host manifest uses `allowed_origins: ["chrome-extension://<id>/"]` instead of `allowed_extensions`, and registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts` (Edge: `...\Microsoft\Edge\...`). Structure the manifest template and `install-host.ps1` so adding these entries later is additive.
- On Chrome the transport would be chosen by a user setting (native vs Web Bluetooth) rather than feature detection — a small change confined to `roll20.js` init. Side benefit: the native path sidesteps Web Bluetooth's reconnection jank.
- Safari is out: it requires a containing macOS app (App Extension model), a separate project entirely.

## Out of scope (deferred)

- Onboarding/detection UX for missing helper (beyond the one-line status message)
- Signed installers (MSI/pkg), macOS/Linux support, AMO listing work
- Chrome/Edge native-transport toggle (see Future section — enabled by this design, implemented after Firefox)
