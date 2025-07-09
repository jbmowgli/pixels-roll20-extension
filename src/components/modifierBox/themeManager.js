'use strict';

//
// Theme Manager Module - Handles styling and theme updates for the modifier box
//
(function () {
  // Theme observer instance
  let themeObserver = null;

  // Export functions to global scope
  window.ModifierBoxThemeManager = {
    addStyles: addModifierBoxStyles,
    updateTheme: updateTheme,
    startThemeMonitoring: startThemeMonitoring,
    stopThemeMonitoring: stopThemeMonitoring,
    forceThemeRefresh: function (modifierBox) {
      // Force an immediate theme refresh
      updateTheme(modifierBox);
    },
    forceElementUpdates: function (modifierBox) {
      // Now that we use CSS classes, just re-apply the theme class to ensure proper styling
      if (!modifierBox) return;
      
      const colors = window.ThemeDetector
        ? window.ThemeDetector.getThemeColors()
        : { theme: 'dark' };

      // Re-apply theme class to body
      const body = document.body;
      body.classList.remove('roll20-light-theme', 'roll20-dark-theme');
      body.classList.add(`roll20-${colors.theme}-theme`);
      
      console.log(`Force updated theme class: roll20-${colors.theme}-theme`);
    },
  };

  function addModifierBoxStyles() {
    // Check if CSSLoader is available
    if (!window.CSSLoader) {
      console.error(
        'CSSLoader utility not found. Loading inline styles as fallback.'
      );
      addInlineStyles();
      return;
    }

    // Define CSS files to load
    const cssFiles = [
      {
        path: 'src/components/modifierBox/styles/modifierBox.css',
        id: 'pixels-modifier-box-base-styles',
      },
      {
        path: 'src/components/modifierBox/styles/minimized.css',
        id: 'pixels-modifier-box-minimized-styles',
      },
      {
        path: 'src/components/modifierBox/styles/lightTheme.css',
        id: 'pixels-modifier-box-light-theme-styles',
      },
    ];

    // Load all CSS files
    window.CSSLoader.loadMultipleCSS(cssFiles)
      .then(() => {
        // CSS files loaded successfully
      })
      .catch(error => {
        console.error(
          'Failed to load CSS files, falling back to inline styles:',
          error
        );
        addInlineStyles();
      });
  }

  // Fallback function for inline styles (keeping the original functionality)
  function addInlineStyles() {
    const styleId = 'pixels-modifier-box-styles-fallback';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
            /* Fallback Base Modifier Box Styles */
            #pixels-modifier-box {
                position: fixed !important;
                z-index: 1000000 !important;
                min-width: 300px !important;
                width: 400px;
                min-height: 120px !important;
                border-radius: 8px !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
                font-family: Arial, sans-serif !important;
                font-size: 14px !important;
                color: #ffffff !important;
                background-color: #2b2b2b !important;
                border: 1px solid #555555 !important;
                resize: none !important;
                display: flex !important;
                flex-direction: column !important;
            }
            /* Additional fallback styles would go here - truncated for brevity */
        `;

    document.head.appendChild(style);
  }

  function updateTheme(modifierBox) {
    if (!modifierBox) {
      return;
    }

    // Get current theme colors
    const colors = window.ThemeDetector
      ? window.ThemeDetector.getThemeColors()
      : {
          theme: 'dark',
          primary: '#4CAF50',
          background: '#2b2b2b',
          text: '#ffffff',
          input: '#333333',
          inputBorder: '#555555',
          button: '#444444',
          border: '#555555',
        };

    // Apply theme class to body element for CSS rules to work
    const body = document.body;
    body.classList.remove('roll20-light-theme', 'roll20-dark-theme');
    body.classList.add(`roll20-${colors.theme}-theme`);
    
    console.log(`Applied theme class: roll20-${colors.theme}-theme`);

    // Let CSS handle the styling now that we have the proper theme class applied
    console.log(`Theme update complete. ${colors.theme} theme applied via CSS classes.`);
  }

  function startThemeMonitoring(onThemeChangeCallback) {
    if (window.ThemeDetector && !themeObserver) {
      themeObserver = window.ThemeDetector.onThemeChange((newTheme, colors) => {
        if (onThemeChangeCallback) {
          onThemeChangeCallback(newTheme, colors);
        }
      });
    }
  }

  function stopThemeMonitoring() {
    if (themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
  }
})();
