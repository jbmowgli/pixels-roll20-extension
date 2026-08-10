/**
 * ModifierBoxManager.ts
 *
 * Handles showing and hiding the modifier box based on context.
 */

'use strict';

import { log } from './Utils';
import { isRoll20PopupWindow } from './PopupDetection';

// Show modifier box (respects popup detection)
export const showModifierBox = (): void => {
  // Don't show modifier box in Roll20 popup windows
  if (isRoll20PopupWindow && isRoll20PopupWindow()) {
    log('Skipping modifier box display - this is a Roll20 popup window');
    return;
  }

  if (typeof window.ModifierBox !== 'undefined') {
    if (!window.ModifierBox.isInitialized()) {
      log('ModifierBox module not initialized yet');
    }
    // Handle async show function
    const result = window.ModifierBox.show();
    if (result && typeof result.catch === 'function') {
      result.catch((error: Error) => {
        console.error('Failed to show modifier box:', error);
      });
    }
  } else {
    log('ModifierBox module not loaded');
  }
};

// Hide modifier box
export const hideModifierBox = (): void => {
  if (typeof window.ModifierBox !== 'undefined') {
    window.ModifierBox.hide();
  } else {
    log('ModifierBox module not loaded');
  }
};

// Default export with all functions
const ModifierBoxManager = {
  showModifierBox,
  hideModifierBox,
};

export default ModifierBoxManager;

// Legacy global exports for backward compatibility (temporary)
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).ModifierBoxManager =
    ModifierBoxManager;
  window.showModifierBox = showModifierBox as unknown as () => Promise<void>;
  window.hideModifierBox = hideModifierBox;
}
