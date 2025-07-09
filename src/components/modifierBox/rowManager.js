'use strict';

//
// Row Manager Module - Handles adding, removing, and managing modifier rows
//
(function () {
  let rowCounter = 1; // Start from 1 since we have row 0

  // Function to clear modifier state
  function clearModifierState(modifierBox) {
    // Clear global variables
    if (typeof window.pixelsModifierName !== 'undefined') {
      window.pixelsModifierName = '';
    }
    if (typeof window.pixelsModifier !== 'undefined') {
      window.pixelsModifier = '0';
    }

    // Update header title to show no modifier selected
    if (modifierBox) {
      const headerTitle = modifierBox.querySelector('.pixels-title');
      if (headerTitle) {
        const logoImg = headerTitle.querySelector('.pixels-logo');
        if (logoImg) {
          headerTitle.innerHTML = `<img src="${logoImg.src}" alt="Pixels" class="pixels-logo"> Pixels Modifier Box`;
        } else {
          headerTitle.textContent = 'Pixels Modifier Box';
        }
      }
    }

    // Send message to extension about clearing the modifier
    if (typeof window.sendMessageToExtension === 'function') {
      window.sendMessageToExtension({
        action: 'modifierChanged',
        modifier: '0',
        name: '',
      });
    }
  }

  // Export functions to global scope
  window.ModifierBoxRowManager = {
    setupModifierRowLogic: setupModifierRowLogic,
    addModifierRow: addModifierRow,
    removeModifierRow: removeModifierRow,
    updateEventListeners: updateEventListeners,
    updateSelectedModifier: updateSelectedModifier,
    clearModifierState: clearModifierState,
    reindexRows: reindexRows,
    saveModifierRows: saveModifierRows,
    loadModifierRows: loadModifierRows,
    clearStoredModifierRows: clearStoredModifierRows,
    resetAllRows: resetAllRows,
    getRowCounter: () => rowCounter,
    setRowCounter: value => (rowCounter = value),
  };

  function setupModifierRowLogic(modifierBox, updateSelectedModifierCallback) {
    if (!modifierBox) {
      console.error('setupModifierRowLogic: modifierBox is required');
      return;
    }

    // Add event listener for the add button (only if not already added)
    const addButton = modifierBox.querySelector('.add-modifier-btn');
    if (addButton && !addButton.hasAttribute('data-listener-added')) {
      addButton.addEventListener('click', () => {
        addModifierRow(modifierBox, updateSelectedModifierCallback);
      });
      addButton.setAttribute('data-listener-added', 'true');
    }

    // Add event listeners for existing radio buttons and inputs
    updateEventListeners(modifierBox, updateSelectedModifierCallback);
  }

  function addModifierRow(modifierBox, updateSelectedModifierCallback) {
    if (!modifierBox) {
      console.error('addModifierRow: modifierBox is required');
      return;
    }

    const content = modifierBox.querySelector('.pixels-content');
    if (!content) {
      console.error('addModifierRow: content area not found');
      return;
    }

    // Create new row
    const newRow = document.createElement('div');
    newRow.className = 'modifier-row';
    newRow.innerHTML = `
            <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
            <input type="radio" name="modifier-select" value="${rowCounter}" class="modifier-radio" id="mod-${rowCounter}">
            <input type="text" class="modifier-name" placeholder="Modifier ${rowCounter + 1}" value="Modifier ${rowCounter + 1}" data-index="${rowCounter}">
            <input type="number" class="modifier-value" value="0" min="-99" max="99" data-index="${rowCounter}">
            <button class="remove-row-btn" type="button">×</button>
        `;

    // Append the new row to the content area
    content.appendChild(newRow);
    rowCounter++;

    // Update event listeners for all rows
    updateEventListeners(modifierBox, updateSelectedModifierCallback);

    // Save the updated state to localStorage
    saveModifierRows(modifierBox);

    // Force theme updates on the new elements
    if (
      window.ModifierBoxThemeManager &&
      window.ModifierBoxThemeManager.forceElementUpdates
    ) {
      window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);
    }
  }

  function removeModifierRow(
    rowElement,
    modifierBox,
    updateSelectedModifierCallback
  ) {
    if (!rowElement) {
      console.error('removeModifierRow: rowElement is null or undefined');
      return;
    }

    if (!modifierBox) {
      console.error('removeModifierRow: modifierBox is required');
      return;
    }

    // Find the actual data-index from the radio button
    const radio = rowElement.querySelector('.modifier-radio');
    if (!radio) {
      console.error('removeModifierRow: radio button not found in row');
      return;
    }

    const index = parseInt(radio.value);

    // Count total rows
    const totalRows = modifierBox.querySelectorAll('.modifier-row').length;

    // If this is the only row left, reset it to default values instead of removing
    if (totalRows === 1) {
      const nameInput = rowElement.querySelector('.modifier-name');
      const valueInput = rowElement.querySelector('.modifier-value');

      nameInput.value = 'Modifier 1';
      valueInput.value = '0';

      // Make sure it's selected
      radio.checked = true;

      // Update the selected modifier
      if (updateSelectedModifierCallback) {
        updateSelectedModifierCallback();
      }

      // Save the updated state to localStorage
      saveModifierRows(modifierBox);

      return;
    }

    // Check if this row was selected
    const wasSelected = radio.checked;

    // Remove the row
    rowElement.remove();

    // If the removed row was selected, select the first remaining row
    if (wasSelected) {
      const firstRadio = modifierBox.querySelector('.modifier-radio');
      if (firstRadio) {
        firstRadio.checked = true;
        if (updateSelectedModifierCallback) {
          updateSelectedModifierCallback();
        }
      } else {
        // Clear global variables since no rows remain
        clearModifierState(modifierBox);
      }
    }

    // Reindex rows to maintain consistency
    reindexRows(modifierBox);

    // Save the updated state to localStorage
    saveModifierRows(modifierBox);
  }

  // Function to reindex all rows after deletion
  function reindexRows(modifierBox) {
    const rows = modifierBox.querySelectorAll('.modifier-row');
    rows.forEach((row, index) => {
      const radio = row.querySelector('.modifier-radio');
      const nameInput = row.querySelector('.modifier-name');
      const valueInput = row.querySelector('.modifier-value');

      if (radio) {
        radio.value = index.toString();
        radio.id = `mod-${index}`;
      }
      if (nameInput) {
        nameInput.setAttribute('data-index', index.toString());
      }
      if (valueInput) {
        valueInput.setAttribute('data-index', index.toString());
      }
    });
  }

  function updateEventListeners(modifierBox, updateSelectedModifierCallback) {
    if (!modifierBox) {
      console.error('updateEventListeners: modifierBox is required');
      return;
    }

    // Remove all existing event listeners by clearing and re-adding rows
    // This is simpler than trying to manage individual listeners
    const rows = modifierBox.querySelectorAll('.modifier-row');

    rows.forEach(row => {
      // Get elements
      const radio = row.querySelector('.modifier-radio');
      const nameInput = row.querySelector('.modifier-name');
      const valueInput = row.querySelector('.modifier-value');
      const removeButton = row.querySelector('.remove-row-btn');

      // Add event listeners (removing duplicates isn't critical since
      // addEventListener with the same function reference won't add duplicates)
      if (radio && updateSelectedModifierCallback) {
        radio.addEventListener('change', () => {
          updateSelectedModifierCallback();
          saveModifierRows(modifierBox);
        });
      }
      if (nameInput && updateSelectedModifierCallback) {
        nameInput.addEventListener('input', () => {
          updateSelectedModifierCallback();
          saveModifierRows(modifierBox);
        });
      }
      if (valueInput && updateSelectedModifierCallback) {
        valueInput.addEventListener('input', () => {
          updateSelectedModifierCallback();
          saveModifierRows(modifierBox);
        });
      }

      // For remove button, we need to ensure we get the right row
      // Use a closure to capture the current row element
      if (removeButton) {
        removeButton.onclick = function () {
          removeModifierRow(row, modifierBox, updateSelectedModifierCallback);
        };
      }
    });
  }

  function updateSelectedModifier(modifierBox) {
    if (!modifierBox) {
      console.error('updateSelectedModifier: modifierBox is required');
      return;
    }

    const selectedRadio = modifierBox.querySelector(
      'input[name="modifier-select"]:checked'
    );
    if (selectedRadio) {
      // Find the row that contains this radio button directly
      // instead of using the radio value as an array index
      const row = selectedRadio.closest('.modifier-row');
      if (row) {
        const nameInput = row.querySelector('.modifier-name');
        const valueInput = row.querySelector('.modifier-value');

        // Update global variables (these should be defined in roll20.js)
        const modifierName = nameInput.value || 'Unnamed';
        const modifierValue = valueInput.value || '0';

        if (typeof window.pixelsModifierName !== 'undefined') {
          window.pixelsModifierName = modifierName;
          console.log(
            `Updated pixelsModifierName to: "${window.pixelsModifierName}"`
          );
        }
        if (typeof window.pixelsModifier !== 'undefined') {
          window.pixelsModifier = modifierValue;
          console.log(`Updated pixelsModifier to: "${window.pixelsModifier}"`);
        }

        // Save the updated values to localStorage
        if (typeof window.updateModifierSettings === 'function') {
          window.updateModifierSettings(window.pixelsModifier, window.pixelsModifierName);
        }

        // Save the modifier rows state to localStorage
        saveModifierRows(modifierBox);

        // Update the header title to show the selected modifier
        const headerTitle = modifierBox.querySelector('.pixels-title');
        if (headerTitle) {
          const valueText =
            modifierValue === '0'
              ? '±0'
              : modifierValue > 0
                ? `+${modifierValue}`
                : modifierValue;
          // Find the logo image and preserve it, then update the text content
          const logoImg = headerTitle.querySelector('.pixels-logo');
          if (logoImg) {
            headerTitle.innerHTML = `<img src="${logoImg.src}" alt="Pixels" class="pixels-logo"> ${modifierName} (${valueText})`;
          } else {
            headerTitle.textContent = `${modifierName} (${valueText})`;
          }
        }

        // Send message to extension if the function exists
        if (typeof window.sendMessageToExtension === 'function') {
          window.sendMessageToExtension({
            action: 'modifierChanged',
            modifier: modifierValue,
            name: modifierName,
          });
        }
      }
    } else {
      // No radio button is selected, clear global variables
      clearModifierState(modifierBox);
    }
  }

  // Function to save all modifier rows to localStorage
  function saveModifierRows(modifierBox) {
    if (!modifierBox) return;

    try {
      const rows = modifierBox.querySelectorAll('.modifier-row');
      const rowsData = [];
      let selectedIndex = -1;

      // Capture rows in their current DOM order (preserves drag-and-drop order)
      rows.forEach((row, domIndex) => {
        const radio = row.querySelector('.modifier-radio');
        const nameInput = row.querySelector('.modifier-name');
        const valueInput = row.querySelector('.modifier-value');

        if (nameInput && valueInput) {
          rowsData.push({
            name: nameInput.value || `Modifier ${domIndex + 1}`,
            value: valueInput.value || '0',
            originalIndex: radio ? radio.value : domIndex.toString() // Store original index for reference
          });

          if (radio && radio.checked) {
            selectedIndex = domIndex; // Use DOM index for selection
          }
        }
      });

      const modifierState = {
        rows: rowsData,
        selectedIndex: selectedIndex,
        rowCounter: rowCounter,
        lastUpdated: Date.now()
      };

      localStorage.setItem('pixels_modifier_rows', JSON.stringify(modifierState));
      console.log('Saved modifier rows to localStorage:', modifierState);
    } catch (error) {
      console.error('Error saving modifier rows:', error);
    }
  }

  // Function to load modifier rows from localStorage
  function loadModifierRows(modifierBox, updateSelectedModifierCallback) {
    if (!modifierBox) return false;

    try {
      const stored = localStorage.getItem('pixels_modifier_rows');
      if (!stored) return false;

      const modifierState = JSON.parse(stored);
      if (!modifierState.rows || !Array.isArray(modifierState.rows)) return false;

      console.log('Loading modifier rows from localStorage:', modifierState);

      // Restore row counter
      if (modifierState.rowCounter) {
        rowCounter = modifierState.rowCounter;
      }

      // Clear existing rows
      const content = modifierBox.querySelector('.pixels-content');
      if (!content) return false;

      // Remove all existing modifier rows
      const existingRows = content.querySelectorAll('.modifier-row');
      existingRows.forEach(row => row.remove());

      // Recreate rows from stored data
      modifierState.rows.forEach((rowData, index) => {
        const newRow = document.createElement('div');
        newRow.className = 'modifier-row';
        newRow.innerHTML = `
          <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
          <input type="radio" name="modifier-select" value="${index}" class="modifier-radio" id="mod-${index}">
          <input type="text" class="modifier-name" placeholder="Modifier ${index + 1}" value="${rowData.name}" data-index="${index}">
          <input type="number" class="modifier-value" value="${rowData.value}" min="-99" max="99" data-index="${index}">
          <button class="remove-row-btn" type="button">×</button>
        `;

        content.appendChild(newRow);
      });

      // Restore selected row
      if (modifierState.selectedIndex >= 0 && modifierState.selectedIndex < modifierState.rows.length) {
        const selectedRadio = modifierBox.querySelector(`input[name="modifier-select"][value="${modifierState.selectedIndex}"]`);
        if (selectedRadio) {
          selectedRadio.checked = true;
        }
      }

      // Update event listeners for all rows
      updateEventListeners(modifierBox, updateSelectedModifierCallback);

      // Update the selected modifier to sync global variables
      if (updateSelectedModifierCallback) {
        updateSelectedModifierCallback();
      }

      // Force theme updates on the restored elements
      if (window.ModifierBoxThemeManager && window.ModifierBoxThemeManager.forceElementUpdates) {
        window.ModifierBoxThemeManager.forceElementUpdates(modifierBox);
      }

      return true;
    } catch (error) {
      console.error('Error loading modifier rows:', error);
      return false;
    }
  }

  // Function to clear stored modifier rows
  function clearStoredModifierRows() {
    try {
      localStorage.removeItem('pixels_modifier_rows');
      console.log('Cleared stored modifier rows');
    } catch (error) {
      console.error('Error clearing stored modifier rows:', error);
    }
  }

  // Function to reset all rows to default values
  function resetAllRows(modifierBox, updateSelectedModifierCallback) {
    if (!modifierBox) {
      console.error('resetAllRows: modifierBox is required');
      return;
    }

    // Remove all existing rows
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
      <input type="radio" name="modifier-select" value="0" class="modifier-radio" id="mod-0" checked>
      <input type="text" class="modifier-name" placeholder="Modifier 1" value="Modifier 1" data-index="0">
      <input type="number" class="modifier-value" value="0" min="-99" max="99" data-index="0">
      <button class="remove-row-btn" type="button">×</button>
    `;

    content.appendChild(defaultRow);

    // Reset global variables
    window.pixelsModifier = '0';
    window.pixelsModifierName = 'Modifier 1';

    // Update event listeners for the new row
    updateEventListeners(modifierBox, updateSelectedModifierCallback);

    // Update selected modifier display
    if (updateSelectedModifierCallback) {
      updateSelectedModifierCallback();
    }

    // Clear stored modifier rows
    clearStoredModifierRows();

    console.log('All rows reset to default');
  }
})();
