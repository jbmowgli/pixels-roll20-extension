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
import { saveKnownDie } from '../../utils/knownDiceStorage.js';

// Utility functions
const log = window.log || console.log;
const postChatMessage = window.postChatMessage || function () {};
const sendTextToExtension = window.sendTextToExtension || function () {};

// Resolved lazily because roll20.js sets this after PixelsBluetooth loads
const getSendStatusToExtension = () =>
  window.sendStatusToExtension || function () {};

// Pixels dice UUIDs from the official Pixels JS SDK

// Modern Pixels dice UUIDs
const PIXELS_SERVICE_UUID = 'a6b90001-7a5a-43f2-a962-350c8edc9b5b';
const PIXELS_NOTIFY_CHARACTERISTIC = 'a6b90002-7a5a-43f2-a962-350c8edc9b5b';
const PIXELS_WRITE_CHARACTERISTIC = 'a6b90003-7a5a-43f2-a962-350c8edc9b5b';

// Legacy Pixels dice UUIDs (for older dice)
const PIXELS_LEGACY_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const PIXELS_LEGACY_NOTIFY_CHARACTERISTIC =
  '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const PIXELS_LEGACY_WRITE_CHARACTERISTIC =
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Global pixels array
const pixels = [];

// Die type enum from the Pixels BLE protocol (IAmADie message)
const DIE_TYPE_FACES = {
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

// Reconnection strategy: 'unknown' until first attempt, then 'watch' or 'poll'
let reconnectionStrategy = 'unknown';

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
  let _dieType = null; // Parsed from IAmADie BLE message (number of faces)
  let _batteryLevel = null; // Battery percentage from IAmADie message (0-100)

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
          if (_device.gatt && !_device.gatt.connected) {
            log(`Pixel ${_name} GATT connection lost, marking as disconnected`);
            const deviceRef = _device; // Capture before markDisconnected
            markDisconnected();
            setTimeout(() => {
              if (!_isConnected && deviceRef && _pixelSelf) {
                attemptReconnection(deviceRef, _pixelSelf);
              }
            }, 5000);
          }
        } catch (error) {
          log(
            `Pixel ${_name} GATT access failed, marking as disconnected: ${error.message}`
          );
          const deviceRef = _device;
          markDisconnected();
          setTimeout(() => {
            if (!_isConnected && deviceRef && _pixelSelf) {
              attemptReconnection(deviceRef, _pixelSelf);
            }
          }, 5000);
        }
      }
    }, 30000);
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
        _isConnected = false;
        // Keep _device alive for reconnection (gatt.connect, watchAdvertisements)
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
        getSendStatusToExtension()();
      }
      _disconnectionTimeout = null;
    }, 1000); // 1 second debounce
  };

  const reconnect = (server, notify, device) => {
    _server = server;
    _isConnected = true;
    _lastActivity = Date.now();

    if (device) {
      _device = device;
    }

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
    getSendStatusToExtension()();
  };

  const disconnect = () => {
    markDisconnected();
    _server?.disconnect();
    log(`Pixel ${_name} manually disconnected`);
  };

  // Permanent removal — nulls _device so it can't be reconnected
  const destroy = () => {
    disconnect();
    _device = null;
    log(`Pixel ${_name} destroyed`);
  };

  const handleNotifications = event => {
    try {
      _lastActivity = Date.now(); // Track activity for connection monitoring

      const value = event.target.value;

      const messageType = value.getUint8(0);

      if (messageType === 2 && value.byteLength >= 4) {
        // IAmADie message: parse die type and battery level
        // Format: [type=2, ledCount, colorway, dieType, dataSetHash(4), pixelId(4),
        //          availableFlash(2), buildTimestamp(4), rollState, faceIndex,
        //          batteryLevelPercent, batteryState]
        const dieTypeEnum = value.getUint8(3);
        const faces = DIE_TYPE_FACES[dieTypeEnum] || 0;
        if (faces > 0) {
          _dieType = faces;
          log(`Pixel ${_name} identified as d${faces}`);
          saveKnownDie(_name, faces);
        }
        if (value.byteLength >= 21) {
          _batteryLevel = value.getUint8(20);
          log(`Pixel ${_name} battery: ${_batteryLevel}%`);
        }
      } else if (messageType === 3) {
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
      _hasMoved = false; // Require movement before next roll registers

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

      // Calculate face value based on die type
      // d00 (percentile): faces represent 00, 10, 20... 90
      // d10: faces represent 1-10 (0 face reads as 10)
      // All other dice: face index + 1
      let diceValue;
      if (_dieType === 100) {
        diceValue = face === 0 ? 100 : face * 10;
      } else if (_dieType === 10) {
        diceValue = face === 0 ? 10 : face;
      } else {
        diceValue = face + 1;
      }
      const modifier = isModifierBoxVisible
        ? parseInt(window.pixelsModifier) || 0
        : 0;

      // Route roll through the prompt (if active) or the batcher
      const command = window.PixelsCommand;
      if (command && command.isPromptActive()) {
        const dieType =
          _dieType ||
          (window.RollBatcher &&
            window.RollBatcher.parseDieType(_name, diceValue)) ||
          diceValue;
        command.offerRoll(dieType, diceValue);
        return;
      }

      // If unprompted rolls are disabled, ignore rolls outside of /pix prompts
      if (!window.pixelsAllowUnprompted) {
        return;
      }

      const batcher = window.RollBatcher;
      if (batcher && batcher.addRoll) {
        const dieType = _dieType || batcher.parseDieType(_name, diceValue);
        batcher.addRoll({
          dieName: _name,
          dieType,
          faceValue: diceValue,
          modifier,
          modifierName: window.pixelsModifierName,
          isModifierBoxVisible,
        });
      } else {
        // Fallback: post immediately if batcher unavailable
        const result = diceValue + modifier;
        const formula = isModifierBoxVisible
          ? pixelsFormulaWithModifier
          : pixelsFormulaSimple;

        const message = formula
          .replaceAll('#modifier_name', window.pixelsModifierName)
          .replaceAll('#modifier_sign', formatModifierSign(modifier))
          .replaceAll('#face_value', diceValue.toString())
          .replaceAll('#pixel_name', _name)
          .replaceAll('#modifier', modifier.toString())
          .replaceAll('#result', result.toString());

        message.split('\\n').forEach(s => postChatMessage(s));
        sendTextToExtension(`${_name}: face up = ${diceValue}`);
      }
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
    get dieType() {
      return _dieType;
    },
    get batteryLevel() {
      return _batteryLevel;
    },
    setNotifyCharacteristic,
    startConnectionMonitoring,
    markDisconnected,
    reconnect,
    disconnect,
    destroy,
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
    _hasDisconnectListener: false,
  };

  // Store self-reference for reconnection
  _pixelSelf = pixelAPI;

  return pixelAPI;
};

// Resolve the Pixels notify characteristic from a connected GATT server.
// Tries the known modern/legacy service + characteristic UUIDs first, then
// falls back to discovering any notifiable characteristic within the service.
// This keeps connection working across firmware variants where the notify
// characteristic UUID differs, or when getCharacteristic() races GATT
// discovery and reports the characteristic as missing.
const findNotifyCharacteristic = async server => {
  const candidates = [
    { service: PIXELS_SERVICE_UUID, notify: PIXELS_NOTIFY_CHARACTERISTIC },
    {
      service: PIXELS_LEGACY_SERVICE_UUID,
      notify: PIXELS_LEGACY_NOTIFY_CHARACTERISTIC,
    },
  ];

  for (const { service: serviceUuid, notify: notifyUuid } of candidates) {
    let service;
    try {
      service = await server.getPrimaryService(serviceUuid);
    } catch {
      continue; // This service isn't present on this die; try the next one.
    }

    // Preferred path: the known notify characteristic UUID.
    try {
      return await service.getCharacteristic(notifyUuid);
    } catch {
      log(
        `Notify characteristic ${notifyUuid} not found in service ${serviceUuid}; discovering characteristics`
      );
    }

    // Fallback: enumerate the service and pick the first notifiable one.
    // getCharacteristics() forces a full discovery of the service, which also
    // recovers from cases where getCharacteristic() missed the attribute.
    const characteristics = await service.getCharacteristics();
    const notifiable = characteristics.find(
      c => c.properties && c.properties.notify
    );
    if (notifiable) {
      log(
        `Using discovered notify characteristic ${notifiable.uuid} in service ${serviceUuid}`
      );
      return notifiable;
    }
    log(
      `Service ${serviceUuid} has no notifiable characteristic (found: ${characteristics
        .map(c => c.uuid)
        .join(', ')})`
    );
  }

  throw new Error(
    'No Pixels notify characteristic found on device. The die may use an unsupported firmware or service UUID.'
  );
};

// Send WhoAreYou (message type 1) to request IAmADie response with die type.
// Non-blocking: failures are silently ignored since dice may send IAmADie
// automatically, or the die type will fall back to inference from the name/value.
const sendWhoAreYou = async server => {
  const writeUuids = [
    { service: PIXELS_SERVICE_UUID, write: PIXELS_WRITE_CHARACTERISTIC },
    {
      service: PIXELS_LEGACY_SERVICE_UUID,
      write: PIXELS_LEGACY_WRITE_CHARACTERISTIC,
    },
  ];

  for (const { service: serviceUuid, write: writeUuid } of writeUuids) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const writeChar = await service.getCharacteristic(writeUuid);
      const whoAreYou = new Uint8Array([1]); // MessageType.WhoAreYou = 1
      await writeChar.writeValue(whoAreYou);
      return;
    } catch {
      // Try next UUID pair
    }
  }
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
    const notifyChar = await findNotifyCharacteristic(server);

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

    // Only add disconnect listener if not already registered
    if (!pixel._hasDisconnectListener) {
      device.addEventListener('gattserverdisconnected', () => {
        log(`Device ${device.name} disconnected`);
        pixel.markDisconnected();

        // Attempt reconnection after GATT disconnection
        setTimeout(() => {
          attemptReconnection(device, pixel);
        }, 5000);
      });
      pixel._hasDisconnectListener = true;
    }

    log(`Connected to ${device.name}`);
    sendTextToExtension(`Connected to ${device.name}`);

    // Remember this die for quick reconnect in the popup
    saveKnownDie(device.name);

    return pixel;
  } catch (error) {
    if (error.name === 'NotFoundError') {
      log('User cancelled the device chooser');
      return null;
    }
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
    getSendStatusToExtension()();

    // Attempt to reconnect after a delay
    setTimeout(() => {
      attemptReconnection(device, pixel);
    }, 5000);
  }
};

// Core GATT reconnection — connects to device and sets up services/notifications
const performGattReconnection = async (device, pixel) => {
  // Ensure clean state before reconnecting
  try {
    if (device.gatt.connected) {
      device.gatt.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch {
    // GATT state might be inaccessible, continue anyway
  }

  const server = await device.gatt.connect();
  await new Promise(resolve => setTimeout(resolve, 500));

  if (!server.connected) {
    throw new Error('Connection lost immediately after connecting');
  }

  const notify = await findNotifyCharacteristic(server);
  await notify.startNotifications();

  pixel.reconnect(server, notify, device);
  sendTextToExtension(`Reconnected to ${pixel.name}`);
  log(`Successfully reconnected to ${device.name}`);

  pixel.startConnectionMonitoring();
  pixel._reconnectAttempts = 0;
};

// Watch-based reconnection — uses watchAdvertisements() for instant reconnection
const attemptWatchReconnection = (device, pixel) => {
  return new Promise((resolve, reject) => {
    const abortController = new AbortController();

    device.addEventListener(
      'advertisementreceived',
      async () => {
        abortController.abort();
        try {
          await performGattReconnection(device, pixel);
          resolve('watch');
        } catch (error) {
          reject(error);
        }
      },
      { once: true }
    );

    device
      .watchAdvertisements({ signal: abortController.signal })
      .catch(error => {
        if (error.name !== 'AbortError') {
          reject(error);
        }
      });

    // Race timeout — if no advertisement in 10s, watchAdvertisements isn't working
    setTimeout(() => {
      abortController.abort();
      reject(new Error('watchAdvertisements timeout'));
    }, 10000);
  });
};

// Poll-based reconnection — exponential backoff GATT connect attempts
const attemptPollReconnection = async (device, pixel) => {
  try {
    // Check if device is actually disconnected
    if (device.gatt && device.gatt.connected) {
      log(`Device ${device.name} is already connected, skipping reconnection`);
      return;
    }
  } catch {
    // GATT state inaccessible, proceed with reconnection
  }

  try {
    await performGattReconnection(device, pixel);
  } catch (error) {
    log(`Poll reconnection failed for ${device.name}: ${error}`);

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
        attemptPollReconnection(device, pixel);
      }, delay);
    } else {
      log(`Max reconnection attempts reached for ${device.name}. Giving up.`);
      sendTextToExtension(
        `Failed to reconnect to ${pixel.name} after ${maxAttempts} attempts`
      );
      getSendStatusToExtension()();
    }
  }
};

// Attempt to reconnect to a disconnected device using dual-path strategy
const attemptReconnection = async (device, pixel) => {
  if (!device) {
    log('Cannot reconnect: device reference is null');
    return;
  }

  log(
    `Attempting to reconnect to ${device.name} (strategy: ${reconnectionStrategy})`
  );

  if (reconnectionStrategy === 'watch') {
    // Known working — go straight to watch
    try {
      await attemptWatchReconnection(device, pixel);
    } catch {
      log(`Watch reconnection failed for ${device.name}, falling back to poll`);
      attemptPollReconnection(device, pixel);
    }
  } else if (reconnectionStrategy === 'poll') {
    // Known that watch doesn't work — go straight to poll
    attemptPollReconnection(device, pixel);
  } else {
    // Unknown — race watch vs timeout to detect platform support
    log('Detecting reconnection strategy (watch vs poll)...');
    try {
      await attemptWatchReconnection(device, pixel);
      reconnectionStrategy = 'watch';
      log('Reconnection strategy set to: watch (watchAdvertisements works)');
    } catch {
      reconnectionStrategy = 'poll';
      log(
        'Reconnection strategy set to: poll (watchAdvertisements unavailable)'
      );
      attemptPollReconnection(device, pixel);
    }
  }
};

// Export the main connection function
export const connectToPixel = connectToNewPixel;

// Connect to a specific die by name (filters the Bluetooth chooser)
export const connectToPixelByName = async name => {
  if (!navigator.bluetooth) {
    const error = new Error('Bluetooth not supported in this browser');
    log(error.message);
    throw error;
  }

  const filters = [{ name }];

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices: [PIXELS_SERVICE_UUID, PIXELS_LEGACY_SERVICE_UUID],
    });

    const existingPixel = getPixelByDeviceId(device.id, pixels);

    if (existingPixel && isConnected(existingPixel)) {
      log(`Already connected to ${device.name} (ID: ${device.id})`);
      return existingPixel;
    }

    const server = await device.gatt.connect();
    const notifyChar = await findNotifyCharacteristic(server);

    await notifyChar.startNotifications();

    // Request die identification (triggers IAmADie response with die type)
    sendWhoAreYou(server);

    let pixel;
    if (existingPixel) {
      existingPixel.reconnect(server, notifyChar);
      pixel = existingPixel;
    } else {
      pixel = createPixel(device.name, server, device);
      pixel.setNotifyCharacteristic(notifyChar);
      pixels.push(pixel);
    }

    pixel.updateActivity();
    pixel.startConnectionMonitoring();

    if (!pixel._hasDisconnectListener) {
      device.addEventListener('gattserverdisconnected', () => {
        log(`Device ${device.name} disconnected`);
        pixel.markDisconnected();
        setTimeout(() => {
          attemptReconnection(device, pixel);
        }, 5000);
      });
      pixel._hasDisconnectListener = true;
    }

    log(`Connected to ${device.name}`);
    sendTextToExtension(`Connected to ${device.name}`);
    saveKnownDie(device.name);

    return pixel;
  } catch (error) {
    if (error.name === 'NotFoundError') {
      log('User cancelled the device chooser');
      return null;
    }
    log(`Connection to ${name} failed: ${error.message}`);
    throw error;
  }
};

// Disconnect all pixels using functional approach
export const disconnectAllPixels = () => {
  const connectedPixels = getConnectedPixels(pixels);

  map(pixel => pixel.disconnect(), connectedPixels);
  pixels.length = 0; // Clear the array

  log(`Disconnected ${connectedPixels.length} pixels`);
  sendTextToExtension(`Disconnected ${connectedPixels.length} pixels`);
  getSendStatusToExtension()();
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
          pixel.destroy();
          return false;
        }
        return true;
      }, pixels);

      if (activePixels.length !== pixels.length) {
        pixels.length = 0;
        pixels.push(...activePixels);
        getSendStatusToExtension()();
      }
    }, 300000); // Check every 5 minutes instead of 1 minute
  } catch (error) {
    console.log('Could not set up global cleanup timer:', error);
  }
};

// Attempt silent reconnection to previously-permitted devices.
// Uses watchAdvertisements to listen indefinitely for each known die to
// start advertising, then connects GATT and sets up notifications.
const reconnectKnownDevices = async () => {
  if (!navigator.bluetooth || !navigator.bluetooth.getDevices) {
    log('getDevices() not available, skipping silent reconnection');
    return;
  }

  try {
    const devices = await navigator.bluetooth.getDevices();
    if (devices.length === 0) {
      log('No previously-permitted Bluetooth devices found');
      return;
    }

    log(
      `Found ${devices.length} previously-permitted device(s), watching for advertisements`
    );

    for (const device of devices) {
      // Skip if already connected
      const existingPixel = getPixelByDeviceId(device.id, pixels);
      if (existingPixel && isConnected(existingPixel)) {
        continue;
      }

      watchForDeviceAndConnect(device);
    }
  } catch (error) {
    log(`Silent reconnection setup failed: ${error.message}`);
  }
};

// Watch for a single device's advertisements and connect when seen.
// The listener stays active indefinitely until the device advertises.
const watchForDeviceAndConnect = device => {
  const deviceName = device.name || 'Unknown Pixel';

  const handleAdvertisement = async () => {
    log(`Advertisement received from ${deviceName}, connecting...`);

    // Remove this listener so we don't double-connect
    device.removeEventListener('advertisementreceived', handleAdvertisement);

    try {
      const server = await device.gatt.connect();
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!server.connected) {
        log(`${deviceName} connection lost immediately, will keep watching`);
        watchForDeviceAndConnect(device);
        return;
      }

      const notifyChar = await findNotifyCharacteristic(server);
      await notifyChar.startNotifications();

      // Request die identification (triggers IAmADie response with die type)
      sendWhoAreYou(server);

      // Reuse existing pixel or create new one
      let pixel = getPixelByDeviceId(device.id, pixels);
      if (pixel) {
        pixel.reconnect(server, notifyChar, device);
      } else {
        pixel = createPixel(deviceName, server, device);
        pixel.setNotifyCharacteristic(notifyChar);
        pixels.push(pixel);
      }

      pixel.updateActivity();
      pixel.startConnectionMonitoring();

      if (!pixel._hasDisconnectListener) {
        device.addEventListener('gattserverdisconnected', () => {
          log(`Device ${deviceName} disconnected`);
          pixel.markDisconnected();
          // Re-watch for the device to come back
          setTimeout(() => {
            watchForDeviceAndConnect(device);
          }, 2000);
        });
        pixel._hasDisconnectListener = true;
      }

      log(`Silently reconnected to ${deviceName}`);
      sendTextToExtension(`Reconnected to ${deviceName}`);
      getSendStatusToExtension()();
      saveKnownDie(deviceName);
    } catch (error) {
      log(`Silent reconnection to ${deviceName} failed: ${error.message}`);
      // Retry watching — the die may have stopped advertising briefly
      setTimeout(() => {
        watchForDeviceAndConnect(device);
      }, 5000);
    }
  };

  device.addEventListener('advertisementreceived', handleAdvertisement);

  device.watchAdvertisements().catch(error => {
    if (error.name !== 'InvalidStateError') {
      // InvalidStateError means already watching, which is fine
      log(`watchAdvertisements failed for ${deviceName}: ${error.message}`);
    }
  });
};

// Initialize the module
export const initialize = () => {
  log('PixelsBluetooth module initialized with ES modules and Ramda');
  setupGlobalCleanup();

  // Set up global variables for backwards compatibility
  window.pixels = pixels;

  // Attempt to reconnect previously-permitted devices
  reconnectKnownDevices();

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
