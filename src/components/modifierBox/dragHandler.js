'use strict';

//
// Drag Handler Module - Handles drag functionality for the modifier box
//
(function () {
  // Export functions to global scope
  window.ModifierBoxDragHandler = {
    setupDragFunctionality: setupDragFunctionality,
  };

  function setupDragFunctionality(modifierBox) {
    if (!modifierBox) {
      console.error('setupDragFunctionality: modifierBox is required');
      return;
    }

    let isDragging = false;
    let isResizing = false;
    let dragOffset = { x: 0, y: 0 };

    // Store original dimensions for restore functionality
    const originalDimensions = {
      width: 400,
      height: null, // Will be set after content is loaded
    };

    const header = modifierBox.querySelector('.pixels-header');
    if (!header) {
      console.error('setupDragFunctionality: header not found');
      return;
    }

    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'pixels-resize-handle';
    resizeHandle.style.cssText = `
            position: absolute !important;
            bottom: 0 !important;
            right: 0 !important;
            width: 20px !important;
            height: 20px !important;
            cursor: se-resize !important;
            background: linear-gradient(-45deg, transparent 25%, #666 35%, transparent 45%, #666 55%, transparent 65%, #666 75%, transparent 85%) !important;
            border-bottom-right-radius: 8px !important;
            z-index: 10 !important;
        `;
    modifierBox.appendChild(resizeHandle);

    // Add double-click to restore original size
    resizeHandle.addEventListener('dblclick', e => {
      modifierBox.style.setProperty(
        'width',
        originalDimensions.width + 'px',
        'important'
      );
      if (originalDimensions.height) {
        modifierBox.style.setProperty(
          'height',
          originalDimensions.height + 'px',
          'important'
        );
      } else {
        modifierBox.style.setProperty('height', 'auto', 'important');
      }
      e.preventDefault();
      e.stopPropagation();
    });

    // Ensure the modifier box maintains fixed positioning for dragging
    modifierBox.style.position = 'fixed';

    // Set initial dimensions and store them
    modifierBox.style.setProperty(
      'width',
      originalDimensions.width + 'px',
      'important'
    );

    // Set initial position if not already set
    if (!modifierBox.style.left || modifierBox.style.left === 'auto') {
      modifierBox.style.left = '20px';
    }
    if (!modifierBox.style.top || modifierBox.style.top === 'auto') {
      modifierBox.style.top = '20px';
    }
    modifierBox.style.right = 'auto';
    modifierBox.style.bottom = 'auto';

    // Store original height after content is rendered
    setTimeout(() => {
      if (!originalDimensions.height) {
        const rect = modifierBox.getBoundingClientRect();
        originalDimensions.height = rect.height;
      }
    }, 100);

    // Drag functionality
    header.addEventListener('mousedown', e => {
      // Skip if clicking on buttons or other interactive elements
      if (
        e.target.tagName === 'BUTTON' ||
        e.target.classList.contains('pixels-close') ||
        e.target.classList.contains('pixels-minimize') ||
        e.target.classList.contains('add-modifier-btn') ||
        e.target === resizeHandle ||
        e.target.closest('button')
      ) {
        return;
      }

      isDragging = true;
      const rect = modifierBox.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
      e.stopPropagation();
    });

    // Resize functionality
    resizeHandle.addEventListener('mousedown', e => {
      isResizing = true;
      const rect = modifierBox.getBoundingClientRect();
      // Store initial dimensions and mouse position
      dragOffset.x = e.clientX;
      dragOffset.y = e.clientY;
      dragOffset.initialWidth = rect.width;
      dragOffset.initialHeight = rect.height;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
      e.stopPropagation();
    });

    function onMouseMove(e) {
      if (isDragging) {
        const newLeft = e.clientX - dragOffset.x;
        const newTop = e.clientY - dragOffset.y;

        // Keep within viewport bounds
        const maxLeft = window.innerWidth - 100; // Keep at least 100px visible
        const maxTop = window.innerHeight - 50; // Keep at least 50px visible

        modifierBox.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
        modifierBox.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
      } else if (isResizing) {
        // Calculate size change based on mouse movement
        const deltaX = e.clientX - dragOffset.x;
        const deltaY = e.clientY - dragOffset.y;

        const newWidth = Math.max(dragOffset.initialWidth + deltaX, 0);
        const newHeight = Math.max(dragOffset.initialHeight + deltaY, 0);

        // Set minimum and maximum dimensions
        const minWidth = 250;
        const minHeight = 120; // Reduced minimum height to allow smaller boxes
        const maxWidth = Math.min(800, window.innerWidth * 0.8);
        const maxHeight = Math.min(600, window.innerHeight * 0.8);

        // Apply width constraints and update
        const constrainedWidth = Math.max(
          minWidth,
          Math.min(newWidth, maxWidth)
        );
        const constrainedHeight = Math.max(
          minHeight,
          Math.min(newHeight, maxHeight)
        );

        // Use setProperty with important flag to override CSS !important rules
        modifierBox.style.setProperty(
          'width',
          constrainedWidth + 'px',
          'important'
        );
        modifierBox.style.setProperty(
          'height',
          constrainedHeight + 'px',
          'important'
        );

        // Prevent the box from going off-screen during resize
        const rect = modifierBox.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          modifierBox.style.left = window.innerWidth - rect.width - 10 + 'px';
        }
        if (rect.bottom > window.innerHeight) {
          modifierBox.style.top = window.innerHeight - rect.height - 10 + 'px';
        }
      }
    }

    function onMouseUp() {
      isDragging = false;
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }
})();
