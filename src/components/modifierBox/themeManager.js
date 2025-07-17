'use strict';

//
// Theme Manager Module - Handles styling and theme updates for the modifier box
//

import { loadMultipleCSS } from '../../utils/cssLoader.js';
import { getThemeColors, onThemeChange } from '../../utils/themeDetector.js';

// Theme observer instance
let themeObserver = null;

function addModifierBoxStyles() {
  // Check if CSSLoader is available
  if (!loadMultipleCSS) {
    console.error(
      'CSSLoader utility not found. Loading inline styles as fallback.'
    );
    addInlineStyles();
    return;
  }

  // Define CSS files to load
  const cssFiles = [
    {
      path: 'components/modifierBox/styles/modifierBox.css',
      id: 'pixels-modifier-box-base-styles',
    },
    {
      path: 'components/modifierBox/styles/minimized.css',
      id: 'pixels-modifier-box-minimized-styles',
    },
    {
      path: 'components/modifierBox/styles/lightTheme.css',
      id: 'pixels-modifier-box-light-theme-styles',
    },
  ];

  // Load all CSS files
  loadMultipleCSS(cssFiles)
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
  const colors = getThemeColors
    ? getThemeColors()
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
}

function startThemeMonitoring(onThemeChangeCallback) {
  if (onThemeChange && !themeObserver) {
    themeObserver = onThemeChange((newTheme, colors) => {
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

// Helper function for force theme refresh
function forceThemeRefresh(modifierBox) {
  // Force an immediate theme refresh
  updateTheme(modifierBox);
}

// Helper function for force element updates
function forceElementUpdates(modifierBox) {
  // Now that we use CSS classes, just re-apply the theme class to ensure proper styling
  if (!modifierBox) {
    return;
  }

  const colors = getThemeColors ? getThemeColors() : { theme: 'dark' };

  // Re-apply theme class to body
  const body = document.body;
  body.classList.remove('roll20-light-theme', 'roll20-dark-theme');
  body.classList.add(`roll20-${colors.theme}-theme`);
}

// Helper function to reset module state (for testing)
function resetState() {
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
}

// Export functions
export const addStyles = addModifierBoxStyles;
export { updateTheme };
export { startThemeMonitoring };
export { stopThemeMonitoring };
export { forceThemeRefresh };
export { forceElementUpdates };
export { resetState };

// Default export for convenience
export default {
  addStyles: addModifierBoxStyles,
  updateTheme,
  startThemeMonitoring,
  stopThemeMonitoring,
  forceThemeRefresh,
  forceElementUpdates,
  resetState,
};

// Legacy global exports for compatibility (temporary)
if (typeof window !== 'undefined') {
  window.ModifierBoxThemeManager = {
    addStyles: addModifierBoxStyles,
    updateTheme,
    startThemeMonitoring,
    stopThemeMonitoring,
    forceThemeRefresh,
    forceElementUpdates,
    resetState,
  };
}
