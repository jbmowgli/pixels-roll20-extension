/**
 * State Manager Module
 * Manages singleton state and lifecycle for the modifier box
 */

'use strict';

// Singleton instance variables
let modifierBox = null;
let modifierBoxVisible = false;
let modifierBoxCreated = false;

// Module is always initialized when loaded (this never changes)
const moduleInitialized = true;

// Get the modifier box element
export function getModifierBoxElement() {
  return modifierBox;
}

// Check if modifier box is visible
export function isModifierBoxVisible() {
  return modifierBoxVisible;
}

// Check if module is initialized
export function isModifierBoxInitialized() {
  return moduleInitialized;
}

// Check if modifier box has been created
export function isModifierBoxCreated() {
  return modifierBoxCreated;
}

// Set the modifier box element
export function setModifierBoxElement(element) {
  modifierBox = element;
  return modifierBox;
}

// Set visibility state
export function setModifierBoxVisible(visible) {
  modifierBoxVisible = Boolean(visible);
  return modifierBoxVisible;
}

// Set created state
export function setModifierBoxCreated(created) {
  modifierBoxCreated = Boolean(created);
  return modifierBoxCreated;
}

// Check if modifier box already exists in DOM
export function findExistingModifierBox() {
  const existingBox = document.getElementById('pixels-modifier-box');
  if (existingBox) {
    modifierBox = existingBox;
    modifierBoxVisible = existingBox.style.display !== 'none';
    return existingBox;
  }
  return null;
}

// Reset module state (for testing)
export function resetState() {
  // Remove existing element from DOM if it exists
  if (modifierBox && modifierBox.parentNode) {
    modifierBox.parentNode.removeChild(modifierBox);
  }
  
  // Also remove any other modifier boxes that might exist in DOM
  const existingBoxes = document.querySelectorAll('#pixels-modifier-box, .PIXELS_EXTENSION_BOX_FIND_ME');
  existingBoxes.forEach(box => {
    if (box.parentNode) {
      box.parentNode.removeChild(box);
    }
  });
  
  modifierBox = null;
  modifierBoxVisible = false;
  modifierBoxCreated = false;
  // Note: moduleInitialized stays true since the module itself is still loaded
}

// Update first row default values to match current standards (migration helper)
export function updateLegacyDefaults(modifierBox) {
  if (!modifierBox) return;

  const firstNameInput = modifierBox.querySelector('.modifier-name');
  if (
    firstNameInput &&
    (firstNameInput.value === 'None' || firstNameInput.value === 'D20')
  ) {
    firstNameInput.value = 'Modifier';
    firstNameInput.placeholder = 'Modifier';

    // Update global variable too
    if (typeof window.pixelsModifierName !== 'undefined') {
      window.pixelsModifierName = 'Modifier';
    }
  }
}

// Ensure modifier box is in DOM and visible
export function ensureModifierBoxInDOM(modifierBox) {
  if (!modifierBox) return false;

  // Ensure it's in the DOM
  if (!document.body.contains(modifierBox)) {
    document.body.appendChild(modifierBox);
  }
  
  modifierBox.style.setProperty('display', 'block', 'important');
  setModifierBoxVisible(true);

  return true;
}

export function validatePosition(modifierBox) {
  if (!modifierBox) return;

  const currentTop = parseInt(modifierBox.style.top) || 0;
  const currentLeft = parseInt(modifierBox.style.left) || 0;

  if (
    currentTop <= 0 ||
    currentLeft <= 0 ||
    currentLeft > window.innerWidth ||
    currentTop > window.innerHeight
  ) {
    modifierBox.style.top = '20px';
    modifierBox.style.left = '20px';
  }
  modifierBox.style.right = 'auto';
  modifierBox.style.bottom = 'auto';
}

// Get current state summary
export function getStateSummary() {
  return {
    hasElement: !!modifierBox,
    isVisible: modifierBoxVisible,
    isCreated: modifierBoxCreated,
    isInitialized: moduleInitialized,
    elementId: modifierBox?.id || null,
    elementInDOM: modifierBox ? document.body.contains(modifierBox) : false,
  };
}

// Export for legacy compatibility
const StateManager = {
  getModifierBoxElement,
  isModifierBoxVisible,
  isModifierBoxInitialized,
  isModifierBoxCreated,
  setModifierBoxElement,
  setModifierBoxVisible,
  setModifierBoxCreated,
  findExistingModifierBox,
  resetState,
  updateLegacyDefaults,
  ensureModifierBoxInDOM,
  validatePosition,
  getStateSummary,
};

export default StateManager;

// Legacy global exports for compatibility (temporary)
if (typeof window !== 'undefined') {
  window.ModifierBoxStateManager = StateManager;
}
