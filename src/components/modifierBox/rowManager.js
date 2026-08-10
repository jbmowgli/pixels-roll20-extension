'use strict';

//
// Row Manager Module - Handles adding, removing, and managing saved roll formula rows
//
import { forceElementUpdates } from './themeManager.js';

let rowCounter = 1; // Start from 1 since we have row 0

const STORAGE_KEY = 'pixels_saved_rolls';
const LEGACY_STORAGE_KEY = 'pixels_modifier_rows';
const CURRENT_VERSION = 2;

/**
 * Migrate v1 row data (modifier-based) to v2 (formula-based).
 * v1 row: { name, value, originalIndex }
 * v2 row: { name, formula }
 */
function migrateRowData(stored) {
  if (!stored || !Array.isArray(stored.rows)) {
    return null;
  }

  // Already v2
  if (stored.version === CURRENT_VERSION) {
    return stored;
  }

  // v1 → v2: convert numeric value to formula string
  const migratedRows = stored.rows.map(row => {
    if (typeof row.formula === 'string') {
      return { name: row.name || 'Roll', formula: row.formula };
    }
    const numericValue = parseInt(row.value) || 0;
    const formula =
      numericValue === 0
        ? '1d20'
        : `1d20${numericValue >= 0 ? '+' : ''}${numericValue}`;
    return { name: row.name || 'Roll', formula };
  });

  return { rows: migratedRows, version: CURRENT_VERSION };
}

/**
 * Execute a formula by invoking the /pixels command programmatically.
 */
function executeFormula(formula) {
  if (!formula || !formula.trim()) {
    return;
  }

  const command = window.PixelsCommand;
  if (command && command.interceptFormula) {
    command.interceptFormula(formula.trim());
  } else {
    console.error(
      'PixelsCommand.interceptFormula not available. Is the content script loaded?'
    );
  }
}

// Export functions to global scope
window.ModifierBoxRowManager = {
  setupModifierRowLogic: setupRowLogic,
  addModifierRow: addFormulaRow,
  removeModifierRow: removeRow,
  updateEventListeners: updateEventListeners,
  updateSelectedModifier: function () {}, // No-op for backward compatibility
  clearModifierState: function () {}, // No-op for backward compatibility
  reindexRows: reindexRows,
  serializeRows: serializeRows,
  applyRows: applyRows,
  saveModifierRows: saveRows,
  loadModifierRows: loadRows,
  applyProfileRows: applyProfileRows,
  clearStoredModifierRows: clearStoredRows,
  resetAllRows: resetAllRows,
  executeFormula: executeFormula,
  getRowCounter: () => rowCounter,
  setRowCounter: value => (rowCounter = value),
};

function setupRowLogic(modifierBox) {
  if (!modifierBox) {
    console.error('setupRowLogic: modifierBox is required');
    return;
  }

  // Add event listener for the add button (only if not already added)
  const addButton = modifierBox.querySelector('.add-modifier-btn');
  if (addButton && !addButton.hasAttribute('data-listener-added')) {
    addButton.addEventListener('click', () => {
      addFormulaRow(modifierBox);
    });
    addButton.setAttribute('data-listener-added', 'true');
  }

  // Add event listeners for existing inputs and buttons
  updateEventListeners(modifierBox);
}

function addFormulaRow(modifierBox) {
  if (!modifierBox) {
    console.error('addFormulaRow: modifierBox is required');
    return;
  }

  const content = modifierBox.querySelector('.pixels-content');
  if (!content) {
    console.error('addFormulaRow: content area not found');
    return;
  }

  // Create new row
  const newRow = document.createElement('div');
  newRow.className = 'modifier-row';
  newRow.innerHTML = `
            <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
            <input type="text" class="modifier-name" placeholder="Name" value="Roll" data-index="${rowCounter}">
            <input type="text" class="formula-input" placeholder="e.g. 2d6+3" value="" data-index="${rowCounter}">
            <button class="roll-formula-btn" type="button" title="Roll this formula">Roll</button>
            <button class="remove-row-btn" type="button">×</button>
        `;

  // Append the new row to the content area
  content.appendChild(newRow);
  rowCounter++;

  // Update event listeners for all rows
  updateEventListeners(modifierBox);

  // Save the updated state to localStorage
  saveRows(modifierBox);

  // Move focus to the new row's name field, selecting its text for quick edit
  const newNameInput = newRow.querySelector('.modifier-name');
  if (newNameInput) {
    newNameInput.focus();
    newNameInput.select();
  }

  // Force theme updates on the new elements
  if (
    window.ModifierBoxThemeManager &&
    window.ModifierBoxThemeManager.forceElementUpdates
  ) {
    window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);
  } else if (forceElementUpdates) {
    forceElementUpdates(modifierBox);
  }
}

function removeRow(rowElement, modifierBox) {
  if (!rowElement) {
    console.error('removeRow: rowElement is null or undefined');
    return;
  }

  if (!modifierBox) {
    console.error('removeRow: modifierBox is required');
    return;
  }

  // Count total rows
  const totalRows = modifierBox.querySelectorAll('.modifier-row').length;

  // If this is the only row left, reset it to default values instead of removing
  if (totalRows === 1) {
    const nameInput = rowElement.querySelector('.modifier-name');
    const formulaInput = rowElement.querySelector('.formula-input');

    nameInput.value = 'Roll';
    formulaInput.value = '1d20';

    // Save the updated state to localStorage
    saveRows(modifierBox);
    return;
  }

  // Remove the row
  rowElement.remove();

  // Reindex rows to maintain consistency
  reindexRows(modifierBox);

  // Save the updated state to localStorage
  saveRows(modifierBox);
}

// Function to reindex all rows after deletion
function reindexRows(modifierBox) {
  const rows = modifierBox.querySelectorAll('.modifier-row');
  rows.forEach((row, index) => {
    const nameInput = row.querySelector('.modifier-name');
    const formulaInput = row.querySelector('.formula-input');

    if (nameInput) {
      nameInput.setAttribute('data-index', index.toString());
    }
    if (formulaInput) {
      formulaInput.setAttribute('data-index', index.toString());
    }
  });
}

function updateEventListeners(modifierBox) {
  if (!modifierBox) {
    console.error('updateEventListeners: modifierBox is required');
    return;
  }

  const rows = modifierBox.querySelectorAll('.modifier-row');

  rows.forEach(row => {
    const nameInput = row.querySelector('.modifier-name');
    const formulaInput = row.querySelector('.formula-input');
    const rollButton = row.querySelector('.roll-formula-btn');
    const removeButton = row.querySelector('.remove-row-btn');

    // Save on input changes
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        saveRows(modifierBox);
      });
    }
    if (formulaInput) {
      formulaInput.addEventListener('input', () => {
        saveRows(modifierBox);
      });

      // Allow Enter key in formula input to trigger roll
      formulaInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          executeFormula(formulaInput.value);
        }
      });
    }

    // Roll button executes the formula
    if (rollButton) {
      rollButton.onclick = function () {
        const formula = row.querySelector('.formula-input');
        if (formula && formula.value.trim()) {
          executeFormula(formula.value);
        } else {
          // Visual feedback for empty formula
          if (formulaInput) {
            formulaInput.classList.add('formula-invalid');
            setTimeout(
              () => formulaInput.classList.remove('formula-invalid'),
              600
            );
          }
        }
      };
    }

    // Remove button
    if (removeButton) {
      removeButton.onclick = function () {
        removeRow(row, modifierBox);
      };
    }
  });
}

/**
 * Serialize the current rows in their DOM order.
 * Returns { rows: [{ name, formula }], version: 2 }.
 */
function serializeRows(modifierBox) {
  const rowsData = [];

  if (!modifierBox) {
    return { rows: rowsData, version: CURRENT_VERSION };
  }

  const rows = modifierBox.querySelectorAll('.modifier-row');
  rows.forEach(row => {
    const nameInput = row.querySelector('.modifier-name');
    const formulaInput = row.querySelector('.formula-input');

    if (nameInput && formulaInput) {
      rowsData.push({
        name: nameInput.value || 'Roll',
        formula: formulaInput.value || '',
      });
    }
  });

  return { rows: rowsData, version: CURRENT_VERSION };
}

// Save all rows to localStorage
function saveRows(modifierBox) {
  if (!modifierBox) {
    return;
  }

  try {
    const data = serializeRows(modifierBox);
    data.rowCounter = rowCounter;
    data.lastUpdated = Date.now();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving formula rows:', error);
  }
}

/**
 * Rebuild the rows in the DOM from serialized data.
 * Accepts both v1 and v2 formats (auto-migrates v1).
 * Returns true on success.
 */
function applyRows(modifierBox, data) {
  const migrated = migrateRowData(data);
  if (!modifierBox || !migrated || !Array.isArray(migrated.rows)) {
    return false;
  }

  const content = modifierBox.querySelector('.pixels-content');
  if (!content) {
    return false;
  }

  // Ensure the row counter stays ahead of the rebuilt indices
  rowCounter = Math.max(rowCounter, migrated.rows.length);

  // Remove all existing rows
  const existingRows = content.querySelectorAll('.modifier-row');
  existingRows.forEach(row => row.remove());

  // Recreate rows from the supplied data
  migrated.rows.forEach((rowData, index) => {
    const newRow = document.createElement('div');
    newRow.className = 'modifier-row';
    newRow.innerHTML = `
          <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
          <input type="text" class="modifier-name" placeholder="Name" value="${escapeHtml(rowData.name)}" data-index="${index}">
          <input type="text" class="formula-input" placeholder="e.g. 2d6+3" value="${escapeHtml(rowData.formula)}" data-index="${index}">
          <button class="roll-formula-btn" type="button" title="Roll this formula">Roll</button>
          <button class="remove-row-btn" type="button">×</button>
        `;

    content.appendChild(newRow);
  });

  // Update event listeners for all rows
  updateEventListeners(modifierBox);

  // Force theme updates on the restored elements
  if (
    window.ModifierBoxThemeManager &&
    window.ModifierBoxThemeManager.forceElementUpdates
  ) {
    window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);
  } else if (forceElementUpdates) {
    forceElementUpdates(modifierBox);
  }

  return true;
}

// Load rows from localStorage (tries new key first, then legacy key with migration)
function loadRows(modifierBox) {
  if (!modifierBox) {
    return false;
  }

  try {
    let stored = localStorage.getItem(STORAGE_KEY);

    // Fall back to legacy key if new key not found
    if (!stored) {
      stored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        // Migrate: save under new key, remove legacy key
        const parsed = JSON.parse(stored);
        const migrated = migrateRowData(parsed);
        if (migrated) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          stored = JSON.stringify(migrated);
        }
      }
    }

    if (!stored) {
      return false;
    }

    const data = JSON.parse(stored);
    if (!data.rows || !Array.isArray(data.rows)) {
      return false;
    }

    // Restore row counter
    if (data.rowCounter) {
      rowCounter = data.rowCounter;
    }

    return applyRows(modifierBox, data);
  } catch (error) {
    console.error('Error loading formula rows:', error);
    return false;
  }
}

/**
 * Apply a saved profile's rows and persist to localStorage.
 * Returns true on success.
 */
function applyProfileRows(modifierBox, profile) {
  const applied = applyRows(modifierBox, profile);
  if (applied) {
    saveRows(modifierBox);
  }
  return applied;
}

// Clear stored rows
function clearStoredRows() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing stored rows:', error);
  }
}

// Reset all rows to a single default row
function resetAllRows(modifierBox) {
  if (!modifierBox) {
    console.error('resetAllRows: modifierBox is required');
    return;
  }

  const content = modifierBox.querySelector('.pixels-content');
  if (!content) {
    console.error('resetAllRows: content area not found');
    return;
  }

  // Clear all existing rows
  content.innerHTML = '';

  // Reset row counter
  rowCounter = 1;

  // Create single default row
  const defaultRow = document.createElement('div');
  defaultRow.className = 'modifier-row';
  defaultRow.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
      <input type="text" class="modifier-name" placeholder="Name" value="Attack" data-index="0">
      <input type="text" class="formula-input" placeholder="e.g. 2d6+3" value="1d20" data-index="0">
      <button class="roll-formula-btn" type="button" title="Roll this formula">Roll</button>
      <button class="remove-row-btn" type="button">×</button>
    `;

  content.appendChild(defaultRow);

  // Update event listeners for the new row
  updateEventListeners(modifierBox);

  // Clear stored rows
  clearStoredRows();
}

/**
 * Escape HTML special characters in a string for safe insertion into innerHTML.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Named exports
export { setupRowLogic as setupModifierRowLogic };
export { addFormulaRow as addModifierRow };
export { removeRow as removeModifierRow };
export { updateEventListeners };
export { serializeRows };
export { applyRows };
export { saveRows as saveModifierRows };
export { loadRows as loadModifierRows };
export { applyProfileRows };
export { clearStoredRows as clearStoredModifierRows };
export { resetAllRows };
export { executeFormula };
export { reindexRows };
export { migrateRowData };
export const getRowCounter = () => rowCounter;
export const setRowCounter = value => (rowCounter = value);

// No-op stubs for backward compatibility
export const updateSelectedModifier = function () {};
export const clearModifierState = function () {};

// Helper function to reset module state (for testing)
export const resetState = () => {
  rowCounter = 1;
};

// Default export for convenience
export default {
  setupModifierRowLogic: setupRowLogic,
  addModifierRow: addFormulaRow,
  removeModifierRow: removeRow,
  updateEventListeners,
  updateSelectedModifier: function () {},
  clearModifierState: function () {},
  reindexRows,
  serializeRows,
  applyRows,
  saveModifierRows: saveRows,
  loadModifierRows: loadRows,
  applyProfileRows,
  clearStoredModifierRows: clearStoredRows,
  resetAllRows,
  executeFormula,
  getRowCounter,
  setRowCounter,
};

// Legacy global exports for compatibility
if (typeof window !== 'undefined') {
  window.ModifierBoxRowManager = {
    setupModifierRowLogic: setupRowLogic,
    addModifierRow: addFormulaRow,
    removeModifierRow: removeRow,
    updateEventListeners,
    updateSelectedModifier: function () {},
    clearModifierState: function () {},
    reindexRows,
    serializeRows,
    applyRows,
    saveModifierRows: saveRows,
    loadModifierRows: loadRows,
    applyProfileRows,
    clearStoredModifierRows: clearStoredRows,
    resetAllRows,
    executeFormula,
    getRowCounter,
    setRowCounter,
    resetState,
  };
}
