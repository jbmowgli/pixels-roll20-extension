/**
 * ModifierBoxManager.js
 *
 * Handles showing and hiding the modifier box based on context.
 */

'use strict';

(function () {
  const log = window.log || console.log;

  // Show modifier box (respects popup detection)
  function showModifierBox() {
    // Don't show modifier box in Roll20 popup windows
    if (window.isRoll20PopupWindow && window.isRoll20PopupWindow()) {
      log('Skipping modifier box display - this is a Roll20 popup window');
      return;
    }

    if (typeof window.ModifierBox !== 'undefined') {
      if (!window.ModifierBox.isInitialized()) {
        log('ModifierBox module not initialized yet');
      }
      // Handle async show function
      if (window.ModifierBox.show.constructor.name === 'AsyncFunction') {
        window.ModifierBox.show().catch(error => {
          console.error('Failed to show modifier box:', error);
        });
      } else {
        window.ModifierBox.show();
      }
    } else {
      log('ModifierBox module not loaded');
    }
  }

  // Hide modifier box
  function hideModifierBox() {
    if (typeof window.ModifierBox !== 'undefined') {
      window.ModifierBox.hide();
    } else {
      log('ModifierBox module not loaded');
    }
  }

  // Export functions to global scope
  window.ModifierBoxManager = {
    showModifierBox,
    hideModifierBox,
  };

  // Legacy exports for compatibility
  window.showModifierBox = showModifierBox;
  window.hideModifierBox = hideModifierBox;
})();
