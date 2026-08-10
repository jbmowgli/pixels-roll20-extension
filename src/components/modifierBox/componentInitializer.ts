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
} from './themeManager';
import { setupDragFunctionality } from './dragHandler';
import { setupModifierRowLogic, loadModifierRows } from './rowManager';
import {
  setupMinimizeControls,
  setupClearAllControls,
  restoreMinimizedState,
} from './uiControls';
import { setupPopoutControls } from './popoutManager';

export function setupModifierBoxComponents(
  modifierBox: HTMLElement,
  clearAllCallback: () => void
): boolean {
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

function setupStyles(): void {
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

function setupDragHandling(modifierBox: HTMLElement): void {
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

function setupRowManagement(modifierBox: HTMLElement): void {
  try {
    if (
      window.ModifierBoxRowManager &&
      window.ModifierBoxRowManager.setupModifierRowLogic
    ) {
      window.ModifierBoxRowManager.setupModifierRowLogic(modifierBox);
    } else if (typeof setupModifierRowLogic === 'function') {
      setupModifierRowLogic(modifierBox);
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
      window.ModifierBoxRowManager.loadModifierRows(modifierBox);
    } else if (typeof loadModifierRows === 'function') {
      loadModifierRows(modifierBox);
    }
  } catch (error) {
    console.error('Error loading saved rows:', error);
  }
}

function setupUIControls(
  modifierBox: HTMLElement,
  clearAllCallback: () => void
): void {
  setupMinimizeControls(modifierBox);
  setupPopoutControls(modifierBox);

  if (clearAllCallback) {
    setupClearAllControls(modifierBox, clearAllCallback);
  }

  // Restore the persisted minimized/full-size state (independent of profiles).
  // Fire-and-forget: the storage read is async and applies once it resolves.
  restoreMinimizedState(modifierBox);
}

function setupThemeManagement(modifierBox: HTMLElement): void {
  try {
    if (
      window.ModifierBoxThemeManager &&
      window.ModifierBoxThemeManager.startThemeMonitoring
    ) {
      window.ModifierBoxThemeManager.startThemeMonitoring(
        (_newTheme: string, _colors: ThemeColors) => {
          window.ModifierBoxThemeManager.updateTheme(modifierBox);
        }
      );
    } else if (typeof startThemeMonitoring === 'function') {
      startThemeMonitoring((_newTheme: string, _colors: ThemeColors) => {
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
}

function setupDragAndDrop(modifierBox: HTMLElement): void {
  if (window.RowDragDrop) {
    const existingRows = modifierBox.querySelectorAll('.modifier-row');
    existingRows.forEach(row => {
      if (!row.querySelector('.drag-handle')) {
        if (window.addDragHandle) {
          window.addDragHandle(row as HTMLElement);
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

function setupPositioning(modifierBox: HTMLElement): void {
  modifierBox.style.top = '20px';
  modifierBox.style.left = '60px';
  modifierBox.style.right = 'auto';
}

function setupCleanupHandlers(): void {
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

export function checkDependencies(): boolean {
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

const ComponentInitializer: ModifierBoxComponentInitializerModule = {
  setupModifierBoxComponents,
  checkDependencies,
};

export default ComponentInitializer;

if (typeof window !== 'undefined') {
  window.ModifierBoxComponentInitializer = ComponentInitializer;
}
