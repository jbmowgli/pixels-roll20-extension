'use strict';
import {
  updateTheme as updateThemeFromThemeManager,
  forceThemeRefresh as forceThemeRefreshFromThemeManager,
  forceElementUpdates,
  stopThemeMonitoring,
} from './themeManager';
import { loadTemplate } from '../../utils/htmlLoader';
import { setupModifierBoxComponents } from './componentInitializer';
import {
  getModifierBoxElement,
  isModifierBoxVisible,
  isModifierBoxInitialized,
  setModifierBoxElement,
  setModifierBoxVisible,
  setModifierBoxCreated,
  resetState,
} from './stateManager';

function _resetStateWrapper(): void {
  resetState();
}

const _getModifierBoxElementWrapper = (): HTMLElement | null =>
  getModifierBoxElement();
const isModifierBoxVisibleFunc = (): boolean => isModifierBoxVisible();
const _isModifierBoxInitializedWrapper = (): boolean =>
  isModifierBoxInitialized();

// No-op: modifier selection is removed. Kept for backward compatibility.
const updateSelectedModifierWrapper = (): void => {};

// Function to update theme using imported function
const updateThemeWrapper = (): void => {
  const modifierBox = getModifierBoxElement();
  if (modifierBox) {
    if (
      window.ModifierBoxThemeManager &&
      window.ModifierBoxThemeManager.updateTheme
    ) {
      window.ModifierBoxThemeManager.updateTheme(modifierBox);
    } else if (typeof updateThemeFromThemeManager === 'function') {
      updateThemeFromThemeManager(modifierBox);
    }
  }
};

// Function to force theme refresh using imported functions
const forceThemeRefreshWrapper = (): void => {
  const modifierBox = getModifierBoxElement();
  if (modifierBox) {
    if (
      window.ModifierBoxThemeManager &&
      window.ModifierBoxThemeManager.forceThemeRefresh
    ) {
      window.ModifierBoxThemeManager.forceThemeRefresh(modifierBox);
      if (window.ModifierBoxThemeManager.forceElementUpdates) {
        window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);
      }
    } else {
      if (typeof forceThemeRefreshFromThemeManager === 'function') {
        forceThemeRefreshFromThemeManager(modifierBox);
      }
      if (typeof forceElementUpdates === 'function') {
        forceElementUpdates(modifierBox);
      }
    }
  }
};

// No-op: modifier sync removed. Kept for backward compatibility with content script callers.
const syncGlobalVars = (): void => {};

async function createModifierBox(): Promise<HTMLElement | null> {
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
    return null;
  }

  const modifierBox = getModifierBoxElement();
  if (modifierBox) {
    return modifierBox;
  }

  const existingBox = document.getElementById('pixels-modifier-box');
  if (existingBox) {
    setModifierBoxElement(existingBox);
    setModifierBoxVisible(existingBox.style.display !== 'none');

    // Legacy migration: old modifier names no longer relevant
    const firstNameInput = existingBox.querySelector(
      '.modifier-name'
    ) as HTMLInputElement | null;
    if (
      firstNameInput &&
      (firstNameInput.value === 'None' || firstNameInput.value === 'D20')
    ) {
      firstNameInput.value = 'Attack';
      firstNameInput.placeholder = 'Name';
    }

    setupModifierBoxComponents(existingBox, clearAllModifiers);
    setModifierBoxCreated(true);
    return existingBox;
  }

  try {
    if (!loadTemplate) {
      console.error(
        'HTMLLoader module not available. Falling back to inline HTML.'
      );
      return createModifierBoxFallback();
    }

    let logoUrl = 'assets/images/logo-128.png';
    try {
      if (
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.getURL
      ) {
        logoUrl = chrome.runtime.getURL('assets/images/logo-128.png');
      }
    } catch {
      // Using fallback logo URL (not in extension context)
    }

    const htmlTemplate = await loadTemplate(
      'components/modifierBox/modifierBox.html',
      'modifierBox'
    );

    const processedHTML = htmlTemplate.replace('{{logoUrl}}', logoUrl);

    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = processedHTML;

    const newModifierBox = tempContainer.firstElementChild as HTMLElement;
    setModifierBoxElement(newModifierBox);

    setupModifierBoxComponents(newModifierBox, clearAllModifiers);

    document.body.appendChild(newModifierBox);
    setModifierBoxVisible(true);
    setModifierBoxCreated(true);

    return newModifierBox;
  } catch (error) {
    console.error('Failed to load HTML template:', error);
    return createModifierBoxFallback();
  }
}

function createModifierBoxFallback(): HTMLElement {
  const newModifierBox = document.createElement('div');
  newModifierBox.id = 'pixels-modifier-box';
  newModifierBox.setAttribute('data-testid', 'pixels-modifier-box');
  newModifierBox.className = 'PIXELS_EXTENSION_BOX_FIND_ME';
  setModifierBoxElement(newModifierBox);

  let logoUrl = 'assets/images/logo-128.png';
  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.getURL
    ) {
      logoUrl = chrome.runtime.getURL('assets/images/logo-128.png');
    }
  } catch {
    // Using fallback logo URL (not in extension context)
  }

  newModifierBox.innerHTML = `
            <div class="pixels-header">
                <span class="pixels-title">
                    <img src="${logoUrl}" alt="Pixels" class="pixels-logo"> Saved Rolls
                </span>
                <div class="pixels-controls">
                    <button class="add-modifier-btn" type="button" title="Add Row">Add</button>
                    <button class="clear-all-btn" type="button" title="Clear All">Clear All</button>
                    <button class="pixels-popout" type="button" title="Pop out to window">⧉</button>
                    <button class="pixels-minimize" title="Minimize">−</button>
                </div>
            </div>
            <div class="pixels-content">
                <div class="modifier-row">
                    <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
                    <input type="text" class="modifier-name" placeholder="Name" value="Attack" data-index="0">
                    <input type="text" class="formula-input" placeholder="e.g. 2d6+3" value="1d20" data-index="0">
                    <button class="roll-formula-btn" type="button" title="Roll this formula">Roll</button>
                    <button class="remove-row-btn" type="button">×</button>
                </div>
            </div>
            <div class="pixels-resize-handle"></div>
        `;

  setupModifierBoxComponents(newModifierBox, clearAllModifiers);

  document.body.appendChild(newModifierBox);
  setModifierBoxVisible(true);
  setModifierBoxCreated(true);

  return newModifierBox;
}

function _setupCleanupHandlers(): void {
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

async function showModifierBox(): Promise<void> {
  let modifierBox = getModifierBoxElement();
  if (!modifierBox) {
    const result = await createModifierBox();
    if (!result) {
      console.error('Failed to create modifier box');
      return;
    }
    modifierBox = getModifierBoxElement();
  } else {
    if (!document.body.contains(modifierBox)) {
      document.body.appendChild(modifierBox);
    }

    modifierBox.style.setProperty('display', 'block', 'important');
    setModifierBoxVisible(true);

    const currentTop = parseInt(modifierBox.style.top) || 0;
    const currentLeft = parseInt(modifierBox.style.left) || 0;

    if (
      currentTop <= 0 ||
      currentLeft <= 0 ||
      currentLeft > window.innerWidth ||
      currentTop > window.innerHeight
    ) {
      modifierBox.style.top = '20px';
      modifierBox.style.left = '20px';
    }
    modifierBox.style.right = 'auto';
    modifierBox.style.bottom = 'auto';

    if (window.ModifierBoxThemeManager) {
      window.ModifierBoxThemeManager.updateTheme(modifierBox);
      window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);

      setTimeout(() => {
        if (modifierBox) {
          window.ModifierBoxThemeManager.updateTheme(modifierBox);
          window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);
        }
      }, 100);
    }
  }

  if (modifierBox && window.ModifierBoxRowManager) {
    // Rows are self-managing now; no active selection to sync
  }
}

function hideModifierBox(): void {
  const modifierBox = getModifierBoxElement();
  if (modifierBox) {
    modifierBox.style.setProperty('display', 'none', 'important');
    setModifierBoxVisible(false);
  }
}

function clearAllModifiers(): void {
  const modifierBox = getModifierBoxElement();
  if (!modifierBox) {
    console.error('Cannot clear saved rolls - modifierBox is null');
    return;
  }

  if (
    window.ModifierBoxRowManager &&
    window.ModifierBoxRowManager.resetAllRows
  ) {
    window.ModifierBoxRowManager.resetAllRows(modifierBox);
  } else {
    console.error('ModifierBoxRowManager.resetAllRows not available');
  }
}

export const create = createModifierBox;
export const show = showModifierBox;
export const hide = hideModifierBox;
export const isVisible = isModifierBoxVisibleFunc;
export const getElement = getModifierBoxElement;
export const updateSelectedModifier = updateSelectedModifierWrapper;
export const isInitialized = isModifierBoxInitialized;
export const updateTheme = updateThemeWrapper;
export const forceThemeRefresh = forceThemeRefreshWrapper;
export { syncGlobalVars };
export const clearAll = clearAllModifiers;
export { resetState };

export default {
  create: createModifierBox,
  show: showModifierBox,
  hide: hideModifierBox,
  isVisible: isModifierBoxVisibleFunc,
  getElement: getModifierBoxElement,
  updateSelectedModifier: updateSelectedModifierWrapper,
  isInitialized: isModifierBoxInitialized,
  updateTheme: updateThemeWrapper,
  forceThemeRefresh: forceThemeRefreshWrapper,
  syncGlobalVars,
  clearAll: clearAllModifiers,
  resetState,
};

if (typeof window !== 'undefined') {
  if (window.ModifierBox && typeof window.jest === 'undefined') {
    // ModifierBox module already loaded, skipping re-initialization
  } else {
    window.ModifierBox = {
      create: createModifierBox,
      show: showModifierBox,
      hide: hideModifierBox,
      isVisible: isModifierBoxVisibleFunc,
      getElement: getModifierBoxElement,
      updateSelectedModifier: updateSelectedModifierWrapper,
      isInitialized: isModifierBoxInitialized,
      updateTheme: updateThemeWrapper,
      forceThemeRefresh: forceThemeRefreshWrapper,
      syncGlobalVars,
      clearAll: clearAllModifiers,
      resetState,
    };
  }
}
