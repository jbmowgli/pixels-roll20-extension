/**
 * Tests for sendStatusToExtension()'s connected-pixel counting, focused on
 * the duck-typed GATT check: GATT-backed pixels (Chrome/Web Bluetooth,
 * PixelsBluetooth.js) must still have their live device.gatt.connected
 * state verified (not just the cached isConnected flag), while
 * native-bridge pixels (Firefox, PixelsNativeBridge.js) have no
 * device/gatt object at all and must be trusted on isConnected alone.
 */

const EXTENSION_MESSAGING_PATH = '../../src/core/extensionMessaging.js';

describe('sendStatusToExtension', () => {
  let extensionMessaging;
  let sendMessage;

  const gattPixel = (isConnected, gattConnected) => ({
    isConnected,
    device: { gatt: { connected: gattConnected } },
  });

  const nativePixel = isConnected => ({ isConnected });

  beforeEach(() => {
    jest.resetModules();

    sendMessage = jest.fn();
    window.chrome = { runtime: { sendMessage } };

    extensionMessaging = require(EXTENSION_MESSAGING_PATH);
  });

  const lastText = () => sendMessage.mock.calls.at(-1)[0].text;

  test('reports no pixels when window.pixels is empty', () => {
    window.pixels = [];
    extensionMessaging.sendStatusToExtension();
    expect(lastText()).toBe('No Pixel connected');
  });

  test('reports connected for a single GATT pixel with live gatt.connected true', () => {
    window.pixels = [gattPixel(true, true)];
    extensionMessaging.sendStatusToExtension();
    expect(lastText()).toBe('1 Pixel connected');
  });

  test('reports disconnected for a GATT pixel with a stale isConnected flag but dead GATT', () => {
    // isConnected is cached and can lag reality; live gatt.connected must win.
    window.pixels = [gattPixel(true, false)];
    extensionMessaging.sendStatusToExtension();
    expect(lastText()).toBe('1 Pixel disconnected');
  });

  test('reports connected for a single native-bridge pixel with no device/gatt', () => {
    window.pixels = [nativePixel(true)];
    extensionMessaging.sendStatusToExtension();
    expect(lastText()).toBe('1 Pixel connected');
  });

  test('reports disconnected for a native-bridge pixel with isConnected false', () => {
    window.pixels = [nativePixel(false)];
    extensionMessaging.sendStatusToExtension();
    expect(lastText()).toBe('1 Pixel disconnected');
  });

  test('counts a mix of GATT and native-bridge pixels correctly', () => {
    window.pixels = [
      gattPixel(true, true), // connected
      gattPixel(true, false), // stale flag, actually disconnected
      nativePixel(true), // connected
      nativePixel(false), // disconnected
    ];
    extensionMessaging.sendStatusToExtension();
    expect(lastText()).toBe('2/4 Pixels connected');
  });

  test('excludes a pixel whose isConnected getter throws, without failing the rest', () => {
    const throwingPixel = {
      get isConnected() {
        throw new Error('boom');
      },
    };
    window.pixels = [throwingPixel, nativePixel(true)];
    expect(() => extensionMessaging.sendStatusToExtension()).not.toThrow();
    expect(lastText()).toBe('1/2 Pixels connected');
  });
});
