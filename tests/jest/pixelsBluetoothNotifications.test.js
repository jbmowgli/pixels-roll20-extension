/**
 * Tests for createPixel()'s notification handling in PixelsBluetooth.js —
 * specifically the wiring introduced when face-event processing was
 * extracted into rollProcessor.js. rollProcessor's own formula/formatting
 * behavior is covered by rollProcessor.test.js; these tests exist to catch
 * regressions in the seam between the two modules (correct args passed,
 * per-die state shared by reference, error handling preserved).
 */

const PIXELS_BLUETOOTH_PATH = '../../src/content/modules/PixelsBluetooth.js';
const ROLL_PROCESSOR_PATH = '../../src/content/modules/rollProcessor.js';

const notificationEvent = bytes => ({
  target: { value: new DataView(new Uint8Array(bytes).buffer) },
});

describe('PixelsBluetooth notification delegation (mocked rollProcessor)', () => {
  let processNotification;
  let logMock;

  beforeEach(() => {
    jest.resetModules();

    processNotification = jest.fn();
    jest.doMock(ROLL_PROCESSOR_PATH, () => ({
      processNotification,
      formatModifierSign: jest.fn(),
    }));

    logMock = jest.fn();
    window.log = logMock;
    window.sendTextToExtension = jest.fn();
    window.sendStatusToExtension = jest.fn();

    require(PIXELS_BLUETOOTH_PATH);
  });

  afterEach(() => {
    jest.dontMock(ROLL_PROCESSOR_PATH);
  });

  test('passes the die name, a dieState object, and the raw DataView through unchanged', () => {
    const pixel = global.createPixel('Aurora', {}, { id: 'device-1' });
    const event = notificationEvent([3, 1, 5]);

    pixel.handleNotifications(event);

    expect(processNotification).toHaveBeenCalledTimes(1);
    const [dieName, dieState, dataView] = processNotification.mock.calls[0];
    expect(dieName).toBe('Aurora');
    expect(dieState).toEqual({ hasMoved: false, face: null });
    expect(dataView).toBe(event.target.value);
  });

  test('reuses the same dieState object reference across multiple notifications', () => {
    const pixel = global.createPixel('Aurora', {}, { id: 'device-1' });

    pixel.handleNotifications(notificationEvent([3, 2, 0]));
    pixel.handleNotifications(notificationEvent([3, 1, 5]));

    const firstState = processNotification.mock.calls[0][1];
    const secondState = processNotification.mock.calls[1][1];
    expect(secondState).toBe(firstState);
  });

  test('gives each pixel its own independent dieState', () => {
    const pixelA = global.createPixel('Aurora', {}, { id: 'a' });
    const pixelB = global.createPixel('Nova', {}, { id: 'b' });

    pixelA.handleNotifications(notificationEvent([3, 1, 5]));
    pixelB.handleNotifications(notificationEvent([3, 1, 9]));

    const stateA = processNotification.mock.calls[0][1];
    const stateB = processNotification.mock.calls[1][1];
    expect(stateA).not.toBe(stateB);
  });

  test('still updates lastActivity when rollProcessor throws', () => {
    processNotification.mockImplementation(() => {
      throw new Error('boom');
    });
    const pixel = global.createPixel('Aurora', {}, { id: 'device-1' });
    const before = pixel.lastActivity;

    expect(() =>
      pixel.handleNotifications(notificationEvent([3, 1, 5]))
    ).not.toThrow();

    expect(pixel.lastActivity).toBeGreaterThanOrEqual(before);
    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining('Notification handling error for Aurora')
    );
  });

  test('does not mark the pixel disconnected when notification processing throws', () => {
    processNotification.mockImplementation(() => {
      throw new Error('boom');
    });
    const pixel = global.createPixel('Aurora', {}, { id: 'device-1' });

    pixel.handleNotifications(notificationEvent([3, 1, 5]));

    expect(pixel._isConnected).toBe(true);
  });
});

describe('PixelsBluetooth notification handling (real rollProcessor)', () => {
  let postChatMessage;

  beforeEach(() => {
    jest.resetModules();

    postChatMessage = jest.fn();
    window.postChatMessage = postChatMessage;
    window.sendTextToExtension = jest.fn();
    window.sendStatusToExtension = jest.fn();
    window.log = jest.fn();
    window.pixelsModifierName = 'Modifier 1';
    window.pixelsModifier = '0';
    delete window.ModifierBox;

    require(PIXELS_BLUETOOTH_PATH);
  });

  test('a full roll (movement then rest) updates lastFaceUp and posts to chat', () => {
    const pixel = global.createPixel('Aurora', {}, { id: 'device-1' });

    pixel.handleNotifications(notificationEvent([3, 2, 0])); // moving
    expect(pixel.lastFaceUp).toBeNull();

    pixel.handleNotifications(notificationEvent([3, 1, 5])); // settled, face byte 5

    expect(pixel.lastFaceUp).toBe(5);
    expect(postChatMessage).toHaveBeenCalledTimes(1);
    expect(postChatMessage.mock.calls[0][0]).toContain('Pixel Roll');
  });

  test('does not post a roll for a resting notification before any movement is seen', () => {
    const pixel = global.createPixel('Aurora', {}, { id: 'device-1' });

    pixel.handleNotifications(notificationEvent([3, 1, 5]));

    expect(pixel.lastFaceUp).toBeNull();
    expect(postChatMessage).not.toHaveBeenCalled();
  });

  test('two connected pixels track face-up state independently', () => {
    const pixelA = global.createPixel('Aurora', {}, { id: 'a' });
    const pixelB = global.createPixel('Nova', {}, { id: 'b' });

    pixelA.handleNotifications(notificationEvent([3, 2, 0]));
    pixelA.handleNotifications(notificationEvent([3, 1, 5]));

    pixelB.handleNotifications(notificationEvent([3, 2, 0]));
    pixelB.handleNotifications(notificationEvent([3, 1, 9]));

    expect(pixelA.lastFaceUp).toBe(5);
    expect(pixelB.lastFaceUp).toBe(9);
  });
});
