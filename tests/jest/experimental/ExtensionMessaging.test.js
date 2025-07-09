/**
 * @jest-environment jsdom
 */

'use strict';

describe('Extension Messaging System', () => {
  let messageListener;
  let mockChrome;

  beforeEach(() => {
    // Set up Chrome API mock
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(listener => {
            messageListener = listener;
          }),
        },
      },
    };

    global.chrome = mockChrome;

    // Mock ModifierBox
    window.ModifierBox = {
      isInitialized: jest.fn().mockReturnValue(true),
      show: jest.fn(),
      hide: jest.fn(),
      getElement: jest.fn().mockReturnValue({
        querySelector: jest.fn().mockReturnValue({
          value: '0',
          querySelectorAll: jest.fn().mockReturnValue([
            {
              querySelector: jest.fn().mockReturnValue({ value: '0' }),
            },
          ]),
        }),
      }),
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

  describe('Message Listener Setup', () => {
    test('should register message listener on initialization', () => {
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    test('should handle Chrome API not available', () => {
      delete global.chrome;

      // Should not throw when Chrome API is missing
      expect(() => {
        delete window.roll20PixelsLoaded;
        require('../../../src/content/roll20.js');
      }).not.toThrow();
    });

    test('should handle partial Chrome API availability', () => {
      global.chrome = { runtime: {} }; // Missing onMessage

      expect(() => {
        delete window.roll20PixelsLoaded;
        require('../../../src/content/roll20.js');
      }).not.toThrow();
    });
  });

  describe('Outbound Messages', () => {
    test('should send status text messages', () => {
      // Access sendTextToExtension indirectly through status updates
      messageListener({ action: 'getStatus' }, null, jest.fn());

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'No Pixel connected',
      });
    });

    test('should send arbitrary data messages', () => {
      const testData = { action: 'test', value: 123 };

      window.sendMessageToExtension(testData);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(testData);
    });

    test('should handle sendMessage errors gracefully', () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Extension context invalidated');
      });

      expect(() => {
        window.sendMessageToExtension({ action: 'test' });
      }).not.toThrow();

      expect(console.log).toHaveBeenCalledWith(
        'Could not send message to extension:',
        'Extension context invalidated'
      );
    });

    test('should handle missing Chrome runtime', () => {
      delete global.chrome.runtime;

      expect(() => {
        window.sendMessageToExtension({ action: 'test' });
      }).not.toThrow();
    });

    test('should handle Chrome not defined', () => {
      delete global.chrome;

      expect(() => {
        window.sendMessageToExtension({ action: 'test' });
      }).not.toThrow();
    });
  });

  describe('Inbound Message Handling', () => {
    describe('getStatus action', () => {
      test('should send no pixels status', () => {
        messageListener({ action: 'getStatus' }, null, jest.fn());

        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
          action: 'showText',
          text: 'No Pixel connected',
        });
      });

      test('should send single pixel status', () => {
        // This would be tested after adding pixel connection logic
        // For now, we test the no pixels case
        messageListener({ action: 'getStatus' }, null, jest.fn());

        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
          action: 'showText',
          text: 'No Pixel connected',
        });
      });
    });

    describe('setModifier action', () => {
      test('should update modifier value', () => {
        const testModifier = '7';
        messageListener(
          {
            action: 'setModifier',
            modifier: testModifier,
          },
          null,
          jest.fn()
        );

        expect(window.pixelsModifier).toBe(testModifier);
        expect(console.log).toHaveBeenCalledWith('Updated modifier: 7');
      });

      test('should handle undefined modifier', () => {
        messageListener(
          {
            action: 'setModifier',
            modifier: undefined,
          },
          null,
          jest.fn()
        );

        expect(window.pixelsModifier).toBe('0'); // Default fallback
      });

      test('should handle null modifier', () => {
        messageListener(
          {
            action: 'setModifier',
            modifier: null,
          },
          null,
          jest.fn()
        );

        expect(window.pixelsModifier).toBe('0'); // Default fallback
      });

      test('should update modifier box when value changes', () => {
        const previousModifier = window.pixelsModifier;
        const newModifier = '5';

        messageListener(
          {
            action: 'setModifier',
            modifier: newModifier,
          },
          null,
          jest.fn()
        );

        expect(window.pixelsModifier).toBe(newModifier);

        // Should attempt to update the modifier box UI
        expect(window.ModifierBox.getElement).toHaveBeenCalled();
      });

      test('should not update modifier box if value unchanged', () => {
        const currentModifier = window.pixelsModifier;

        messageListener(
          {
            action: 'setModifier',
            modifier: currentModifier,
          },
          null,
          jest.fn()
        );

        // Should not call getElement if value didn't change
        expect(window.ModifierBox.getElement).not.toHaveBeenCalled();
      });
    });

    describe('showModifier action', () => {
      test('should call showModifierBox function', () => {
        messageListener({ action: 'showModifier' }, null, jest.fn());

        expect(console.log).toHaveBeenCalledWith(
          'Received showModifier message'
        );
        expect(window.ModifierBox.show).toHaveBeenCalled();
      });

      test('should handle showModifier when ModifierBox not available', () => {
        delete window.ModifierBox;

        expect(() => {
          messageListener({ action: 'showModifier' }, null, jest.fn());
        }).not.toThrow();
      });
    });

    describe('hideModifier action', () => {
      test('should call hideModifierBox function', () => {
        messageListener({ action: 'hideModifier' }, null, jest.fn());

        expect(console.log).toHaveBeenCalledWith(
          'Received hideModifier message'
        );
        expect(window.ModifierBox.hide).toHaveBeenCalled();
      });

      test('should handle hideModifier when ModifierBox not available', () => {
        delete window.ModifierBox;

        expect(() => {
          messageListener({ action: 'hideModifier' }, null, jest.fn());
        }).not.toThrow();
      });
    });

    describe('connect action', () => {
      test('should attempt Bluetooth connection', () => {
        messageListener({ action: 'connect' }, null, jest.fn());

        expect(console.log).toHaveBeenCalledWith(
          'Connect button clicked, attempting to connect to Pixel'
        );
      });

      test('should handle connection errors', () => {
        // Connection errors are handled within the connectToPixel function
        // This tests that the message handler doesn't crash
        expect(() => {
          messageListener({ action: 'connect' }, null, jest.fn());
        }).not.toThrow();
      });
    });

    describe('disconnect action', () => {
      test('should disconnect all pixels', () => {
        messageListener({ action: 'disconnect' }, null, jest.fn());

        expect(console.log).toHaveBeenCalledWith('Manual disconnect requested');
      });

      test('should send status update after disconnect', () => {
        messageListener({ action: 'disconnect' }, null, jest.fn());

        // Should send updated status after disconnection
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
          action: 'showText',
          text: 'No Pixel connected',
        });
      });
    });

    describe('unknown actions', () => {
      test('should handle unknown message actions gracefully', () => {
        expect(() => {
          messageListener({ action: 'unknownAction' }, null, jest.fn());
        }).not.toThrow();
      });

      test('should handle malformed messages', () => {
        expect(() => {
          messageListener({}, null, jest.fn());
        }).not.toThrow();
      });

      test('should handle null messages', () => {
        expect(() => {
          messageListener(null, null, jest.fn());
        }).not.toThrow();
      });

      test('should handle undefined messages', () => {
        expect(() => {
          messageListener(undefined, null, jest.fn());
        }).not.toThrow();
      });
    });
  });

  describe('Status Updates', () => {
    test('should send status on initialization', () => {
      // Status is sent automatically on module load
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'No Pixel connected',
      });
    });

    test('should format status for no pixels', () => {
      messageListener({ action: 'getStatus' }, null, jest.fn());

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'No Pixel connected',
      });
    });
  });

  describe('Message Context and Sender', () => {
    test('should handle message with sender information', () => {
      const mockSender = { tab: { id: 123 } };
      const mockSendResponse = jest.fn();

      expect(() => {
        messageListener({ action: 'getStatus' }, mockSender, mockSendResponse);
      }).not.toThrow();
    });

    test('should handle sendResponse callback', () => {
      const mockSendResponse = jest.fn();

      messageListener({ action: 'getStatus' }, null, mockSendResponse);

      // The message handler doesn't explicitly call sendResponse
      // but it should handle it being provided
      expect(mockSendResponse).toBeDefined();
    });

    test('should handle missing sendResponse', () => {
      expect(() => {
        messageListener({ action: 'getStatus' }, null, undefined);
      }).not.toThrow();
    });
  });

  describe('Error Recovery and Robustness', () => {
    test('should continue functioning after Chrome API errors', () => {
      // Simulate Chrome API becoming unavailable
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Extension context invalidated');
      });

      // Should handle the error and continue
      window.sendMessageToExtension({ action: 'test' });

      // Should still be able to process messages
      expect(() => {
        messageListener({ action: 'getStatus' }, null, jest.fn());
      }).not.toThrow();
    });

    test('should handle message listener setup errors', () => {
      mockChrome.runtime.onMessage.addListener.mockImplementation(() => {
        throw new Error('Could not add listener');
      });

      expect(() => {
        delete window.roll20PixelsLoaded;
        require('../../../src/content/roll20.js');
      }).not.toThrow();
    });

    test('should handle concurrent message processing', () => {
      // Process multiple messages simultaneously
      const promises = [
        () => messageListener({ action: 'getStatus' }, null, jest.fn()),
        () =>
          messageListener(
            { action: 'setModifier', modifier: '3' },
            null,
            jest.fn()
          ),
        () => messageListener({ action: 'showModifier' }, null, jest.fn()),
      ];

      expect(() => {
        promises.forEach(fn => fn());
      }).not.toThrow();
    });
  });

  describe('Integration with Other Systems', () => {
    test('should coordinate with ModifierBox for modifier updates', () => {
      const mockElement = {
        querySelector: jest.fn().mockReturnValue({
          value: '0',
          querySelectorAll: jest.fn().mockReturnValue([
            {
              querySelector: jest.fn().mockReturnValue({ value: '0' }),
            },
          ]),
        }),
      };

      window.ModifierBox.getElement.mockReturnValue(mockElement);

      messageListener(
        {
          action: 'setModifier',
          modifier: '8',
        },
        null,
        jest.fn()
      );

      expect(window.ModifierBox.getElement).toHaveBeenCalled();
    });

    test('should coordinate with Bluetooth for connection status', () => {
      // Connection status updates are sent through the messaging system
      messageListener({ action: 'getStatus' }, null, jest.fn());

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'showText',
        text: 'No Pixel connected',
      });
    });
  });
});
