/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Comprehensive tests for the Pixel class functionality
 * Tests focus on the Pixel class methods, state management, and notification handling
 */

// Mock Chrome and Bluetooth APIs
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

describe('Pixel Class Functionality', () => {
  let originalChrome;
  let originalNavigator;
  let mockServer;
  let mockDevice;
  let mockCharacteristic;

  beforeAll(() => {
    originalChrome = global.chrome;
    originalNavigator = global.navigator;
  });

  beforeEach(() => {
    // Clear module cache for fresh load
    jest.resetModules();

    // Clear window state
    delete window.roll20PixelsLoaded;
    delete window.pixelsModifier;
    delete window.pixelsModifierName;

    // Set up mocks
    global.chrome = mockChrome;
    global.navigator = {
      ...global.navigator,
      bluetooth: mockBluetooth,
    };

    // Create mock GATT objects
    mockServer = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn(),
      getPrimaryService: jest.fn(),
      connected: true,
    };

    mockDevice = {
      name: 'TestPixel',
      gatt: mockServer,
      addEventListener: jest.fn(),
    };

    mockCharacteristic = {
      startNotifications: jest.fn().mockResolvedValue(),
      stopNotifications: jest.fn().mockResolvedValue(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      writeValue: jest.fn().mockResolvedValue(),
    };

    // Wire up mock chain
    mockServer.getPrimaryService.mockResolvedValue({
      getCharacteristic: jest.fn().mockResolvedValue(mockCharacteristic),
    });
    mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

    // Mock console
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock ModifierBox
    window.ModifierBox = {
      isInitialized: jest.fn().mockReturnValue(true),
      show: jest.fn(),
      hide: jest.fn(),
      getElement: jest.fn(),
      syncGlobalVars: jest.fn(),
    };

    // Set up DOM for chat testing
    document.body.innerHTML = `
      <div id="textchat-input">
        <textarea></textarea>
        <button></button>
      </div>
    `;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.chrome = originalChrome;
    global.navigator = originalNavigator;

    if (console.log.mockRestore) console.log.mockRestore();
    if (console.error.mockRestore) console.error.mockRestore();

    jest.clearAllMocks();
  });

  describe('Pixel Class Construction and Properties', () => {
    test('should create Pixel instance with correct properties', async () => {
      require('../../../src/content/roll20.js');

      // Get the message listener
      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Trigger connection to create Pixel instance
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Verify Pixel was created (tested indirectly through connection behavior)
      expect(mockDevice.addEventListener).toHaveBeenCalledWith(
        'gattserverdisconnected',
        expect.any(Function)
      );
      expect(mockCharacteristic.startNotifications).toHaveBeenCalled();
    });

    test('should handle Pixel construction with all parameters', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Successfully connect to create Pixel
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Verify the Pixel instance was set up correctly
      expect(mockCharacteristic.addEventListener).toHaveBeenCalledWith(
        'characteristicvaluechanged',
        expect.any(Function)
      );
    });
  });

  describe('Connection State Management', () => {
    test('should track connection state correctly', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Connect
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Should send status indicating connection
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'showText',
          text: expect.stringContaining('connected'),
        })
      );
    });

    test('should handle disconnection events', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Connect first
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Get the disconnect handler
      const disconnectHandler = mockDevice.addEventListener.mock.calls.find(
        call => call[0] === 'gattserverdisconnected'
      )?.[1];

      expect(disconnectHandler).toBeDefined();

      if (disconnectHandler) {
        // Simulate disconnection
        disconnectHandler({ target: mockDevice });

        // Should handle disconnection
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Handling disconnection')
        );
      }
    });

    test('should handle manual disconnection', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Connect first
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Clear previous calls
      mockChrome.runtime.sendMessage.mockClear();

      // Disconnect
      await messageListener({ action: 'disconnect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith('Manual disconnect requested');
    });
  });

  describe('Notification Handling', () => {
    test('should set up notification handlers correctly', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockCharacteristic.addEventListener).toHaveBeenCalledWith(
        'characteristicvaluechanged',
        expect.any(Function)
      );
    });

    test('should process face-up notifications correctly', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Get the notification handler
      const notificationHandler =
        mockCharacteristic.addEventListener.mock.calls.find(
          call => call[0] === 'characteristicvaluechanged'
        )?.[1];

      expect(notificationHandler).toBeDefined();

      if (notificationHandler) {
        // Create mock notification event for face-up (event type 3, status 1, face 5)
        const mockEvent = {
          target: {
            value: {
              byteLength: 3,
              getUint8: jest.fn(index => {
                if (index === 0) return 3; // Face event
                if (index === 1) return 1; // Face up event
                if (index === 2) return 5; // Face value (6 on d6)
                return 0;
              }),
            },
          },
        };

        // Clear previous calls
        mockChrome.runtime.sendMessage.mockClear();

        // Simulate initial movement to set _hasMoved flag
        mockEvent.target.value.getUint8 = jest.fn(index => {
          if (index === 0) return 3; // Face event
          if (index === 1) return 2; // Movement event
          if (index === 2) return 0; // Face value
          return 0;
        });
        notificationHandler(mockEvent);

        // Now simulate face-up event
        mockEvent.target.value.getUint8 = jest.fn(index => {
          if (index === 0) return 3; // Face event
          if (index === 1) return 1; // Face up event
          if (index === 2) return 5; // Face value (6 on d6)
          return 0;
        });
        notificationHandler(mockEvent);

        // Should sync with ModifierBox
        expect(window.ModifierBox.syncGlobalVars).toHaveBeenCalled();

        // Should send roll result
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'showText',
            text: expect.stringContaining('face up = 6'),
          })
        );
      }
    });

    test('should handle movement detection correctly', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      const notificationHandler =
        mockCharacteristic.addEventListener.mock.calls.find(
          call => call[0] === 'characteristicvaluechanged'
        )?.[1];

      if (notificationHandler) {
        // Create mock notification event for movement
        const mockEvent = {
          target: {
            value: {
              byteLength: 3,
              getUint8: jest.fn(index => {
                if (index === 0) return 3; // Face event
                if (index === 1) return 2; // Movement event (not face-up)
                if (index === 2) return 0; // Face value
                return 0;
              }),
            },
          },
        };

        // Should process movement without triggering roll
        expect(() => {
          notificationHandler(mockEvent);
        }).not.toThrow();
      }
    });

    test('should handle non-face events', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      const notificationHandler =
        mockCharacteristic.addEventListener.mock.calls.find(
          call => call[0] === 'characteristicvaluechanged'
        )?.[1];

      if (notificationHandler) {
        // Create mock notification event for non-face event
        const mockEvent = {
          target: {
            value: {
              byteLength: 3,
              getUint8: jest.fn(index => {
                if (index === 0) return 1; // Not a face event
                if (index === 1) return 0;
                if (index === 2) return 0;
                return 0;
              }),
            },
          },
        };

        // Should process without error
        expect(() => {
          notificationHandler(mockEvent);
        }).not.toThrow();
      }
    });
  });

  describe('Roll Processing and Chat Integration', () => {
    test('should calculate roll results correctly', async () => {
      require('../../../src/content/roll20.js');

      // Set up modifier
      window.pixelsModifier = '3';
      window.pixelsModifierName = 'Test Modifier';

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      const notificationHandler =
        mockCharacteristic.addEventListener.mock.calls.find(
          call => call[0] === 'characteristicvaluechanged'
        )?.[1];

      if (notificationHandler) {
        // First trigger movement
        let mockEvent = {
          target: {
            value: {
              byteLength: 3,
              getUint8: jest.fn(index => {
                if (index === 0) return 3; // Face event
                if (index === 1) return 2; // Movement
                if (index === 2) return 0;
                return 0;
              }),
            },
          },
        };
        notificationHandler(mockEvent);

        // Clear previous calls
        mockChrome.runtime.sendMessage.mockClear();

        // Then trigger face-up with value 4 (which should be face 5)
        mockEvent = {
          target: {
            value: {
              byteLength: 3,
              getUint8: jest.fn(index => {
                if (index === 0) return 3; // Face event
                if (index === 1) return 1; // Face up
                if (index === 2) return 4; // Face value 4 (displays as 5)
                return 0;
              }),
            },
          },
        };
        notificationHandler(mockEvent);

        // Should calculate: dice=5, modifier=3, result=8
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Dice value: 5, Modifier: 3, Result: 8')
        );
      }
    });

    test('should handle chat message posting', async () => {
      require('../../../src/content/roll20.js');

      const textarea = document.querySelector('#textchat-input textarea');
      const button = document.querySelector('#textchat-input button');
      const clickSpy = jest.spyOn(button, 'click').mockImplementation(() => {});

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      const notificationHandler =
        mockCharacteristic.addEventListener.mock.calls.find(
          call => call[0] === 'characteristicvaluechanged'
        )?.[1];

      if (notificationHandler) {
        // Set original content
        textarea.value = 'original';

        // Trigger movement then face-up
        let mockEvent = {
          target: {
            value: {
              byteLength: 3,
              getUint8: jest.fn(index => {
                if (index === 0) return 3;
                if (index === 1) return 2; // Movement
                if (index === 2) return 0;
                return 0;
              }),
            },
          },
        };
        notificationHandler(mockEvent);

        mockEvent = {
          target: {
            value: {
              byteLength: 3,
              getUint8: jest.fn(index => {
                if (index === 0) return 3;
                if (index === 1) return 1; // Face up
                if (index === 2) return 2; // Face 3
                return 0;
              }),
            },
          },
        };
        notificationHandler(mockEvent);

        // Should click the button to send message
        expect(clickSpy).toHaveBeenCalled();

        // Should restore original content
        expect(textarea.value).toBe('original');
      }
    });
  });

  describe('Error Handling in Pixel Operations', () => {
    test('should handle notification setup errors', async () => {
      require('../../../src/content/roll20.js');

      // Make startNotifications fail
      mockCharacteristic.startNotifications.mockRejectedValue(
        new Error('Notification failed')
      );

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error connecting to Pixel notifications')
      );
    });

    test('should handle invalid notification data', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      const notificationHandler =
        mockCharacteristic.addEventListener.mock.calls.find(
          call => call[0] === 'characteristicvaluechanged'
        )?.[1];

      if (notificationHandler) {
        // Create event with zero byte length
        const mockEvent = {
          target: {
            value: {
              byteLength: 0,
              getUint8: jest.fn(() => 0),
            },
          },
        };

        expect(() => {
          notificationHandler(mockEvent);
        }).not.toThrow();
      }
    });

    test('should handle malformed notification events', async () => {
      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      const notificationHandler =
        mockCharacteristic.addEventListener.mock.calls.find(
          call => call[0] === 'characteristicvaluechanged'
        )?.[1];

      if (notificationHandler) {
        // Create malformed event
        const mockEvent = {
          target: {}, // Missing value property
        };

        expect(() => {
          notificationHandler(mockEvent);
        }).not.toThrow();
      }
    });
  });

  describe('Reconnection Logic', () => {
    test('should attempt reconnection after disconnection', async () => {
      jest.useFakeTimers();

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Get disconnect handler
      const disconnectHandler = mockDevice.addEventListener.mock.calls.find(
        call => call[0] === 'gattserverdisconnected'
      )?.[1];

      if (disconnectHandler) {
        // Simulate disconnection
        mockDevice.gatt.connected = false;
        disconnectHandler({ target: mockDevice });

        // Fast-forward to trigger reconnection attempt
        jest.advanceTimersByTime(5000);

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Attempting to reconnect')
        );
      }

      jest.useRealTimers();
    });

    test('should handle reconnection failure gracefully', async () => {
      jest.useFakeTimers();

      require('../../../src/content/roll20.js');

      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      // Make reconnection fail
      mockServer.connect.mockRejectedValue(new Error('Reconnection failed'));

      const disconnectHandler = mockDevice.addEventListener.mock.calls.find(
        call => call[0] === 'gattserverdisconnected'
      )?.[1];

      if (disconnectHandler) {
        mockDevice.gatt.connected = false;
        disconnectHandler({ target: mockDevice });

        jest.advanceTimersByTime(5000);

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Failed to reconnect')
        );
      }

      jest.useRealTimers();
    });
  });
});
