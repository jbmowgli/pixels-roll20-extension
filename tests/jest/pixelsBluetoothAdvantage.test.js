/**
 * @jest-environment jsdom
 *
 * Tests for the advantage/disadvantage two-roll logic in PixelsBluetooth.js
 *
 * Note: postChatMessage / sendTextToExtension are captured as module-level
 * constants when PixelsBluetooth.js loads, so we must set window globals
 * before each require() call and use jest.resetModules() to get a fresh copy.
 */

// Helper: build a BLE notification DataView for a face event
// byte 0 = message type (3 = face event), byte 1 = ev, byte 2 = face (0-indexed)
function makeFaceEvent(ev, face) {
  const buffer = new ArrayBuffer(3);
  const view = new DataView(buffer);
  view.setUint8(0, 3);
  view.setUint8(1, ev);
  view.setUint8(2, face);
  return { target: { value: view } };
}

// Simulate a full roll: move die (ev=2) then settle (ev=1)
function simulateRoll(pixel, face) {
  pixel.handleNotifications(makeFaceEvent(2, 0)); // die moved
  pixel.handleNotifications(makeFaceEvent(1, face)); // die settled
}

describe('PixelsBluetooth — advantage/disadvantage roll logic', () => {
  let createPixel;
  let mockPostChat;
  let mockSendText;
  let mockServer;
  let mockDevice;

  beforeEach(() => {
    resetMocks();
    jest.useFakeTimers();
    jest.resetModules();

    // Set up mocks on window BEFORE requiring the module so the
    // module-level const captures pick them up.
    mockPostChat = jest.fn();
    mockSendText = jest.fn();
    window.postChatMessage = mockPostChat;
    window.sendTextToExtension = mockSendText;
    window.sendStatusToExtension = jest.fn();
    window.log = jest.fn();

    // Modifier box visible with a modifier set
    window.ModifierBox = {
      isVisible: () => true,
      syncGlobalVars: jest.fn(),
    };
    window.pixelsModifier = '3';
    window.pixelsModifierName = 'Str Attack';
    window.pixelsRollType = 'normal';

    // Require the module fresh after globals are set
    ({ createPixel } = require('../../src/content/modules/PixelsBluetooth.js'));

    mockDevice = { id: 'device-1', gatt: { connected: true } };
    mockServer = { connected: true, disconnect: jest.fn() };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Normal roll (unchanged behaviour) ──────────────────────────────────────

  describe('Normal mode', () => {
    test('posts immediately on a single roll', () => {
      window.pixelsRollType = 'normal';
      const pixel = createPixel('TestDie', mockServer, mockDevice);
      simulateRoll(pixel, 14); // face 14 = value 15

      expect(mockPostChat).toHaveBeenCalledTimes(1);
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).toContain('15');
      expect(msg).not.toContain('Advantage');
      expect(msg).not.toContain('Disadvantage');
    });
  });

  // ── Advantage ──────────────────────────────────────────────────────────────

  describe('Advantage mode', () => {
    let pixel;
    beforeEach(() => {
      window.pixelsRollType = 'advantage';
      pixel = createPixel('TestDie', mockServer, mockDevice);
    });

    test('does not post to Roll20 on the first roll', () => {
      simulateRoll(pixel, 14); // roll 1: value 15
      expect(mockPostChat).not.toHaveBeenCalled();
    });

    test('sends popup status after first roll', () => {
      simulateRoll(pixel, 14);
      expect(mockSendText).toHaveBeenCalledWith(
        expect.stringContaining('Roll 1 = 15')
      );
    });

    test('posts to Roll20 on the second roll using the higher value', () => {
      simulateRoll(pixel, 14); // roll 1: value 15
      simulateRoll(pixel, 11); // roll 2: value 12 → lower
      expect(mockPostChat).toHaveBeenCalledTimes(1);
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).toContain('Advantage');
      expect(msg).toContain('Roll 1=[[15]]');
      expect(msg).toContain('Roll 2=[[12]]');
      expect(msg).toContain('Used=[[15]]'); // higher value used
      expect(msg).toContain('15 + 3'); // modifier applied
    });

    test('uses higher value when roll 2 is greater', () => {
      simulateRoll(pixel, 11); // roll 1: value 12
      simulateRoll(pixel, 14); // roll 2: value 15 → higher
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).toContain('Used=[[15]]');
    });

    test('includes modifier name in formula', () => {
      simulateRoll(pixel, 14);
      simulateRoll(pixel, 11);
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).toContain('Str Attack');
    });

    test('shows CRITICAL decoration when used value is 20', () => {
      simulateRoll(pixel, 19); // value 20
      simulateRoll(pixel, 9); // value 10
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).toContain('CRITICAL');
    });

    test('does not show FUMBLE when lower die is 1 but advantage uses higher', () => {
      simulateRoll(pixel, 0); // value 1
      simulateRoll(pixel, 4); // value 5 → advantage uses 5
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).not.toContain('FUMBLE');
    });

    test('resets state after second roll so next roll starts fresh', () => {
      simulateRoll(pixel, 14);
      simulateRoll(pixel, 11);
      mockPostChat.mockClear();
      mockSendText.mockClear();

      // Next single roll should be a new roll 1, not post immediately
      simulateRoll(pixel, 7);
      expect(mockPostChat).not.toHaveBeenCalled();
      expect(mockSendText).toHaveBeenCalledWith(
        expect.stringContaining('Roll 1 = 8')
      );
    });
  });

  // ── Disadvantage ──────────────────────────────────────────────────────────

  describe('Disadvantage mode', () => {
    let pixel;
    beforeEach(() => {
      window.pixelsRollType = 'disadvantage';
      pixel = createPixel('TestDie', mockServer, mockDevice);
    });

    test('posts to Roll20 on the second roll using the lower value', () => {
      simulateRoll(pixel, 14); // value 15
      simulateRoll(pixel, 11); // value 12 → lower
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).toContain('Disadvantage');
      expect(msg).toContain('Roll 1=[[15]]');
      expect(msg).toContain('Roll 2=[[12]]');
      expect(msg).toContain('Used=[[12]]'); // lower value used
      expect(msg).toContain('12 + 3');
    });

    test('shows FUMBLE decoration when used value is 1', () => {
      simulateRoll(pixel, 4); // value 5
      simulateRoll(pixel, 0); // value 1 → lower, used
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).toContain('FUMBLE');
    });

    test('shows CRITICAL decoration when both dice are 20', () => {
      simulateRoll(pixel, 19); // value 20
      simulateRoll(pixel, 19); // value 20 → lower is still 20
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).toContain('CRITICAL');
    });
  });

  // ── Timeout ────────────────────────────────────────────────────────────────

  describe('Timeout handling', () => {
    let pixel;
    beforeEach(() => {
      window.pixelsRollType = 'advantage';
      pixel = createPixel('TestDie', mockServer, mockDevice);
    });

    test('cancels pending roll after 15 seconds with no second roll', () => {
      simulateRoll(pixel, 14);
      expect(mockPostChat).not.toHaveBeenCalled();

      jest.advanceTimersByTime(15000);

      // Nothing posted to Roll20
      expect(mockPostChat).not.toHaveBeenCalled();
      // Cancellation message sent to popup
      expect(mockSendText).toHaveBeenCalledWith(
        expect.stringContaining('Timed out')
      );
    });

    test('after timeout, next roll is treated as roll 1 again', () => {
      simulateRoll(pixel, 14);
      jest.advanceTimersByTime(15000);
      mockSendText.mockClear();

      simulateRoll(pixel, 9);
      expect(mockPostChat).not.toHaveBeenCalled();
      expect(mockSendText).toHaveBeenCalledWith(
        expect.stringContaining('Roll 1 = 10')
      );
    });

    test('second roll before timeout cancels the timer cleanly', () => {
      simulateRoll(pixel, 14);
      simulateRoll(pixel, 11);

      // Advancing time should not trigger any additional messages
      const callCount = mockSendText.mock.calls.length;
      jest.advanceTimersByTime(15000);
      expect(mockSendText.mock.calls.length).toBe(callCount);
    });
  });

  // ── Modifier box hidden ───────────────────────────────────────────────────

  describe('Modifier box hidden', () => {
    let pixel;
    beforeEach(() => {
      window.ModifierBox = { isVisible: () => false };
      window.pixelsRollType = 'advantage';
      pixel = createPixel('TestDie', mockServer, mockDevice);
    });

    test('posts result without modifier when modifier box is hidden', () => {
      simulateRoll(pixel, 14);
      simulateRoll(pixel, 11);
      const msg = mockPostChat.mock.calls[0][0];
      expect(msg).toContain('Pixel Roll - Advantage');
      expect(msg).toContain('Used=[[15]]');
      // No modifier name in simple formula
      expect(msg).not.toContain('Str Attack');
    });
  });
});
