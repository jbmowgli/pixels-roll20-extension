'use strict';
import { updateTheme as updateThemeFromThemeManager, forceThemeRefresh as forceThemeRefreshFromThemeManager, forceElementUpdates } from './themeManager.js';
import { updateSelectedModifier as updateSelectedModifierFromRowManager, resetAllRows } from './rowManager.js';
import { loadTemplate } from '../../utils/htmlLoader.js';
import { setupModifierBoxComponents, checkDependencies } from './componentInitializer.js';
import { 
  getModifierBoxElement, 
  isModifierBoxVisible, 
  isModifierBoxInitialized,
  setModifierBoxElement,
  setModifierBoxVisible,
  setModifierBoxCreated,
  findExistingModifierBox,
  resetState,
  updateLegacyDefaults,
  ensureModifierBoxInDOM,
  validatePosition
} from './stateManager.js';
import { 
  createModifierBoxElement, 
  processTemplateHTML, 
  extractModifierBoxFromTemplate 
} from './htmlGenerator.js';
function resetStateWrapper() {
  resetState();
}

const getModifierBoxElementWrapper = () => getModifierBoxElement();
const isModifierBoxVisibleFunc = () => isModifierBoxVisible();
const isModifierBoxInitializedWrapper = () => isModifierBoxInitialized();

// Function to update selected modifier using imported function
const updateSelectedModifierWrapper = () => {
  const modifierBox = getModifierBoxElement();
  if (modifierBox) {
    if (window.ModifierBoxRowManager && window.ModifierBoxRowManager.updateSelectedModifier) {
      window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
    } else if (typeof updateSelectedModifierFromRowManager === 'function') {
      updateSelectedModifierFromRowManager(modifierBox);
    }
  }
};

// Function to update theme using imported function
const updateThemeWrapper = () => {
  const modifierBox = getModifierBoxElement();
  if (modifierBox) {
    if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.updateTheme) {
      window.ModifierBoxThemeManager.updateTheme(modifierBox);
    } else if (typeof updateThemeFromThemeManager === 'function') {
      updateThemeFromThemeManager(modifierBox);
    }
  }
};

// Function to force theme refresh using imported functions
const forceThemeRefreshWrapper = () => {
  const modifierBox = getModifierBoxElement();
  if (modifierBox) {
    if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.forceThemeRefresh) {
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

const syncGlobalVars = () => {
  const modifierBox = getModifierBoxElement();
  if (modifierBox) {
    if (window.ModifierBoxRowManager && window.ModifierBoxRowManager.updateSelectedModifier) {
      window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
    } else if (typeof updateSelectedModifierFromRowManager === 'function') {
      updateSelectedModifierFromRowManager(modifierBox);
    }
  }
};

async function createModifierBox() {
  const hasThemeManager = (window.ModifierBoxThemeManager && 
     typeof window.ModifierBoxThemeManager.addStyles === 'function');
     
  const hasDragHandler = (window.ModifierBoxDragHandler && 
     typeof window.ModifierBoxDragHandler.setupDragFunctionality === 'function');
     
  const hasRowManager = (window.ModifierBoxRowManager && 
     typeof window.ModifierBoxRowManager.setupModifierRowLogic === 'function');

  if (!hasThemeManager || !hasDragHandler || !hasRowManager) {
    console.error('Required modules not loaded. Make sure all modifier box modules are included.');
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

      const firstNameInput = existingBox.querySelector('.modifier-name');
      if (
        firstNameInput &&
        (firstNameInput.value === 'None' || firstNameInput.value === 'D20')
      ) {
        firstNameInput.value = 'Modifier';
        firstNameInput.placeholder = 'Modifier';

        if (typeof window.pixelsModifierName !== 'undefined') {
          window.pixelsModifierName = 'Modifier';
        }
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
        'src/components/modifierBox/modifierBox.html',
        'modifierBox'
      );

      const processedHTML = htmlTemplate.replace('{{logoUrl}}', logoUrl);

      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = processedHTML;

      const newModifierBox = tempContainer.firstElementChild;
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

  function createModifierBoxFallback() {
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
                    <img src="${logoUrl}" alt="Pixels" class="pixels-logo"> Modifiers
                </span>
                <div class="pixels-controls">
                    <button class="add-modifier-btn" type="button" title="Add Row">Add</button>
                    <button class="clear-all-btn" type="button" title="Clear All">Clear All</button>
                    <button class="pixels-minimize" title="Minimize">−</button>
                </div>
            </div>
            <div class="pixels-content">
                <div class="modifier-row">
                    <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
                    <input type="radio" name="modifier-select" value="0" class="modifier-radio" id="mod-0" checked>
                    <input type="text" class="modifier-name" placeholder="Modifier" value="Modifier" data-index="0">
                    <input type="number" class="modifier-value" value="0" min="-99" max="99" data-index="0">
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



  function setupCleanupHandlers() {
    window.addEventListener('beforeunload', () => {
      if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.stopThemeMonitoring) {
        window.ModifierBoxThemeManager.stopThemeMonitoring();
      } else if (typeof stopThemeMonitoring === 'function') {
        stopThemeMonitoring();
      }
    });
  }

  async function showModifierBox() {
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
          window.ModifierBoxThemeManager.updateTheme(modifierBox);
          window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);
        }, 100);
      }
    }

    if (modifierBox && window.ModifierBoxRowManager) {
      window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
    }
  }

  function hideModifierBox() {
    const modifierBox = getModifierBoxElement();
    if (modifierBox) {
      modifierBox.style.setProperty('display', 'none', 'important');
      setModifierBoxVisible(false);
    } else {
      console.error('Cannot hide - modifierBox is null');
    }
  }

  function clearAllModifiers() {
    if (!modifierBox) {
      console.error('Cannot clear modifiers - modifierBox is null');
      return;
    }

    if (typeof window.clearAllModifierSettings === 'function') {
      window.clearAllModifierSettings();
    }

    if (
      window.ModifierBoxRowManager &&
      window.ModifierBoxRowManager.resetAllRows
    ) {
      const updateCallback = () => {
        if (window.ModifierBoxRowManager.updateSelectedModifier) {
          window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
        }
      };
      window.ModifierBoxRowManager.resetAllRows(modifierBox, updateCallback);
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
