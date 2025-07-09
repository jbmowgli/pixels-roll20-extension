/**
 * StorageManager.js
 * 
 * Handles localStorage operations for modifier settings persistence.
 */

'use strict';

(function() {
  const log = window.log || console.log;

  // Save modifier settings to localStorage
  function saveModifierSettings() {
    try {
      const settings = {
        modifier: window.pixelsModifier,
        modifierName: window.pixelsModifierName,
        lastUpdated: Date.now()
      };
      localStorage.setItem('pixels_roll20_settings', JSON.stringify(settings));
      log('Saved modifier settings to localStorage');
    } catch (error) {
      log('Error saving modifier settings:', error);
    }
  }

  // Load modifier settings from localStorage
  function loadModifierSettings() {
    try {
      const stored = localStorage.getItem('pixels_roll20_settings');
      if (stored) {
        const settings = JSON.parse(stored);
        window.pixelsModifier = settings.modifier || '0';
        window.pixelsModifierName = settings.modifierName || 'Modifier 1';
        log(`Loaded modifier settings: ${window.pixelsModifier}, ${window.pixelsModifierName}`);
        return true;
      }
    } catch (error) {
      log('Error loading modifier settings:', error);
    }
    return false;
  }

  // Update modifier settings
  function updateModifierSettings(modifier, modifierName) {
    window.pixelsModifier = modifier || '0';
    window.pixelsModifierName = modifierName || 'Modifier 1';
    saveModifierSettings();
    log(`Updated modifier settings: ${modifier}, ${modifierName}`);
  }

  // Clear all modifier settings
  function clearAllModifierSettings() {
    try {
      localStorage.removeItem('pixels_roll20_settings');
      window.pixelsModifier = '0';
      window.pixelsModifierName = 'Modifier 1';
      log('Cleared all modifier settings from localStorage');
    } catch (error) {
      log('Error clearing modifier settings:', error);
    }
  }

  // Export functions to global scope
  window.StorageManager = {
    saveModifierSettings,
    loadModifierSettings,
    updateModifierSettings,
    clearAllModifierSettings
  };

  // Legacy exports for compatibility
  window.saveModifierSettings = saveModifierSettings;
  window.loadModifierSettings = loadModifierSettings;
  window.updateModifierSettings = updateModifierSettings;
  window.clearAllModifierSettings = clearAllModifierSettings;

})();
