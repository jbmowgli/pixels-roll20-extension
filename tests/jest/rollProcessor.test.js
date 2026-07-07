/**
 * Tests for rollProcessor.js — the face-event parsing and roll/chat
 * formatting shared by the Chrome (Web Bluetooth) and Firefox
 * (native-messaging) connectivity paths.
 */

describe('rollProcessor', () => {
  let rollProcessor;
  let postChatMessage;
  let sendTextToExtension;

  const faceEventFrame = (ev, face) =>
    new DataView(new Uint8Array([3, ev, face]).buffer);

  beforeEach(() => {
    jest.resetModules();

    postChatMessage = jest.fn();
    sendTextToExtension = jest.fn();

    window.postChatMessage = postChatMessage;
    window.sendTextToExtension = sendTextToExtension;
    window.pixelsModifierName = 'Modifier 1';
    window.pixelsModifier = '0';
    delete window.ModifierBox;

    rollProcessor = require('../../src/content/modules/rollProcessor.js');
  });

  describe('processNotification', () => {
    test('ignores notifications that are not face events', () => {
      const dieState = { hasMoved: false, face: null };
      const frame = new DataView(new Uint8Array([1, 0, 0]).buffer);

      rollProcessor.processNotification('Aurora', dieState, frame);

      expect(postChatMessage).not.toHaveBeenCalled();
      expect(dieState.hasMoved).toBe(false);
    });

    test('does not post a roll for a resting notification before any movement', () => {
      const dieState = { hasMoved: false, face: null };

      rollProcessor.processNotification(
        'Aurora',
        dieState,
        faceEventFrame(1, 5)
      );

      expect(postChatMessage).not.toHaveBeenCalled();
      expect(dieState.hasMoved).toBe(false);
    });

    test('marks hasMoved once the die starts moving', () => {
      const dieState = { hasMoved: false, face: null };

      rollProcessor.processNotification(
        'Aurora',
        dieState,
        faceEventFrame(2, 0)
      );

      expect(dieState.hasMoved).toBe(true);
      expect(postChatMessage).not.toHaveBeenCalled();
    });

    test('posts a roll once the die settles after moving', () => {
      const dieState = { hasMoved: true, face: null };

      rollProcessor.processNotification(
        'Aurora',
        dieState,
        faceEventFrame(1, 5)
      );

      expect(dieState.face).toBe(5);
      expect(sendTextToExtension).toHaveBeenCalledWith('Aurora: face up = 6');
      expect(postChatMessage).toHaveBeenCalledTimes(1);

      const message = postChatMessage.mock.calls[0][0];
      expect(message).toContain('Pixel Roll');
      expect(message).toContain('Result=[[6]]');
    });

    test('ignores movement events once already settled', () => {
      const dieState = { hasMoved: true, face: null };

      rollProcessor.processNotification(
        'Aurora',
        dieState,
        faceEventFrame(2, 0)
      );

      expect(postChatMessage).not.toHaveBeenCalled();
      expect(dieState.face).toBeNull();
    });

    test('applies the modifier and modifier-box formula when the modifier box is visible', () => {
      window.ModifierBox = { isVisible: () => true, syncGlobalVars: jest.fn() };
      window.pixelsModifier = '3';
      window.pixelsModifierName = 'Attack';

      const dieState = { hasMoved: true, face: null };
      rollProcessor.processNotification(
        'Aurora',
        dieState,
        faceEventFrame(1, 9)
      ); // face value 10

      expect(window.ModifierBox.syncGlobalVars).toHaveBeenCalled();
      const message = postChatMessage.mock.calls[0][0];
      expect(message).toContain('Attack (+3)');
      expect(message).toContain('Result=[[10 + 3]]');
    });

    test('decorates critical hits (face value 20) when modifier box is visible', () => {
      window.ModifierBox = { isVisible: () => true, syncGlobalVars: jest.fn() };

      const dieState = { hasMoved: true, face: null };
      rollProcessor.processNotification(
        'Aurora',
        dieState,
        faceEventFrame(1, 19)
      ); // face value 20

      expect(postChatMessage.mock.calls[0][0]).toContain('CRITICAL!');
    });

    test('decorates fumbles (face value 1) when modifier box is visible', () => {
      window.ModifierBox = { isVisible: () => true, syncGlobalVars: jest.fn() };

      const dieState = { hasMoved: true, face: null };
      rollProcessor.processNotification(
        'Aurora',
        dieState,
        faceEventFrame(1, 0)
      ); // face value 1

      expect(postChatMessage.mock.calls[0][0]).toContain('FUMBLE!');
    });

    test('does not decorate crit/fumble or apply a modifier when the modifier box is hidden', () => {
      const dieState = { hasMoved: true, face: null };

      rollProcessor.processNotification(
        'Aurora',
        dieState,
        faceEventFrame(1, 19)
      ); // face value 20

      const message = postChatMessage.mock.calls[0][0];
      expect(message).not.toContain('CRITICAL!');
      expect(message).toContain('Pixel Roll');
    });

    test('tracks state independently per die', () => {
      const dieA = { hasMoved: true, face: null };
      const dieB = { hasMoved: false, face: null };

      rollProcessor.processNotification('Aurora', dieA, faceEventFrame(1, 5));
      rollProcessor.processNotification('Nova', dieB, faceEventFrame(2, 0));

      expect(dieA.face).toBe(5);
      expect(dieB.hasMoved).toBe(true);
      expect(dieB.face).toBeNull();
    });
  });

  describe('formatModifierSign', () => {
    test('formats positive numbers with a + sign', () => {
      expect(rollProcessor.formatModifierSign('3')).toBe('+3');
    });

    test('formats negative numbers without a + sign', () => {
      expect(rollProcessor.formatModifierSign('-3')).toBe('-3');
    });

    test('treats invalid input as zero', () => {
      expect(rollProcessor.formatModifierSign('invalid')).toBe('+0');
    });
  });
});
