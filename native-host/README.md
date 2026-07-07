# pixels-roll20-helper

Rust native messaging host that talks Bluetooth LE to Pixels dice on behalf
of the Pixels Roll20 extension, for browsers without Web Bluetooth
(Firefox). It only scans, connects, and subscribes to the dice's notify
characteristic — it never writes to a die, and never parses roll data; it
forwards raw notification bytes and the extension does the rest with the
same logic used on the Chrome/Web Bluetooth path.

See [`PROTOCOL.md`](./PROTOCOL.md) for the stdin/stdout message format.

This crate implements Milestone 3 of
[`../specs/firefox-native-messaging-support.md`](../specs/firefox-native-messaging-support.md).
Host registration (native messaging manifest + install script) and the
extension-side wiring (background script relay, `PixelsNativeBridge.js`)
are separate, later milestones in that plan and are not part of this crate.

## Build

Build on Windows (BLE via `btleplug`'s WinRT backend needs a real Windows
Bluetooth stack — this won't do anything useful under WSL2):

```powershell
cd native-host
cargo build --release --target x86_64-pc-windows-msvc
```

The `.cargo/config.toml` in this directory statically links the MSVC CRT
(`+crt-static`), so `target\x86_64-pc-windows-msvc\release\pixels-roll20-helper.exe`
is a single self-contained binary with no Visual C++ Redistributable
dependency.

## Standalone test (no browser required)

```powershell
cargo run --release -- --cli
```

This scans for Pixels dice, auto-connects to any it finds, and prints
human-readable connect/disconnect/roll events to stdout instead of the
framed JSON protocol. Wake a die and you should see it connect; roll it and
you should see a `[roll]` line. Ctrl+C to quit (this disconnects cleanly
before exiting).

## Native messaging mode

Run with no arguments. It expects to be launched by the browser via
`runtime.connectNative()`, which pipes the extension's messages to its
stdin and reads its stdout — it is not meant to be run interactively in
this mode. Host registration (the manifest that tells Firefox this binary
exists and which extension may launch it, plus the Windows registry key)
is out of scope for this crate — see Milestone 5 of the plan.
