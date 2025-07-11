/**
 * Component Initializer Module
 * Orchestrates the setup of all modifier box components
 */

'use strict';

import { addStyles, updateTheme as updateThemeFromThemeManager, startThemeMonitoring, stopThemeMonitoring } from './themeManager.js';
import { setupDragFunctionality } from './dragHandler.js';
import { setupModifierRowLogic, updateSelectedModifier as updateSelectedModifierFromRowManager, loadModifierRows } from './rowManager.js';
import { setupMinimizeControls, setupClearAllControls } from './uiControls.js';

// Setup all modifier box components
export function setupModifierBoxComponents(modifierBox, clearAllCallback) {
  if (!modifierBox) {
    console.error('setupModifierBoxComponents: modifierBox is null');
    return false;
  }

  // Check if already setup to prevent duplicate event listeners
  if (modifierBox.hasAttribute('data-components-setup')) {
    console.log('Components already setup, skipping');
    return true;
  }

  try {
    // Setup core components
    setupStyles();
    setupDragHandling(modifierBox);
    setupRowManagement(modifierBox);
    setupUIControls(modifierBox, clearAllCallback);
    setupThemeManagement(modifierBox);
    setupDragAndDrop(modifierBox);
    setupPositioning(modifierBox);
    setupCleanupHandlers();

    // Mark as setup
    modifierBox.setAttribute('data-components-setup', 'true');
    console.log('Components setup completed');
    return true;
  } catch (error) {
    console.error('Error during component setup:', error);
    return false;
  }
}

// Setup CSS styles
function setupStyles() {
  try {
    if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.addStyles) {
      window.ModifierBoxThemeManager.addStyles();
    } else if (typeof addStyles === 'function') {
      addStyles();
    } else {
      console.error('Theme manager addStyles not available');
    }
  } catch (error) {
    console.error('Error adding styles:', error);
  }
}

// Setup drag functionality
function setupDragHandling(modifierBox) {
  try {
    if (window.ModifierBoxDragHandler && window.ModifierBoxDragHandler.setupDragFunctionality) {
      window.ModifierBoxDragHandler.setupDragFunctionality(modifierBox);
    } else if (typeof setupDragFunctionality === 'function') {
      setupDragFunctionality(modifierBox);
    } else {
      console.error('Drag handler setupDragFunctionality not available');
    }
  } catch (error) {
    console.error('Error setting up drag functionality:', error);
  }
}

// Setup row management with callback
function setupRowManagement(modifierBox) {
  const updateCallback = () => {
    try {
      if (window.ModifierBoxRowManager && window.ModifierBoxRowManager.updateSelectedModifier) {
        window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
      } else if (typeof updateSelectedModifierFromRowManager === 'function') {
        updateSelectedModifierFromRowManager(modifierBox);
      }
    } catch (error) {
      console.error('Error updating selected modifier:', error);
    }
  };

  try {
    if (window.ModifierBoxRowManager && window.ModifierBoxRowManager.setupModifierRowLogic) {
      window.ModifierBoxRowManager.setupModifierRowLogic(modifierBox, updateCallback);
    } else if (typeof setupModifierRowLogic === 'function') {
      setupModifierRowLogic(modifierBox, updateCallback);
    } else {
      console.error('Row manager setupModifierRowLogic not available');
    }
  } catch (error) {
    console.error('Error setting up row logic:', error);
  }

  // Try to load saved modifier rows from localStorage
  try {
    if (window.ModifierBoxRowManager && window.ModifierBoxRowManager.loadModifierRows) {
      const loaded = window.ModifierBoxRowManager.loadModifierRows(modifierBox, updateCallback);
      if (loaded) {
        console.log('Successfully loaded modifier rows from localStorage');
      } else {
        console.log('No saved modifier rows found, using default');
      }
    } else if (typeof loadModifierRows === 'function') {
      const loaded = loadModifierRows(modifierBox, updateCallback);
      if (loaded) {
        console.log('Successfully loaded modifier rows from localStorage');
      } else {
        console.log('No saved modifier rows found, using default');
      }
    }
  } catch (error) {
    console.error('Error loading modifier rows:', error);
  }
}

// Setup UI controls (minimize and clear all)
function setupUIControls(modifierBox, clearAllCallback) {
  // Setup minimize controls
  setupMinimizeControls(modifierBox);

  // Setup clear all controls
  if (clearAllCallback) {
    setupClearAllControls(modifierBox, clearAllCallback);
  }
}

// Setup theme management and monitoring
function setupThemeManagement(modifierBox) {
  // Start theme monitoring
  try {
    if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.startThemeMonitoring) {
      window.ModifierBoxThemeManager.startThemeMonitoring((newTheme, colors) => {
        console.log('Theme changed to:', newTheme, colors);
        window.ModifierBoxThemeManager.updateTheme(modifierBox);
      });
    } else if (typeof startThemeMonitoring === 'function') {
      startThemeMonitoring((newTheme, colors) => {
        console.log('Theme changed to:', newTheme, colors);
        if (typeof updateThemeFromThemeManager === 'function') {
          updateThemeFromThemeManager(modifierBox);
        } else if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.updateTheme) {
          window.ModifierBoxThemeManager.updateTheme(modifierBox);
        }
      });
    }
  } catch (error) {
    console.error('Error starting theme monitoring:', error);
  }

  // Apply initial theme immediately
  console.log('Applying initial theme to modifier box...');
  try {
    if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.updateTheme) {
      window.ModifierBoxThemeManager.updateTheme(modifierBox);
    } else if (typeof updateThemeFromThemeManager === 'function') {
      updateThemeFromThemeManager(modifierBox);
    }
  } catch (error) {
    console.error('Error applying initial theme:', error);
  }

  // Update header to show initial modifier
  try {
    if (window.ModifierBoxRowManager && window.ModifierBoxRowManager.updateSelectedModifier) {
      window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
    } else if (typeof updateSelectedModifierFromRowManager === 'function') {
      updateSelectedModifierFromRowManager(modifierBox);
    }
  } catch (error) {
    console.error('Error updating selected modifier:', error);
  }
}

// Setup drag and drop for rows
function setupDragAndDrop(modifierBox) {
  if (window.RowDragDrop) {
    // Add drag handles to existing rows that don't have them
    const existingRows = modifierBox.querySelectorAll('.modifier-row');
    existingRows.forEach(row => {
      if (!row.querySelector('.drag-handle')) {
        if (window.addDragHandle) {
          window.addDragHandle(row);
        }
      }
    });

    window.modifierRowDragDrop = window.RowDragDrop(
      '#pixels-modifier-box .pixels-content',
      '.modifier-row',
      window.ModifierBoxRowManager
    );
    console.log('Row drag and drop initialized');
  } else {
    console.warn('RowDragDrop not available - drag and drop disabled');
  }
}

// Setup initial positioning
function setupPositioning(modifierBox) {
  // Set fixed position - top left corner
  modifierBox.style.top = '20px';
  modifierBox.style.left = '60px';
  modifierBox.style.right = 'auto';
}

// Setup cleanup handlers for page unload
function setupCleanupHandlers() {
  window.addEventListener('beforeunload', () => {
    if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.stopThemeMonitoring) {
      window.ModifierBoxThemeManager.stopThemeMonitoring();
    } else if (typeof stopThemeMonitoring === 'function') {
      stopThemeMonitoring();
    }
  });
}

// Check for required dependencies
export function checkDependencies() {
  const hasThemeManager = (window.ModifierBoxThemeManager && 
     typeof window.ModifierBoxThemeManager.addStyles === 'function');
     
  const hasDragHandler = (window.ModifierBoxDragHandler && 
     typeof window.ModifierBoxDragHandler.setupDragFunctionality === 'function');
     
  const hasRowManager = (window.ModifierBoxRowManager && 
     typeof window.ModifierBoxRowManager.setupModifierRowLogic === 'function');

  // If testing environment is missing required dependencies, return false
  if (!hasThemeManager || !hasDragHandler || !hasRowManager) {
    console.error('Required modules not loaded. Make sure all modifier box modules are included.');
    return false;
  }
  
  return true;
}

// Export for legacy compatibility
const ComponentInitializer = {
  setupModifierBoxComponents,
  checkDependencies,
};

export default ComponentInitializer;

// Legacy global exports for compatibility (temporary)
if (typeof window !== 'undefined') {
  window.ModifierBoxComponentInitializer = ComponentInitializer;
}
