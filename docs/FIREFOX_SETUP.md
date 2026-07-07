# Firefox Setup (Beta)

Firefox doesn't implement Web Bluetooth (Mozilla classifies it as
"harmful"), so this extension talks to Pixels dice on Firefox through a
small companion program instead — a **native messaging host** that Firefox
launches on demand and that does the actual Bluetooth work. See
[`../specs/firefox-native-messaging-support.md`](../specs/firefox-native-messaging-support.md)
for the full design; this page is just the steps to get it running.

**Status:** Windows only, unsigned/temporary add-on only for now. Signed
installers and a smoother onboarding flow are explicitly deferred — see
[Known limitations](#known-limitations) below.

## Prerequisites

- Firefox on Windows
- [Rust](https://rustup.rs/) (stable, MSVC toolchain) and the Visual Studio
  Build Tools "Desktop development with C++" workload (provides the MSVC
  linker `link.exe` — Rust needs it to produce a Windows binary)
- Node.js + npm (to build the extension itself, same as the Chrome build)

## 1. Build the native messaging host

```powershell
cd native-host
cargo build --release --target x86_64-pc-windows-msvc
```

This produces
`native-host\target\x86_64-pc-windows-msvc\release\pixels-roll20-helper.exe`,
a single statically-linked binary. See
[`../native-host/README.md`](../native-host/README.md) for details,
including a `--cli` mode to sanity-check BLE connectivity without a
browser at all.

## 2. Register it with Firefox

```powershell
.\scripts\install-host.ps1
```

This copies the exe to `%LOCALAPPDATA%\PixelsRoll20\`, writes a native
messaging host manifest next to it, and points Firefox at that manifest via
the `HKCU\Software\Mozilla\NativeMessagingHosts\pixels_roll20_helper`
registry key. Safe to re-run any time (e.g. after rebuilding the exe).

To remove it later: `.\scripts\uninstall-host.ps1`.

## 3. Build and load the extension

```powershell
npm install
npm run build:firefox
```

Then in Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `dist\firefox\manifest.json`

Temporary add-ons are removed when Firefox restarts, so you'll need to
reload it each session until this is published as a signed release.

## 4. Connect a die

Open a Roll20 game, click the extension icon, and click **Connect**.
Unlike Chrome's device picker, this auto-connects to _every_ Pixels die
currently in range — wake a die (roll it gently) if it isn't showing up.
Roll it, and the result should post to Roll20 chat exactly like the Chrome
path.

If you see "Companion app not installed" in the popup, the native host
isn't registered (or isn't reachable) — re-run
`.\scripts\install-host.ps1` and check `about:debugging` → **This
Firefox** → your add-on → **Inspect** for background-script console errors.

## Known limitations

- **Windows only.** btleplug supports macOS/Linux too, but the install
  script and this doc are Windows-specific for now.
- **No signed installer.** You build and register the host yourself; there's
  no MSI/pkg or one-click setup yet.
- **Temporary add-on only.** Not signed for permanent installation or
  listed on addons.mozilla.org.
- **No device picker.** The native host auto-connects to every discovered
  Pixels die — there's no per-device chooser dialog like Web Bluetooth's.
- **Minimal "host missing" UX.** If the companion app isn't installed, the
  extension shows a single status line, not a guided setup flow.
