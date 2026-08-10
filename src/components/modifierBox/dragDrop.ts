/**
 * Drag and Drop functionality for modifier rows
 */

import { getThemeColors } from '../../utils/themeDetector';

// Functional helpers
const createElement = (
  tagName: string,
  className: string = ''
): HTMLElement => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
};

const setStyle = (
  styles: Record<string, string>,
  element: HTMLElement
): HTMLElement => {
  Object.entries(styles).forEach(([prop, value]) => {
    element.style.setProperty(prop, value, 'important');
  });
  return element;
};

const addClass = (className: string, element: HTMLElement): HTMLElement => {
  element.classList.add(className);
  return element;
};

const removeClass = (className: string, element: HTMLElement): HTMLElement => {
  element.classList.remove(className);
  return element;
};

const findClosest = (selector: string, element: Element): Element | null =>
  element.closest(selector);

// Factory function to create drag and drop functionality
export const createRowDragDrop: RowDragDropFactory = (
  containerSelector: string,
  rowSelector: string,
  rowManagerInstance: ModifierBoxRowManagerModule
): RowDragDropInstance => {
  let container: Element | null = null;
  let draggedElement: HTMLElement | null = null;
  let placeholder: HTMLElement | null = null;
  let _dragHandle: HTMLElement | null = null; // Track drag handle for cleanup
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  // Create placeholder element with theme-aware styling
  const createPlaceholder = (): HTMLElement => {
    const element = createElement('div', 'modifier-row-placeholder');
    updatePlaceholderTheme(element);
    return element;
  };

  const updatePlaceholderTheme = (
    placeholderElement: HTMLElement | null = placeholder
  ): void => {
    if (!placeholderElement) return;

    // Get theme colors if available
    let primaryColor = '#4caf50'; // Default fallback

    if (getThemeColors && typeof getThemeColors === 'function') {
      const colors = getThemeColors();
      if (colors?.primary) {
        primaryColor = colors.primary;
      }
    }

    // Update the placeholder with the theme color
    const gradient = `linear-gradient(90deg, transparent 0%, ${primaryColor} 20%, ${primaryColor} 80%, transparent 100%)`;
    setStyle({ background: gradient }, placeholderElement);
  };

  const attachEventListeners = (): void => {
    // Use mouse-based drag and drop for better reliability
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during drag
    document.addEventListener('selectstart', preventSelect);
  };

  const preventSelect = (e: Event): void => {
    if (draggedElement) {
      e.preventDefault();
    }
  };

  const handleMouseDown = (e: MouseEvent): void => {
    const target = e.target as Element;
    const handle = findClosest('.drag-handle', target);
    if (!handle) return;

    const row = findClosest(rowSelector, handle) as HTMLElement | null;
    if (!row) return;

    e.preventDefault(); // Prevent text selection

    draggedElement = row;
    container = findClosest(containerSelector, row);
    _dragHandle = handle as HTMLElement;

    // Store initial mouse position
    startX = e.clientX;
    startY = e.clientY;
    isDragging = false;

    // Change cursor
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: MouseEvent): void => {
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

  const startDrag = (): void => {
    if (!draggedElement) return;

    isDragging = true;

    // Add visual feedback using functional approach
    addClass('dragging', draggedElement);
    setStyle(
      {
        opacity: '0.7',
        transform: 'rotate(2deg)',
        zIndex: '10000',
      },
      draggedElement
    );
  };

  const updateDragPosition = (e: MouseEvent): void => {
    if (!draggedElement || !container || !placeholder) return;

    const afterElement = getDragAfterElement(container, e.clientY);
    const rows = container.querySelectorAll(rowSelector);

    // Remove existing placeholder
    if (placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }

    // Update placeholder theme before showing it
    updatePlaceholderTheme();

    if (afterElement === undefined) {
      // Insert at the end
      const lastRow = Array.from(rows)
        .filter(row => row !== draggedElement)
        .pop();
      if (lastRow) {
        lastRow.parentNode!.insertBefore(placeholder, lastRow.nextSibling);
      } else {
        // If no other rows, insert at the beginning
        container.appendChild(placeholder);
      }
    } else if (afterElement !== draggedElement) {
      // Insert before the afterElement
      afterElement.parentNode!.insertBefore(placeholder, afterElement);
    }
  };

  const handleMouseUp = (): void => {
    if (!draggedElement) return;

    document.body.style.cursor = '';

    if (isDragging) {
      completeDrag();
    } else {
      // Just cleanup if we didn't actually drag
      cleanup();
    }
  };

  const completeDrag = (): void => {
    if (!draggedElement || !placeholder || !placeholder.parentNode) {
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
      const modifierBox = findClosest(
        '#pixels-modifier-box',
        container!
      ) as HTMLElement | null;
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

  const getDragAfterElement = (
    containerElement: Element,
    y: number
  ): Element | undefined => {
    const draggableElements = [
      ...containerElement.querySelectorAll(`${rowSelector}:not(.dragging)`),
    ];

    return draggableElements.reduce(
      (
        currentClosest: { offset: number; element: Element | undefined },
        child: Element
      ) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > currentClosest.offset) {
          return { offset: offset, element: child };
        } else {
          return currentClosest;
        }
      },
      {
        offset: Number.NEGATIVE_INFINITY,
        element: undefined as Element | undefined,
      }
    ).element;
  };

  const cleanup = (): void => {
    if (draggedElement) {
      setStyle(
        {
          opacity: '',
          transform: '',
          zIndex: '',
        },
        draggedElement
      );
      removeClass('dragging', draggedElement);
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
export const addDragHandle = (row: HTMLElement): void => {
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

export const removeDragHandle = (row: HTMLElement): void => {
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
