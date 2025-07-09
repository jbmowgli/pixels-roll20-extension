/**
 * Drag and Drop functionality for modifier rows
 */

class RowDragDrop {
  constructor(containerSelector, rowSelector, rowManagerInstance) {
    this.container = null;
    this.containerSelector = containerSelector;
    this.rowSelector = rowSelector;
    this.rowManager = rowManagerInstance;
    this.draggedElement = null;
    this.placeholder = null;
    this.dragHandle = null;

    this.init();
  }

  init() {
    this.createPlaceholder();
    this.attachEventListeners();
  }

  createPlaceholder() {
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'modifier-row-placeholder';
    // Simple line - no content needed since it's styled with CSS
    this.updatePlaceholderTheme();
  }

  updatePlaceholderTheme() {
    if (!this.placeholder) return;

    // Get theme colors if available
    let primaryColor = '#4caf50'; // Default fallback

    if (
      window.ThemeDetector &&
      typeof window.ThemeDetector.getThemeColors === 'function'
    ) {
      const colors = window.ThemeDetector.getThemeColors();
      if (colors && colors.primary) {
        primaryColor = colors.primary;
      }
    }

    // Update the placeholder with the theme color
    const gradient = `linear-gradient(90deg, transparent 0%, ${primaryColor} 20%, ${primaryColor} 80%, transparent 100%)`;
    this.placeholder.style.setProperty('background', gradient, 'important');
  }

  attachEventListeners() {
    // Use mouse-based drag and drop for better reliability
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));

    // Prevent text selection during drag
    document.addEventListener('selectstart', this.preventSelect.bind(this));
  }

  preventSelect(e) {
    if (this.draggedElement) {
      e.preventDefault();
    }
  }

  handleMouseDown(e) {
    const dragHandle = e.target.closest('.drag-handle');
    if (!dragHandle) return;

    const row = dragHandle.closest(this.rowSelector);
    if (!row) return;

    e.preventDefault(); // Prevent text selection

    this.draggedElement = row;
    this.container = row.closest(this.containerSelector);
    this.dragHandle = dragHandle;

    // Store initial mouse position
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.isDragging = false;

    // Change cursor
    document.body.style.cursor = 'grabbing';
  }

  handleMouseMove(e) {
    if (!this.draggedElement) return;

    // Start dragging only after moving a few pixels (prevent accidental drags)
    const deltaX = Math.abs(e.clientX - this.startX);
    const deltaY = Math.abs(e.clientY - this.startY);

    if (!this.isDragging && (deltaX > 5 || deltaY > 5)) {
      this.startDrag();
    }

    if (this.isDragging) {
      e.preventDefault();
      this.updateDragPosition(e);
    }
  }

  startDrag() {
    if (!this.draggedElement) return;

    this.isDragging = true;

    // Add visual feedback
    this.draggedElement.classList.add('dragging');
    this.draggedElement.style.opacity = '0.7';
    this.draggedElement.style.transform = 'rotate(2deg)';
    this.draggedElement.style.zIndex = '10000';
  }

  updateDragPosition(e) {
    if (!this.draggedElement || !this.container) return;

    const afterElement = this.getDragAfterElement(this.container, e.clientY);
    const rows = this.container.querySelectorAll(this.rowSelector);

    // Remove existing placeholder
    if (this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }

    // Update placeholder theme before showing it
    this.updatePlaceholderTheme();

    if (afterElement == null) {
      // Insert at the end
      const lastRow = Array.from(rows)
        .filter(row => row !== this.draggedElement)
        .pop();
      if (lastRow) {
        lastRow.parentNode.insertBefore(this.placeholder, lastRow.nextSibling);
      } else {
        // If no other rows, insert at the beginning
        this.container.appendChild(this.placeholder);
      }
    } else if (afterElement !== this.draggedElement) {
      // Insert before the afterElement
      afterElement.parentNode.insertBefore(this.placeholder, afterElement);
    }
  }

  handleMouseUp(e) {
    if (!this.draggedElement) return;

    document.body.style.cursor = '';

    if (this.isDragging) {
      this.completeDrag();
    } else {
      // Just cleanup if we didn't actually drag
      this.cleanup();
    }
  }

  completeDrag() {
    if (!this.draggedElement || !this.placeholder.parentNode) {
      this.cleanup();
      return;
    }

    // Insert the dragged element where the placeholder is
    this.placeholder.parentNode.insertBefore(
      this.draggedElement,
      this.placeholder
    );

    // Remove placeholder
    if (this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }

    // Reindex all rows to maintain correct radio button values
    if (this.rowManager && typeof this.rowManager.reindexRows === 'function') {
      const modifierBox = this.container.closest('#pixels-modifier-box');
      if (modifierBox) {
        this.rowManager.reindexRows(modifierBox);
        
        // Save the new order to localStorage after reindexing
        if (typeof this.rowManager.saveModifierRows === 'function') {
          this.rowManager.saveModifierRows(modifierBox);
        }
      }
    }

    this.cleanup();
  }

  getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll(`${this.rowSelector}:not(.dragging)`),
    ];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  cleanup() {
    if (this.draggedElement) {
      this.draggedElement.style.opacity = '';
      this.draggedElement.style.transform = '';
      this.draggedElement.style.zIndex = '';
      this.draggedElement.classList.remove('dragging');
      this.draggedElement = null;
    }

    if (this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }

    this.dragHandle = null;
    this.container = null;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;

    // Reset cursor
    document.body.style.cursor = '';
  }

  // Method to add drag handle to a row
  static addDragHandle(row) {
    // Check if drag handle already exists
    if (row.querySelector('.drag-handle')) return;

    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.title = 'Drag to reorder';
    dragHandle.innerHTML = '⋮⋮';

    // Insert at the beginning of the row
    row.insertBefore(dragHandle, row.firstChild);
  }

  // Method to remove drag handle from a row
  static removeDragHandle(row) {
    const dragHandle = row.querySelector('.drag-handle');
    if (dragHandle) {
      dragHandle.remove();
    }
  }
}

// Export for use in other modules
window.RowDragDrop = RowDragDrop;
