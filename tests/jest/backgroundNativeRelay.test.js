/**
 * Tests for the native-messaging relay in background.js. Content scripts
 * can't call chrome.runtime.connectNative() themselves — only the
 * background script can — so this pipes a runtime.connect port named
 * 'pixels-native' (opened by PixelsNativeBridge.js) to a
 * connectNative('pixels_roll20_helper') connection and back. See
 * native-host/PROTOCOL.md for the message shapes being relayed.
 */

const BACKGROUND_PATH = '../../src/background/background.js';

const makeMockPort = name => ({
  name,
  postMessage: jest.fn(),
  disconnect: jest.fn(),
  onMessage: { addListener: jest.fn() },
  onDisconnect: { addListener: jest.fn() },
});

describe('background.js native messaging relay', () => {
  let contentPort;
  let nativePort;
  let onConnectListener;
  let connectNative;

  beforeEach(() => {
    jest.resetModules();

    contentPort = makeMockPort('pixels-native');
    nativePort = makeMockPort('native');
    connectNative = jest.fn(() => nativePort);

    global.chrome = {
      runtime: {
        onInstalled: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() },
        onConnect: {
          addListener: jest.fn(listener => {
            onConnectListener = listener;
          }),
        },
        connectNative,
        lastError: undefined,
      },
      storage: {
        sync: {
          get: jest.fn((keys, cb) => cb({})),
          set: jest.fn((data, cb) => cb && cb()),
        },
      },
    };

    require(BACKGROUND_PATH);
  });

  test('ignores connections on unrelated port names', () => {
    const otherPort = makeMockPort('something-else');
    onConnectListener(otherPort);
    expect(connectNative).not.toHaveBeenCalled();
  });

  test('opens the native host by name for a pixels-native port', () => {
    onConnectListener(contentPort);
    expect(connectNative).toHaveBeenCalledWith('pixels_roll20_helper');
  });

  test('relays native host messages to the content port unchanged', () => {
    onConnectListener(contentPort);
    const nativeMessageHandler =
      nativePort.onMessage.addListener.mock.calls[0][0];

    nativeMessageHandler({ event: 'dieConnected', id: 'abc', name: 'Aurora' });

    expect(contentPort.postMessage).toHaveBeenCalledWith({
      event: 'dieConnected',
      id: 'abc',
      name: 'Aurora',
    });
  });

  test('relays content-port messages to the native host unchanged', () => {
    onConnectListener(contentPort);
    const contentMessageHandler =
      contentPort.onMessage.addListener.mock.calls[0][0];

    contentMessageHandler({ cmd: 'connect' });

    expect(nativePort.postMessage).toHaveBeenCalledWith({ cmd: 'connect' });
  });

  test('disconnects the native port when the content port closes', () => {
    onConnectListener(contentPort);
    const contentDisconnectHandler =
      contentPort.onDisconnect.addListener.mock.calls[0][0];

    contentDisconnectHandler();

    expect(nativePort.disconnect).toHaveBeenCalled();
  });

  test('reports hostMissing if connectNative throws synchronously', () => {
    connectNative.mockImplementation(() => {
      throw new Error('not found');
    });

    onConnectListener(contentPort);

    expect(contentPort.postMessage).toHaveBeenCalledWith({
      event: 'hostMissing',
    });
  });

  test('does not attach native port listeners after a synchronous connectNative failure', () => {
    connectNative.mockImplementation(() => {
      throw new Error('not found');
    });

    expect(() => onConnectListener(contentPort)).not.toThrow();
    expect(nativePort.onMessage.addListener).not.toHaveBeenCalled();
  });

  test('reports hostMissing if the native host disconnects immediately with lastError set', () => {
    onConnectListener(contentPort);
    const nativeDisconnectHandler =
      nativePort.onDisconnect.addListener.mock.calls[0][0];

    global.chrome.runtime.lastError = {
      message: 'Specified native messaging host not found.',
    };
    nativeDisconnectHandler();

    expect(contentPort.postMessage).toHaveBeenCalledWith({
      event: 'hostMissing',
    });
  });

  test('does not report hostMissing on a clean native disconnect (no lastError)', () => {
    onConnectListener(contentPort);
    const nativeDisconnectHandler =
      nativePort.onDisconnect.addListener.mock.calls[0][0];

    global.chrome.runtime.lastError = undefined;
    nativeDisconnectHandler();

    expect(contentPort.postMessage).not.toHaveBeenCalledWith({
      event: 'hostMissing',
    });
  });

  test('does not throw if the content port is already closed when relaying', () => {
    onConnectListener(contentPort);
    const nativeMessageHandler =
      nativePort.onMessage.addListener.mock.calls[0][0];
    contentPort.postMessage.mockImplementation(() => {
      throw new Error('port closed');
    });

    expect(() =>
      nativeMessageHandler({ event: 'scanDone', found: 0 })
    ).not.toThrow();
  });
});
