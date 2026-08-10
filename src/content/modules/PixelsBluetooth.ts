/**
 * PixelsBluetooth.ts
 *
 * Handles all Bluetooth connectivity with Pixels dice, including:
 * - Device discovery and connection
 * - Connection monitoring and reconnection
 * - Pixel factory functions
 * - Roll handling and formula processing
 */

import { curry, filter, find, map } from 'ramda';
import { saveKnownDie } from '../../utils/knownDiceStorage';

// Utility functions
const log = window.log || console.log;
const postChatMessage: (message: string) => void =
  window.postChatMessage || function () {};
const sendTextToExtension: (txt: string) => void =
  window.sendTextToExtension || function () {};

// Resolved lazily because roll20.js sets this after PixelsBluetooth loads
const getSendStatusToExtension = (): (() => void) =>
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
const pixels: PixelDie[] = [];

// Die type enum from the Pixels BLE protocol (IAmADie message)
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

// Reconnection strategy: 'unknown' until first attempt, then 'watch' or 'poll'
type ReconnectionStrategy = 'unknown' | 'watch' | 'poll';
let reconnectionStrategy: ReconnectionStrategy = 'unknown';

// Roll formula for unprompted rolls (simple, no modifier)
const pixelsFormulaSimple =
  '&{template:default} {{name=Pixel Roll}} {{Pixel=#face_value}} {{Result=[[#result]]}}';

// Functional helpers using Ramda
const isConnected = (pixel: PixelDie): boolean => Boolean(pixel._isConnected);
const getName = (pixel: PixelDie): string => pixel._name;
const getPixelByName = curry(
  (name: string, pixelList: PixelDie[]): PixelDie | undefined =>
    find((pixel: PixelDie) => getName(pixel) === name, pixelList)
);
const getPixelByDeviceId = curry(
  (deviceId: string, pixelList: PixelDie[]): PixelDie | undefined =>
    pixelList.find((pixel: PixelDie) => {
      const pixelDeviceId = pixel.deviceId || pixel._deviceId;
      return pixelDeviceId === deviceId;
    })
);
const getConnectedPixels = (list: PixelDie[]): PixelDie[] =>
  filter(isConnected, list);

// Pixel factory function - creates a new Pixel die object
export const createPixel = (
  name: string,
  server: BluetoothRemoteGATTServer,
  device: BluetoothDevice
): PixelDie => {
  const _name = name;
  const _deviceId = device.id;
  let _server: BluetoothRemoteGATTServer | null = server;
  let _device: BluetoothDevice | null = device;
  let _notify: BluetoothRemoteGATTCharacteristic | null = null;
  let _notificationHandler: ((event: Event) => void) | null = null;
  let _hasMoved = false;
  let _isConnected = true;
  let _connectionMonitor: ReturnType<typeof setInterval> | null = null;
  let _lastActivity = Date.now();
  let _face: number | null = null;
  let _dieType: number | null = null;
  let _batteryLevel: number | null = null;

  // Private methods
  const setNotifyCharacteristic = (
    notify: BluetoothRemoteGATTCharacteristic
  ): void => {
    _notify = notify;
    _notificationHandler = (event: Event) => handleNotifications(event);
    _notify.addEventListener(
      'characteristicvaluechanged',
      _notificationHandler
    );
  };

  const startConnectionMonitoring = (): void => {
    if (_connectionMonitor) {
      clearInterval(_connectionMonitor);
    }

    let _batteryPollCounter = 0;

    _connectionMonitor = setInterval(() => {
      if (_isConnected && _device) {
        try {
          if (_device.gatt && !_device.gatt.connected) {
            log(`Pixel ${_name} GATT connection lost, marking as disconnected`);
            const deviceRef = _device;
            markDisconnected();
            setTimeout(() => {
              if (!_isConnected && deviceRef && _pixelSelf) {
                attemptReconnection(deviceRef, _pixelSelf);
              }
            }, 5000);
          } else if (_server) {
            _batteryPollCounter += 1;
            if (_batteryPollCounter >= 10) {
              _batteryPollCounter = 0;
              sendRequestBatteryLevel(_server);
            }
          }
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          log(
            `Pixel ${_name} GATT access failed, marking as disconnected: ${message}`
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

  let _disconnectionTimeout: ReturnType<typeof setTimeout> | null = null;
  let _pixelSelf: PixelDie | null = null;

  const markDisconnected = (): void => {
    if (_disconnectionTimeout) {
      clearTimeout(_disconnectionTimeout);
    }

    _disconnectionTimeout = setTimeout(() => {
      if (_isConnected) {
        _isConnected = false;
        _server = null;

        if (_notify && _notificationHandler) {
          try {
            _notify.removeEventListener(
              'characteristicvaluechanged',
              _notificationHandler
            );
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : String(error);
            log(
              `Error removing notification listener for ${_name}: ${message}`
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
    }, 1000);
  };

  const reconnect = (
    server: BluetoothRemoteGATTServer,
    notify: BluetoothRemoteGATTCharacteristic | null,
    device?: BluetoothDevice
  ): void => {
    _server = server;
    _isConnected = true;
    _lastActivity = Date.now();

    if (device) {
      _device = device;
    }

    if (_disconnectionTimeout) {
      clearTimeout(_disconnectionTimeout);
      _disconnectionTimeout = null;
    }

    if (notify) {
      setNotifyCharacteristic(notify);
    }

    log(`Pixel ${_name} reconnected successfully`);
    getSendStatusToExtension()();
  };

  const disconnect = (): void => {
    markDisconnected();
    _server?.disconnect();
    log(`Pixel ${_name} manually disconnected`);
  };

  const destroy = (): void => {
    disconnect();
    _device = null;
    log(`Pixel ${_name} destroyed`);
  };

  const handleNotifications = (event: Event): void => {
    try {
      _lastActivity = Date.now();

      const target = event.target as BluetoothRemoteGATTCharacteristic;
      const value = target.value;
      if (!value) return;

      const messageType = value.getUint8(0);

      if (messageType === 2 && value.byteLength >= 4) {
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
      } else if (messageType === 34 && value.byteLength >= 2) {
        _batteryLevel = value.getUint8(1);
        log(`Pixel ${_name} battery update: ${_batteryLevel}%`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Notification handling error for ${_name}: ${message}`);
    }
  };

  const handleFaceEvent = (ev: number, face: number): void => {
    if (!_hasMoved) {
      if (ev !== 1) {
        _hasMoved = true;
      }
    } else if (ev === 1) {
      _face = face;
      _hasMoved = false;

      let diceValue: number;
      if (_dieType === 100) {
        diceValue = face === 0 ? 100 : face * 10;
      } else if (_dieType === 10) {
        diceValue = face === 0 ? 10 : face;
      } else {
        diceValue = face + 1;
      }

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
        });
      } else {
        const message = pixelsFormulaSimple
          .replaceAll('#face_value', diceValue.toString())
          .replaceAll('#pixel_name', _name)
          .replaceAll('#result', diceValue.toString());

        message.split('\\n').forEach(s => postChatMessage(s));
        sendTextToExtension(`${_name}: face up = ${diceValue}`);
      }
    }
  };

  // Public API
  const pixelAPI: PixelDie = {
    get name() {
      return _name;
    },
    get deviceId() {
      return _deviceId;
    },
    get isConnected() {
      try {
        const gattConnected = _device && _device.gatt && _device.gatt.connected;
        return _isConnected && _server !== null && !!_device && !!gattConnected;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        log(`GATT state check error for ${_name}: ${message}`);
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
    async blink(color = 0xcc6600, count = 1, duration = 1000): Promise<void> {
      if (!_server || !_isConnected) {
        log(`Cannot blink ${_name}: not connected`);
        return;
      }
      const payload = buildBlinkPayload(color, count, duration);
      await sendBytes(_server, payload);
      log(`Blink sent to ${_name}`);
    },
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
    _reconnectAttempts: 0,
    _hasDisconnectListener: false,
  };

  _pixelSelf = pixelAPI;

  return pixelAPI;
};

// Resolve the Pixels notify characteristic from a connected GATT server.
const findNotifyCharacteristic = async (
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic> => {
  const candidates = [
    { service: PIXELS_SERVICE_UUID, notify: PIXELS_NOTIFY_CHARACTERISTIC },
    {
      service: PIXELS_LEGACY_SERVICE_UUID,
      notify: PIXELS_LEGACY_NOTIFY_CHARACTERISTIC,
    },
  ];

  for (const { service: serviceUuid, notify: notifyUuid } of candidates) {
    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(serviceUuid);
    } catch {
      continue;
    }

    try {
      return await service.getCharacteristic(notifyUuid);
    } catch {
      log(
        `Notify characteristic ${notifyUuid} not found in service ${serviceUuid}; discovering characteristics`
      );
    }

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

// Send a single-byte message to the die's write characteristic.
const sendMessage = async (
  server: BluetoothRemoteGATTServer,
  messageType: number
): Promise<void> => {
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
      await writeChar.writeValue(new Uint8Array([messageType]));
      return;
    } catch {
      // Try next UUID pair
    }
  }
};

// Send a multi-byte message to the die's write characteristic.
const sendBytes = async (
  server: BluetoothRemoteGATTServer,
  data: Uint8Array
): Promise<void> => {
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
      await writeChar.writeValue(data);
      return;
    } catch {
      // Try next UUID pair
    }
  }
};

// Pixels BLE protocol message type for Blink (message type 29).
const BLINK_MESSAGE_TYPE = 29;
const FACE_MASK_ALL = 0xffffffff;

// Build a Blink message payload per the Pixels BLE protocol.
const buildBlinkPayload = (
  color: number,
  count: number,
  duration: number
): Uint8Array => {
  const buffer = new ArrayBuffer(14);
  const view = new DataView(buffer);
  view.setUint8(0, BLINK_MESSAGE_TYPE);
  view.setUint8(1, count);
  view.setUint16(2, duration, true);
  view.setUint32(4, color, true);
  view.setUint32(8, FACE_MASK_ALL, true);
  view.setUint8(12, 128); // fade: moderate fade for a pleasant blink
  view.setUint8(13, 1); // loopCount
  return new Uint8Array(buffer);
};

// Send WhoAreYou (message type 1) to request IAmADie response with die type.
const sendWhoAreYou = async (
  server: BluetoothRemoteGATTServer
): Promise<void> => {
  await sendMessage(server, 1);
};

// Send RequestBatteryLevel (message type 33) to request a BatteryLevel response.
const sendRequestBatteryLevel = async (
  server: BluetoothRemoteGATTServer
): Promise<void> => {
  await sendMessage(server, 33);
};

// Main Bluetooth connection logic using functional approach
const connectToNewPixel = async (): Promise<PixelDie | null> => {
  if (!navigator.bluetooth) {
    const error = new Error('Bluetooth not supported in this browser');
    log(error.message);
    throw error;
  }

  const filters: BluetoothLEScanFilter[] = [
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

    const server = await device.gatt!.connect();
    const notifyChar = await findNotifyCharacteristic(server);

    await notifyChar.startNotifications();

    let pixel: PixelDie;
    if (existingPixel) {
      existingPixel.reconnect(server, notifyChar);
      pixel = existingPixel;
    } else {
      pixel = createPixel(device.name!, server, device);
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
    saveKnownDie(device.name!);

    return pixel;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      log('User cancelled the device chooser');
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    log(`Connection failed: ${message}`);
    throw error;
  }
};

// Handle device disconnection using functional approach
const _handleDeviceDisconnection = (device: BluetoothDevice): void => {
  log(`Handling disconnection for device: ${device.name}`);

  const pixel = getPixelByName(device.name!, pixels);
  if (pixel) {
    pixel.markDisconnected();
    sendTextToExtension(`Pixel ${device.name} disconnected`);
    getSendStatusToExtension()();

    setTimeout(() => {
      attemptReconnection(device, pixel);
    }, 5000);
  }
};

// Core GATT reconnection — connects to device and sets up services/notifications
const performGattReconnection = async (
  device: BluetoothDevice,
  pixel: PixelDie
): Promise<void> => {
  try {
    if (device.gatt!.connected) {
      device.gatt!.disconnect();
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
    }
  } catch {
    // GATT state might be inaccessible, continue anyway
  }

  const server = await device.gatt!.connect();
  await new Promise<void>(resolve => setTimeout(resolve, 500));

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
const attemptWatchReconnection = (
  device: BluetoothDevice,
  pixel: PixelDie
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const abortController = new AbortController();

    device.addEventListener(
      'advertisementreceived',
      async () => {
        abortController.abort();
        try {
          await performGattReconnection(device, pixel);
          resolve('watch');
        } catch (error: unknown) {
          reject(error);
        }
      },
      { once: true }
    );

    device
      .watchAdvertisements({ signal: abortController.signal })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          reject(error);
        }
      });

    setTimeout(() => {
      abortController.abort();
      reject(new Error('watchAdvertisements timeout'));
    }, 10000);
  });
};

// Poll-based reconnection — exponential backoff GATT connect attempts
const attemptPollReconnection = async (
  device: BluetoothDevice,
  pixel: PixelDie
): Promise<void> => {
  try {
    if (device.gatt && device.gatt.connected) {
      log(`Device ${device.name} is already connected, skipping reconnection`);
      return;
    }
  } catch {
    // GATT state inaccessible, proceed with reconnection
  }

  try {
    await performGattReconnection(device, pixel);
  } catch (error: unknown) {
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
const attemptReconnection = async (
  device: BluetoothDevice,
  pixel: PixelDie
): Promise<void> => {
  if (!device) {
    log('Cannot reconnect: device reference is null');
    return;
  }

  log(
    `Attempting to reconnect to ${device.name} (strategy: ${reconnectionStrategy})`
  );

  if (reconnectionStrategy === 'watch') {
    try {
      await attemptWatchReconnection(device, pixel);
    } catch {
      log(`Watch reconnection failed for ${device.name}, falling back to poll`);
      attemptPollReconnection(device, pixel);
    }
  } else if (reconnectionStrategy === 'poll') {
    attemptPollReconnection(device, pixel);
  } else {
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
export const connectToPixelByName = async (
  name: string
): Promise<PixelDie | null> => {
  if (!navigator.bluetooth) {
    const error = new Error('Bluetooth not supported in this browser');
    log(error.message);
    throw error;
  }

  const filters: BluetoothLEScanFilter[] = [{ name }];

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

    const server = await device.gatt!.connect();
    const notifyChar = await findNotifyCharacteristic(server);

    await notifyChar.startNotifications();

    sendWhoAreYou(server);

    let pixel: PixelDie;
    if (existingPixel) {
      existingPixel.reconnect(server, notifyChar);
      pixel = existingPixel;
    } else {
      pixel = createPixel(device.name!, server, device);
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
    saveKnownDie(device.name!);

    return pixel;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      log('User cancelled the device chooser');
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    log(`Connection to ${name} failed: ${message}`);
    throw error;
  }
};

// Disconnect all pixels using functional approach
export const disconnectAllPixels = (): void => {
  const connectedPixels = getConnectedPixels(pixels);

  map((pixel: PixelDie) => pixel.disconnect(), connectedPixels);
  pixels.length = 0;

  log(`Disconnected ${connectedPixels.length} pixels`);
  sendTextToExtension(`Disconnected ${connectedPixels.length} pixels`);
  getSendStatusToExtension()();
};

// Get pixels list
export const getPixels = (): PixelDie[] => pixels;

// Get connected pixels only
export const getConnectedPixelsList = (): PixelDie[] =>
  getConnectedPixels(pixels);

// Find pixel by name using functional approach
export const findPixelByName = getPixelByName;

// Set up global connection cleanup
const setupGlobalCleanup = (): void => {
  try {
    setInterval(() => {
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;

      const activePixels = filter((pixel: PixelDie) => {
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
    }, 300000);
  } catch (error: unknown) {
    console.log('Could not set up global cleanup timer:', error);
  }
};

// Attempt silent reconnection to previously-permitted devices.
const reconnectKnownDevices = async (): Promise<void> => {
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
      const existingPixel = getPixelByDeviceId(device.id, pixels);
      if (existingPixel && isConnected(existingPixel)) {
        continue;
      }

      watchForDeviceAndConnect(device);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Silent reconnection setup failed: ${message}`);
  }
};

// Watch for a single device's advertisements and connect when seen.
const watchForDeviceAndConnect = (device: BluetoothDevice): void => {
  const deviceName = device.name || 'Unknown Pixel';

  const handleAdvertisement = async (): Promise<void> => {
    log(`Advertisement received from ${deviceName}, connecting...`);

    device.removeEventListener('advertisementreceived', handleAdvertisement);

    try {
      const server = await device.gatt!.connect();
      await new Promise<void>(resolve => setTimeout(resolve, 500));

      if (!server.connected) {
        log(`${deviceName} connection lost immediately, will keep watching`);
        watchForDeviceAndConnect(device);
        return;
      }

      const notifyChar = await findNotifyCharacteristic(server);
      await notifyChar.startNotifications();

      sendWhoAreYou(server);

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
          pixel!.markDisconnected();
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Silent reconnection to ${deviceName} failed: ${message}`);
      setTimeout(() => {
        watchForDeviceAndConnect(device);
      }, 5000);
    }
  };

  device.addEventListener('advertisementreceived', handleAdvertisement);

  device.watchAdvertisements().catch((error: unknown) => {
    if (error instanceof Error && error.name !== 'InvalidStateError') {
      log(`watchAdvertisements failed for ${deviceName}: ${error.message}`);
    }
  });
};

// Initialize the module
export const initialize = (): {
  connectToPixel: typeof connectToNewPixel;
  disconnectAllPixels: typeof disconnectAllPixels;
  getPixels: typeof getPixels;
  getConnectedPixelsList: typeof getConnectedPixelsList;
  findPixelByName: typeof getPixelByName;
} => {
  log('PixelsBluetooth module initialized with ES modules and Ramda');
  setupGlobalCleanup();

  window.pixels = pixels;

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

  window.connectToPixel = connectToPixel;
  window.pixels = pixels;
}

// Expose for testing
declare const global: {
  createPixel?: typeof createPixel;
  getPixelByDeviceId?: typeof getPixelByDeviceId;
  PixelsBluetooth?: {
    connectToPixel: typeof connectToNewPixel;
    disconnectAllPixels: typeof disconnectAllPixels;
    getPixels: typeof getPixels;
    initialize: typeof initialize;
    createPixel: typeof createPixel;
    getPixelByDeviceId: typeof getPixelByDeviceId;
  };
};

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
