'use strict';

/**
 * Modifier Settings Management for Pixels Roll20 Extension
 * Handles saving and loading of modifier settings using persistent storage
 */

// Local Storage Functions (persistent storage)
export const saveModifierSettings = () => {
  try {
    const settings = {
      modifier: window.pixelsModifier,
      modifierName: window.pixelsModifierName,
      lastUpdated: Date.now(),
    };
    localStorage.setItem('pixels_roll20_settings', JSON.stringify(settings));
    console.log('Saved modifier settings to localStorage');
  } catch (error) {
    console.log('Error saving modifier settings:', error);
  }
};

export const loadModifierSettings = () => {
  try {
    const stored = localStorage.getItem('pixels_roll20_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      window.pixelsModifier = settings.modifier || '0';
      window.pixelsModifierName = settings.modifierName || 'Modifier 1';
      console.log(
        `Loaded modifier settings: ${window.pixelsModifier}, ${window.pixelsModifierName}`
      );
      return true;
    }
  } catch (error) {
    console.log('Error loading modifier settings:', error);
  }
  return false;
};

export const updateModifierSettings = (modifier, modifierName) => {
  window.pixelsModifier = modifier || '0';
  window.pixelsModifierName = modifierName || 'Modifier 1';
  saveModifierSettings();
};

export const clearAllModifierSettings = () => {
  try {
    localStorage.removeItem('pixels_roll20_settings');
    window.pixelsModifier = '0';
    window.pixelsModifierName = 'Modifier 1';
    console.log('Cleared all modifier settings from localStorage');
  } catch (error) {
    console.log('Error clearing modifier settings:', error);
  }
};

// Default export with all functions
const PixelsSessionStorage = {
  saveModifierSettings,
  loadModifierSettings,
  updateModifierSettings,
  clearAllModifierSettings,
};

export default PixelsSessionStorage;

// Legacy global exports for backward compatibility (temporary)
if (typeof window !== 'undefined') {
  window.PixelsSessionStorage = PixelsSessionStorage;
  window.saveModifierSettings = saveModifierSettings;
  window.loadModifierSettings = loadModifierSettings;
  window.updateModifierSettings = updateModifierSettings;
  window.clearAllModifierSettings = clearAllModifierSettings;
}
