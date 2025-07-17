/**
 * Component Initializer Module
 * Orchestrates the setup of all modifier box components
 */

'use strict';

import {
  addStyles,
  updateTheme as updateThemeFromThemeManager,
  startThemeMonitoring,
  stopThemeMonitoring,
} from './themeManager.js';
import { setupDragFunctionality } from './dragHandler.js';
import {
  setupModifierRowLogic,
  updateSelectedModifier as updateSelectedModifierFromRowManager,
  loadModifierRows,
} from './rowManager.js';
import { setupMinimizeControls, setupClearAllControls } from './uiControls.js';

export function setupModifierBoxComponents(modifierBox, clearAllCallback) {
  if (!modifierBox) {
    console.error('setupModifierBoxComponents: modifierBox is null');
    return false;
  }

  if (modifierBox.hasAttribute('data-components-setup')) {
    return true;
  }

  try {
    setupStyles();
    setupDragHandling(modifierBox);
    setupRowManagement(modifierBox);
    setupUIControls(modifierBox, clearAllCallback);
    setupThemeManagement(modifierBox);
    setupDragAndDrop(modifierBox);
    setupPositioning(modifierBox);
    setupCleanupHandlers();

    modifierBox.setAttribute('data-components-setup', 'true');
    return true;
  } catch (error) {
    console.error('Error during component setup:', error);
    return false;
  }
}

function setupStyles() {
  try {
    if (
      window.ModifierBoxThemeManager &&
      window.ModifierBoxThemeManager.addStyles
    ) {
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

function setupDragHandling(modifierBox) {
  try {
    if (
      window.ModifierBoxDragHandler &&
      window.ModifierBoxDragHandler.setupDragFunctionality
    ) {
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

function setupRowManagement(modifierBox) {
  const updateCallback = () => {
    try {
      if (
        window.ModifierBoxRowManager &&
        window.ModifierBoxRowManager.updateSelectedModifier
      ) {
        window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
      } else if (typeof updateSelectedModifierFromRowManager === 'function') {
        updateSelectedModifierFromRowManager(modifierBox);
      }
    } catch (error) {
      console.error('Error updating selected modifier:', error);
    }
  };

  try {
    if (
      window.ModifierBoxRowManager &&
      window.ModifierBoxRowManager.setupModifierRowLogic
    ) {
      window.ModifierBoxRowManager.setupModifierRowLogic(
        modifierBox,
        updateCallback
      );
    } else if (typeof setupModifierRowLogic === 'function') {
      setupModifierRowLogic(modifierBox, updateCallback);
    } else {
      console.error('Row manager setupModifierRowLogic not available');
    }
  } catch (error) {
    console.error('Error setting up row logic:', error);
  }

  try {
    if (
      window.ModifierBoxRowManager &&
      window.ModifierBoxRowManager.loadModifierRows
    ) {
      const loaded = window.ModifierBoxRowManager.loadModifierRows(
        modifierBox,
        updateCallback
      );
      if (!loaded) {
        // No saved modifier rows found, using default
      }
    } else if (typeof loadModifierRows === 'function') {
      const loaded = loadModifierRows(modifierBox, updateCallback);
      if (!loaded) {
        // No saved modifier rows found, using default
      }
    }
  } catch (error) {
    console.error('Error loading modifier rows:', error);
  }
}

function setupUIControls(modifierBox, clearAllCallback) {
  setupMinimizeControls(modifierBox);

  if (clearAllCallback) {
    setupClearAllControls(modifierBox, clearAllCallback);
  }
}

function setupThemeManagement(modifierBox) {
  try {
    if (
      window.ModifierBoxThemeManager &&
      window.ModifierBoxThemeManager.startThemeMonitoring
    ) {
      window.ModifierBoxThemeManager.startThemeMonitoring(
        (_newTheme, _colors) => {
          window.ModifierBoxThemeManager.updateTheme(modifierBox);
        }
      );
    } else if (typeof startThemeMonitoring === 'function') {
      startThemeMonitoring((_newTheme, _colors) => {
        if (typeof updateThemeFromThemeManager === 'function') {
          updateThemeFromThemeManager(modifierBox);
        } else if (
          window.ModifierBoxThemeManager &&
          window.ModifierBoxThemeManager.updateTheme
        ) {
          window.ModifierBoxThemeManager.updateTheme(modifierBox);
        }
      });
    }
  } catch (error) {
    console.error('Error starting theme monitoring:', error);
  }

  try {
    if (
      window.ModifierBoxThemeManager &&
      window.ModifierBoxThemeManager.updateTheme
    ) {
      window.ModifierBoxThemeManager.updateTheme(modifierBox);
    } else if (typeof updateThemeFromThemeManager === 'function') {
      updateThemeFromThemeManager(modifierBox);
    }
  } catch (error) {
    console.error('Error applying initial theme:', error);
  }

  try {
    if (
      window.ModifierBoxRowManager &&
      window.ModifierBoxRowManager.updateSelectedModifier
    ) {
      window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
    } else if (typeof updateSelectedModifierFromRowManager === 'function') {
      updateSelectedModifierFromRowManager(modifierBox);
    }
  } catch (error) {
    console.error('Error updating selected modifier:', error);
  }
}

function setupDragAndDrop(modifierBox) {
  if (window.RowDragDrop) {
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
  } else {
    console.warn('RowDragDrop not available - drag and drop disabled');
  }
}

function setupPositioning(modifierBox) {
  modifierBox.style.top = '20px';
  modifierBox.style.left = '60px';
  modifierBox.style.right = 'auto';
}

function setupCleanupHandlers() {
  window.addEventListener('beforeunload', () => {
    if (
      window.ModifierBoxThemeManager &&
      window.ModifierBoxThemeManager.stopThemeMonitoring
    ) {
      window.ModifierBoxThemeManager.stopThemeMonitoring();
    } else if (typeof stopThemeMonitoring === 'function') {
      stopThemeMonitoring();
    }
  });
}

export function checkDependencies() {
  const hasThemeManager =
    window.ModifierBoxThemeManager &&
    typeof window.ModifierBoxThemeManager.addStyles === 'function';

  const hasDragHandler =
    window.ModifierBoxDragHandler &&
    typeof window.ModifierBoxDragHandler.setupDragFunctionality === 'function';

  const hasRowManager =
    window.ModifierBoxRowManager &&
    typeof window.ModifierBoxRowManager.setupModifierRowLogic === 'function';

  if (!hasThemeManager || !hasDragHandler || !hasRowManager) {
    console.error(
      'Required modules not loaded. Make sure all modifier box modules are included.'
    );
    return false;
  }

  return true;
}

const ComponentInitializer = {
  setupModifierBoxComponents,
  checkDependencies,
};

export default ComponentInitializer;

if (typeof window !== 'undefined') {
  window.ModifierBoxComponentInitializer = ComponentInitializer;
}
