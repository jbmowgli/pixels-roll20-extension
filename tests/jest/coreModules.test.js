/**
 * Core Module Tests for Pixels Roll20 Extension
 * Tests the individual core modules in the new modular structure
 * Simplified version focusing on module structure validation
 */

// Mock console
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

// Mock document
global.document = {
  getElementById: jest.fn(),
};

describe('Core Modules - Structure Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Initialize window object
    global.window = {
      pixelsModifier: '0',
      pixelsModifierName: 'Modifier 1',
      pixels: [],
    };
  });

  describe('Module Files Existence', () => {
    test('should have core module files', () => {
      // Test that the core module files exist by requiring them
      expect(() => {
        require('../../src/utils/modifierSettings.js');
      }).not.toThrow();
    });
  });

  describe('Module Loading', () => {
    test('should load modules without errors', () => {
      // Load the core modules
      require('../../src/utils/modifierSettings.js');

      // Test that modules have been loaded and created their namespaces
      expect(global.window.PixelsSessionStorage).toBeDefined();
    });

    test('should maintain backward compatibility functions', () => {
      // Load the modules
      require('../../src/utils/modifierSettings.js');

      // Check that backward compatibility functions exist
      expect(typeof global.window.saveModifierSettings).toBe('function');
      expect(typeof global.window.loadModifierSettings).toBe('function');
      expect(typeof global.window.updateModifierSettings).toBe('function');
      expect(typeof global.window.clearAllModifierSettings).toBe('function');
    });
  });

  describe('Chrome Extension Integration', () => {
    test('should handle Chrome API calls without errors', () => {
      // Load the modules
      require('../../src/utils/modifierSettings.js');

      // Test that localStorage functions work
      expect(() => {
        global.window.saveModifierSettings();
      }).not.toThrow();
    });
  });

  describe('Refactoring Validation', () => {
    test('should have successfully updated storage to localStorage', () => {
      // Load all modules
      require('../../src/utils/modifierSettings.js');

      // Verify that all expected functionality is available
      expect(global.window.PixelsSessionStorage).toHaveProperty('saveModifierSettings');
      expect(global.window.PixelsSessionStorage).toHaveProperty('loadModifierSettings');
      expect(global.window.PixelsSessionStorage).toHaveProperty('clearAllModifierSettings');
      
      // Test that functions exist globally for backward compatibility
      expect(typeof global.window.saveModifierSettings).toBe('function');
      expect(typeof global.window.loadModifierSettings).toBe('function');
      expect(typeof global.window.clearAllModifierSettings).toBe('function');
    });
  });
});
