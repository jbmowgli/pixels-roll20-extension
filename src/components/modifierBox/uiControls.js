/**
 * UI Controls Module
 * Handles minimize/maximize and clear all functionality for the modifier box
 */

'use strict';

// Setup minimize/maximize functionality
export function setupMinimizeControls(modifierBox) {
  if (!modifierBox) {
    console.error('setupMinimizeControls: modifierBox is required');
    return;
  }

  const minimizeBtn = modifierBox.querySelector('.pixels-minimize');
  if (!minimizeBtn) {
    console.error('Minimize button not found!');
    return;
  }

  console.log('Minimize button found, adding event listener');
  minimizeBtn.addEventListener('click', e => {
    console.log('Minimize button clicked');
    e.preventDefault();
    e.stopPropagation();

    const isCurrentlyMinimized = modifierBox.classList.contains('minimized');

    if (!isCurrentlyMinimized) {
      minimizeModifierBox(modifierBox, minimizeBtn);
    } else {
      restoreModifierBox(modifierBox, minimizeBtn);
    }
  });
}

// Minimize the modifier box
function minimizeModifierBox(modifierBox, minimizeBtn) {
  // Store current dimensions before minimizing
  const rect = modifierBox.getBoundingClientRect();
  modifierBox.setAttribute('data-original-width', rect.width);
  modifierBox.setAttribute('data-original-height', rect.height);

  // Minimize
  modifierBox.classList.add('minimized');
  // Force the minimized dimensions to override any inline styles
  modifierBox.style.setProperty('width', '200px', 'important');
  modifierBox.style.setProperty('min-width', '200px', 'important');
  modifierBox.style.setProperty('max-width', '200px', 'important');
  modifierBox.style.setProperty('height', 'auto', 'important');
  modifierBox.style.setProperty('min-height', 'auto', 'important');
  minimizeBtn.textContent = '+';
  minimizeBtn.title = 'Restore';
  console.log('Minimized - stored dimensions:', rect.width, 'x', rect.height);
}

// Restore the modifier box from minimized state
function restoreModifierBox(modifierBox, minimizeBtn) {
  // Restore original dimensions
  const originalWidth = modifierBox.getAttribute('data-original-width');
  const originalHeight = modifierBox.getAttribute('data-original-height');

  modifierBox.classList.remove('minimized');

  // Clear forced minimized styles
  modifierBox.style.removeProperty('min-width');
  modifierBox.style.removeProperty('max-width');
  modifierBox.style.removeProperty('min-height');

  // Restore dimensions if they were stored
  if (originalWidth && originalHeight) {
    modifierBox.style.setProperty('width', `${originalWidth}px`, 'important');
    modifierBox.style.setProperty('height', `${originalHeight}px`, 'important');
    console.log('Restored dimensions:', originalWidth, 'x', originalHeight);
  }

  minimizeBtn.textContent = '−';
  minimizeBtn.title = 'Minimize';
}

// Setup clear all functionality
export function setupClearAllControls(modifierBox, clearAllCallback) {
  if (!modifierBox) {
    console.error('setupClearAllControls: modifierBox is required');
    return;
  }

  if (!clearAllCallback || typeof clearAllCallback !== 'function') {
    console.error('setupClearAllControls: clearAllCallback is required');
    return;
  }

  const clearAllBtn = modifierBox.querySelector('.clear-all-btn');
  if (!clearAllBtn) {
    console.error('Clear All button not found!');
    return;
  }

  console.log('Clear All button found, adding event listener');
  clearAllBtn.addEventListener('click', e => {
    console.log('Clear All button clicked');
    e.preventDefault();
    e.stopPropagation();
    clearAllCallback();
  });
}

// Export for legacy compatibility
const UIControls = {
  setupMinimizeControls,
  setupClearAllControls,
};

export default UIControls;

// Legacy global exports for compatibility (temporary)
if (typeof window !== 'undefined') {
  window.ModifierBoxUIControls = UIControls;
}
