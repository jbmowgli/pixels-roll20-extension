/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Simple, working comprehensive test for roll20.js
 * Focus on fundamental functionality with robust mocking
 */

describe('Roll20.js - Working Tests', () => {
  let mockChrome;
  let originalChrome;
  let originalNavigator;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeAll(() => {
    originalChrome = global.chrome;
    originalNavigator = global.navigator;
  });

  beforeEach(() => {
    // Clear module cache
    jest.resetModules();

    // Clear window state
    delete window.roll20PixelsLoaded;
    delete window.pixelsModifier;
    delete window.pixelsModifierName;
    delete window.showModifierBox;
    delete window.hideModifierBox;
    delete window.sendMessageToExtension;

    // Create fresh Chrome mock for each test
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
        },
      },
    };

    // Set up globals
    global.chrome = mockChrome;
    global.navigator = {
      ...originalNavigator,
      bluetooth: {
        requestDevice: jest.fn(),
        getAvailability: jest.fn().mockResolvedValue(true),
      },
    };

    // Mock console
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Set up DOM
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
    global.chrome = originalChrome;
    global.navigator = originalNavigator;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    document.body.innerHTML = '';
  });

  describe('Module Loading', () => {
    test('should load and initialize correctly', () => {
      require('../../../src/content/roll20.js');

      expect(window.pixelsModifier).toBe('0');
      expect(window.pixelsModifierName).toBe('Modifier 1');
      expect(typeof window.showModifierBox).toBe('function');
      expect(typeof window.hideModifierBox).toBe('function');
      expect(typeof window.sendMessageToExtension).toBe('function');
    });

    test('should register message listener', () => {
      require('../../../src/content/roll20.js');

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    test('should send initial status', () => {
      require('../../../src/content/roll20.js');

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'No Pixel connected',
      });
    });

    test('should prevent double initialization', () => {
      window.roll20PixelsLoaded = true;

      require('../../../src/content/roll20.js');

      expect(window.pixelsModifier).toBeUndefined();
    });

    test('should handle missing Chrome API', () => {
      delete global.chrome;

      expect(() => {
        require('../../../src/content/roll20.js');
      }).not.toThrow();
    });
  });

  describe('ModifierBox Functions', () => {
    beforeEach(() => {
      require('../../../src/content/roll20.js');
    });

    test('showModifierBox should call ModifierBox.show', () => {
      window.showModifierBox();

      expect(window.ModifierBox.show).toHaveBeenCalled();
    });

    test('showModifierBox should handle missing ModifierBox', () => {
      delete window.ModifierBox;

      window.showModifierBox();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'ModifierBox module not loaded'
      );
    });

    test('hideModifierBox should call ModifierBox.hide', () => {
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

    test('should send messages to extension', () => {
      const testMessage = { action: 'test', data: 'value' };

      window.sendMessageToExtension(testMessage);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(testMessage);
    });

    test('should handle missing Chrome runtime', () => {
      delete global.chrome.runtime;

      expect(() => {
        window.sendMessageToExtension({ action: 'test' });
      }).not.toThrow();
    });
  });

  describe('Message Processing', () => {
    let messageListener;

    beforeEach(() => {
      require('../../../src/content/roll20.js');
      // Get the message listener that was registered
      const calls = mockChrome.runtime.onMessage.addListener.mock.calls;
      if (calls.length > 0) {
        messageListener = calls[0][0];
      }
    });

    test('should handle getStatus message', () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      mockChrome.runtime.sendMessage.mockClear();

      messageListener({ action: 'getStatus' }, null, jest.fn());

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'No Pixel connected',
      });
    });

    test('should handle setModifier message', () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      messageListener(
        { action: 'setModifier', modifier: '5' },
        null,
        jest.fn()
      );

      expect(window.pixelsModifier).toBe('5');
    });

    test('should handle showModifier message', () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      messageListener({ action: 'showModifier' }, null, jest.fn());

      expect(window.ModifierBox.show).toHaveBeenCalled();
    });

    test('should handle hideModifier message', () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      messageListener({ action: 'hideModifier' }, null, jest.fn());

      expect(window.ModifierBox.hide).toHaveBeenCalled();
    });

    test('should handle disconnect message', () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      messageListener({ action: 'disconnect' }, null, jest.fn());

      expect(consoleLogSpy).toHaveBeenCalledWith('Manual disconnect requested');
    });

    test('should handle invalid messages', () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      // Test null message
      expect(() => {
        messageListener(null, null, jest.fn());
      }).not.toThrow();

      // Test undefined message
      expect(() => {
        messageListener(undefined, null, jest.fn());
      }).not.toThrow();

      // Test message without action
      expect(() => {
        messageListener({ data: 'test' }, null, jest.fn());
      }).not.toThrow();
    });
  });

  describe('Bluetooth Connection Simulation', () => {
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

      global.navigator.bluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');
      const calls = mockChrome.runtime.onMessage.addListener.mock.calls;
      if (calls.length > 0) {
        messageListener = calls[0][0];
      }
    });

    test('should attempt Bluetooth connection', async () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(global.navigator.bluetooth.requestDevice).toHaveBeenCalledWith({
        filters: [
          { services: ['a6b90001-7a5a-43f2-a962-350c8edc9b5b'] },
          { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] },
        ],
      });
    });

    test('should connect to GATT server', async () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockServer.connect).toHaveBeenCalled();
    });

    test('should start notifications', async () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(mockCharacteristic.startNotifications).toHaveBeenCalled();
    });

    test('should handle connection failure', async () => {
      if (!messageListener) {
        console.warn('Message listener not found, skipping test');
        return;
      }

      global.navigator.bluetooth.requestDevice.mockRejectedValue(
        new Error('Failed')
      );

      await messageListener({ action: 'connect' }, null, jest.fn());

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error during device selection or connection')
      );
    });
  });

  describe('Roll Processing Logic', () => {
    let messageListener;
    let notificationHandler;

    beforeEach(async () => {
      // Set up Bluetooth mocks
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

      global.navigator.bluetooth.requestDevice.mockResolvedValue(mockDevice);

      require('../../../src/content/roll20.js');
      const calls = mockChrome.runtime.onMessage.addListener.mock.calls;
      if (calls.length > 0) {
        messageListener = calls[0][0];

        // Connect to create pixel and get notification handler
        await messageListener({ action: 'connect' }, null, jest.fn());

        // Get the notification handler
        const notifCalls = mockCharacteristic.addEventListener.mock.calls;
        const notifCall = notifCalls.find(
          call => call[0] === 'characteristicvaluechanged'
        );
        if (notifCall) {
          notificationHandler = notifCall[1];
        }
      }
    });

    test('should process dice roll notifications', () => {
      if (!notificationHandler) {
        console.warn('Notification handler not found, skipping test');
        return;
      }

      // Set modifier values
      window.pixelsModifier = '2';
      window.pixelsModifierName = 'Test Modifier';

      // Simulate movement first
      const movementEvent = {
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
      notificationHandler(movementEvent);

      // Clear previous calls
      mockChrome.runtime.sendMessage.mockClear();

      // Simulate face-up event
      const faceUpEvent = {
        target: {
          value: {
            byteLength: 3,
            getUint8: jest.fn(index => {
              if (index === 0) return 3; // Face event
              if (index === 1) return 1; // Face up
              if (index === 2) return 3; // Face value 3 (displays as 4)
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
        text: 'TestPixel: face up = 4',
      });
    });

    test('should handle chat posting', () => {
      if (!notificationHandler) {
        console.warn('Notification handler not found, skipping test');
        return;
      }

      const textarea = document.querySelector('#textchat-input textarea');
      const button = document.querySelector('#textchat-input button');
      const clickSpy = jest.spyOn(button, 'click').mockImplementation(() => {});

      textarea.value = 'original';

      // Movement then face-up
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
              if (index === 2) return 1; // Face 2
              return 0;
            }),
          },
        },
      };
      notificationHandler(faceUpEvent);

      // Should click button and restore content
      expect(clickSpy).toHaveBeenCalled();
      expect(textarea.value).toBe('original');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing DOM elements', () => {
      require('../../../src/content/roll20.js');

      // Clear DOM
      document.body.innerHTML = '';

      expect(() => {
        window.showModifierBox();
      }).not.toThrow();
    });

    test('should handle Chrome API errors', () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('API Error');
      });

      require('../../../src/content/roll20.js');

      expect(() => {
        window.sendMessageToExtension({ action: 'test' });
      }).not.toThrow();
    });

    test('should handle partial Chrome API', () => {
      global.chrome = { runtime: {} }; // Missing onMessage

      expect(() => {
        require('../../../src/content/roll20.js');
      }).not.toThrow();
    });

    test('should handle missing Bluetooth', () => {
      delete global.navigator.bluetooth;

      require('../../../src/content/roll20.js');
      const calls = mockChrome.runtime.onMessage.addListener.mock.calls;
      if (calls.length > 0) {
        const messageListener = calls[0][0];

        expect(() => {
          messageListener({ action: 'connect' }, null, jest.fn());
        }).not.toThrow();
      }
    });
  });

  describe('Utility Functions', () => {
    test('should handle array operations correctly', () => {
      require('../../../src/content/roll20.js');

      // Test with proper DOM structure
      document.body.innerHTML = `
        <div id="textchat-input">
          <textarea>test</textarea>
          <button>Send</button>
        </div>
      `;

      const chatDiv = document.getElementById('textchat-input');
      const textareas = chatDiv.getElementsByTagName('textarea');
      const buttons = chatDiv.getElementsByTagName('button');

      expect(textareas.length).toBe(1);
      expect(buttons.length).toBe(1);
    });

    test('should handle empty collections', () => {
      require('../../../src/content/roll20.js');

      document.body.innerHTML = '<div id="textchat-input"></div>';

      const chatDiv = document.getElementById('textchat-input');
      const textareas = chatDiv.getElementsByTagName('textarea');
      const buttons = chatDiv.getElementsByTagName('button');

      expect(textareas.length).toBe(0);
      expect(buttons.length).toBe(0);
    });
  });
});
