'use strict';

/**
 * Modifier Settings — DEPRECATED
 *
 * This module previously managed active modifier persistence. Modifiers have
 * been replaced by saved roll formulas (managed by rowManager.ts). These
 * functions are retained as no-ops for backward compatibility with any
 * remaining callers during the transition.
 */

export const saveModifierSettings = (): void => {};
export const loadModifierSettings = (): false => false;
export const updateModifierSettings = (): void => {};
export const clearAllModifierSettings = (): void => {};

const PixelsSessionStorage = {
  saveModifierSettings,
  loadModifierSettings,
  updateModifierSettings,
  clearAllModifierSettings,
};

export default PixelsSessionStorage;

if (typeof window !== 'undefined') {
  window.PixelsSessionStorage = PixelsSessionStorage;
  window.saveModifierSettings = saveModifierSettings;
  window.loadModifierSettings = loadModifierSettings;
  window.updateModifierSettings = updateModifierSettings;
  window.clearAllModifierSettings = clearAllModifierSettings;
}
