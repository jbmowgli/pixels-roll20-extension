/**
 * PixelsBluetooth.js
 *
 * Handles all Bluetooth connectivity with Pixels dice, including:
 * - Device discovery and connection
 * - Connection monitoring and reconnection
 * - Pixel class definition
 * - Roll handling and formula processing
 */

'use strict';

(function () {
  const log = window.log || console.log;
  const postChatMessage = window.postChatMessage || function () {};
  const sendTextToExtension = window.sendTextToExtension || function () {};
  const sendStatusToExtension = window.sendStatusToExtension || function () {};

  // Pixels dice UUIDs from the official Pixels JS SDK

  // Modern Pixels dice UUIDs
  const PIXELS_SERVICE_UUID = 'a6b90001-7a5a-43f2-a962-350c8edc9b5b';
  const PIXELS_NOTIFY_CHARACTERISTIC = 'a6b90002-7a5a-43f2-a962-350c8edc9b5b';
  const PIXELS_WRITE_CHARACTERISTIC = 'a6b90003-7a5a-43f2-a962-350c8edc9b5b';

  // Legacy Pixels dice UUIDs (for older dice)
  const PIXELS_LEGACY_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const PIXELS_LEGACY_NOTIFY_CHARACTERISTIC =
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const PIXELS_LEGACY_WRITE_CHARACTERISTIC =
    '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

  // Global pixels array
  let pixels = [];

  // Roll formulas
  const pixelsFormulaWithModifier =
    '&{template:default} {{name=#modifier_name (+#modifier)}} {{Pixel=#face_value}} {{Result=[[#face_value + #modifier]]}}';
  const pixelsFormulaSimple =
    '&{template:default} {{name=Pixel Roll}} {{Pixel=#face_value}} {{Result=[[#result]]}}';

  // Pixel class - represents a connected Pixels die
  class Pixel {
    constructor(name, server, device) {
      this._name = name;
      this._server = server;
      this._device = device;
      this._notify = null;
      this._notificationHandler = null;
      this._hasMoved = false;
      this._status = 'Ready';
      this._isConnected = true;
      this._connectionMonitor = null;
      this._lastActivity = Date.now();
    }

    get isConnected() {
      return (
        this._isConnected &&
        this._server !== null &&
        this._device &&
        this._device.gatt.connected
      );
    }

    get name() {
      return this._name;
    }

    get lastFaceUp() {
      return this._face;
    }

    get lastActivity() {
      return this._lastActivity;
    }

    setNotifyCharacteristic(notify) {
      // Remove old listener if it exists
      if (this._notify && this._notificationHandler) {
        this._notify.removeEventListener(
          'characteristicvaluechanged',
          this._notificationHandler
        );
      }

      this._notify = notify;
      this._notificationHandler = ev => this.handleNotifications(ev);

      if (this._notify) {
        this._notify.addEventListener(
          'characteristicvaluechanged',
          this._notificationHandler
        );
      }
    }

    markDisconnected() {
      this._isConnected = false;
      this._server = null;

      // Clean up notification listener
      if (this._notify && this._notificationHandler) {
        this._notify.removeEventListener(
          'characteristicvaluechanged',
          this._notificationHandler
        );
        this._notify = null;
        this._notificationHandler = null;
      }

      if (this._connectionMonitor) {
        clearInterval(this._connectionMonitor);
        this._connectionMonitor = null;
      }
      log(`Pixel ${this._name} marked as disconnected`);
    }

    reconnect(server, notify) {
      this._server = server;
      this._isConnected = true;
      this._lastActivity = Date.now();

      // Set up new notification listener
      if (notify) {
        this.setNotifyCharacteristic(notify);
      }

      log(`Pixel ${this._name} reconnected successfully`);
    }

    disconnect() {
      this.markDisconnected();
      this._server?.disconnect();
      log(`Pixel ${this._name} manually disconnected`);
    }

    handleNotifications(event) {
      this._lastActivity = Date.now(); // Track activity for connection monitoring

      const value = event.target.value;
      const arr = [];
      // Convert raw data bytes to hex values just for the sake of showing something.
      for (let i = 0; i < value.byteLength; i++) {
        arr.push(`0x${`00${value.getUint8(i).toString(16)}`.slice(-2)}`);
      }

      log(`Pixel notification: ${arr.join(' ')}`);

      if (value.getUint8(0) === 3) {
        this._handleFaceEvent(value.getUint8(1), value.getUint8(2));
      }
    }

    _handleFaceEvent(ev, face) {
      if (!this._hasMoved) {
        if (ev !== 1) {
          this._hasMoved = true;
        }
      } else if (ev === 1) {
        this._face = face;
        const txt = `${this._name}: face up = ${face + 1}`;
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

        log(
          `Dice value: ${diceValue}, Modifier: ${modifier}, Result: ${result}`
        );
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
          .replaceAll('#pixel_name', this._name)
          .replaceAll('#modifier', modifier.toString())
          .replaceAll('#result', result.toString());

        log(`Formula after replacement: ${message}`);

        message.split('\\n').forEach(s => postChatMessage(s));

        sendTextToExtension(txt);
      }
    }
  }

  // Connect to a Pixels die
  async function connectToPixel() {
    try {
      // Try to find both modern and legacy Pixels dice
      const options = {
        filters: [
          { services: [PIXELS_SERVICE_UUID] }, // Modern Pixels dice
          { services: [PIXELS_LEGACY_SERVICE_UUID] }, // Legacy Pixels dice
        ],
      };
      log(`Requesting Bluetooth Device with ${JSON.stringify(options)}`);

      const device = await navigator.bluetooth.requestDevice(options);
      log(
        `User selected Pixel "${device.name}", connected=${
          device.gatt.connected
        }`
      );

      // Add disconnect event listener to handle unexpected disconnections
      device.addEventListener('gattserverdisconnected', event => {
        log(`Pixel device disconnected: ${event.target.name}`);
        handleDeviceDisconnection(event.target);
      });

      let server, notify;
      const connect = async () => {
        console.log(`Connecting to ${device.name}`);
        server = await device.gatt.connect();

        // Try to detect which type of Pixel this is and use appropriate UUIDs
        let serviceUuid, notifyUuid, _writeUuid;
        try {
          // Try modern UUIDs first
          await server.getPrimaryService(PIXELS_SERVICE_UUID);
          serviceUuid = PIXELS_SERVICE_UUID;
          notifyUuid = PIXELS_NOTIFY_CHARACTERISTIC;
          _writeUuid = PIXELS_WRITE_CHARACTERISTIC;
          log('Connected to modern Pixels die');
        } catch {
          // Fall back to legacy UUIDs
          await server.getPrimaryService(PIXELS_LEGACY_SERVICE_UUID);
          serviceUuid = PIXELS_LEGACY_SERVICE_UUID;
          notifyUuid = PIXELS_LEGACY_NOTIFY_CHARACTERISTIC;
          _writeUuid = PIXELS_LEGACY_WRITE_CHARACTERISTIC;
          log('Connected to legacy Pixels die');
        }

        const service = await server.getPrimaryService(serviceUuid);
        notify = await service.getCharacteristic(notifyUuid);
      };

      // Attempt to connect up to 3 times
      const maxAttempts = 3;
      for (let i = maxAttempts - 1; i >= 0; --i) {
        try {
          await connect();
          break;
        } catch (error) {
          log(`Error connecting to Pixel: ${error}`);
          // Wait a bit before trying again
          if (i) {
            const delay = 2;
            log(`Trying again in ${delay} seconds...`);
            await new Promise(resolve =>
              setTimeout(() => resolve(), delay * 1000)
            );
          }
        }
      }

      // Subscribe to notify characteristic
      if (server && notify) {
        try {
          // Check if this device is already connected
          const existingPixel = pixels.find(p => p.name === device.name);
          if (existingPixel) {
            log(
              `Device ${
                device.name
              } is already connected, skipping duplicate connection`
            );
            return;
          }

          const pixel = new Pixel(device.name, server, device);
          await notify.startNotifications();
          log('Pixels notifications started!');
          pixel.setNotifyCharacteristic(notify);
          sendTextToExtension(`Just connected to ${pixel.name}`);
          pixels.push(pixel);

          // Update connection status in popup
          sendStatusToExtension();

          // Start connection monitoring
          startConnectionMonitoring(pixel);
        } catch (error) {
          log(`Error connecting to Pixel notifications: ${error}`);
          // Handle notification error
          if (server) {
            server.disconnect();
          }
        }
      }
    } catch (error) {
      log(`Error during device selection or connection: ${error}`);
      sendTextToExtension(`Failed to connect to Pixel: ${error.message}`);
    }
  }

  // Handle device disconnection
  function handleDeviceDisconnection(device) {
    log(`Handling disconnection for device: ${device.name}`);

    // Find the pixel in our array
    const pixelIndex = pixels.findIndex(p => p.name === device.name);
    if (pixelIndex !== -1) {
      const pixel = pixels[pixelIndex];
      pixel.markDisconnected();

      // Update status
      sendTextToExtension(`Pixel ${device.name} disconnected`);
      sendStatusToExtension();

      // Attempt to reconnect after a delay
      setTimeout(() => {
        attemptReconnection(device, pixel);
      }, 5000); // Wait 5 seconds before attempting reconnection
    }
  }

  // Attempt to reconnect to a disconnected device
  async function attemptReconnection(device, pixel) {
    if (!device.gatt.connected) {
      log(`Attempting to reconnect to ${device.name}`);
      try {
        // First, ensure we're disconnected cleanly
        if (device.gatt.connected) {
          device.gatt.disconnect();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }

        const server = await device.gatt.connect();

        // Wait a moment for the connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify connection is still active
        if (!server.connected) {
          throw new Error('Connection lost immediately after connecting');
        }

        // Detect which type of Pixel this is and use appropriate UUIDs
        let service, notifyUuid;
        try {
          // Try modern UUIDs first
          service = await server.getPrimaryService(PIXELS_SERVICE_UUID);
          notifyUuid = PIXELS_NOTIFY_CHARACTERISTIC;
          log('Reconnecting to modern Pixels die');
        } catch {
          // Fall back to legacy UUIDs
          service = await server.getPrimaryService(PIXELS_LEGACY_SERVICE_UUID);
          notifyUuid = PIXELS_LEGACY_NOTIFY_CHARACTERISTIC;
          log('Reconnecting to legacy Pixels die');
        }
        const notify = await service.getCharacteristic(notifyUuid);

        await notify.startNotifications();

        pixel.reconnect(server, notify);
        sendTextToExtension(`Reconnected to ${pixel.name}`);
        log(`Successfully reconnected to ${device.name}`);

        // Restart connection monitoring
        startConnectionMonitoring(pixel);

        // Reset retry count on successful reconnection
        pixel._reconnectAttempts = 0;
      } catch (error) {
        log(`Failed to reconnect to ${device.name}: ${error}`);

        // Implement exponential backoff
        pixel._reconnectAttempts = (pixel._reconnectAttempts || 0) + 1;
        const maxAttempts = 5;

        if (pixel._reconnectAttempts < maxAttempts) {
          const delay = Math.min(
            5000 * Math.pow(2, pixel._reconnectAttempts - 1),
            60000
          ); // Cap at 1 minute
          log(
            `Retry ${pixel._reconnectAttempts}/${maxAttempts} in ${delay / 1000} seconds`
          );

          setTimeout(() => {
            attemptReconnection(device, pixel);
          }, delay);
        } else {
          log(
            `Max reconnection attempts reached for ${device.name}. Giving up.`
          );
          sendTextToExtension(
            `Failed to reconnect to ${pixel.name} after ${maxAttempts} attempts`
          );
        }
      }
    }
  }

  // Start connection monitoring for a pixel
  function startConnectionMonitoring(pixel) {
    // Check connection status every 30 seconds
    try {
      pixel._connectionMonitor = setInterval(() => {
        if (pixel._device && !pixel._device.gatt.connected) {
          log(`Connection lost detected for ${pixel.name}`);
          handleDeviceDisconnection(pixel._device);
          clearInterval(pixel._connectionMonitor);
        }
      }, 30000);
    } catch (error) {
      console.log('Could not set up connection monitoring:', error);
    }
  }

  // Disconnect all pixels
  function disconnectAllPixels() {
    log('Manual disconnect requested');
    pixels.forEach(pixel => {
      pixel.disconnect();
    });
    pixels = [];
    sendStatusToExtension();
  }

  // Get current pixels array
  function getPixels() {
    return pixels;
  }

  // Set up global connection cleanup - runs every 60 seconds
  function setupGlobalCleanup() {
    try {
      setInterval(() => {
        // Remove permanently disconnected pixels after 5 minutes of inactivity
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        pixels = pixels.filter(pixel => {
          if (!pixel.isConnected && now - pixel.lastActivity > fiveMinutes) {
            log(`Removing stale pixel connection: ${pixel.name}`);
            pixel.disconnect(); // Ensure cleanup
            return false;
          }
          return true;
        });

        // Update status if pixels were removed
        sendStatusToExtension();
      }, 60000);
    } catch (error) {
      console.log('Could not set up global cleanup timer:', error);
    }
  }

  // Initialize the module
  function initialize() {
    setupGlobalCleanup();
  }

  // Export functions to global scope
  window.PixelsBluetooth = {
    connectToPixel,
    disconnectAllPixels,
    getPixels,
    initialize,
    Pixel,
  };

  // Legacy exports for compatibility
  window.connectToPixel = connectToPixel;
  window.pixels = pixels;
  window.Pixel = Pixel;

  // Expose for testing
  if (typeof global !== 'undefined') {
    global.Pixel = Pixel;
  }
})();
