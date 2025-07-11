'use strict';

//
// Floating Modifier Box Module - Singleton Pattern
// Refactored to use modular components for better maintainability
//
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

// Singleton instance v// Module initialization code ends here
console.log(
  'ModifierBox module initialized as singleton with modular components'
);

// Helper function to reset module state (for testing)
function resetStateWrapper() {
  resetState();
}

// Helper functions for the module API
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

// Function to sync global variables
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
  // Check for required dependencies - for test environment we need to check window objects
  // since the imports might not be mockable in the same way
  const hasThemeManager = (window.ModifierBoxThemeManager && 
     typeof window.ModifierBoxThemeManager.addStyles === 'function');
     
  const hasDragHandler = (window.ModifierBoxDragHandler && 
     typeof window.ModifierBoxDragHandler.setupDragFunctionality === 'function');
     
  const hasRowManager = (window.ModifierBoxRowManager && 
     typeof window.ModifierBoxRowManager.setupModifierRowLogic === 'function');

  // If testing environment is missing required dependencies, return null
  if (!hasThemeManager || !hasDragHandler || !hasRowManager) {
    console.error('Required modules not loaded. Make sure all modifier box modules are included.');
    return null;
  }
  
  // Singleton check - ensure only one instance exists
  const modifierBox = getModifierBoxElement();
  if (modifierBox) {
    return modifierBox;
  }

    // Check if an existing modifier box exists in the DOM
    const existingBox = document.getElementById('pixels-modifier-box');
    if (existingBox) {
      setModifierBoxElement(existingBox);
      setModifierBoxVisible(existingBox.style.display !== 'none');

      // Update the first row's default values to match current standards
      const firstNameInput = existingBox.querySelector('.modifier-name');
      if (
        firstNameInput &&
        (firstNameInput.value === 'None' || firstNameInput.value === 'D20')
      ) {
        firstNameInput.value = 'Modifier';
        firstNameInput.placeholder = 'Modifier';

        // Update global variable too
        if (typeof window.pixelsModifierName !== 'undefined') {
          window.pixelsModifierName = 'Modifier';
        }
      }

      setupModifierBoxComponents(existingBox, clearAllModifiers); // Setup all components
      setModifierBoxCreated(true);
      return existingBox;
    }

    try {
      // Load HTML template
      if (!loadTemplate) {
        console.error(
          'HTMLLoader module not available. Falling back to inline HTML.'
        );
        return createModifierBoxFallback();
      }

      // Get logo URL safely - handle both extension and test environments
      let logoUrl = 'assets/images/logo-128.png'; // fallback
      try {
        if (
          typeof chrome !== 'undefined' &&
          chrome.runtime &&
          chrome.runtime.getURL
        ) {
          logoUrl = chrome.runtime.getURL('assets/images/logo-128.png');
        }
      } catch {
        console.log('Using fallback logo URL (not in extension context)');
      }

      // Load the HTML template
      const htmlTemplate = await loadTemplate(
        'src/components/modifierBox/modifierBox.html',
        'modifierBox'
      );

      // Replace logo URL placeholder
      const processedHTML = htmlTemplate.replace('{{logoUrl}}', logoUrl);

      // Create temporary container to parse HTML
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = processedHTML;

      // Get the modifier box element from the template
      const newModifierBox = tempContainer.firstElementChild;
      setModifierBoxElement(newModifierBox);

      // Setup all components
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

  // Fallback function for inline HTML creation
  function createModifierBoxFallback() {
    // Create the floating box
    const newModifierBox = document.createElement('div');
    newModifierBox.id = 'pixels-modifier-box';
    newModifierBox.setAttribute('data-testid', 'pixels-modifier-box');
    newModifierBox.className = 'PIXELS_EXTENSION_BOX_FIND_ME';
    setModifierBoxElement(newModifierBox);

    // Get logo URL safely - handle both extension and test environments
    let logoUrl = 'assets/images/logo-128.png'; // fallback
    try {
      if (
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.getURL
      ) {
        logoUrl = chrome.runtime.getURL('assets/images/logo-128.png');
      }
    } catch {
      console.log('Using fallback logo URL (not in extension context)');
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

    // Setup all components
    setupModifierBoxComponents(newModifierBox, clearAllModifiers);

    document.body.appendChild(newModifierBox);
    setModifierBoxVisible(true);
    setModifierBoxCreated(true);

    console.log('Modifier box created with fallback method and added to page');
    return newModifierBox;
  }



  function setupCleanupHandlers() {
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.stopThemeMonitoring) {
        window.ModifierBoxThemeManager.stopThemeMonitoring();
      } else if (typeof stopThemeMonitoring === 'function') {
        stopThemeMonitoring();
      }
    });
  }

  async function showModifierBox() {
    console.log('showModifierBox called');

    // Singleton check
    let modifierBox = getModifierBoxElement();
    if (!modifierBox) {
      const result = await createModifierBox();
      if (!result) {
        console.error('Failed to create modifier box');
        return;
      }
      modifierBox = getModifierBoxElement(); // Get the newly created element
    } else {
      console.log('Modifier box already exists, showing it');
      
      // Ensure it's in the DOM
      if (!document.body.contains(modifierBox)) {
        document.body.appendChild(modifierBox);
      }
      
      modifierBox.style.setProperty('display', 'block', 'important');
      setModifierBoxVisible(true);

      // Only reset position if it's not been set or if it's at 0,0 (which means lost)
      const currentTop = parseInt(modifierBox.style.top) || 0;
      const currentLeft = parseInt(modifierBox.style.left) || 0;

      if (
        currentTop <= 0 ||
        currentLeft <= 0 ||
        currentLeft > window.innerWidth ||
        currentTop > window.innerHeight
      ) {
        console.log('Resetting position - current position invalid');
        modifierBox.style.top = '20px';
        modifierBox.style.left = '20px';
      } else {
        console.log('Keeping existing position:', currentLeft, currentTop);
      }
      modifierBox.style.right = 'auto';
      modifierBox.style.bottom = 'auto';

      // Force theme update to ensure correct colors are applied
      if (window.ModifierBoxThemeManager) {
        window.ModifierBoxThemeManager.updateTheme(modifierBox);
        // Also force element-specific updates
        window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);

        // Apply theme again after a short delay to ensure CSS is fully loaded
        setTimeout(() => {
          console.log('Applying delayed theme update...');
          window.ModifierBoxThemeManager.updateTheme(modifierBox);
          window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);
        }, 100);
      }
    }

    // Sync global state with current UI values (not the other way around)
    if (modifierBox && window.ModifierBoxRowManager) {
      window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
    }
  }

  function hideModifierBox() {
    console.log('hideModifierBox called');
    const modifierBox = getModifierBoxElement();
    if (modifierBox) {
      console.log('Hiding modifier box');
      // Use setProperty with important to ensure it overrides any CSS
      modifierBox.style.setProperty('display', 'none', 'important');
      setModifierBoxVisible(false);
      console.log(
        'Modifier box hidden successfully - display set to:',
        modifierBox.style.display
      );
    } else {
      console.error('Cannot hide - modifierBox is null');
    }
  }

  function clearAllModifiers() {
    console.log('clearAllModifiers called');

    if (!modifierBox) {
      console.error('Cannot clear modifiers - modifierBox is null');
      return;
    }

    // Clear localStorage
    if (typeof window.clearAllModifierSettings === 'function') {
      window.clearAllModifierSettings();
    }

    // Reset all rows using rowManager
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

    console.log('All modifiers cleared successfully');
  }

// Module initialization completed
console.log(
  'ModifierBox module initialized as singleton with modular components'
);

// Export functions
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

// Default export for convenience
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

// Legacy global exports for compatibility (temporary)
if (typeof window !== 'undefined') {
  // For testing environment, always reinitialize to ensure fresh state
  if (window.ModifierBox && typeof window.jest === 'undefined') {
    console.warn(
      'ModifierBox module already loaded, skipping re-initialization'
    );
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
