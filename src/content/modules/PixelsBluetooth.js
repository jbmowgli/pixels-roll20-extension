/**
 * PixelsBluetooth.js
 *
 * Handles all Bluetooth connectivity with Pixels dice, including:
 * - Device discovery and connection
 * - Connection monitoring and reconnection
 * - Pixel factory functions
 * - Roll handling and formula processing
 */

import { curry, pipe, map, filter, find, propEq, prop } from 'ramda';

// Utility functions
const log = window.log || console.log;
const postChatMessage = window.postChatMessage || function () {};
const sendTextToExtension = window.sendTextToExtension || function () {};
const sendStatusToExtension = window.sendStatusToExtension || function () {};

// Pixels dice UUIDs from the official Pixels JS SDK

// Modern Pixels dice UUIDs
const PIXELS_SERVICE_UUID = 'a6b90001-7a5a-43f2-a962-350c8edc9b5b';
const PIXELS_NOTIFY_CHARACTERISTIC = 'a6b90002-7a5a-43f2-a962-350c8edc9b5b';
const _PIXELS_WRITE_CHARACTERISTIC = 'a6b90003-7a5a-43f2-a962-350c8edc9b5b';

// Legacy Pixels dice UUIDs (for older dice)
const PIXELS_LEGACY_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const PIXELS_LEGACY_NOTIFY_CHARACTERISTIC =
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const _PIXELS_LEGACY_WRITE_CHARACTERISTIC =
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Global pixels array
const pixels = [];

// Roll formulas
const pixelsFormulaWithModifier =
  '&{template:default} {{name=#modifier_name (+#modifier)}} {{Pixel=#face_value}} {{Result=[[#face_value + #modifier]]}}';
const pixelsFormulaSimple =
  '&{template:default} {{name=Pixel Roll}} {{Pixel=#face_value}} {{Result=[[#result]]}}';

// Functional helpers using Ramda
const isConnected = prop('_isConnected');
const getName = prop('_name');
const getPixelByName = curry((name, pixelList) =>
  find(pipe(getName, propEq(name)), pixelList)
);
const getConnectedPixels = filter(isConnected);

// Pixel factory function - creates a new Pixel die object
export const createPixel = (name, server, device) => {
  const _name = name;
  let _server = server;
  let _device = device;
  let _notify = null;
  let _notificationHandler = null;
  let _hasMoved = false;
  let _isConnected = true;
  let _connectionMonitor = null;
  let _lastActivity = Date.now();
  let _face = null;

  // Private methods
  const setNotifyCharacteristic = notify => {
    _notify = notify;
    _notificationHandler = event => handleNotifications(event);
    _notify.addEventListener(
      'characteristicvaluechanged',
      _notificationHandler
    );
    log(`Pixel ${_name} notification characteristic set up`);
  };

  const startConnectionMonitoring = () => {
    if (_connectionMonitor) {
      clearInterval(_connectionMonitor);
    }

    _connectionMonitor = setInterval(() => {
      const timeSinceLastActivity = Date.now() - _lastActivity;
      const timeoutMs = 30000; // 30 seconds timeout

      if (timeSinceLastActivity > timeoutMs && _isConnected) {
        log(
          `Pixel ${_name} appears disconnected (no activity for ${timeoutMs}ms)`
        );
        markDisconnected();
      }
    }, 5000); // Check every 5 seconds
  };

  const markDisconnected = () => {
    _isConnected = false;
    _device = null;
    _server = null;

    // Clean up notification listener
    if (_notify && _notificationHandler) {
      _notify.removeEventListener(
        'characteristicvaluechanged',
        _notificationHandler
      );
      _notify = null;
      _notificationHandler = null;
    }

    if (_connectionMonitor) {
      clearInterval(_connectionMonitor);
      _connectionMonitor = null;
    }
    log(`Pixel ${_name} marked as disconnected`);
  };

  const reconnect = (server, notify) => {
    _server = server;
    _isConnected = true;
    _lastActivity = Date.now();

    // Set up new notification listener
    if (notify) {
      setNotifyCharacteristic(notify);
    }

    log(`Pixel ${_name} reconnected successfully`);
  };

  const disconnect = () => {
    markDisconnected();
    _server?.disconnect();
    log(`Pixel ${_name} manually disconnected`);
  };

  const handleNotifications = event => {
    _lastActivity = Date.now(); // Track activity for connection monitoring

    const value = event.target.value;
    const arr = [];
    // Convert raw data bytes to hex values just for the sake of showing something.
    for (let i = 0; i < value.byteLength; i++) {
      arr.push(`0x${`00${value.getUint8(i).toString(16)}`.slice(-2)}`);
    }

    log(`Pixel notification: ${arr.join(' ')}`);

    if (value.getUint8(0) === 3) {
      handleFaceEvent(value.getUint8(1), value.getUint8(2));
    }
  };

  const handleFaceEvent = (ev, face) => {
    if (!_hasMoved) {
      if (ev !== 1) {
        _hasMoved = true;
      }
    } else if (ev === 1) {
      _face = face;
      const txt = `${_name}: face up = ${face + 1}`;
      log(txt);

      // Check if modifier box is visible to determine modifier application
      const isModifierBoxVisible =
        window.ModifierBox &&
        window.ModifierBox.isVisible &&
        window.ModifierBox.isVisible();

      // Sync modifier values from the modifier box before processing roll (only if visible)
      if (
        isModifierBoxVisible &&
        typeof window.ModifierBox !== 'undefined' &&
        window.ModifierBox.syncGlobalVars
      ) {
        window.ModifierBox.syncGlobalVars();
      }

      const diceValue = face + 1;
      const modifier = isModifierBoxVisible
        ? parseInt(window.pixelsModifier) || 0
        : 0;
      const result = diceValue + modifier;

      log(`Dice value: ${diceValue}, Modifier: ${modifier}, Result: ${result}`);
      log(`pixelsModifierName: "${window.pixelsModifierName}"`);
      log(`Modifier box visible: ${isModifierBoxVisible}`);

      // Choose formula based on modifier box visibility
      let formula = isModifierBoxVisible
        ? pixelsFormulaWithModifier
        : pixelsFormulaSimple;

      // Add critical hit message if face value is 20
      if (diceValue === 20 && isModifierBoxVisible) {
        formula = formula.replace(
          '{{Pixel=#face_value}}',
          '{{<span style="color: #ff4444; font-size: 20px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">CRITICAL!</span>}} {{Pixel=#face_value}}'
        );
      }

      // Add fumble message if face value is 1
      if (diceValue === 1 && isModifierBoxVisible) {
        formula = formula.replace(
          '{{Pixel=#face_value}}',
          '{{<span style="color: #888888; font-size: 16px; font-style: italic; opacity: 0.7;">FUMBLE!</span>}} {{Pixel=#face_value}}'
        );
      }

      log(`Formula before replacement: ${formula}`);

      const message = formula
        .replaceAll('#modifier_name', window.pixelsModifierName)
        .replaceAll('#face_value', diceValue.toString())
        .replaceAll('#pixel_name', _name)
        .replaceAll('#modifier', modifier.toString())
        .replaceAll('#result', result.toString());

      log(`Formula after replacement: ${message}`);

      message.split('\\n').forEach(s => postChatMessage(s));

      sendTextToExtension(txt);
    }
  };

  // Public API
  return {
    get name() {
      return _name;
    },
    get isConnected() {
      return (
        _isConnected && _server !== null && _device && _device.gatt.connected
      );
    },
    get device() {
      return _device;
    },
    get server() {
      return _server;
    },
    get lastActivity() {
      return _lastActivity;
    },
    get lastFaceUp() {
      return _face;
    },
    setNotifyCharacteristic,
    startConnectionMonitoring,
    markDisconnected,
    reconnect,
    disconnect,
    handleNotifications,
    // Internal properties for compatibility
    get _name() {
      return _name;
    },
    get _isConnected() {
      return _isConnected;
    },
    get _device() {
      return _device;
    },
    get _server() {
      return _server;
    },
    get _lastActivity() {
      return _lastActivity;
    },
  };
};

// Main Bluetooth connection logic using functional approach
const connectToNewPixel = async () => {
  if (!navigator.bluetooth) {
    const error = new Error('Bluetooth not supported in this browser');
    log(error.message);
    throw error;
  }

  const filters = [
    { services: [PIXELS_SERVICE_UUID] },
    { services: [PIXELS_LEGACY_SERVICE_UUID] },
    { namePrefix: 'Pixel' },
  ];

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: filters,
      optionalServices: [PIXELS_SERVICE_UUID, PIXELS_LEGACY_SERVICE_UUID],
    });

    const existingPixel = getPixelByName(device.name, pixels);

    if (existingPixel && isConnected(existingPixel)) {
      log(`Already connected to ${device.name}`);
      return existingPixel;
    }

    const server = await device.gatt.connect();
    let service, notifyChar;

    // Try modern UUIDs first
    try {
      service = await server.getPrimaryService(PIXELS_SERVICE_UUID);
      notifyChar = await service.getCharacteristic(
        PIXELS_NOTIFY_CHARACTERISTIC
      );
    } catch {
      // Fall back to legacy UUIDs
      log('Modern UUIDs failed, trying legacy UUIDs');
      service = await server.getPrimaryService(PIXELS_LEGACY_SERVICE_UUID);
      notifyChar = await service.getCharacteristic(
        PIXELS_LEGACY_NOTIFY_CHARACTERISTIC
      );
    }

    await notifyChar.startNotifications();

    let pixel;
    if (existingPixel) {
      // Reconnect existing pixel
      existingPixel.reconnect(server, notifyChar);
      pixel = existingPixel;
    } else {
      // Create new pixel
      pixel = createPixel(device.name, server, device);
      pixel.setNotifyCharacteristic(notifyChar);
      pixels.push(pixel);
    }

    pixel.startConnectionMonitoring();

    device.addEventListener('gattserverdisconnected', () => {
      log(`Device ${device.name} disconnected`);
      pixel.markDisconnected();
    });

    log(`Connected to ${device.name}`);
    sendTextToExtension(`Connected to ${device.name}`);

    return pixel;
  } catch (error) {
    log(`Connection failed: ${error.message}`);
    throw error;
  }
};

// Handle device disconnection using functional approach
const _handleDeviceDisconnection = device => {
  log(`Handling disconnection for device: ${device.name}`);

  const pixel = getPixelByName(device.name, pixels);
  if (pixel) {
    pixel.markDisconnected();
    sendTextToExtension(`Pixel ${device.name} disconnected`);
    sendStatusToExtension();

    // Attempt to reconnect after a delay
    setTimeout(() => {
      attemptReconnection(device, pixel);
    }, 5000);
  }
};

// Attempt to reconnect to a disconnected device
const attemptReconnection = async (device, pixel) => {
  if (!device.gatt.connected) {
    log(`Attempting to reconnect to ${device.name}`);
    try {
      if (device.gatt.connected) {
        device.gatt.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const server = await device.gatt.connect();
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!server.connected) {
        throw new Error('Connection lost immediately after connecting');
      }

      let service, notifyUuid;
      try {
        service = await server.getPrimaryService(PIXELS_SERVICE_UUID);
        notifyUuid = PIXELS_NOTIFY_CHARACTERISTIC;
        log('Reconnecting to modern Pixels die');
      } catch {
        service = await server.getPrimaryService(PIXELS_LEGACY_SERVICE_UUID);
        notifyUuid = PIXELS_LEGACY_NOTIFY_CHARACTERISTIC;
        log('Reconnecting to legacy Pixels die');
      }

      const notify = await service.getCharacteristic(notifyUuid);
      await notify.startNotifications();

      pixel.reconnect(server, notify);
      sendTextToExtension(`Reconnected to ${pixel.name}`);
      log(`Successfully reconnected to ${device.name}`);

      pixel.startConnectionMonitoring();
      pixel._reconnectAttempts = 0;
    } catch (error) {
      log(`Failed to reconnect to ${device.name}: ${error}`);

      pixel._reconnectAttempts = (pixel._reconnectAttempts || 0) + 1;
      const maxAttempts = 5;

      if (pixel._reconnectAttempts < maxAttempts) {
        const delay = Math.min(
          5000 * Math.pow(2, pixel._reconnectAttempts - 1),
          60000
        );
        log(
          `Retry ${pixel._reconnectAttempts}/${maxAttempts} in ${delay / 1000} seconds`
        );

        setTimeout(() => {
          attemptReconnection(device, pixel);
        }, delay);
      } else {
        log(`Max reconnection attempts reached for ${device.name}. Giving up.`);
        sendTextToExtension(
          `Failed to reconnect to ${pixel.name} after ${maxAttempts} attempts`
        );
      }
    }
  }
};

// Export the main connection function
export const connectToPixel = connectToNewPixel;

// Disconnect all pixels using functional approach
export const disconnectAllPixels = () => {
  const connectedPixels = getConnectedPixels(pixels);

  map(pixel => pixel.disconnect(), connectedPixels);
  pixels.length = 0; // Clear the array

  log(`Disconnected ${connectedPixels.length} pixels`);
  sendTextToExtension(`Disconnected ${connectedPixels.length} pixels`);
  sendStatusToExtension();
};

// Get pixels list
export const getPixels = () => pixels;

// Get connected pixels only
export const getConnectedPixelsList = () => getConnectedPixels(pixels);

// Find pixel by name using functional approach
export const findPixelByName = getPixelByName;

// Set up global connection cleanup
const setupGlobalCleanup = () => {
  try {
    setInterval(() => {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      const activePixels = filter(pixel => {
        if (!pixel.isConnected && now - pixel.lastActivity > fiveMinutes) {
          log(`Removing stale pixel connection: ${pixel.name}`);
          pixel.disconnect();
          return false;
        }
        return true;
      }, pixels);

      if (activePixels.length !== pixels.length) {
        pixels.length = 0;
        pixels.push(...activePixels);
        sendStatusToExtension();
      }
    }, 60000);
  } catch (error) {
    console.log('Could not set up global cleanup timer:', error);
  }
};

// Initialize the module
export const initialize = () => {
  log('PixelsBluetooth module initialized with ES modules and Ramda');
  setupGlobalCleanup();

  // Set up global variables for backwards compatibility
  window.pixels = pixels;

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
  createPixel,
};

// Legacy global exports for compatibility (when not using modules)
if (typeof window !== 'undefined') {
  window.PixelsBluetooth = {
    connectToPixel,
    disconnectAllPixels,
    getPixels,
    initialize,
    createPixel,
  };

  // Legacy individual exports
  window.connectToPixel = connectToPixel;
  window.pixels = pixels;
}

// Expose for testing
if (typeof global !== 'undefined') {
  global.createPixel = createPixel;
  global.PixelsBluetooth = {
    connectToPixel,
    disconnectAllPixels,
    getPixels,
    initialize,
    createPixel,
  };
}
