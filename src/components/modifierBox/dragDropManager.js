'use strict';

//
// Drag and Drop Manager Module - Handles reordering modifier rows
//
(function () {
  let draggedElement = null;
  let placeholder = null;
  let isDragging = false;

  // Export functions to global scope
  window.ModifierBoxDragDropManager = {
    setupDragAndDrop: setupDragAndDrop,
    cleanup: cleanup,
  };

  function setupDragAndDrop(modifierBox) {
    if (!modifierBox) {
      console.error('setupDragAndDrop: modifierBox is required');
      return;
    }

    const content = modifierBox.querySelector('.pixels-content');
    if (!content) {
      console.error('setupDragAndDrop: content area not found');
      return;
    }

    // Add drag handles to existing rows
    addDragHandlesToRows(content);

    // Set up event delegation for dynamic rows
    setupEventDelegation(content, modifierBox);
  }

  function addDragHandlesToRows(content) {
    const rows = content.querySelectorAll('.modifier-row');
    rows.forEach(row => {
      if (!row.querySelector('.drag-handle')) {
        addDragHandleToRow(row);
      }
    });
  }

  function addDragHandleToRow(row) {
    // Create drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '⋮⋮'; // Unicode for vertical dots
    dragHandle.title = 'Drag to reorder';
    dragHandle.draggable = false; // We'll handle drag manually

    // Insert at the beginning of the row
    row.insertBefore(dragHandle, row.firstChild);

    // Add drag styling to the row
    row.classList.add('draggable-row');
  }

  function setupEventDelegation(content, modifierBox) {
    // Mouse events for drag initiation
    content.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Touch events for mobile support
    content.addEventListener('touchstart', handleTouchStart, {
      passive: false,
    });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    // Store modifierBox reference for later use
    content._modifierBox = modifierBox;
  }

  function handleMouseDown(e) {
    const dragHandle = e.target.closest('.drag-handle');
    if (!dragHandle) return;

    e.preventDefault();
    startDrag(dragHandle.parentElement, e.clientX, e.clientY);
  }

  function handleTouchStart(e) {
    const dragHandle = e.target.closest('.drag-handle');
    if (!dragHandle) return;

    e.preventDefault();
    const touch = e.touches[0];
    startDrag(dragHandle.parentElement, touch.clientX, touch.clientY);
  }

  function startDrag(row, clientX, clientY) {
    if (isDragging) return;

    isDragging = true;
    draggedElement = row;

    // Create placeholder
    placeholder = row.cloneNode(true);
    placeholder.classList.add('drag-placeholder');
    placeholder.style.opacity = '0.5';
    placeholder.style.pointerEvents = 'none';

    // Style the dragged element
    row.classList.add('dragging');
    row.style.position = 'fixed';
    row.style.zIndex = '10000';
    row.style.pointerEvents = 'none';
    row.style.transform = 'rotate(2deg)';
    row.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';

    // Insert placeholder
    row.parentNode.insertBefore(placeholder, row.nextSibling);

    // Position the dragged element
    updateDragPosition(clientX, clientY);

    // Add visual feedback to content area
    const content = row.closest('.pixels-content');
    if (content) {
      content.classList.add('drag-active');
    }
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    updateDragPosition(e.clientX, e.clientY);
    updateDropTarget(e.clientX, e.clientY);
  }

  function handleTouchMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    updateDragPosition(touch.clientX, touch.clientY);
    updateDropTarget(touch.clientX, touch.clientY);
  }

  function updateDragPosition(clientX, clientY) {
    if (!draggedElement) return;

    const rect = draggedElement.getBoundingClientRect();
    draggedElement.style.left = clientX - rect.width / 2 + 'px';
    draggedElement.style.top = clientY - 20 + 'px';
  }

  function updateDropTarget(clientX, clientY) {
    if (!draggedElement || !placeholder) return;

    const content = draggedElement.closest('.pixels-content');
    if (!content) return;

    const rows = Array.from(content.querySelectorAll('.modifier-row')).filter(
      row => row !== draggedElement && row !== placeholder
    );

    let insertBeforeElement = null;
    let minDistance = Infinity;

    rows.forEach(row => {
      const rect = row.getBoundingClientRect();
      const rowCenter = rect.top + rect.height / 2;
      const distance = Math.abs(clientY - rowCenter);

      if (distance < minDistance) {
        minDistance = distance;
        insertBeforeElement = clientY < rowCenter ? row : row.nextSibling;
      }
    });

    // Move placeholder to the appropriate position
    if (insertBeforeElement !== placeholder.nextSibling) {
      content.insertBefore(placeholder, insertBeforeElement);
    }
  }

  function handleMouseUp(e) {
    if (!isDragging) return;
    endDrag();
  }

  function handleTouchEnd(e) {
    if (!isDragging) return;
    endDrag();
  }

  function endDrag() {
    if (!isDragging || !draggedElement || !placeholder) return;

    const content = draggedElement.closest('.pixels-content');
    const modifierBox = content._modifierBox;

    // Reset dragged element styles
    draggedElement.classList.remove('dragging');
    draggedElement.style.position = '';
    draggedElement.style.zIndex = '';
    draggedElement.style.pointerEvents = '';
    draggedElement.style.transform = '';
    draggedElement.style.boxShadow = '';
    draggedElement.style.left = '';
    draggedElement.style.top = '';

    // Place the dragged element at the placeholder position
    placeholder.parentNode.insertBefore(draggedElement, placeholder);
    placeholder.remove();

    // Remove visual feedback
    if (content) {
      content.classList.remove('drag-active');
    }

    // Reindex rows after reordering
    if (window.ModifierBoxRowManager && modifierBox) {
      window.ModifierBoxRowManager.reindexRows(modifierBox);
    }

    // Clean up
    draggedElement = null;
    placeholder = null;
    isDragging = false;
  }

  function cleanup() {
    // Remove event listeners if needed
    isDragging = false;
    draggedElement = null;
    placeholder = null;
  }

  // Auto-setup when new rows are added
  if (window.ModifierBoxRowManager) {
    const originalAddRow = window.ModifierBoxRowManager.addModifierRow;
    if (originalAddRow) {
      window.ModifierBoxRowManager.addModifierRow = function (
        modifierBox,
        updateSelectedModifierCallback
      ) {
        const result = originalAddRow.call(
          this,
          modifierBox,
          updateSelectedModifierCallback
        );

        // Add drag handle to the newly created row
        const content = modifierBox.querySelector('.pixels-content');
        if (content) {
          const rows = content.querySelectorAll('.modifier-row');
          const lastRow = rows[rows.length - 1];
          if (lastRow && !lastRow.querySelector('.drag-handle')) {
            addDragHandleToRow(lastRow);
          }
        }

        return result;
      };
    }
  }
})();
