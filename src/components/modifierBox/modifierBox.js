'use strict';

//
// Floating Modifier Box Module - Singleton Pattern
// Refactored to use modular components for better maintainability
//
import { addStyles, updateTheme as updateThemeFromThemeManager, startThemeMonitoring, stopThemeMonitoring, forceThemeRefresh as forceThemeRefreshFromThemeManager, forceElementUpdates } from './themeManager.js';
import { setupDragFunctionality } from './dragHandler.js';
import { setupModifierRowLogic, updateSelectedModifier as updateSelectedModifierFromRowManager, loadModifierRows, resetAllRows } from './rowManager.js';
import { loadTemplate } from '../../utils/htmlLoader.js';

// Singleton instance v// Module initialization code ends here
console.log(
  'ModifierBox module initialized as singleton with modular components'
);

// Helper function to reset module state (for testing)
function resetState() {
  // Remove existing element from DOM if it exists
  if (modifierBox && modifierBox.parentNode) {
    modifierBox.parentNode.removeChild(modifierBox);
  }
  
  // Also remove any other modifier boxes that might exist in DOM
  const existingBoxes = document.querySelectorAll('#pixels-modifier-box, .PIXELS_EXTENSION_BOX_FIND_ME');
  existingBoxes.forEach(box => {
    if (box.parentNode) {
      box.parentNode.removeChild(box);
    }
  });
  
  modifierBox = null;
  modifierBoxVisible = false;
  modifierBoxCreated = false;
  // Note: moduleInitialized stays true since the module itself is still loaded
}

// Singleton instance variables
let modifierBox = null;
let modifierBoxVisible = false;
let modifierBoxCreated = false; // Tracks if modifier box has been created

// Module is always initialized when loaded (this never changes)
const moduleInitialized = true;

// Helper functions for the module API
const getModifierBoxElement = () => modifierBox;
const isModifierBoxVisibleFunc = () => modifierBoxVisible;
const isModifierBoxInitialized = () => moduleInitialized;

// Function to update selected modifier using imported function
const updateSelectedModifierWrapper = () => {
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
    if (modifierBox) {
      return modifierBox;
    }

    // Check if an existing modifier box exists in the DOM
    const existingBox = document.getElementById('pixels-modifier-box');
    if (existingBox) {
      modifierBox = existingBox;
      modifierBoxVisible = existingBox.style.display !== 'none';

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

      setupModifierBoxComponents(); // Setup all components
      modifierBoxCreated = true;
      return modifierBox;
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
      modifierBox = tempContainer.firstElementChild;

      // Setup all components
      setupModifierBoxComponents();

      document.body.appendChild(modifierBox);
      modifierBoxVisible = true;
      modifierBoxCreated = true;

      return modifierBox;
    } catch (error) {
      console.error('Failed to load HTML template:', error);
      return createModifierBoxFallback();
    }
  }

  // Fallback function for inline HTML creation
  function createModifierBoxFallback() {
    // Create the floating box
    modifierBox = document.createElement('div');
    modifierBox.id = 'pixels-modifier-box';
    modifierBox.setAttribute('data-testid', 'pixels-modifier-box');
    modifierBox.className = 'PIXELS_EXTENSION_BOX_FIND_ME';

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

    modifierBox.innerHTML = `
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
    setupModifierBoxComponents();

    document.body.appendChild(modifierBox);
    modifierBoxVisible = true;
    modifierBoxCreated = true;

    console.log('Modifier box created with fallback method and added to page');
    return modifierBox;
  }

  function setupModifierBoxComponents() {
    if (!modifierBox) {
      console.error('setupModifierBoxComponents: modifierBox is null');
      return;
    }

    // Check if already setup to prevent duplicate event listeners
    if (modifierBox.hasAttribute('data-components-setup')) {
      console.log('Components already setup, skipping');
      return;
    }

    // Add CSS styles using theme manager (prioritize global for testing)
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

    // Setup drag functionality (prioritize global for testing)
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

    // Set fixed position - top left corner
    modifierBox.style.top = '20px';
    modifierBox.style.left = '60px';
    modifierBox.style.right = 'auto';

    // Add minimize functionality
    const minimizeBtn = modifierBox.querySelector('.pixels-minimize');

    // Add clear all functionality
    const clearAllBtn = modifierBox.querySelector('.clear-all-btn');

    if (clearAllBtn) {
      console.log('Clear All button found, adding event listener');
      clearAllBtn.addEventListener('click', e => {
        console.log('Clear All button clicked');
        e.preventDefault();
        e.stopPropagation();

        clearAllModifiers();
      });
    } else {
      console.error('Clear All button not found!');
    }

    if (minimizeBtn) {
      console.log('Minimize button found, adding event listener');
      minimizeBtn.addEventListener('click', e => {
        console.log('Minimize button clicked');
        e.preventDefault();
        e.stopPropagation();

        const isCurrentlyMinimized =
          modifierBox.classList.contains('minimized');

        if (!isCurrentlyMinimized) {
          // Store current dimensions before minimizing
          const rect = modifierBox.getBoundingClientRect();
          modifierBox.setAttribute('data-original-width', rect.width);
          modifierBox.setAttribute('data-original-height', rect.height);

          // Minimize
          modifierBox.classList.add('minimized');
          // Force the minimized dimensions to override any inline styles
          modifierBox.style.setProperty('width', '200px', 'important');
          modifierBox.style.setProperty('min-width', '200px', 'important');
          modifierBox.style.setProperty('max-width', '200px', 'important');
          modifierBox.style.setProperty('height', 'auto', 'important');
          modifierBox.style.setProperty('min-height', 'auto', 'important');
          minimizeBtn.textContent = '+';
          minimizeBtn.title = 'Restore';
          console.log(
            'Minimized - stored dimensions:',
            rect.width,
            'x',
            rect.height
          );
        } else {
          // Restore original dimensions
          const originalWidth = modifierBox.getAttribute('data-original-width');
          const originalHeight = modifierBox.getAttribute(
            'data-original-height'
          );

          modifierBox.classList.remove('minimized');

          // Clear forced minimized styles
          modifierBox.style.removeProperty('min-width');
          modifierBox.style.removeProperty('max-width');
          modifierBox.style.removeProperty('min-height');

          // Restore dimensions if they were stored
          if (originalWidth && originalHeight) {
            modifierBox.style.setProperty(
              'width',
              `${originalWidth}px`,
              'important'
            );
            modifierBox.style.setProperty(
              'height',
              `${originalHeight}px`,
              'important'
            );
            console.log(
              'Restored dimensions:',
              originalWidth,
              'x',
              originalHeight
            );
          }

          minimizeBtn.textContent = '−';
          minimizeBtn.title = 'Minimize';
        }
      });
    } else {
      console.error('Minimize button not found!');
    }

    // Setup row management with callback (prioritize global for testing)
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

    // Try to load saved modifier rows from localStorage (prioritize global for testing)
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

    // Setup drag and drop for rows (if available)
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

    // Start theme monitoring (prioritize global for testing)
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

    // Apply initial theme immediately (prioritize global for testing)
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

    // Update header to show initial modifier (prioritize global for testing)
    try {
      if (window.ModifierBoxRowManager && window.ModifierBoxRowManager.updateSelectedModifier) {
        window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
      } else if (typeof updateSelectedModifierFromRowManager === 'function') {
        updateSelectedModifierFromRowManager(modifierBox);
      }
    } catch (error) {
      console.error('Error updating selected modifier:', error);
    }

    // Mark as setup
    modifierBox.setAttribute('data-components-setup', 'true');
    
    // Setup cleanup handlers for page unload
    setupCleanupHandlers();
    
    console.log('Components setup completed');
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
    if (!modifierBox) {
      const result = await createModifierBox();
      if (!result) {
        console.error('Failed to create modifier box');
        return;
      }
    } else {
      console.log('Modifier box already exists, showing it');
      
      // Ensure it's in the DOM
      if (!document.body.contains(modifierBox)) {
        document.body.appendChild(modifierBox);
      }
      
      modifierBox.style.setProperty('display', 'block', 'important');
      modifierBoxVisible = true;

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
    if (modifierBox) {
      console.log('Hiding modifier box');
      // Use setProperty with important to ensure it overrides any CSS
      modifierBox.style.setProperty('display', 'none', 'important');
      modifierBoxVisible = false;
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
