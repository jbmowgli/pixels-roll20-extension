/**
 * StorageManager.js
 *
 * Handles localStorage operations for modifier settings persistence.
 */

'use strict';

import {
  saveModifierSettings,
  loadModifierSettings,
  updateModifierSettings,
  clearAllModifierSettings,
} from '../../utils/modifierSettings.js';

// Re-export all functions from modifierSettings for coordination
export {
  saveModifierSettings,
  loadModifierSettings,
  updateModifierSettings,
  clearAllModifierSettings,
};

// Default export with all functions
const StorageManager = {
  saveModifierSettings,
  loadModifierSettings,
  updateModifierSettings,
  clearAllModifierSettings,
};

export default StorageManager;

// Legacy global exports for backward compatibility (temporary)
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
  window.saveModifierSettings = saveModifierSettings;
  window.loadModifierSettings = loadModifierSettings;
  window.updateModifierSettings = updateModifierSettings;
  window.clearAllModifierSettings = clearAllModifierSettings;
}
