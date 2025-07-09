'use strict';

//
// Floating Modifier Box Module - Singleton Pattern
// Refactored to use modular components for better maintainability
//
(function () {
  // Singleton instance variables
  let modifierBox = null;
  let isModifierBoxVisible = false;
  let isInitialized = false;

  // Prevent multiple initialization
  if (window.ModifierBox) {
    console.warn(
      'ModifierBox module already loaded, skipping re-initialization'
    );
    return;
  }

  // Export functions to global scope
  window.ModifierBox = {
    create: createModifierBox,
    show: showModifierBox,
    hide: hideModifierBox,
    isVisible: () => isModifierBoxVisible,
    getElement: () => modifierBox,
    updateSelectedModifier: () => {
      if (window.ModifierBoxRowManager && modifierBox) {
        window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
      }
    },
    isInitialized: () => isInitialized,
    updateTheme: () => {
      if (window.ModifierBoxThemeManager && modifierBox) {
        window.ModifierBoxThemeManager.updateTheme(modifierBox);
      }
    },
    forceThemeRefresh: () => {
      if (window.ModifierBoxThemeManager && modifierBox) {
        window.ModifierBoxThemeManager.forceThemeRefresh(modifierBox);
        window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);
      }
    },
    syncGlobalVars: () => {
      // Force sync global variables with current modifier values
      if (modifierBox && window.ModifierBoxRowManager) {
        window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
      }
    },
    clearAll: clearAllModifiers,
  };

  async function createModifierBox() {
    // Check if required modules are available
    if (
      !window.ModifierBoxThemeManager ||
      !window.ModifierBoxDragHandler ||
      !window.ModifierBoxRowManager
    ) {
      console.error(
        'Required modules not loaded. Make sure all modifier box modules are included.'
      );
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
      isModifierBoxVisible = existingBox.style.display !== 'none';

      // Update the first row's default values to match current standards
      const firstNameInput = existingBox.querySelector('.modifier-name');
      if (
        firstNameInput &&
        (firstNameInput.value === 'None' || firstNameInput.value === 'D20')
      ) {
        firstNameInput.value = 'Modifier 1';
        firstNameInput.placeholder = 'Modifier 1';

        // Update global variable too
        if (typeof window.pixelsModifierName !== 'undefined') {
          window.pixelsModifierName = 'Modifier 1';
        }
      }

      setupModifierBoxComponents(); // Setup all components
      isInitialized = true;
      return modifierBox;
    }

    try {
      // Load HTML template
      if (!window.HTMLLoader) {
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
      } catch (error) {
        console.log('Using fallback logo URL (not in extension context)');
      }

      // Load the HTML template
      const htmlTemplate = await window.HTMLLoader.loadTemplate(
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
      isModifierBoxVisible = true;
      isInitialized = true;

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
    } catch (error) {
      console.log('Using fallback logo URL (not in extension context)');
    }

    modifierBox.innerHTML = `
            <div class="pixels-header">
                <span class="pixels-title">
                    <img src="${logoUrl}" alt="Pixels" class="pixels-logo"> Dice Modifiers
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
                    <input type="text" class="modifier-name" placeholder="Modifier 1" value="Modifier 1" data-index="0">
                    <input type="number" class="modifier-value" value="0" min="-99" max="99" data-index="0">
                    <button class="remove-row-btn" type="button">×</button>
                </div>
            </div>
            <div class="pixels-resize-handle"></div>
        `;

    // Setup all components
    setupModifierBoxComponents();

    document.body.appendChild(modifierBox);
    isModifierBoxVisible = true;
    isInitialized = true;

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

    // Add CSS styles using theme manager
    window.ModifierBoxThemeManager.addStyles();

    // Setup drag functionality
    window.ModifierBoxDragHandler.setupDragFunctionality(modifierBox);

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
              originalWidth + 'px',
              'important'
            );
            modifierBox.style.setProperty(
              'height',
              originalHeight + 'px',
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

    // Setup row management with callback
    const updateCallback = () =>
      window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);
    window.ModifierBoxRowManager.setupModifierRowLogic(
      modifierBox,
      updateCallback
    );

    // Try to load saved modifier rows from localStorage
    if (window.ModifierBoxRowManager.loadModifierRows) {
      const loaded = window.ModifierBoxRowManager.loadModifierRows(modifierBox, updateCallback);
      if (loaded) {
        console.log('Successfully loaded modifier rows from localStorage');
      } else {
        console.log('No saved modifier rows found, using default');
      }
    }

    // Setup drag and drop for rows (if available)
    if (window.RowDragDrop) {
      // Add drag handles to existing rows that don't have them
      const existingRows = modifierBox.querySelectorAll('.modifier-row');
      existingRows.forEach(row => {
        if (!row.querySelector('.drag-handle')) {
          window.RowDragDrop.addDragHandle(row);
        }
      });

      window.modifierRowDragDrop = new window.RowDragDrop(
        '#pixels-modifier-box .pixels-content',
        '.modifier-row',
        window.ModifierBoxRowManager
      );
      console.log('Row drag and drop initialized');
    } else {
      console.warn('RowDragDrop not available - drag and drop disabled');
    }

    // Start theme monitoring
    window.ModifierBoxThemeManager.startThemeMonitoring((newTheme, colors) => {
      console.log('Theme changed to:', newTheme, colors);
      window.ModifierBoxThemeManager.updateTheme(modifierBox);
    });

    // Apply initial theme immediately
    console.log('Applying initial theme to modifier box...');
    window.ModifierBoxThemeManager.updateTheme(modifierBox);

    // Update header to show initial modifier
    window.ModifierBoxRowManager.updateSelectedModifier(modifierBox);

    // Mark as setup
    modifierBox.setAttribute('data-components-setup', 'true');
    console.log('Components setup completed');
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
      modifierBox.style.setProperty('display', 'block', 'important');
      isModifierBoxVisible = true;

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
      isModifierBoxVisible = false;
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
    if (window.ModifierBoxRowManager && window.ModifierBoxRowManager.resetAllRows) {
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

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.ModifierBoxThemeManager) {
      window.ModifierBoxThemeManager.stopThemeMonitoring();
    }
  });

  // Mark module as initialized
  isInitialized = true;
  console.log(
    'ModifierBox module initialized as singleton with modular components'
  );
})();
