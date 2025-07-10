/**
 * Drag and Drop functionality  let container = null;
  let draggedElement = null;
  let placeholder = null;
  let    dragHandle = null;// Track drag handle for cleanup
  let startX = 0;
  let startY = 0;
  let isDragging = false;difier rows
 */

import { curry, pipe, reduce } from 'ramda';
import { getThemeColors } from '../../utils/themeDetector.js';

// Functional helpers
const createElement = (tagName, className = '') => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
};

const setStyle = curry((styles, element) => {
  Object.entries(styles).forEach(([prop, value]) => {
    element.style.setProperty(prop, value, 'important');
  });
  return element;
});

const addClass = curry((className, element) => {
  element.classList.add(className);
  return element;
});

const removeClass = curry((className, element) => {
  element.classList.remove(className);
  return element;
});

const closest = curry((selector, element) => element.closest(selector));

// Factory function to create drag and drop functionality
export const createRowDragDrop = (
  containerSelector,
  rowSelector,
  rowManagerInstance
) => {
  let container = null;
  let draggedElement = null;
  let placeholder = null;
  let _dragHandle = null; // Track drag handle for cleanup
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  // Create placeholder element with theme-aware styling
  const createPlaceholder = () => {
    const element = createElement('div', 'modifier-row-placeholder');
    updatePlaceholderTheme(element);
    return element;
  };

  const updatePlaceholderTheme = (placeholderElement = placeholder) => {
    if (!placeholderElement) return;

    // Get theme colors if available
    let primaryColor = '#4caf50'; // Default fallback

    if (
      getThemeColors &&
      typeof getThemeColors === 'function'
    ) {
      const colors = getThemeColors();
      if (colors?.primary) {
        primaryColor = colors.primary;
      }
    }

    // Update the placeholder with the theme color
    const gradient = `linear-gradient(90deg, transparent 0%, ${primaryColor} 20%, ${primaryColor} 80%, transparent 100%)`;
    setStyle({ background: gradient }, placeholderElement);
  };

  const attachEventListeners = () => {
    // Use mouse-based drag and drop for better reliability
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during drag
    document.addEventListener('selectstart', preventSelect);
  };

  const preventSelect = e => {
    if (draggedElement) {
      e.preventDefault();
    }
  };

  const handleMouseDown = e => {
    const handle = closest('.drag-handle', e.target);
    if (!handle) return;

    const row = closest(rowSelector, handle);
    if (!row) return;

    e.preventDefault(); // Prevent text selection

    draggedElement = row;
    container = closest(containerSelector, row);
    _dragHandle = handle;

    // Store initial mouse position
    startX = e.clientX;
    startY = e.clientY;
    isDragging = false;

    // Change cursor
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = e => {
    if (!draggedElement) return;

    // Start dragging only after moving a few pixels (prevent accidental drags)
    const deltaX = Math.abs(e.clientX - startX);
    const deltaY = Math.abs(e.clientY - startY);

    if (!isDragging && (deltaX > 5 || deltaY > 5)) {
      startDrag();
    }

    if (isDragging) {
      e.preventDefault();
      updateDragPosition(e);
    }
  };

  const startDrag = () => {
    if (!draggedElement) return;

    isDragging = true;

    // Add visual feedback using functional approach
    pipe(
      addClass('dragging'),
      setStyle({
        opacity: '0.7',
        transform: 'rotate(2deg)',
        zIndex: '10000',
      })
    )(draggedElement);
  };

  const updateDragPosition = e => {
    if (!draggedElement || !container) return;

    const afterElement = getDragAfterElement(container, e.clientY);
    const rows = container.querySelectorAll(rowSelector);

    // Remove existing placeholder
    if (placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }

    // Update placeholder theme before showing it
    updatePlaceholderTheme();

    if (afterElement === null) {
      // Insert at the end
      const lastRow = Array.from(rows)
        .filter(row => row !== draggedElement)
        .pop();
      if (lastRow) {
        lastRow.parentNode.insertBefore(placeholder, lastRow.nextSibling);
      } else {
        // If no other rows, insert at the beginning
        container.appendChild(placeholder);
      }
    } else if (afterElement !== draggedElement) {
      // Insert before the afterElement
      afterElement.parentNode.insertBefore(placeholder, afterElement);
    }
  };

  const handleMouseUp = () => {
    if (!draggedElement) return;

    document.body.style.cursor = '';

    if (isDragging) {
      completeDrag();
    } else {
      // Just cleanup if we didn't actually drag
      cleanup();
    }
  };

  const completeDrag = () => {
    if (!draggedElement || !placeholder.parentNode) {
      cleanup();
      return;
    }

    // Insert the dragged element where the placeholder is
    placeholder.parentNode.insertBefore(draggedElement, placeholder);

    // Remove placeholder
    if (placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }

    // Reindex all rows to maintain correct radio button values
    if (
      rowManagerInstance &&
      typeof rowManagerInstance.reindexRows === 'function'
    ) {
      const modifierBox = closest('#pixels-modifier-box', container);
      if (modifierBox) {
        rowManagerInstance.reindexRows(modifierBox);

        // Save the new order to localStorage after reindexing
        if (typeof rowManagerInstance.saveModifierRows === 'function') {
          rowManagerInstance.saveModifierRows(modifierBox);
        }
      }
    }

    cleanup();
  };

  const getDragAfterElement = (containerElement, y) => {
    const draggableElements = [
      ...containerElement.querySelectorAll(`${rowSelector}:not(.dragging)`),
    ];

    return reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY },
      draggableElements
    ).element;
  };

  const cleanup = () => {
    if (draggedElement) {
      pipe(
        setStyle({
          opacity: '',
          transform: '',
          zIndex: '',
        }),
        removeClass('dragging')
      )(draggedElement);
      draggedElement = null;
    }

    if (placeholder?.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }

    _dragHandle = null;
    container = null;
    isDragging = false;
    startX = 0;
    startY = 0;

    // Reset cursor
    document.body.style.cursor = '';
  };

  // Initialize
  placeholder = createPlaceholder();
  attachEventListeners();

  // Public API
  return {
    updatePlaceholderTheme: () => updatePlaceholderTheme(),
    cleanup,
  };
};

// Utility functions for drag handles
export const addDragHandle = row => {
  // Check if drag handle already exists
  if (row.querySelector('.drag-handle')) {
    return;
  }

  const dragHandle = createElement('div', 'drag-handle');
  dragHandle.title = 'Drag to reorder';
  dragHandle.innerHTML = '⋮⋮';

  // Insert at the beginning of the row
  row.insertBefore(dragHandle, row.firstChild);
};

export const removeDragHandle = row => {
  const dragHandle = row.querySelector('.drag-handle');
  if (dragHandle) {
    dragHandle.remove();
  }
};

// Export for backwards compatibility
export const RowDragDrop = createRowDragDrop;

// Export for use in other modules (legacy support)
if (typeof window !== 'undefined') {
  window.RowDragDrop = createRowDragDrop;
  window.addDragHandle = addDragHandle;
  window.removeDragHandle = removeDragHandle;
}
