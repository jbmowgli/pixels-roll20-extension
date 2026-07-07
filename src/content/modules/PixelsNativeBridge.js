/**
 * PixelsNativeBridge.js
 *
 * Firefox connectivity path: Firefox has no Web Bluetooth, so BLE is
 * handled out-of-process by a native messaging host (see native-host/),
 * reached through the background script's runtime.connectNative() relay
 * (see src/background/background.js). Same public surface as
 * PixelsBluetooth.js — initialize/connectToPixel/disconnectAllPixels/
 * getPixels/getConnectedPixelsList/findPixelByName, plus the window.*
 * legacy globals — so roll20.js can pick either implementation based on
 * navigator.bluetooth feature detection and wire it up identically.
 *
 * Unlike Chrome, there is no per-device picker here: the native host
 * auto-connects to every Pixels die it discovers when asked to scan.
 */

import { processNotification } from './rollProcessor';

// Utility functions
const log = window.log || console.log;
const sendTextToExtension = window.sendTextToExtension || function () {};
const sendStatusToExtension = window.sendStatusToExtension || function () {};

const NATIVE_PORT_NAME = 'pixels-native';

// Global pixels array — lightweight die objects (name/id/connected/
// lastFaceUp), not GATT-backed. The actual BLE connection lives in the
// native host process; this content script only tracks what it's told
// about via port messages.
const pixels = [];

let port = null;

const findDieById = id => pixels.find(p => p.deviceId === id);

const bytesToDataView = bytes => new DataView(new Uint8Array(bytes).buffer);

// Die factory — mirrors createPixel() in PixelsBluetooth.js closely enough
// that the two are interchangeable from the caller's point of view, but
// carries no GATT/device reference (there is none on this path).
const createNativeDie = (id, name) => {
  // hasMoved/face are mutated by rollProcessor (passed by reference) so
  // face-event state persists across notifications, same as PixelsBluetooth.
  const _dieState = { hasMoved: false, face: null };
  let _isConnected = false;
  let _lastActivity = Date.now();

  const dieAPI = {
    get name() {
      return name;
    },
    get deviceId() {
      return id;
    },
    get isConnected() {
      return _isConnected;
    },
    get lastActivity() {
      return _lastActivity;
    },
    get lastFaceUp() {
      return _dieState.face;
    },
    // Internal properties for compatibility with PixelsBluetooth's shape
    get _name() {
      return name;
    },
    get _deviceId() {
      return id;
    },
    get _isConnected() {
      return _isConnected;
    },
    setConnected(connected) {
      _isConnected = connected;
      _lastActivity = Date.now();
    },
    handleNotification(dataView) {
      _lastActivity = Date.now();
      try {
        processNotification(name, _dieState, dataView);
      } catch (error) {
        log(`Notification handling error for ${name}: ${error.message}`);
      }
    },
    // No per-die disconnect command exists in the native protocol (only a
    // bulk "disconnect all") — this just updates local state so stale UI
    // doesn't show a die as connected after disconnectAllPixels().
    disconnect() {
      _isConnected = false;
    },
  };

  return dieAPI;
};

const handleHostMessage = message => {
  if (!message || typeof message !== 'object') {
    return;
  }

  switch (message.event) {
    case 'dieConnected': {
      let die = findDieById(message.id);
      if (!die) {
        die = createNativeDie(message.id, message.name);
        pixels.push(die);
      }
      die.setConnected(true);
      log(`Pixel ${message.name} connected`);
      sendTextToExtension(`Connected to ${message.name}`);
      sendStatusToExtension();
      break;
    }

    case 'dieDisconnected': {
      const die = findDieById(message.id);
      if (die) {
        die.setConnected(false);
      }
      log(`Pixel ${message.name} disconnected`);
      sendStatusToExtension();
      break;
    }

    case 'notification': {
      const die = findDieById(message.id);
      if (die) {
        die.handleNotification(bytesToDataView(message.data));
      }
      break;
    }

    case 'scanDone':
      log(`Native scan complete, ${message.found} die/dice tracked`);
      break;

    case 'error':
      log(`Native host error: ${message.message}`);
      break;

    case 'hostMissing':
      sendTextToExtension(
        'Companion app not installed — see setup instructions'
      );
      break;

    case 'status':
      // Reserved for future popup status rendering; connection state is
      // already driven by dieConnected/dieDisconnected above.
      break;

    default:
      log(`Unknown native bridge event: ${message.event}`);
  }
};

// Opens (or returns the already-open) port to the background script's
// native-messaging relay. Throws if extension messaging isn't available at
// all (e.g. running outside an extension context).
const ensurePort = () => {
  if (port) {
    return port;
  }

  if (
    typeof chrome === 'undefined' ||
    !chrome.runtime ||
    !chrome.runtime.connect
  ) {
    throw new Error('Extension messaging is not available');
  }

  port = chrome.runtime.connect({ name: NATIVE_PORT_NAME });

  port.onMessage.addListener(handleHostMessage);
  port.onDisconnect.addListener(() => {
    log('Native bridge port disconnected');
    port = null;
    // The relay (or the native host behind it) is gone — reflect that
    // instead of leaving stale "connected" state in the UI.
    pixels.forEach(die => die.setConnected(false));
    sendStatusToExtension();
  });

  return port;
};

export const connectToPixel = async () => {
  try {
    ensurePort().postMessage({ cmd: 'connect' });
  } catch (error) {
    log(`Native connect failed: ${error.message}`);
    throw error;
  }
};

export const disconnectAllPixels = () => {
  try {
    ensurePort().postMessage({ cmd: 'disconnect' });
  } catch (error) {
    log(`Native disconnect failed: ${error.message}`);
  }

  const count = pixels.length;
  pixels.forEach(die => die.disconnect());
  pixels.length = 0;

  log(`Disconnected ${count} pixels`);
  sendTextToExtension(`Disconnected ${count} pixels`);
  sendStatusToExtension();
};

export const getPixels = () => pixels;

export const getConnectedPixelsList = () => pixels.filter(p => p.isConnected);

export const findPixelByName = name => pixels.find(p => p.name === name);

export const initialize = () => {
  log('PixelsNativeBridge module initialized');
  window.pixels = pixels;

  try {
    ensurePort();
  } catch (error) {
    log(`Failed to open native bridge port: ${error.message}`);
  }

  return {
    connectToPixel,
    disconnectAllPixels,
    getPixels,
    getConnectedPixelsList,
    findPixelByName,
  };
};

// Default export for convenience
export default {
  connectToPixel,
  disconnectAllPixels,
  getPixels,
  getConnectedPixelsList,
  findPixelByName,
  initialize,
  createNativeDie,
};

// Legacy global exports for compatibility (when not using modules)
if (typeof window !== 'undefined') {
  window.PixelsNativeBridge = {
    connectToPixel,
    disconnectAllPixels,
    getPixels,
    initialize,
    createNativeDie,
  };

  window.connectToPixel = connectToPixel;
  window.pixels = pixels;
}

// Expose for testing
if (typeof global !== 'undefined') {
  global.createNativeDie = createNativeDie;
  global.PixelsNativeBridge = {
    connectToPixel,
    disconnectAllPixels,
    getPixels,
    initialize,
    createNativeDie,
  };
}
