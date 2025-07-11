/**
 * UI Controls Module
 * Handles minimize/maximize and clear all functionality for the modifier box
 */

'use strict';

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

  minimizeBtn.addEventListener('click', e => {
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

function minimizeModifierBox(modifierBox, minimizeBtn) {
  const rect = modifierBox.getBoundingClientRect();
  modifierBox.setAttribute('data-original-width', rect.width);
  modifierBox.setAttribute('data-original-height', rect.height);

  modifierBox.classList.add('minimized');
  modifierBox.style.setProperty('width', '200px', 'important');
  modifierBox.style.setProperty('min-width', '200px', 'important');
  modifierBox.style.setProperty('max-width', '200px', 'important');
  modifierBox.style.setProperty('height', 'auto', 'important');
  modifierBox.style.setProperty('min-height', 'auto', 'important');
  minimizeBtn.textContent = '+';
  minimizeBtn.title = 'Restore';
}

// Restore the modifier box from minimized state
function restoreModifierBox(modifierBox, minimizeBtn) {
  const originalWidth = modifierBox.getAttribute('data-original-width');
  const originalHeight = modifierBox.getAttribute('data-original-height');

  modifierBox.classList.remove('minimized');

  modifierBox.style.removeProperty('min-width');
  modifierBox.style.removeProperty('max-width');
  modifierBox.style.removeProperty('min-height');

  if (originalWidth && originalHeight) {
    modifierBox.style.setProperty('width', `${originalWidth}px`, 'important');
    modifierBox.style.setProperty('height', `${originalHeight}px`, 'important');
  }

  minimizeBtn.textContent = '−';
  minimizeBtn.title = 'Minimize';
}

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

  clearAllBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    clearAllCallback();
  });
}

const UIControls = {
  setupMinimizeControls,
  setupClearAllControls,
};

export default UIControls;

if (typeof window !== 'undefined') {
  window.ModifierBoxUIControls = UIControls;
}
