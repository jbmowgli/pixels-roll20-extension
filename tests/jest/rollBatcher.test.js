/**
 * RollBatcher Module Tests
 *
 * Tests for the roll batching system that groups individual dice rolls
 * within a time window into combined messages.
 */

// Mock globals before requiring the module
global.window = {
  postChatMessage: jest.fn(),
  sendTextToExtension: jest.fn(),
  RollBatcher: null,
};

global.localStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
};

describe('RollBatcher', () => {
  let RollBatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    global.window.postChatMessage = jest.fn();
    global.window.sendTextToExtension = jest.fn();
    global.localStorage.getItem = jest.fn(() => null);

    // Re-require to get a fresh module instance
    jest.resetModules();
    RollBatcher = require('../../src/content/modules/RollBatcher.js');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('parseDieType', () => {
    test('should parse d6 from die name containing "d6"', () => {
      expect(RollBatcher.parseDieType('PixelD6_ABC', 3)).toBe(6);
    });

    test('should parse d20 from die name containing "d20"', () => {
      expect(RollBatcher.parseDieType('MG d20', 15)).toBe(20);
    });

    test('should parse d12 from die name case-insensitively', () => {
      expect(RollBatcher.parseDieType('MyD12Die', 7)).toBe(12);
    });

    test('should infer d6 from face value 5 when name has no die type', () => {
      expect(RollBatcher.parseDieType('RandomName', 5)).toBe(6);
    });

    test('should infer d4 from face value 4 when name has no die type', () => {
      expect(RollBatcher.parseDieType('NoDiceInfo', 4)).toBe(4);
    });

    test('should infer d20 from face value 13 when name has no die type', () => {
      expect(RollBatcher.parseDieType('UUID-1234', 13)).toBe(20);
    });

    test('should infer d8 from face value 7 when name has no die type', () => {
      expect(RollBatcher.parseDieType('SomeDie', 7)).toBe(8);
    });

    test('should infer d10 from face value 9 when name has no die type', () => {
      expect(RollBatcher.parseDieType('SomeDie', 9)).toBe(10);
    });

    test('should infer d12 from face value 11 when name has no die type', () => {
      expect(RollBatcher.parseDieType('SomeDie', 11)).toBe(12);
    });

    test('should default to d20 for values above 100', () => {
      expect(RollBatcher.parseDieType('Unknown', 150)).toBe(20);
    });
  });

  describe('setWindowMs', () => {
    test('should change the batch window duration', () => {
      const rollData = createRollData('Die1', 6, 3);

      RollBatcher.setWindowMs(5000);
      RollBatcher.addRoll(rollData);

      // Should not flush at 2 seconds
      jest.advanceTimersByTime(2000);
      expect(global.window.postChatMessage).not.toHaveBeenCalled();

      // Should flush at 5 seconds
      jest.advanceTimersByTime(3000);
      expect(global.window.postChatMessage).toHaveBeenCalled();
    });
  });

  describe('addRoll and flushRolls', () => {
    test('should post a single roll after the timer expires', () => {
      const rollData = createRollData('Die1', 6, 4);

      RollBatcher.addRoll(rollData);

      // Should not have posted yet
      expect(global.window.postChatMessage).not.toHaveBeenCalled();

      // Advance past the default 2-second window
      jest.advanceTimersByTime(2000);

      expect(global.window.postChatMessage).toHaveBeenCalledTimes(1);
      const message = global.window.postChatMessage.mock.calls[0][0];
      expect(message).toContain('Pixels Dice');
      expect(message).toContain('1d6');
    });

    test('should group multiple rolls within the window', () => {
      RollBatcher.addRoll(createRollData('Die1', 6, 4));
      jest.advanceTimersByTime(500);
      RollBatcher.addRoll(createRollData('Die2', 6, 3));

      jest.advanceTimersByTime(2000);

      expect(global.window.postChatMessage).toHaveBeenCalledTimes(1);
      const message = global.window.postChatMessage.mock.calls[0][0];
      expect(message).toContain('2d6');
      expect(message).toContain('Pixels Dice');
    });

    test('should reset timer on each new roll', () => {
      RollBatcher.addRoll(createRollData('Die1', 6, 4));

      jest.advanceTimersByTime(1500);
      // Add second roll before first timer fires
      RollBatcher.addRoll(createRollData('Die2', 6, 2));

      // First timer would have fired at 2000ms, but it was reset
      jest.advanceTimersByTime(500);
      expect(global.window.postChatMessage).not.toHaveBeenCalled();

      // Should flush 2000ms after the second roll
      jest.advanceTimersByTime(1500);
      expect(global.window.postChatMessage).toHaveBeenCalledTimes(1);
    });

    test('should not include modifier in output (modifiers removed)', () => {
      const rollData = createRollData('Die1', 20, 15, {
        modifier: 3,
        modifierName: 'Attack',
        isModifierBoxVisible: true,
      });

      RollBatcher.addRoll(rollData);
      jest.advanceTimersByTime(2000);

      const message = global.window.postChatMessage.mock.calls[0][0];
      // Modifiers are no longer applied to unprompted rolls
      expect(message).toContain('Pixels Dice');
      expect(message).not.toContain('Attack');
      expect(message).not.toContain('+3');
    });

    test('should produce simple output regardless of modifier data', () => {
      const rollData = createRollData('Die1', 20, 15, {
        modifier: 0,
        modifierName: 'Modifier',
        isModifierBoxVisible: true,
      });

      RollBatcher.addRoll(rollData);
      jest.advanceTimersByTime(2000);

      const message = global.window.postChatMessage.mock.calls[0][0];
      expect(message).toContain('Pixels Dice');
      expect(message).not.toContain('+0');
    });

    test('should handle mixed die types in a group', () => {
      RollBatcher.addRoll(createRollData('D6Die', 6, 5));
      RollBatcher.addRoll(createRollData('D8Die', 8, 7));

      jest.advanceTimersByTime(2000);

      const message = global.window.postChatMessage.mock.calls[0][0];
      expect(message).toContain('1d6');
      expect(message).toContain('1d8');
    });

    test('should sort dice values by die type in output', () => {
      // Add d8 first, then d6
      RollBatcher.addRoll(createRollData('D8Die', 8, 7));
      RollBatcher.addRoll(createRollData('D6Die', 6, 3));

      jest.advanceTimersByTime(2000);

      const message = global.window.postChatMessage.mock.calls[0][0];
      // Formula should list d6 before d8
      expect(message.indexOf('1d6')).toBeLessThan(message.indexOf('1d8'));
    });

    test('should send text to extension for each roll', () => {
      RollBatcher.addRoll(createRollData('MyDie', 6, 4));
      jest.advanceTimersByTime(2000);

      expect(global.window.sendTextToExtension).toHaveBeenCalled();
    });
  });

  describe('percentile combo detection', () => {
    test('should combine d00 and d10 into a d% roll', () => {
      RollBatcher.addRoll(createRollData('D00Die', 100, 30));
      RollBatcher.addRoll(createRollData('D10Die', 10, 5));

      jest.advanceTimersByTime(2000);

      const message = global.window.postChatMessage.mock.calls[0][0];
      expect(message).toContain('d%');
      expect(message).toContain('35');
    });

    test('should handle d00=100 and d10=0 as 100', () => {
      RollBatcher.addRoll(createRollData('D00Die', 100, 100));
      RollBatcher.addRoll(createRollData('D10Die', 10, 0));

      jest.advanceTimersByTime(2000);

      const message = global.window.postChatMessage.mock.calls[0][0];
      expect(message).toContain('100');
    });

    test('should handle d00=100 and d10=5 as 5', () => {
      RollBatcher.addRoll(createRollData('D00Die', 100, 100));
      RollBatcher.addRoll(createRollData('D10Die', 10, 5));

      jest.advanceTimersByTime(2000);

      const message = global.window.postChatMessage.mock.calls[0][0];
      // Result should be 5, not 105
      expect(message).toContain('[[5]]');
    });

    test('should display standalone d00 as d00 not d%', () => {
      RollBatcher.addRoll(createRollData('D00Die', 100, 50));

      jest.advanceTimersByTime(2000);

      const message = global.window.postChatMessage.mock.calls[0][0];
      expect(message).toContain('d00');
      expect(message).not.toContain('d%');
    });

    test('should combine d00+d10 with other dice in the batch', () => {
      RollBatcher.addRoll(createRollData('D00Die', 100, 40));
      RollBatcher.addRoll(createRollData('D10Die', 10, 3));
      RollBatcher.addRoll(createRollData('D6Die', 6, 5));

      jest.advanceTimersByTime(2000);

      const message = global.window.postChatMessage.mock.calls[0][0];
      expect(message).toContain('d%');
      expect(message).toContain('1d6');
    });
  });

  describe('flushRolls', () => {
    test('should do nothing when no rolls are pending', () => {
      RollBatcher.flushRolls();
      expect(global.window.postChatMessage).not.toHaveBeenCalled();
    });

    test('should flush pending rolls immediately when called', () => {
      RollBatcher.addRoll(createRollData('Die1', 6, 4));

      // Flush manually before timer
      RollBatcher.flushRolls();

      expect(global.window.postChatMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('localStorage persistence', () => {
    test('should respect custom window set via setWindowMs', () => {
      RollBatcher.setWindowMs(5000);

      const rollData = createRollData('Die1', 6, 3);
      RollBatcher.addRoll(rollData);

      jest.advanceTimersByTime(4000);
      expect(global.window.postChatMessage).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(global.window.postChatMessage).toHaveBeenCalled();
    });
  });
});

/**
 * Helper to create roll data objects for testing.
 */
function createRollData(dieName, dieType, faceValue, options = {}) {
  return {
    dieName,
    dieType,
    faceValue,
    modifier: options.modifier || 0,
    modifierName: options.modifierName || 'Modifier',
    isModifierBoxVisible: options.isModifierBoxVisible || false,
  };
}
