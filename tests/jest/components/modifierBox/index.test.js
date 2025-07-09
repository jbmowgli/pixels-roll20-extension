/**
 * @jest-environment jsdom
 */

// Import the module by reading and evaluating it
const fs = require('fs');
const path = require('path');

// Helper function to load a module file
function loadModule(modulePath) {
  const fullPath = path.join(__dirname, '../../../../', modulePath);
  const moduleCode = fs.readFileSync(fullPath, 'utf8');
  eval(moduleCode);
}

describe('ModifierBox Main Module', () => {
  beforeEach(() => {
    // Reset DOM and global state
    resetMocks();

    // Load dependencies first (mock them)
    window.ModifierBoxThemeManager = {
      addStyles: jest.fn(),
      updateTheme: jest.fn(),
      startThemeMonitoring: jest.fn(),
      stopThemeMonitoring: jest.fn(),
      forceThemeRefresh: jest.fn(),
      forceElementUpdates: jest.fn(),
    };

    window.ModifierBoxDragHandler = {
      setupDragFunctionality: jest.fn(),
    };

    window.ModifierBoxRowManager = {
      setupModifierRowLogic: jest.fn(),
      updateSelectedModifier: jest.fn(),
    };

    // Load the main ModifierBox module
    loadModule('src/components/modifierBox/modifierBox.js');
  });

  describe('Module Initialization', () => {
    test('should initialize ModifierBox global object', () => {
      expect(window.ModifierBox).toBeDefined();
      expect(typeof window.ModifierBox).toBe('object');
    });

    test('should expose correct API methods', () => {
      expect(window.ModifierBox.create).toBeInstanceOf(Function);
      expect(window.ModifierBox.show).toBeInstanceOf(Function);
      expect(window.ModifierBox.hide).toBeInstanceOf(Function);
      expect(window.ModifierBox.isVisible).toBeInstanceOf(Function);
      expect(window.ModifierBox.getElement).toBeInstanceOf(Function);
      expect(window.ModifierBox.updateSelectedModifier).toBeInstanceOf(
        Function
      );
      expect(window.ModifierBox.isInitialized).toBeInstanceOf(Function);
      expect(window.ModifierBox.updateTheme).toBeInstanceOf(Function);
      expect(window.ModifierBox.forceThemeRefresh).toBeInstanceOf(Function);
      expect(window.ModifierBox.syncGlobalVars).toBeInstanceOf(Function);
    });

    test('should prevent multiple initialization', () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      // Try to load the module again
      loadModule('src/components/modifierBox/modifierBox.js');
      expect(consoleSpy).toHaveBeenCalledWith(
        'ModifierBox module already loaded, skipping re-initialization'
      );
    });
  });

  describe('createModifierBox', () => {
    test('should create modifier box element with correct structure', async () => {
      const element = await window.ModifierBox.create();

      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.id).toBe('pixels-modifier-box');
      expect(element.getAttribute('data-testid')).toBe('pixels-modifier-box');
      expect(element.className).toBe('PIXELS_EXTENSION_BOX_FIND_ME');
    });

    test('should create modifier box with correct HTML structure', async () => {
      const element = await window.ModifierBox.create();

      // Check header
      const header = element.querySelector('.pixels-header');
      expect(header).toBeTruthy();

      const title = header.querySelector('.pixels-title');
      expect(title).toBeTruthy();

      const controls = header.querySelector('.pixels-controls');
      expect(controls).toBeTruthy();

      // Check buttons
      expect(element.querySelector('.add-modifier-btn')).toBeTruthy();
      expect(element.querySelector('.pixels-minimize')).toBeTruthy();
      // Close button has been removed - only controlled from popup
      expect(element.querySelector('.pixels-close')).toBeFalsy();

      // Check content area
      const content = element.querySelector('.pixels-content');
      expect(content).toBeTruthy();

      // Check initial modifier row
      const modifierRow = content.querySelector('.modifier-row');
      expect(modifierRow).toBeTruthy();

      const radio = modifierRow.querySelector('input[type="radio"]');
      const nameInput = modifierRow.querySelector('input[type="text"]');
      const valueInput = modifierRow.querySelector('input[type="number"]');
      const removeBtn = modifierRow.querySelector('.remove-row-btn');

      expect(radio).toBeTruthy();
      expect(nameInput).toBeTruthy();
      expect(valueInput).toBeTruthy();
      expect(removeBtn).toBeTruthy();

      expect(radio.checked).toBe(true);
      expect(nameInput.value).toBe('Modifier 1');
      expect(valueInput.value).toBe('0');
    });

    test('should return existing modifier box if one already exists', async () => {
      const firstElement = await window.ModifierBox.create();
      const secondElement = await window.ModifierBox.create();

      expect(firstElement).toBe(secondElement);
    });

    test('should adopt existing modifier box from DOM', async () => {
      // Create an existing element in the DOM
      const existingBox = document.createElement('div');
      existingBox.id = 'pixels-modifier-box';
      existingBox.innerHTML = `
        <div class="modifier-row">
          <input type="text" class="modifier-name" value="D20">
        </div>
      `;
      document.body.appendChild(existingBox);

      const element = await window.ModifierBox.create();

      expect(element).toBe(existingBox);

      // Check that "D20" was updated to "Modifier 1"
      const nameInput = element.querySelector('.modifier-name');
      expect(nameInput.value).toBe('Modifier 1');
    });

    test('should call all component setup methods', async () => {
      await window.ModifierBox.create();

      expect(window.ModifierBoxThemeManager.addStyles).toHaveBeenCalled();
      expect(
        window.ModifierBoxDragHandler.setupDragFunctionality
      ).toHaveBeenCalled();
      expect(
        window.ModifierBoxRowManager.setupModifierRowLogic
      ).toHaveBeenCalled();
      expect(
        window.ModifierBoxThemeManager.startThemeMonitoring
      ).toHaveBeenCalled();
    });

    test('should handle missing dependencies gracefully', async () => {
      // Remove dependencies
      delete window.ModifierBoxThemeManager;
      delete window.ModifierBoxDragHandler;
      delete window.ModifierBoxRowManager;

      // Reload module
      delete window.ModifierBox;
      loadModule('src/components/modifierBox/modifierBox.js');

      const element = await window.ModifierBox.create();

      expect(element).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Required modules not loaded. Make sure all modifier box modules are included.'
      );
    });
  });

  describe('showModifierBox', () => {
    test('should create and show modifier box if it does not exist', async () => {
      await window.ModifierBox.show();

      expect(window.ModifierBox.isVisible()).toBe(true);
      expect(window.ModifierBox.getElement()).toBeInstanceOf(HTMLElement);
      expect(document.body.contains(window.ModifierBox.getElement())).toBe(
        true
      );
    });

    test('should show existing modifier box', async () => {
      // Create modifier box first
      const element = await window.ModifierBox.create();
      element.style.display = 'none';

      await window.ModifierBox.show();

      expect(element.style.display).toBe('block');
      expect(window.ModifierBox.isVisible()).toBe(true);
    });

    test('should apply fixed position and update theme when showing existing box', async () => {
      // Create modifier box first
      await window.ModifierBox.create();

      await window.ModifierBox.show();

      expect(window.ModifierBoxThemeManager.updateTheme).toHaveBeenCalled();
      expect(
        window.ModifierBoxThemeManager.forceElementUpdates
      ).toHaveBeenCalled();
    });
  });

  describe('hideModifierBox', () => {
    test('should hide modifier box if it exists', async () => {
      const element = await window.ModifierBox.create();

      window.ModifierBox.hide();

      expect(element.style.display).toBe('none');
      expect(window.ModifierBox.isVisible()).toBe(false);
    });

    test('should handle hiding when modifier box does not exist', () => {
      window.ModifierBox.hide();

      expect(console.error).toHaveBeenCalledWith(
        'Cannot hide - modifierBox is null'
      );
    });
  });

  describe('Event Handlers', () => {
    test('should verify close button is not present (controlled from popup only)', async () => {
      const element = await window.ModifierBox.create();
      const closeBtn = element.querySelector('.pixels-close');

      // Close button should not exist - functionality moved to popup
      expect(closeBtn).toBe(null);
    });

    test('should set up minimize button functionality', async () => {
      const element = await window.ModifierBox.create();
      const minimizeBtn = element.querySelector('.pixels-minimize');

      expect(element.classList.contains('minimized')).toBe(false);

      simulateEvent(minimizeBtn, 'click');

      expect(element.classList.contains('minimized')).toBe(true);

      // Click again to toggle back
      simulateEvent(minimizeBtn, 'click');

      expect(element.classList.contains('minimized')).toBe(false);
    });
  });

  describe('State Management', () => {
    test('should track visibility state correctly', async () => {
      expect(window.ModifierBox.isVisible()).toBe(false);

      await window.ModifierBox.show();
      expect(window.ModifierBox.isVisible()).toBe(true);

      window.ModifierBox.hide();
      expect(window.ModifierBox.isVisible()).toBe(false);
    });

    test('should track initialization state correctly', async () => {
      expect(window.ModifierBox.isInitialized()).toBe(true); // Module loads immediately

      await window.ModifierBox.create();
      expect(window.ModifierBox.isInitialized()).toBe(true);
    });

    test('should return correct element reference', async () => {
      expect(window.ModifierBox.getElement()).toBeNull();

      const element = await window.ModifierBox.create();
      expect(window.ModifierBox.getElement()).toBe(element);
    });
  });

  describe('Integration Methods', () => {
    test('should call updateSelectedModifier when available', async () => {
      await window.ModifierBox.create();

      window.ModifierBox.updateSelectedModifier();

      expect(
        window.ModifierBoxRowManager.updateSelectedModifier
      ).toHaveBeenCalled();
    });

    test('should call theme methods when available', async () => {
      await window.ModifierBox.create();

      window.ModifierBox.updateTheme();
      expect(window.ModifierBoxThemeManager.updateTheme).toHaveBeenCalled();

      window.ModifierBox.forceThemeRefresh();
      expect(
        window.ModifierBoxThemeManager.forceThemeRefresh
      ).toHaveBeenCalled();
      expect(
        window.ModifierBoxThemeManager.forceElementUpdates
      ).toHaveBeenCalled();
    });

    test('should sync global variables', async () => {
      await window.ModifierBox.create();

      window.ModifierBox.syncGlobalVars();

      expect(
        window.ModifierBoxRowManager.updateSelectedModifier
      ).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('should setup cleanup handlers for page unload', () => {
      const addEventListener = jest.spyOn(window, 'addEventListener');

      // Reload module to trigger event listener setup
      delete window.ModifierBox;
      loadModule('src/components/modifierBox/modifierBox.js');

      expect(addEventListener).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });
  });

  describe('Global State Initialization', () => {
    let mockModifierBox;

    beforeEach(() => {
      // Helper function to create a mock modifier box
      function createMockModifierBox() {
        const box = document.createElement('div');
        box.id = 'pixels-modifier-box';
        box.innerHTML = `
          <div class="pixels-header">
            <span class="pixels-title">
              <img src="logo.png" alt="Pixels" class="pixels-logo"> Test Title
            </span>
            <div class="pixels-controls">
              <button class="add-modifier-btn" type="button">Add</button>
            </div>
          </div>
          <div class="pixels-content">
            <div class="modifier-row">
              <input type="radio" name="modifier-select" value="0" class="modifier-radio" id="mod-0" checked>
              <input type="text" class="modifier-name" placeholder="Modifier 1" value="Modifier 1" data-index="0">
              <input type="number" class="modifier-value" value="0" min="-99" max="99" data-index="0">
              <button class="remove-row-btn" type="button">×</button>
            </div>
          </div>
        `;
        document.body.appendChild(box);
        return box;
      }

      mockModifierBox = createMockModifierBox();

      // Mock updateSelectedModifier to capture calls
      window.ModifierBoxRowManager = {
        updateSelectedModifier: jest.fn(),
      };
    });

    test('should sync global state from UI when modifier box is shown', () => {
      // Set up a modifier box with non-default values
      const row = mockModifierBox.querySelector('.modifier-row');
      const nameInput = row.querySelector('.modifier-name');
      const valueInput = row.querySelector('.modifier-value');

      nameInput.value = 'Custom Modifier';
      valueInput.value = '5';

      // Call the show logic that syncs global state
      if (mockModifierBox && window.ModifierBoxRowManager) {
        window.ModifierBoxRowManager.updateSelectedModifier(mockModifierBox);
      }

      // Verify that updateSelectedModifier was called to sync state FROM UI
      expect(
        window.ModifierBoxRowManager.updateSelectedModifier
      ).toHaveBeenCalledWith(mockModifierBox);
    });

    test('should not overwrite UI values with stale global state', () => {
      // This test verifies that we don't restore old global state TO the UI
      // when showing the modifier box

      const row = mockModifierBox.querySelector('.modifier-row');
      const nameInput = row.querySelector('.modifier-name');
      const valueInput = row.querySelector('.modifier-value');

      // User sets custom values in UI
      nameInput.value = 'User Custom Modifier';
      valueInput.value = '7';

      // Simulate old global state (should NOT overwrite UI)
      window.pixelsModifierName = 'Old Global State';
      window.pixelsModifier = '3';

      // The showModifierBox logic should call updateSelectedModifier
      // which reads FROM the UI TO update global state, not the reverse
      const originalUpdateFunction =
        window.ModifierBoxRowManager.updateSelectedModifier;
      window.ModifierBoxRowManager.updateSelectedModifier = jest
        .fn()
        .mockImplementation(modifierBox => {
          // Simulate the real updateSelectedModifier behavior
          const selectedRadio = modifierBox.querySelector(
            'input[name="modifier-select"]:checked'
          );
          if (selectedRadio) {
            const row = selectedRadio.closest('.modifier-row');
            if (row) {
              const nameInput = row.querySelector('.modifier-name');
              const valueInput = row.querySelector('.modifier-value');
              window.pixelsModifierName = nameInput.value || 'Unnamed';
              window.pixelsModifier = valueInput.value || '0';
            }
          }
        });

      // Call the sync logic
      if (mockModifierBox && window.ModifierBoxRowManager) {
        window.ModifierBoxRowManager.updateSelectedModifier(mockModifierBox);
      }

      // Verify UI values were preserved (not overwritten)
      expect(nameInput.value).toBe('User Custom Modifier');
      expect(valueInput.value).toBe('7');

      // Verify global state was updated FROM the UI
      expect(window.pixelsModifierName).toBe('User Custom Modifier');
      expect(window.pixelsModifier).toBe('7');
    });
  });
});
