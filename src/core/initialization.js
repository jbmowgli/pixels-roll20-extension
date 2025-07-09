'use strict';

/**
 * Main Initialization and Coordination for Pixels Roll20 Extension
 * Coordinates all the different modules and handles initial setup
 */

(function () {
  // Prevent multiple initializations
  if (typeof window.roll20PixelsLoaded !== 'undefined') {
    return;
  }
  
  window.roll20PixelsLoaded = true;
  
  // Global modifier variables (accessed by modifierBox.js)
  window.pixelsModifier = '0';
  window.pixelsModifierName = 'Modifier 1';
  
  // Global pixels array
  window.pixels = [];

  // Chat message formulas
  // Formula when modifier box is visible (shows modifier details)
  window.pixelsFormulaWithModifier =
    '&{template:default} {{name=#modifier_name}} {{Pixel Die=[[#face_value]]}} {{Modifier=[[#modifier]]}} {{Total=[[#face_value + #modifier]]}}';

  // Formula when modifier box is hidden (simplified display)
  window.pixelsFormulaSimple =
    '&{template:default} {{name=Result}} {{Pixel Dice=[[#result]]}}';

  // Legacy formula variable for backward compatibility
  window.pixelsFormula = window.pixelsFormulaWithModifier;

  // Initialize all modules
  function initializePixelsExtension() {
    console.log('Starting Pixels Roll20 extension');

    // Note: Most functionality is now integrated into roll20.js
    // This initialization mainly handles setup that needs to happen early

    // Send initial status if the function is available
    if (window.sendStatusToExtension) {
      window.sendStatusToExtension();
    }

    // Load modifier settings from localStorage
    console.log('Loading modifier settings from localStorage...');
    if (window.loadModifierSettings) {
      window.loadModifierSettings();
    }

    // Show modifier box by default with a delay to ensure DOM is ready
    console.log('Attempting to show modifier box automatically...');
    setTimeout(() => {
      try {
        if (window.showModifierBox) {
          window.showModifierBox();
          console.log('Modifier box shown successfully on page load');
        }
      } catch (error) {
        console.log('Error showing modifier box: ' + error);
      }
    }, 1000);
  }

  // Wait for all modules to be loaded before initializing
  function waitForModulesAndInitialize() {
    // Since most functionality is now integrated into roll20.js,
    // we only need to check for the essential modules that exist as separate files
    const requiredModules = [
      'PixelsSessionStorage',
      'ThemeDetector',
      'CSSLoader',
      'HTMLLoader'
    ];

    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total
    
    function checkModules() {
      const allLoaded = requiredModules.every(module => window[module] !== undefined);
      
      if (allLoaded) {
        initializePixelsExtension();
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkModules, 100);
      } else {
        console.warn('Some modules failed to load within timeout, initializing anyway');
        // Log which modules are missing for debugging
        requiredModules.forEach(module => {
          if (!window[module]) {
            console.warn(`Missing module: ${module}`);
          }
        });
        initializePixelsExtension();
      }
    }
    
    checkModules();
  }

  // Export initialization function
  window.PixelsInitialization = {
    initializePixelsExtension,
    waitForModulesAndInitialize
  };

  // Start the initialization process
  waitForModulesAndInitialize();
})();
