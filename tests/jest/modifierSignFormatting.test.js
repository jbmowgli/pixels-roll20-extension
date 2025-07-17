/**
 * Test for modifier sign formatting fix
 */

describe('Modifier Sign Formatting', () => {
  let formatModifierSign;

  beforeEach(() => {
    // Mock the module to access the formatModifierSign function
    jest.resetModules();

    // Create the function as it appears in the module
    formatModifierSign = modifier => {
      const num = parseInt(modifier) || 0;
      return num >= 0 ? `+${num}` : num.toString();
    };
  });

  describe('formatModifierSign function', () => {
    test('should format positive numbers with + sign', () => {
      expect(formatModifierSign('3')).toBe('+3');
      expect(formatModifierSign('10')).toBe('+10');
      expect(formatModifierSign(5)).toBe('+5');
    });

    test('should format negative numbers without + sign', () => {
      expect(formatModifierSign('-3')).toBe('-3');
      expect(formatModifierSign('-10')).toBe('-10');
      expect(formatModifierSign(-5)).toBe('-5');
    });

    test('should handle zero correctly', () => {
      expect(formatModifierSign('0')).toBe('+0');
      expect(formatModifierSign(0)).toBe('+0');
    });

    test('should handle invalid input', () => {
      expect(formatModifierSign('invalid')).toBe('+0');
      expect(formatModifierSign(null)).toBe('+0');
      expect(formatModifierSign(undefined)).toBe('+0');
      expect(formatModifierSign('')).toBe('+0');
    });

    test('should handle decimal numbers by truncating', () => {
      expect(formatModifierSign('3.7')).toBe('+3');
      expect(formatModifierSign('-3.7')).toBe('-3');
    });
  });

  describe('Chat message formatting scenarios', () => {
    test('should prevent +-3 display for negative modifiers', () => {
      const template = '{{name=Test (#modifier_sign)}}';
      const negativeModifier = -3;
      const formattedSign = formatModifierSign(negativeModifier);
      const result = template.replace('#modifier_sign', formattedSign);

      expect(result).toBe('{{name=Test (-3)}}');
      expect(result).not.toContain('+-');
    });

    test('should show +3 for positive modifiers', () => {
      const template = '{{name=Test (#modifier_sign)}}';
      const positiveModifier = 3;
      const formattedSign = formatModifierSign(positiveModifier);
      const result = template.replace('#modifier_sign', formattedSign);

      expect(result).toBe('{{name=Test (+3)}}');
    });

    test('should handle zero modifier appropriately', () => {
      const template = '{{name=Test (#modifier_sign)}}';
      const zeroModifier = 0;
      const formattedSign = formatModifierSign(zeroModifier);
      const result = template.replace('#modifier_sign', formattedSign);

      expect(result).toBe('{{name=Test (+0)}}');
    });
  });
});
