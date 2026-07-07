/**
 * Tests for PixelsNativeBridge.js — the Firefox connectivity path that
 * talks to the native messaging host through a background-script relay
 * instead of Web Bluetooth. Covers the port lifecycle, host-event handling,
 * and (via the real rollProcessor) that a roll actually updates state and
 * posts to chat, same as pixelsBluetoothNotifications.test.js does for the
 * Chrome path.
 */

const NATIVE_BRIDGE_PATH = '../../src/content/modules/PixelsNativeBridge.js';

const makeMockPort = () => ({
  postMessage: jest.fn(),
  onMessage: { addListener: jest.fn() },
  onDisconnect: { addListener: jest.fn() },
});

describe('PixelsNativeBridge', () => {
  let bridge;
  let mockPort;
  let sendTextToExtension;
  let sendStatusToExtension;
  let postChatMessage;

  const hostMessageListener = () =>
    mockPort.onMessage.addListener.mock.calls[0][0];
  const portDisconnectListener = () =>
    mockPort.onDisconnect.addListener.mock.calls[0][0];

  beforeEach(() => {
    jest.resetModules();

    mockPort = makeMockPort();
    window.chrome = {
      runtime: {
        connect: jest.fn(() => mockPort),
      },
    };

    sendTextToExtension = jest.fn();
    sendStatusToExtension = jest.fn();
    postChatMessage = jest.fn();
    window.sendTextToExtension = sendTextToExtension;
    window.sendStatusToExtension = sendStatusToExtension;
    window.postChatMessage = postChatMessage;
    window.log = jest.fn();
    window.pixelsModifierName = 'Modifier 1';
    window.pixelsModifier = '0';
    delete window.ModifierBox;

    bridge = require(NATIVE_BRIDGE_PATH);
  });

  describe('initialize', () => {
    test('opens a port named pixels-native', () => {
      bridge.initialize();
      expect(window.chrome.runtime.connect).toHaveBeenCalledWith({
        name: 'pixels-native',
      });
    });

    test('does not throw when extension messaging is unavailable', () => {
      window.chrome = {};
      expect(() => bridge.initialize()).not.toThrow();
    });
  });

  describe('connectToPixel', () => {
    test('sends a connect command over the port', async () => {
      bridge.initialize();
      await bridge.connectToPixel();
      expect(mockPort.postMessage).toHaveBeenCalledWith({ cmd: 'connect' });
    });

    test('rejects when extension messaging is unavailable', async () => {
      window.chrome = {};
      await expect(bridge.connectToPixel()).rejects.toThrow();
    });
  });

  describe('host events', () => {
    beforeEach(() => {
      bridge.initialize();
    });

    test('dieConnected adds a new die and marks it connected', () => {
      hostMessageListener()({
        event: 'dieConnected',
        id: 'abc',
        name: 'Aurora',
      });

      const pixels = bridge.getPixels();
      expect(pixels).toHaveLength(1);
      expect(pixels[0].name).toBe('Aurora');
      expect(pixels[0].isConnected).toBe(true);
      expect(sendTextToExtension).toHaveBeenCalledWith('Connected to Aurora');
      expect(sendStatusToExtension).toHaveBeenCalled();
    });

    test('dieConnected for an already-tracked id updates it in place, not a duplicate', () => {
      hostMessageListener()({
        event: 'dieConnected',
        id: 'abc',
        name: 'Aurora',
      });
      hostMessageListener()({
        event: 'dieDisconnected',
        id: 'abc',
        name: 'Aurora',
      });
      hostMessageListener()({
        event: 'dieConnected',
        id: 'abc',
        name: 'Aurora',
      });

      expect(bridge.getPixels()).toHaveLength(1);
      expect(bridge.getPixels()[0].isConnected).toBe(true);
    });

    test('dieDisconnected marks a tracked die disconnected without removing it', () => {
      hostMessageListener()({
        event: 'dieConnected',
        id: 'abc',
        name: 'Aurora',
      });
      hostMessageListener()({
        event: 'dieDisconnected',
        id: 'abc',
        name: 'Aurora',
      });

      const pixels = bridge.getPixels();
      expect(pixels).toHaveLength(1);
      expect(pixels[0].isConnected).toBe(false);
    });

    test('notification for an unknown id is ignored without throwing', () => {
      expect(() =>
        hostMessageListener()({
          event: 'notification',
          id: 'unknown',
          name: 'Ghost',
          data: [3, 1, 5],
        })
      ).not.toThrow();
      expect(postChatMessage).not.toHaveBeenCalled();
    });

    test('a full roll (movement then rest) updates lastFaceUp and posts to chat', () => {
      hostMessageListener()({
        event: 'dieConnected',
        id: 'abc',
        name: 'Aurora',
      });

      hostMessageListener()({
        event: 'notification',
        id: 'abc',
        name: 'Aurora',
        data: [3, 2, 0], // moving
      });
      expect(bridge.getPixels()[0].lastFaceUp).toBeNull();

      hostMessageListener()({
        event: 'notification',
        id: 'abc',
        name: 'Aurora',
        data: [3, 1, 5], // settled, face byte 5
      });

      expect(bridge.getPixels()[0].lastFaceUp).toBe(5);
      expect(postChatMessage).toHaveBeenCalledTimes(1);
      expect(postChatMessage.mock.calls[0][0]).toContain('Pixel Roll');
    });

    test('hostMissing surfaces a status message', () => {
      hostMessageListener()({ event: 'hostMissing' });
      expect(sendTextToExtension).toHaveBeenCalledWith(
        expect.stringContaining('Companion app not installed')
      );
    });

    test('ignores malformed messages without throwing', () => {
      expect(() => hostMessageListener()(null)).not.toThrow();
      expect(() => hostMessageListener()('not an object')).not.toThrow();
      expect(() =>
        hostMessageListener()({ event: 'somethingUnknown' })
      ).not.toThrow();
    });
  });

  describe('port disconnect', () => {
    test('marks all tracked dice disconnected and updates status', () => {
      bridge.initialize();
      hostMessageListener()({
        event: 'dieConnected',
        id: 'abc',
        name: 'Aurora',
      });

      portDisconnectListener()();

      expect(bridge.getPixels()[0].isConnected).toBe(false);
      expect(sendStatusToExtension).toHaveBeenCalled();
    });

    test('a later connectToPixel re-opens the port', async () => {
      bridge.initialize();
      portDisconnectListener()();

      await bridge.connectToPixel();

      expect(window.chrome.runtime.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('disconnectAllPixels', () => {
    test('sends a disconnect command, clears local state, and updates status', () => {
      bridge.initialize();
      hostMessageListener()({
        event: 'dieConnected',
        id: 'abc',
        name: 'Aurora',
      });

      bridge.disconnectAllPixels();

      expect(mockPort.postMessage).toHaveBeenCalledWith({ cmd: 'disconnect' });
      expect(bridge.getPixels()).toHaveLength(0);
      expect(sendStatusToExtension).toHaveBeenCalled();
    });
  });

  describe('getConnectedPixelsList', () => {
    test('filters to only connected dice', () => {
      bridge.initialize();
      hostMessageListener()({ event: 'dieConnected', id: 'a', name: 'Aurora' });
      hostMessageListener()({ event: 'dieConnected', id: 'b', name: 'Nova' });
      hostMessageListener()({
        event: 'dieDisconnected',
        id: 'b',
        name: 'Nova',
      });

      const connected = bridge.getConnectedPixelsList();
      expect(connected).toHaveLength(1);
      expect(connected[0].name).toBe('Aurora');
    });
  });

  describe('findPixelByName', () => {
    test('finds a tracked die by name', () => {
      bridge.initialize();
      hostMessageListener()({
        event: 'dieConnected',
        id: 'abc',
        name: 'Aurora',
      });

      expect(bridge.findPixelByName('Aurora').deviceId).toBe('abc');
      expect(bridge.findPixelByName('Nonexistent')).toBeUndefined();
    });
  });
});
