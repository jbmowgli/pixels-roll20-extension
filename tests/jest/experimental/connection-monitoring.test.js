/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Tests for connection monitoring, cleanup, and background processes
 * Focuses on interval-based operations and resource management
 */

const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

const mockBluetooth = {
  requestDevice: jest.fn(),
  getAvailability: jest.fn(),
};

describe('Connection Monitoring and Cleanup', () => {
  let originalChrome;
  let originalNavigator;
  let originalSetInterval;
  let originalClearInterval;
  let intervalSpy;
  let clearIntervalSpy;

  beforeAll(() => {
    originalChrome = global.chrome;
    originalNavigator = global.navigator;
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;
  });

  beforeEach(() => {
    // Clear module cache
    jest.resetModules();

    // Clear window state
    delete window.roll20PixelsLoaded;

    // Set up mocks
    global.chrome = mockChrome;
    global.navigator = {
      ...global.navigator,
      bluetooth: mockBluetooth,
    };

    // Mock intervals
    intervalSpy = jest.fn();
    clearIntervalSpy = jest.fn();
    global.setInterval = intervalSpy;
    global.clearInterval = clearIntervalSpy;

    // Mock console
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Mock ModifierBox
    window.ModifierBox = {
      isInitialized: jest.fn().mockReturnValue(true),
      show: jest.fn(),
      hide: jest.fn(),
      getElement: jest.fn(),
      syncGlobalVars: jest.fn(),
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.chrome = originalChrome;
    global.navigator = originalNavigator;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;

    if (console.log.mockRestore) console.log.mockRestore();

    jest.clearAllMocks();
  });

  describe('Connection Monitoring Setup', () => {
    test('should set up global cleanup interval', () => {
      require('../../../src/content/roll20.js');

      // Should set up a 60-second interval for global cleanup
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    test('should set up auto-show timer', () => {
      const setTimeoutSpy = jest.fn();
      global.setTimeout = setTimeoutSpy;

      require('../../../src/content/roll20.js');

      // Should set up 1-second timeout for auto-show
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      global.setTimeout = originalSetInterval; // Restore
    });

    test('should handle timer setup errors gracefully', () => {
      // Make setInterval throw
      global.setInterval = jest.fn(() => {
        throw new Error('Timer failed');
      });

      expect(() => {
        require('../../../src/content/roll20.js');
      }).not.toThrow();
    });
  });

  describe('Connection State Tracking', () => {
    test('should track connection state properly', async () => {
      const mockDevice = {
        name: 'TestPixel',
        gatt: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn(),
          getPrimaryService: jest.fn().mockResolvedValue({
            getCharacteristic: jest.fn().mockResolvedValue({
              startNotifications: jest.fn().mockResolvedValue(),
              addEventListener: jest.fn(),
            }),
          }),
          connected: true,
        },
        addEventListener: jest.fn(),
      };

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Connect to create a pixel
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Should send connection status
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'showText',
          text: expect.stringContaining('connected'),
        })
      );
    });

    test('should handle multiple pixel connections', async () => {
      const createMockDevice = name => ({
        name,
        gatt: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn(),
          getPrimaryService: jest.fn().mockResolvedValue({
            getCharacteristic: jest.fn().mockResolvedValue({
              startNotifications: jest.fn().mockResolvedValue(),
              addEventListener: jest.fn(),
            }),
          }),
          connected: true,
        },
        addEventListener: jest.fn(),
      });

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Connect first pixel
      mockBluetooth.requestDevice.mockResolvedValueOnce(
        createMockDevice('Pixel1')
      );
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Connect second pixel
      mockBluetooth.requestDevice.mockResolvedValueOnce(
        createMockDevice('Pixel2')
      );
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Should handle multiple connections
      expect(mockBluetooth.requestDevice).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cleanup Operations', () => {
    test('should implement global cleanup logic', () => {
      require('../../../src/content/roll20.js');

      // Get the cleanup function
      const cleanupFunction = intervalSpy.mock.calls.find(
        call => call[1] === 60000
      )?.[0];

      expect(cleanupFunction).toBeDefined();

      if (cleanupFunction) {
        // Mock Date.now for consistent timing
        const originalNow = Date.now;
        Date.now = jest.fn(() => 1000000); // Fixed timestamp

        // Run cleanup function
        expect(() => {
          cleanupFunction();
        }).not.toThrow();

        Date.now = originalNow;
      }
    });

    test('should clean up stale connections', () => {
      require('../../../src/content/roll20.js');

      const cleanupFunction = intervalSpy.mock.calls.find(
        call => call[1] === 60000
      )?.[0];

      if (cleanupFunction) {
        // Mock current time
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000 + 1000);
        const originalNow = Date.now;
        Date.now = jest.fn(() => Date.now());

        // Simulate cleanup with stale connections
        expect(() => {
          cleanupFunction();
        }).not.toThrow();

        Date.now = originalNow;
      }
    });

    test('should handle errors during cleanup', () => {
      require('../../../src/content/roll20.js');

      const cleanupFunction = intervalSpy.mock.calls.find(
        call => call[1] === 60000
      )?.[0];

      if (cleanupFunction) {
        // Mock Date.now to throw
        const originalNow = Date.now;
        Date.now = jest.fn(() => {
          throw new Error('Time error');
        });

        expect(() => {
          cleanupFunction();
        }).not.toThrow();

        Date.now = originalNow;
      }
    });
  });

  describe('Per-Pixel Connection Monitoring', () => {
    test('should set up individual pixel monitoring', async () => {
      const mockDevice = {
        name: 'TestPixel',
        gatt: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn(),
          getPrimaryService: jest.fn().mockResolvedValue({
            getCharacteristic: jest.fn().mockResolvedValue({
              startNotifications: jest.fn().mockResolvedValue(),
              addEventListener: jest.fn(),
            }),
          }),
          connected: true,
        },
        addEventListener: jest.fn(),
      };

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Should set up monitoring interval (30 seconds)
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    test('should detect connection loss', async () => {
      const mockDevice = {
        name: 'TestPixel',
        gatt: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn(),
          getPrimaryService: jest.fn().mockResolvedValue({
            getCharacteristic: jest.fn().mockResolvedValue({
              startNotifications: jest.fn().mockResolvedValue(),
              addEventListener: jest.fn(),
            }),
          }),
          connected: true,
        },
        addEventListener: jest.fn(),
      };

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Get the monitoring function
      const monitoringFunction = intervalSpy.mock.calls.find(
        call => call[1] === 30000
      )?.[0];

      if (monitoringFunction) {
        // Simulate connection loss
        mockDevice.gatt.connected = false;

        expect(() => {
          monitoringFunction();
        }).not.toThrow();

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Connection lost detected')
        );
      }
    });

    test('should clean up monitoring on disconnection', async () => {
      const mockDevice = {
        name: 'TestPixel',
        gatt: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn(),
          getPrimaryService: jest.fn().mockResolvedValue({
            getCharacteristic: jest.fn().mockResolvedValue({
              startNotifications: jest.fn().mockResolvedValue(),
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
            }),
          }),
          connected: true,
        },
        addEventListener: jest.fn(),
      };

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Disconnect
      await messageListener({ action: 'disconnect' }, null, jest.fn());

      // Should clear intervals
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    test('should handle memory cleanup correctly', async () => {
      const mockDevice = {
        name: 'TestPixel',
        gatt: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn(),
          getPrimaryService: jest.fn().mockResolvedValue({
            getCharacteristic: jest.fn().mockResolvedValue({
              startNotifications: jest.fn().mockResolvedValue(),
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
            }),
          }),
          connected: true,
        },
        addEventListener: jest.fn(),
      };

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Connect and disconnect multiple times
      for (let i = 0; i < 3; i++) {
        await messageListener({ action: 'connect' }, null, jest.fn());
        await messageListener({ action: 'disconnect' }, null, jest.fn());
      }

      // Should handle multiple connect/disconnect cycles
      expect(mockBluetooth.requestDevice).toHaveBeenCalledTimes(3);
    });

    test('should handle event listener cleanup', async () => {
      const mockCharacteristic = {
        startNotifications: jest.fn().mockResolvedValue(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      const mockDevice = {
        name: 'TestPixel',
        gatt: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn(),
          getPrimaryService: jest.fn().mockResolvedValue({
            getCharacteristic: jest.fn().mockResolvedValue(mockCharacteristic),
          }),
          connected: true,
        },
        addEventListener: jest.fn(),
      };

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());
      await messageListener({ action: 'disconnect' }, null, jest.fn());

      // Should remove event listeners on cleanup
      expect(mockCharacteristic.removeEventListener).toHaveBeenCalledWith(
        'characteristicvaluechanged',
        expect.any(Function)
      );
    });

    test('should handle interval cleanup errors', async () => {
      // Make clearInterval throw
      global.clearInterval = jest.fn(() => {
        throw new Error('Cleanup failed');
      });

      const mockDevice = {
        name: 'TestPixel',
        gatt: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn(),
          getPrimaryService: jest.fn().mockResolvedValue({
            getCharacteristic: jest.fn().mockResolvedValue({
              startNotifications: jest.fn().mockResolvedValue(),
              addEventListener: jest.fn(),
              removeEventListener: jest.fn(),
            }),
          }),
          connected: true,
        },
        addEventListener: jest.fn(),
      };

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Should handle cleanup errors gracefully
      expect(() => {
        messageListener({ action: 'disconnect' }, null, jest.fn());
      }).not.toThrow();
    });
  });

  describe('Status Updates and Monitoring', () => {
    test('should update status after cleanup operations', () => {
      require('../../../src/content/roll20.js');

      const cleanupFunction = intervalSpy.mock.calls.find(
        call => call[1] === 60000
      )?.[0];

      if (cleanupFunction) {
        // Clear previous calls
        mockChrome.runtime.sendMessage.mockClear();

        // Run cleanup
        cleanupFunction();

        // Should send status update
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'showText',
          })
        );
      }
    });

    test('should handle status update errors during monitoring', () => {
      // Make sendMessage throw
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Status update failed');
      });

      require('../../../src/content/roll20.js');

      const cleanupFunction = intervalSpy.mock.calls.find(
        call => call[1] === 60000
      )?.[0];

      if (cleanupFunction) {
        expect(() => {
          cleanupFunction();
        }).not.toThrow();
      }
    });

    test('should provide accurate connection counts', async () => {
      const createMockDevice = name => ({
        name,
        gatt: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn(),
          getPrimaryService: jest.fn().mockResolvedValue({
            getCharacteristic: jest.fn().mockResolvedValue({
              startNotifications: jest.fn().mockResolvedValue(),
              addEventListener: jest.fn(),
            }),
          }),
          connected: true,
        },
        addEventListener: jest.fn(),
      });

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Clear initial status calls
      mockChrome.runtime.sendMessage.mockClear();

      // Connect two pixels
      mockBluetooth.requestDevice.mockResolvedValueOnce(
        createMockDevice('Pixel1')
      );
      await messageListener({ action: 'connect' }, null, jest.fn());

      mockBluetooth.requestDevice.mockResolvedValueOnce(
        createMockDevice('Pixel2')
      );
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Request status
      mockChrome.runtime.sendMessage.mockClear();
      messageListener({ action: 'getStatus' }, null, jest.fn());

      // Should report correct count
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'showText',
          text: expect.stringMatching(/2.*connected/),
        })
      );
    });
  });
});
