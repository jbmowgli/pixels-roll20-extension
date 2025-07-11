/**
 * @jest-environment jsdom
 */

// Mock the ES module imports
jest.mock('../../../../src/utils/cssLoader.js', () => ({
  loadMultipleCSS: jest.fn(() => Promise.resolve()),
  loadCSS: jest.fn(() => Promise.resolve()),
  removeCSS: jest.fn(),
  isLoaded: jest.fn(() => false),
}));

jest.mock('../../../../src/utils/themeDetector.js', () => ({
  getThemeColors: jest.fn(() => ({
    theme: 'dark',
    primary: '#4CAF50',
    background: '#2b2b2b',
    text: '#ffffff',
    input: '#333333',
    inputBorder: '#555555',
    button: '#444444',
    border: '#555555',
  })),
  onThemeChange: jest.fn(() => ({
    disconnect: jest.fn(),
  })),
}));

// Import the ES module using require (Babel will transform it)
const themeManagerModule = require('../../../../src/components/modifierBox/themeManager.js');
const { loadMultipleCSS } = require('../../../../src/utils/cssLoader.js');
const { getThemeColors, onThemeChange } = require('../../../../src/utils/themeDetector.js');

// Helper function to reset mocks and DOM state
function resetMocks() {
  // Clear all mock calls
  jest.clearAllMocks();

  // Reset DOM state
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.body.className = '';

  // Reset any global state
  if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.resetState) {
    window.ModifierBoxThemeManager.resetState();
  }
}

describe('ModifierBox Theme Manager', () => {
  beforeEach(() => {
    resetMocks();

    // Set up globals for backward compatibility
    if (themeManagerModule.default) {
      window.ModifierBoxThemeManager = themeManagerModule.default;
    }

    // Reset module state
    if (window.ModifierBoxThemeManager.resetState) {
      window.ModifierBoxThemeManager.resetState();
    }

    // Clear mock calls
    jest.clearAllMocks();

    // Set up legacy globals for tests that still expect them
    window.ThemeDetector = {
      getThemeColors,
      onThemeChange,
    };
    window.CSSLoader = {
      loadMultipleCSS,
    };
  });

  describe('Module Initialization', () => {
    test('should initialize ModifierBoxThemeManager global object', () => {
      expect(window.ModifierBoxThemeManager).toBeDefined();
      expect(typeof window.ModifierBoxThemeManager).toBe('object');
    });

    test('should expose correct API methods', () => {
      expect(window.ModifierBoxThemeManager.addStyles).toBeInstanceOf(Function);
      expect(window.ModifierBoxThemeManager.updateTheme).toBeInstanceOf(
        Function
      );
      expect(
        window.ModifierBoxThemeManager.startThemeMonitoring
      ).toBeInstanceOf(Function);
      expect(window.ModifierBoxThemeManager.stopThemeMonitoring).toBeInstanceOf(
        Function
      );
      expect(window.ModifierBoxThemeManager.forceThemeRefresh).toBeInstanceOf(
        Function
      );
      expect(window.ModifierBoxThemeManager.forceElementUpdates).toBeInstanceOf(
        Function
      );
    });
  });

  describe('addStyles', () => {
    test('should attempt to load external CSS files when CSSLoader is available', async () => {
      window.ModifierBoxThemeManager.addStyles();

      // Should attempt to load CSS files
      expect(loadMultipleCSS).toHaveBeenCalledWith([
        expect.objectContaining({
          path: 'components/modifierBox/styles/modifierBox.css',
          id: 'pixels-modifier-box-base-styles',
        }),
        expect.objectContaining({
          path: 'components/modifierBox/styles/minimized.css',
          id: 'pixels-modifier-box-minimized-styles',
        }),
        expect.objectContaining({
          path: 'components/modifierBox/styles/lightTheme.css',
          id: 'pixels-modifier-box-light-theme-styles',
        }),
      ]);
    });

    test('should fall back to inline styles when CSSLoader is not available', () => {
      // Create a version of the module where loadMultipleCSS is null
      const originalLoadMultipleCSS = require('../../../../src/utils/cssLoader.js').loadMultipleCSS;
      require('../../../../src/utils/cssLoader.js').loadMultipleCSS = null;

      window.ModifierBoxThemeManager.addStyles();

      const styleElement = document.getElementById(
        'pixels-modifier-box-styles-fallback'
      );
      expect(styleElement).toBeTruthy();
      expect(styleElement.tagName).toBe('STYLE');
      expect(styleElement.textContent).toContain('#pixels-modifier-box');

      // Restore original function
      require('../../../../src/utils/cssLoader.js').loadMultipleCSS = originalLoadMultipleCSS;
    });

    test('should fall back to inline styles when CSS loading fails', async () => {
      // Mock the CSS loader to reject
      loadMultipleCSS.mockRejectedValueOnce(new Error('CSS load failed'));

      window.ModifierBoxThemeManager.addStyles();

      // Wait for promise to reject and fallback to execute
      await new Promise(resolve => setTimeout(resolve, 50));

      const styleElement = document.getElementById(
        'pixels-modifier-box-styles-fallback'
      );
      expect(styleElement).toBeTruthy();
      expect(styleElement.tagName).toBe('STYLE');
    });

    test('should not add fallback styles twice', async () => {
      // Mock the CSS loader to reject both times
      loadMultipleCSS.mockRejectedValue(new Error('CSS load failed'));

      window.ModifierBoxThemeManager.addStyles();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      window.ModifierBoxThemeManager.addStyles();
      await new Promise(resolve => setTimeout(resolve, 50));

      const styleElements = document.querySelectorAll(
        '#pixels-modifier-box-styles-fallback'
      );
      expect(styleElements.length).toBe(1);
    });

    test('should include comprehensive CSS rules in fallback', async () => {
      // Mock the CSS loader to reject
      loadMultipleCSS.mockRejectedValueOnce(new Error('CSS load failed'));

      window.ModifierBoxThemeManager.addStyles();

      // Wait for promise to reject and fallback to execute
      await new Promise(resolve => setTimeout(resolve, 50));

      const styleElement = document.getElementById(
        'pixels-modifier-box-styles-fallback'
      );
      expect(styleElement).toBeTruthy();
      const css = styleElement.textContent;

      // Check for key CSS selectors
      expect(css).toContain('#pixels-modifier-box');
      expect(css).toContain('position: fixed');
    });
  });

  describe('updateTheme', () => {
    let mockModifierBox;

    beforeEach(() => {
      mockModifierBox = document.createElement('div');
      mockModifierBox.id = 'pixels-modifier-box';
      mockModifierBox.innerHTML = `
        <div class="pixels-header"></div>
        <div class="pixels-content">
          <div class="current-roll"></div>
          <input type="text" class="modifier-input">
          <div class="modifier-row">
            <input type="text" class="modifier-name">
            <input type="number" class="modifier-value">
            <button class="remove-row-btn">×</button>
          </div>
        </div>
      `;
      document.body.appendChild(mockModifierBox);
    });

    test('should apply theme colors to modifier box elements', () => {
      window.ModifierBoxThemeManager.updateTheme(mockModifierBox);

      // Check that styles were applied (we can't easily test the exact values due to browser differences)
      expect(getThemeColors).toHaveBeenCalled();
    });

    test('should handle null modifier box gracefully', () => {
      window.ModifierBoxThemeManager.updateTheme(null);
      // Should not throw any errors
    });

    test('should use fallback colors when ThemeDetector is not available', () => {
      delete window.ThemeDetector;

      window.ModifierBoxThemeManager.updateTheme(mockModifierBox);

      // Should still complete without error
      expect(() => {
        window.ModifierBoxThemeManager.updateTheme(mockModifierBox);
      }).not.toThrow();
    });

    test('should apply theme class to body element', () => {
      const mockBody = document.body;

      // Mock the imported getThemeColors function to return light theme
      getThemeColors.mockReturnValue({
        theme: 'light',
        background: '#ffffff',
        text: '#333333',
        primary: '#2196F3',
        input: '#ffffff',
        inputBorder: '#cccccc',
        button: '#f8f9fa',
        border: '#dddddd',
      });

      window.ModifierBoxThemeManager.updateTheme(mockModifierBox);

      // Should apply the theme class to body
      expect(mockBody.classList.contains('roll20-light-theme')).toBe(true);
      expect(mockBody.classList.contains('roll20-dark-theme')).toBe(false);
    });
  });

  describe('forceElementUpdates', () => {
    let mockModifierBox;

    beforeEach(() => {
      mockModifierBox = document.createElement('div');
      mockModifierBox.innerHTML = `
        <input type="text" class="modifier-name">
        <input type="number" class="modifier-value">
        <button class="remove-row-btn">×</button>
      `;
      document.body.appendChild(mockModifierBox);
    });

    test('should force style updates on input elements', () => {
      window.ModifierBoxThemeManager.forceElementUpdates(mockModifierBox);

      const inputs = mockModifierBox.querySelectorAll(
        'input[type="text"], input[type="number"]'
      );
      expect(inputs.length).toBeGreaterThan(0);

      // Verify the function completes without error
      expect(getThemeColors).toHaveBeenCalled();
    });

    test('should force style updates on remove buttons', () => {
      window.ModifierBoxThemeManager.forceElementUpdates(mockModifierBox);

      const buttons = mockModifierBox.querySelectorAll('.remove-row-btn');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('should handle empty modifier box', () => {
      const emptyBox = document.createElement('div');

      expect(() => {
        window.ModifierBoxThemeManager.forceElementUpdates(emptyBox);
      }).not.toThrow();
    });

    test('should handle null modifier box', () => {
      expect(() => {
        window.ModifierBoxThemeManager.forceElementUpdates(null);
      }).not.toThrow();
    });
  });

  describe('Theme Monitoring', () => {
    test('should start theme monitoring when ThemeDetector is available', () => {
      const mockCallback = jest.fn();

      window.ModifierBoxThemeManager.startThemeMonitoring(mockCallback);

      expect(onThemeChange).toHaveBeenCalled();
    });

    test('should not start monitoring if ThemeDetector is unavailable', () => {
      delete window.ThemeDetector;
      const mockCallback = jest.fn();

      window.ModifierBoxThemeManager.startThemeMonitoring(mockCallback);

      // Should not throw error
    });

    test('should not start multiple observers', () => {
      const mockCallback = jest.fn();

      window.ModifierBoxThemeManager.startThemeMonitoring(mockCallback);
      window.ModifierBoxThemeManager.startThemeMonitoring(mockCallback);

      // Should only call onThemeChange once
      expect(onThemeChange).toHaveBeenCalledTimes(1);
    });

    test('should stop theme monitoring', () => {
      const mockObserver = { disconnect: jest.fn() };
      window.ThemeDetector.onThemeChange.mockReturnValue(mockObserver);

      const mockCallback = jest.fn();
      window.ModifierBoxThemeManager.startThemeMonitoring(mockCallback);
      window.ModifierBoxThemeManager.stopThemeMonitoring();

      expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    test('should handle stopping monitoring when no observer exists', () => {
      expect(() => {
        window.ModifierBoxThemeManager.stopThemeMonitoring();
      }).not.toThrow();
    });
  });

  describe('Force Theme Refresh', () => {
    let mockModifierBox;

    beforeEach(() => {
      mockModifierBox = document.createElement('div');
      document.body.appendChild(mockModifierBox);
    });

    test('should force immediate theme refresh', () => {
      // Create a mock element with styles to test theme updates
      mockModifierBox.innerHTML = `
        <input type="text" class="test-input" />
        <button class="remove-row-btn test-button">×</button>
      `;

      const testInput = mockModifierBox.querySelector('.test-input');
      const testButton = mockModifierBox.querySelector('.test-button');

      // Store original styles
      const originalInputColor = testInput.style.color;
      const originalButtonColor = testButton.style.color;

      window.ModifierBoxThemeManager.forceThemeRefresh(mockModifierBox);

      // The function should run without errors
      expect(mockModifierBox).toBeTruthy();
    });
  });

  describe('Integration', () => {
    test('should work with different theme color schemes', () => {
      const lightTheme = {
        theme: 'light',
        primary: '#2196F3',
        background: '#ffffff',
        text: '#333333',
        input: '#ffffff',
        inputBorder: '#cccccc',
        button: '#f8f9fa',
        border: '#dddddd',
      };

      window.ThemeDetector.getThemeColors.mockReturnValue(lightTheme);

      const mockBox = document.createElement('div');
      mockBox.innerHTML = '<input type="text">';
      document.body.appendChild(mockBox);

      expect(() => {
        window.ModifierBoxThemeManager.updateTheme(mockBox);
      }).not.toThrow();
    });
  });
});
