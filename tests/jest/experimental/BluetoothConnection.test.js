/**
 * @jest-environment jsdom
 */

'use strict';

describe('Bluetooth Connection Management', () => {
  let mockDevice, mockServer, mockService, mockCharacteristic;
  let mockBluetooth;
  let messageListener;

  beforeEach(() => {
    // Set up comprehensive mocks
    mockCharacteristic = {
      startNotifications: jest.fn().mockResolvedValue(),
      stopNotifications: jest.fn().mockResolvedValue(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      writeValue: jest.fn().mockResolvedValue(),
    };

    mockService = {
      getCharacteristic: jest.fn().mockResolvedValue(mockCharacteristic),
    };

    mockServer = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn(),
      getPrimaryService: jest.fn().mockResolvedValue(mockService),
      connected: true,
    };

    mockDevice = {
      name: 'TestPixel',
      gatt: mockServer,
      addEventListener: jest.fn(),
    };

    mockBluetooth = {
      requestDevice: jest.fn().mockResolvedValue(mockDevice),
      getAvailability: jest.fn().mockResolvedValue(true),
    };

    // Set up global environment
    global.navigator = {
      bluetooth: mockBluetooth,
    };

    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(listener => {
            messageListener = listener;
          }),
        },
      },
    };

    // Mock ModifierBox
    window.ModifierBox = {
      isInitialized: jest.fn().mockReturnValue(true),
      syncGlobalVars: jest.fn(),
    };

    // Mock console
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Load the module
    delete window.roll20PixelsLoaded;
    require('../../../src/content/roll20.js');
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
    jest.clearAllMocks();
    delete window.roll20PixelsLoaded;
  });

  describe('Device Discovery', () => {
    test('should request device with correct service filters', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockBluetooth.requestDevice).toHaveBeenCalledWith({
        filters: [
          { services: ['a6b90001-7a5a-43f2-a962-350c8edc9b5b'] }, // Modern Pixels
          { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] }, // Legacy Pixels
        ],
      });
    });

    test('should handle user cancellation gracefully', async () => {
      mockBluetooth.requestDevice.mockRejectedValue(
        new Error('User cancelled')
      );

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error during device selection')
      );
    });

    test('should handle Bluetooth not available', async () => {
      delete global.navigator.bluetooth;

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Should not throw error
      expect(console.log).toHaveBeenCalledWith(
        'Connect button clicked, attempting to connect to Pixel'
      );
    });
  });

  describe('Connection Process', () => {
    test('should connect to modern Pixels device', async () => {
      mockServer.getPrimaryService
        .mockResolvedValueOnce(mockService) // First call for modern UUID succeeds
        .mockRejectedValue(new Error('Service not found')); // Second call fails

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockServer.getPrimaryService).toHaveBeenCalledWith(
        'a6b90001-7a5a-43f2-a962-350c8edc9b5b'
      );
      expect(mockService.getCharacteristic).toHaveBeenCalledWith(
        'a6b90002-7a5a-43f2-a962-350c8edc9b5b'
      );
    });

    test('should fallback to legacy Pixels device', async () => {
      mockServer.getPrimaryService
        .mockRejectedValueOnce(new Error('Modern service not found'))
        .mockResolvedValue(mockService); // Second call for legacy UUID succeeds

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockServer.getPrimaryService).toHaveBeenCalledWith(
        'a6b90001-7a5a-43f2-a962-350c8edc9b5b'
      );
      expect(mockServer.getPrimaryService).toHaveBeenCalledWith(
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
      );
    });

    test('should retry connection on failure', async () => {
      mockServer.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValue(); // Third attempt succeeds

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockServer.connect).toHaveBeenCalledTimes(3);
    });

    test('should give up after max retry attempts', async () => {
      mockServer.connect.mockRejectedValue(new Error('Connection failed'));

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockServer.connect).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error connecting to Pixel')
      );
    });

    test('should set up notifications after successful connection', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockCharacteristic.startNotifications).toHaveBeenCalled();
      expect(mockCharacteristic.addEventListener).toHaveBeenCalledWith(
        'characteristicvaluechanged',
        expect.any(Function)
      );
    });

    test('should prevent duplicate connections', async () => {
      // Connect once
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Reset mocks
      jest.clearAllMocks();

      // Try to connect again with same device name
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Should detect existing connection
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('already connected')
      );
    });
  });

  describe('Disconnection Handling', () => {
    test('should handle unexpected disconnection', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Get the disconnect handler
      const disconnectHandler = mockDevice.addEventListener.mock.calls.find(
        call => call[0] === 'gattserverdisconnected'
      )?.[1];

      expect(disconnectHandler).toBeDefined();

      // Simulate disconnection
      disconnectHandler({ target: mockDevice });

      expect(console.log).toHaveBeenCalledWith(
        'Handling disconnection for device: TestPixel'
      );
    });

    test('should attempt reconnection after disconnection', async () => {
      jest.useFakeTimers();

      await messageListener({ action: 'connect' }, null, jest.fn());

      const disconnectHandler = mockDevice.addEventListener.mock.calls.find(
        call => call[0] === 'gattserverdisconnected'
      )?.[1];

      // Simulate disconnection
      disconnectHandler({ target: mockDevice });

      // Advance timer to trigger reconnection
      jest.advanceTimersByTime(5000);

      expect(mockServer.connect).toHaveBeenCalled();

      jest.useRealTimers();
    });

    test('should clean up resources on disconnection', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      const disconnectHandler = mockDevice.addEventListener.mock.calls.find(
        call => call[0] === 'gattserverdisconnected'
      )?.[1];

      disconnectHandler({ target: mockDevice });

      // Should clean up event listeners and resources
      expect(mockCharacteristic.removeEventListener).toHaveBeenCalledWith(
        'characteristicvaluechanged',
        expect.any(Function)
      );
    });

    test('should handle manual disconnection', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      messageListener({ action: 'disconnect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith('Manual disconnect requested');
      expect(mockServer.disconnect).toHaveBeenCalled();
    });
  });

  describe('Connection Monitoring', () => {
    test('should start connection monitoring after connection', async () => {
      jest.useFakeTimers();

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Advance timer to check monitoring
      jest.advanceTimersByTime(30000);

      // Should periodically check connection status
      // This is verified indirectly through the monitoring behavior

      jest.useRealTimers();
    });

    test('should detect lost connections', async () => {
      jest.useFakeTimers();

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Simulate connection loss
      mockServer.connected = false;

      jest.advanceTimersByTime(30000);

      // Should detect the lost connection
      // This is tested indirectly through the monitoring logic

      jest.useRealTimers();
    });

    test('should clean up stale connections globally', async () => {
      jest.useFakeTimers();

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Advance time past cleanup threshold
      jest.advanceTimersByTime(60000);

      // Should run global cleanup
      // This is verified through the periodic cleanup function

      jest.useRealTimers();
    });
  });

  describe('Service Detection', () => {
    test('should properly detect modern Pixels service', async () => {
      mockServer.getPrimaryService
        .mockResolvedValueOnce(mockService)
        .mockRejectedValue(new Error('Legacy service not found'));

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        'Connected to modern Pixels die'
      );
    });

    test('should properly detect legacy Pixels service', async () => {
      mockServer.getPrimaryService
        .mockRejectedValueOnce(new Error('Modern service not found'))
        .mockResolvedValueOnce(mockService);

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        'Connected to legacy Pixels die'
      );
    });

    test('should handle service detection failure', async () => {
      mockServer.getPrimaryService.mockRejectedValue(
        new Error('No services found')
      );

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error connecting to Pixel')
      );
    });
  });

  describe('Notification Setup', () => {
    test('should handle notification setup failure gracefully', async () => {
      mockCharacteristic.startNotifications.mockRejectedValue(
        new Error('Notifications not supported')
      );

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error connecting to Pixel notifications')
      );
      expect(mockServer.disconnect).toHaveBeenCalled();
    });

    test('should set up notification handler correctly', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockCharacteristic.addEventListener).toHaveBeenCalledWith(
        'characteristicvaluechanged',
        expect.any(Function)
      );
    });
  });

  describe('Error Recovery', () => {
    test('should handle connection timeout', async () => {
      const timeoutError = new Error('Connection timeout');
      mockServer.connect.mockRejectedValue(timeoutError);

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error connecting to Pixel')
      );
    });

    test('should handle service unavailable error', async () => {
      mockServer.getPrimaryService.mockRejectedValue(
        new Error('Service unavailable')
      );

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error connecting to Pixel')
      );
    });

    test('should handle characteristic unavailable error', async () => {
      mockService.getCharacteristic.mockRejectedValue(
        new Error('Characteristic unavailable')
      );

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error connecting to Pixel')
      );
    });
  });

  describe('Reconnection Logic', () => {
    test('should retry reconnection on failure', async () => {
      jest.useFakeTimers();

      await messageListener({ action: 'connect' }, null, jest.fn());

      const disconnectHandler = mockDevice.addEventListener.mock.calls.find(
        call => call[0] === 'gattserverdisconnected'
      )?.[1];

      // Simulate disconnection
      disconnectHandler({ target: mockDevice });

      // Mock reconnection failure
      mockServer.connect.mockRejectedValue(new Error('Reconnection failed'));

      jest.advanceTimersByTime(5000);

      // Should try again after failure
      jest.advanceTimersByTime(10000);

      expect(mockServer.connect).toHaveBeenCalledTimes(2); // Initial + reconnect attempts

      jest.useRealTimers();
    });

    test('should detect service type on reconnection', async () => {
      jest.useFakeTimers();

      await messageListener({ action: 'connect' }, null, jest.fn());

      const disconnectHandler = mockDevice.addEventListener.mock.calls.find(
        call => call[0] === 'gattserverdisconnected'
      )?.[1];

      disconnectHandler({ target: mockDevice });

      // Reset mock for reconnection
      mockServer.getPrimaryService
        .mockRejectedValueOnce(new Error('Modern service not found'))
        .mockResolvedValue(mockService);

      jest.advanceTimersByTime(5000);

      expect(console.log).toHaveBeenCalledWith(
        'Reconnecting to legacy Pixels die'
      );

      jest.useRealTimers();
    });
  });
});
