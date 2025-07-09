/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Comprehensive and robust tests for roll20.js module
 * This file focuses on practical testing that works with the actual implementation
 */

// Comprehensive Chrome API mock
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Bluetooth API mock
const mockBluetooth = {
  requestDevice: jest.fn(),
  getAvailability: jest.fn().mockResolvedValue(true),
};

describe('Roll20.js Comprehensive Test Suite', () => {
  let originalChrome;
  let originalNavigator;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeAll(() => {
    originalChrome = global.chrome;
    originalNavigator = global.navigator;
  });

  beforeEach(() => {
    // Clear module cache for fresh loads
    jest.resetModules();

    // Clear any existing state
    delete window.roll20PixelsLoaded;
    delete window.pixelsModifier;
    delete window.pixelsModifierName;
    delete window.showModifierBox;
    delete window.hideModifierBox;
    delete window.sendMessageToExtension;

    // Set up global mocks
    global.chrome = mockChrome;
    global.navigator = {
      ...originalNavigator,
      bluetooth: mockBluetooth,
    };

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Reset all mocks
    jest.clearAllMocks();

    // Set up DOM structure
    document.body.innerHTML = `
      <div id="textchat-input">
        <textarea value=""></textarea>
        <button>Send</button>
      </div>
    `;

    // Mock ModifierBox
    window.ModifierBox = {
      isInitialized: jest.fn().mockReturnValue(true),
      show: jest.fn(),
      hide: jest.fn(),
      getElement: jest.fn().mockReturnValue({
        querySelector: jest.fn().mockReturnValue({ value: '0' }),
        querySelectorAll: jest
          .fn()
          .mockReturnValue([
            { querySelector: jest.fn().mockReturnValue({ value: '0' }) },
          ]),
      }),
      syncGlobalVars: jest.fn(),
    };
  });

  afterEach(() => {
    // Restore global state
    global.chrome = originalChrome;
    global.navigator = originalNavigator;

    // Restore console
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Clean up DOM
    document.body.innerHTML = '';
  });

  describe('Module Initialization', () => {
    test('should initialize global variables correctly', () => {
      require('../../../src/content/roll20.js');

      expect(window.pixelsModifier).toBe('0');
      expect(window.pixelsModifierName).toBe('Modifier 1');
      expect(typeof window.showModifierBox).toBe('function');
      expect(typeof window.hideModifierBox).toBe('function');
      expect(typeof window.sendMessageToExtension).toBe('function');
    });

    test('should prevent multiple initialization', () => {
      window.roll20PixelsLoaded = true;

      require('../../../src/content/roll20.js');

      // Variables should not be set if already loaded
      expect(window.pixelsModifier).toBeUndefined();
      expect(window.pixelsModifierName).toBeUndefined();
    });

    test('should register Chrome message listener', () => {
      require('../../../src/content/roll20.js');

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    test('should handle Chrome API unavailability gracefully', () => {
      delete global.chrome;

      expect(() => {
        require('../../../src/content/roll20.js');
      }).not.toThrow();
    });

    test('should send initial status message', () => {
      require('../../../src/content/roll20.js');

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'No Pixel connected',
      });
    });
  });

  describe('ModifierBox Integration', () => {
    beforeEach(() => {
      require('../../../src/content/roll20.js');
    });

    test('showModifierBox should work with available ModifierBox', () => {
      window.showModifierBox();

      expect(window.ModifierBox.show).toHaveBeenCalled();
    });

    test('showModifierBox should handle async ModifierBox.show', () => {
      window.ModifierBox.show = jest.fn().mockResolvedValue();
      Object.defineProperty(window.ModifierBox.show, 'constructor', {
        value: { name: 'AsyncFunction' },
      });

      expect(() => {
        window.showModifierBox();
      }).not.toThrow();
    });

    test('showModifierBox should handle uninitialized ModifierBox', () => {
      window.ModifierBox.isInitialized.mockReturnValue(false);

      window.showModifierBox();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'ModifierBox module not initialized yet'
      );
    });

    test('showModifierBox should handle missing ModifierBox', () => {
      delete window.ModifierBox;

      window.showModifierBox();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'ModifierBox module not loaded'
      );
    });

    test('hideModifierBox should work correctly', () => {
      window.hideModifierBox();

      expect(window.ModifierBox.hide).toHaveBeenCalled();
    });

    test('hideModifierBox should handle missing ModifierBox', () => {
      delete window.ModifierBox;

      window.hideModifierBox();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'ModifierBox module not loaded'
      );
    });
  });

  describe('Extension Communication', () => {
    beforeEach(() => {
      require('../../../src/content/roll20.js');
    });

    test('should send messages to extension correctly', () => {
      const testMessage = { action: 'test', data: 'value' };

      window.sendMessageToExtension(testMessage);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(testMessage);
    });

    test('should handle sendMessage errors gracefully', () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Communication failed');
      });

      expect(() => {
        window.sendMessageToExtension({ action: 'test' });
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Could not send message to extension:',
        'Communication failed'
      );
    });

    test('should handle missing Chrome runtime gracefully', () => {
      delete global.chrome.runtime;

      expect(() => {
        window.sendMessageToExtension({ action: 'test' });
      }).not.toThrow();
    });
  });

  describe('Message Handling', () => {
    let messageListener;

    beforeEach(() => {
      require('../../../src/content/roll20.js');
      messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    });

    test('should handle getStatus message', () => {
      mockChrome.runtime.sendMessage.mockClear();

      messageListener({ action: 'getStatus' }, null, jest.fn());

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'No Pixel connected',
      });
    });

    test('should handle setModifier message', () => {
      messageListener(
        { action: 'setModifier', modifier: '5' },
        null,
        jest.fn()
      );

      expect(window.pixelsModifier).toBe('5');
    });

    test('should handle setModifier with undefined value', () => {
      messageListener(
        { action: 'setModifier', modifier: undefined },
        null,
        jest.fn()
      );

      expect(window.pixelsModifier).toBe('0');
    });

    test('should handle showModifier message', () => {
      messageListener({ action: 'showModifier' }, null, jest.fn());

      expect(window.ModifierBox.show).toHaveBeenCalled();
    });

    test('should handle hideModifier message', () => {
      messageListener({ action: 'hideModifier' }, null, jest.fn());

      expect(window.ModifierBox.hide).toHaveBeenCalled();
    });

    test('should handle disconnect message', () => {
      messageListener({ action: 'disconnect' }, null, jest.fn());

      expect(consoleLogSpy).toHaveBeenCalledWith('Manual disconnect requested');
    });

    test('should handle null messages gracefully', () => {
      expect(() => {
        messageListener(null, null, jest.fn());
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Received invalid message')
      );
    });

    test('should handle undefined messages gracefully', () => {
      expect(() => {
        messageListener(undefined, null, jest.fn());
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Received invalid message')
      );
    });

    test('should handle messages without action property', () => {
      expect(() => {
        messageListener({ data: 'test' }, null, jest.fn());
      }).not.toThrow();
    });
  });

  describe('Bluetooth Connection Flow', () => {
    let messageListener;
    let mockDevice;
    let mockServer;
    let mockService;
    let mockCharacteristic;

    beforeEach(() => {
      // Set up complete Bluetooth mock chain
      mockCharacteristic = {
        startNotifications: jest.fn().mockResolvedValue(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
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

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');
      messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    });

    test('should request Bluetooth device with correct filters', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockBluetooth.requestDevice).toHaveBeenCalledWith({
        filters: [
          { services: ['a6b90001-7a5a-43f2-a962-350c8edc9b5b'] },
          { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] },
        ],
      });
    });

    test('should connect to GATT server', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockServer.connect).toHaveBeenCalled();
    });

    test('should detect modern Pixels service', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockServer.getPrimaryService).toHaveBeenCalledWith(
        'a6b90001-7a5a-43f2-a962-350c8edc9b5b'
      );
    });

    test('should fallback to legacy service on modern service failure', async () => {
      mockServer.getPrimaryService
        .mockRejectedValueOnce(new Error('Service not found'))
        .mockResolvedValueOnce(mockService);

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockServer.getPrimaryService).toHaveBeenCalledWith(
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
      );
    });

    test('should start notifications after connection', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockCharacteristic.startNotifications).toHaveBeenCalled();
    });

    test('should set up event listeners', async () => {
      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockDevice.addEventListener).toHaveBeenCalledWith(
        'gattserverdisconnected',
        expect.any(Function)
      );
      expect(mockCharacteristic.addEventListener).toHaveBeenCalledWith(
        'characteristicvaluechanged',
        expect.any(Function)
      );
    });

    test('should handle connection errors gracefully', async () => {
      mockBluetooth.requestDevice.mockRejectedValue(
        new Error('Connection failed')
      );

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error during device selection or connection')
      );
    });

    test('should prevent duplicate connections', async () => {
      // Connect once
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Try to connect again with same device name
      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('already connected')
      );
    });
  });

  describe('Roll Processing', () => {
    let messageListener;
    let mockDevice;
    let mockCharacteristic;
    let notificationHandler;

    beforeEach(async () => {
      // Set up Bluetooth mocks
      mockCharacteristic = {
        startNotifications: jest.fn().mockResolvedValue(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      const mockService = {
        getCharacteristic: jest.fn().mockResolvedValue(mockCharacteristic),
      };

      const mockServer = {
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

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');
      messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Connect to get notification handler
      await messageListener({ action: 'connect' }, null, jest.fn());

      // Get the notification handler
      notificationHandler = mockCharacteristic.addEventListener.mock.calls.find(
        call => call[0] === 'characteristicvaluechanged'
      )?.[1];
    });

    test('should process face-up notifications correctly', () => {
      if (!notificationHandler) {
        throw new Error('Notification handler not set up');
      }

      // Set modifier values
      window.pixelsModifier = '3';
      window.pixelsModifierName = 'Test Modifier';

      // First simulate movement to set _hasMoved flag
      const movementEvent = {
        target: {
          value: {
            byteLength: 3,
            getUint8: jest.fn(index => {
              if (index === 0) return 3; // Face event
              if (index === 1) return 2; // Movement event
              if (index === 2) return 0;
              return 0;
            }),
          },
        },
      };
      notificationHandler(movementEvent);

      // Clear previous calls
      mockChrome.runtime.sendMessage.mockClear();

      // Now simulate face-up event
      const faceUpEvent = {
        target: {
          value: {
            byteLength: 3,
            getUint8: jest.fn(index => {
              if (index === 0) return 3; // Face event
              if (index === 1) return 1; // Face up event
              if (index === 2) return 4; // Face value 4 (displays as 5)
              return 0;
            }),
          },
        },
      };

      notificationHandler(faceUpEvent);

      // Should sync with ModifierBox
      expect(window.ModifierBox.syncGlobalVars).toHaveBeenCalled();

      // Should send result to extension
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'TestPixel: face up = 5',
      });

      // Should log calculations
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Dice value: 5, Modifier: 3, Result: 8'
      );
    });

    test('should handle chat message posting', () => {
      if (!notificationHandler) {
        throw new Error('Notification handler not set up');
      }

      const textarea = document.querySelector('#textchat-input textarea');
      const button = document.querySelector('#textchat-input button');
      const clickSpy = jest.spyOn(button, 'click').mockImplementation(() => {});

      // Set original content
      textarea.value = 'original content';

      // Simulate movement then face-up
      const movementEvent = {
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
      notificationHandler(movementEvent);

      const faceUpEvent = {
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
      notificationHandler(faceUpEvent);

      // Should click the button to send chat message
      expect(clickSpy).toHaveBeenCalled();

      // Should restore original content
      expect(textarea.value).toBe('original content');
    });

    test('should handle missing chat elements gracefully', () => {
      if (!notificationHandler) {
        throw new Error('Notification handler not set up');
      }

      // Remove chat elements
      document.body.innerHTML = '';

      // Trigger face-up event
      const movementEvent = {
        target: {
          value: {
            byteLength: 3,
            getUint8: jest.fn(index => {
              if (index === 0) return 3;
              if (index === 1) return 2;
              if (index === 2) return 0;
              return 0;
            }),
          },
        },
      };
      notificationHandler(movementEvent);

      const faceUpEvent = {
        target: {
          value: {
            byteLength: 3,
            getUint8: jest.fn(index => {
              if (index === 0) return 3;
              if (index === 1) return 1;
              if (index === 2) return 2;
              return 0;
            }),
          },
        },
      };

      expect(() => {
        notificationHandler(faceUpEvent);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Couldn't find Roll20 chat textarea and/or button"
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed notification events', async () => {
      // Set up connection first
      const mockCharacteristic = {
        startNotifications: jest.fn().mockResolvedValue(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      const mockService = {
        getCharacteristic: jest.fn().mockResolvedValue(mockCharacteristic),
      };

      const mockServer = {
        connect: jest.fn().mockResolvedValue(),
        disconnect: jest.fn(),
        getPrimaryService: jest.fn().mockResolvedValue(mockService),
        connected: true,
      };

      const mockDevice = {
        name: 'TestPixel',
        gatt: mockServer,
        addEventListener: jest.fn(),
      };

      mockBluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');
      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      await messageListener({ action: 'connect' }, null, jest.fn());

      const notificationHandler =
        mockCharacteristic.addEventListener.mock.calls.find(
          call => call[0] === 'characteristicvaluechanged'
        )?.[1];

      if (notificationHandler) {
        // Test with malformed event
        const malformedEvent = {
          target: {}, // Missing value property
        };

        expect(() => {
          notificationHandler(malformedEvent);
        }).not.toThrow();
      }
    });

    test('should handle partial Chrome API availability', () => {
      global.chrome = { runtime: {} }; // Missing onMessage

      expect(() => {
        require('../../../src/content/roll20.js');
      }).not.toThrow();
    });

    test('should handle missing Bluetooth API', () => {
      delete global.navigator.bluetooth;

      require('../../../src/content/roll20.js');
      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      expect(() => {
        messageListener({ action: 'connect' }, null, jest.fn());
      }).not.toThrow();
    });

    test('should handle timer creation gracefully', () => {
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn();

      require('../../../src/content/roll20.js');

      // Should attempt to set up auto-show timer
      expect(global.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        1000
      );

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Status Reporting', () => {
    let messageListener;

    beforeEach(() => {
      require('../../../src/content/roll20.js');
      messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    });

    test('should report correct status with no pixels', () => {
      mockChrome.runtime.sendMessage.mockClear();

      messageListener({ action: 'getStatus' }, null, jest.fn());

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'No Pixel connected',
      });
    });

    test('should handle status reporting errors gracefully', () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Status failed');
      });

      expect(() => {
        messageListener({ action: 'getStatus' }, null, jest.fn());
      }).not.toThrow();
    });
  });
});
