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
  '&{template:default} {{name=#modifier_name (#modifier_sign)}} {{Pixel=#face_value}} {{Result=[[#face_value + #modifier]]}}';
const pixelsFormulaSimple =
  '&{template:default} {{name=Pixel Roll}} {{Pixel=#face_value}} {{Result=[[#result]]}}';

// Functional helpers using Ramda
const isConnected = prop('_isConnected');
const getName = prop('_name');
const getPixelByName = curry((name, pixelList) =>
  find(pipe(getName, propEq(name)), pixelList)
);
const getPixelByDeviceId = curry((deviceId, pixelList) =>
  pixelList.find(pixel => {
    const pixelDeviceId = pixel.deviceId || pixel._deviceId;
    return pixelDeviceId === deviceId;
  })
);
const getConnectedPixels = filter(isConnected);

// Helper function to format modifier with proper sign
const formatModifierSign = modifier => {
  const num = parseInt(modifier) || 0;
  return num >= 0 ? `+${num}` : num.toString();
};

// Pixel factory function - creates a new Pixel die object
export const createPixel = (name, server, device) => {
  const _name = name;
  const _deviceId = device.id; // Store the device ID
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
  };

  const startConnectionMonitoring = () => {
    if (_connectionMonitor) {
      clearInterval(_connectionMonitor);
    }

    _connectionMonitor = setInterval(() => {
      // Only monitor GATT connection state, no timeout-based disconnection
      // This allows for hours between dice rolls without disconnecting
      if (_isConnected && _device) {
        try {
          // Only disconnect if GATT is actually disconnected, not based on activity timeout
          if (_device.gatt && !_device.gatt.connected) {
            log(`Pixel ${_name} GATT connection lost, marking as disconnected`);
            markDisconnected();
            // Attempt reconnection after GATT disconnection
            setTimeout(() => {
              if (!_isConnected && _device && _pixelSelf) {
                attemptReconnection(_device, _pixelSelf);
              }
            }, 5000);
          }
        } catch (error) {
          // GATT access failed, likely disconnected
          log(
            `Pixel ${_name} GATT access failed, marking as disconnected: ${error.message}`
          );
          markDisconnected();
          // Attempt reconnection after GATT failure
          setTimeout(() => {
            if (!_isConnected && _device && _pixelSelf) {
              attemptReconnection(_device, _pixelSelf);
            }
          }, 5000);
        }
      }
    }, 30000); // Check every 30 seconds - less frequent since we're only checking GATT state
  };

  let _disconnectionTimeout = null;
  let _pixelSelf = null; // Store reference to self for reconnection

  const markDisconnected = () => {
    // Debounce disconnection to prevent rapid state changes
    if (_disconnectionTimeout) {
      clearTimeout(_disconnectionTimeout);
    }

    _disconnectionTimeout = setTimeout(() => {
      if (_isConnected) {
        // Double-check we still need to disconnect
        _isConnected = false;
        _device = null;
        _server = null;

        // Clean up notification listener
        if (_notify && _notificationHandler) {
          try {
            _notify.removeEventListener(
              'characteristicvaluechanged',
              _notificationHandler
            );
          } catch (error) {
            log(
              `Error removing notification listener for ${_name}: ${error.message}`
            );
          }
          _notify = null;
          _notificationHandler = null;
        }

        if (_connectionMonitor) {
          clearInterval(_connectionMonitor);
          _connectionMonitor = null;
        }
        log(`Pixel ${_name} marked as disconnected`);
      }
      _disconnectionTimeout = null;
    }, 1000); // 1 second debounce
  };

  const reconnect = (server, notify) => {
    _server = server;
    _isConnected = true;
    _lastActivity = Date.now();

    // Clear any pending disconnection timeout
    if (_disconnectionTimeout) {
      clearTimeout(_disconnectionTimeout);
      _disconnectionTimeout = null;
    }

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
    try {
      _lastActivity = Date.now(); // Track activity for connection monitoring

      const value = event.target.value;
      const arr = [];
      // Convert raw data bytes to hex values just for the sake of showing something.
      for (let i = 0; i < value.byteLength; i++) {
        arr.push(`0x${`00${value.getUint8(i).toString(16)}`.slice(-2)}`);
      }

      if (value.getUint8(0) === 3) {
        handleFaceEvent(value.getUint8(1), value.getUint8(2));
      }
    } catch (error) {
      log(`Notification handling error for ${_name}: ${error.message}`);
      // Don't mark as disconnected for processing errors
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

      // Choose formula based on modifier box visibility
      let formula = isModifierBoxVisible
        ? pixelsFormulaWithModifier
        : pixelsFormulaSimple;

      // Add critical hit message if face value is 20
      if (diceValue === 20 && isModifierBoxVisible) {
        formula = formula.replace(
          '{{Pixel=#face_value}}',
          '{{&#128293; <span style="color: #ff4444; font-size: 20px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">CRITICAL!</span> &#128293;}} {{Pixel=#face_value}}'
        );
      }

      // Add fumble message if face value is 1
      if (diceValue === 1 && isModifierBoxVisible) {
        formula = formula.replace(
          '{{Pixel=#face_value}}',
          '{{&#128128; <span style="color: #888888; font-size: 16px; font-style: italic; opacity: 0.7;">FUMBLE!</span> &#128128;}} {{Pixel=#face_value}}'
        );
      }

      const message = formula
        .replaceAll('#modifier_name', window.pixelsModifierName)
        .replaceAll('#modifier_sign', formatModifierSign(modifier))
        .replaceAll('#face_value', diceValue.toString())
        .replaceAll('#pixel_name', _name)
        .replaceAll('#modifier', modifier.toString())
        .replaceAll('#result', result.toString());

      message.split('\\n').forEach(s => postChatMessage(s));

      sendTextToExtension(txt);
    }
  };

  // Public API
  const pixelAPI = {
    get name() {
      return _name;
    },
    get deviceId() {
      return _deviceId;
    },
    get isConnected() {
      try {
        const gattConnected = _device && _device.gatt && _device.gatt.connected;
        return _isConnected && _server !== null && _device && gattConnected;
      } catch (error) {
        // GATT state might be inconsistent during transitions
        log(`GATT state check error for ${_name}: ${error.message}`);
        return false;
      }
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
    updateActivity() {
      _lastActivity = Date.now();
    },
    // Internal properties for compatibility
    get _name() {
      return _name;
    },
    get _deviceId() {
      return _deviceId;
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
    _reconnectAttempts: 0, // Initialize reconnection attempt counter
  };

  // Store self-reference for reconnection
  _pixelSelf = pixelAPI;

  return pixelAPI;
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

    const existingPixel = getPixelByDeviceId(device.id, pixels);

    if (existingPixel && isConnected(existingPixel)) {
      log(`Already connected to ${device.name} (ID: ${device.id})`);
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

    // Update activity after successful connection
    pixel.updateActivity();
    pixel.startConnectionMonitoring();

    device.addEventListener('gattserverdisconnected', () => {
      log(`Device ${device.name} disconnected`);
      pixel.markDisconnected();

      // Attempt reconnection after GATT disconnection
      setTimeout(() => {
        attemptReconnection(device, pixel);
      }, 5000);
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
  try {
    // Check if device is actually disconnected before attempting reconnection
    if (device.gatt.connected) {
      log(`Device ${device.name} is already connected, skipping reconnection`);
      return;
    }
  } catch (error) {
    log(
      `Cannot check GATT state for ${device.name}, proceeding with reconnection: ${error.message}`
    );
  }

  log(`Attempting to reconnect to ${device.name}`);
  try {
    // Ensure clean state before reconnecting
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
      const sixHours = 6 * 60 * 60 * 1000; // 6 hours - very conservative cleanup

      const activePixels = filter(pixel => {
        // Only remove connections that have been disconnected for over 6 hours
        if (!pixel.isConnected && now - pixel.lastActivity > sixHours) {
          log(
            `Removing very stale pixel connection: ${pixel.name} (inactive for ${sixHours / (60 * 60 * 1000)} hours)`
          );
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
    }, 300000); // Check every 5 minutes instead of 1 minute
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
  global.getPixelByDeviceId = getPixelByDeviceId;
  global.PixelsBluetooth = {
    connectToPixel,
    disconnectAllPixels,
    getPixels,
    initialize,
    createPixel,
    getPixelByDeviceId,
  };
}
