/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

function loadModule(modulePath) {
  const fullPath = path.join(__dirname, '../../../../', modulePath);
  const moduleCode = fs.readFileSync(fullPath, 'utf8');
  eval(moduleCode);
}

describe('ModifierBox Drag Handler', () => {
  beforeEach(() => {
    resetMocks();
    loadModule('src/components/modifierBox/dragHandler.js');
  });

  describe('Module Initialization', () => {
    test('should initialize ModifierBoxDragHandler global object', () => {
      expect(window.ModifierBoxDragHandler).toBeDefined();
      expect(typeof window.ModifierBoxDragHandler).toBe('object');
    });

    test('should expose setupDragFunctionality method', () => {
      expect(
        window.ModifierBoxDragHandler.setupDragFunctionality
      ).toBeInstanceOf(Function);
    });
  });

  describe('setupDragFunctionality', () => {
    let mockModifierBox;
    let mockHeader;

    beforeEach(() => {
      mockModifierBox = document.createElement('div');
      mockModifierBox.id = 'pixels-modifier-box';
      mockModifierBox.style.position = 'fixed';
      mockModifierBox.style.left = '100px';
      mockModifierBox.style.top = '200px';

      mockHeader = document.createElement('div');
      mockHeader.className = 'pixels-header';
      mockModifierBox.appendChild(mockHeader);

      document.body.appendChild(mockModifierBox);

      // Mock getBoundingClientRect
      mockModifierBox.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 200,
        width: 280,
        height: 150,
      }));
    });

    test('should handle null modifierBox parameter', () => {
      window.ModifierBoxDragHandler.setupDragFunctionality(null);

      expect(console.error).toHaveBeenCalledWith(
        'setupDragFunctionality: modifierBox is required'
      );
    });

    test('should handle missing header element', () => {
      const boxWithoutHeader = document.createElement('div');

      window.ModifierBoxDragHandler.setupDragFunctionality(boxWithoutHeader);

      expect(console.error).toHaveBeenCalledWith(
        'setupDragFunctionality: header not found'
      );
    });

    test('should setup drag functionality successfully', () => {
      window.ModifierBoxDragHandler.setupDragFunctionality(mockModifierBox);

      // Should complete without errors
      expect(mockModifierBox.querySelector('.pixels-header')).toBeTruthy();
    });

    test('should add mousedown event listener to header', () => {
      const addEventListenerSpy = jest.spyOn(mockHeader, 'addEventListener');

      window.ModifierBoxDragHandler.setupDragFunctionality(mockModifierBox);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      );
    });
  });

  describe('Drag Behavior', () => {
    let mockModifierBox;
    let mockHeader;

    beforeEach(() => {
      mockModifierBox = document.createElement('div');
      mockModifierBox.id = 'pixels-modifier-box';
      mockModifierBox.style.position = 'fixed';
      mockModifierBox.style.left = '100px';
      mockModifierBox.style.top = '200px';

      mockHeader = document.createElement('div');
      mockHeader.className = 'pixels-header';
      mockModifierBox.appendChild(mockHeader);

      document.body.appendChild(mockModifierBox);

      mockModifierBox.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 200,
        width: 280,
        height: 150,
      }));

      window.ModifierBoxDragHandler.setupDragFunctionality(mockModifierBox);
    });

    test('should initiate drag on mousedown', () => {
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 250,
        bubbles: true,
      });

      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      mockHeader.dispatchEvent(mouseDownEvent);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mousemove',
        expect.any(Function)
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mouseup',
        expect.any(Function)
      );
    });

    test('should update position during mousemove', () => {
      // Start drag
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150, // 50px from left of box (100px)
        clientY: 250, // 50px from top of box (200px)
        bubbles: true,
      });
      mockHeader.dispatchEvent(mouseDownEvent);

      // Move mouse
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 300, // New position
        clientY: 400,
        bubbles: true,
      });
      document.dispatchEvent(mouseMoveEvent);

      // Check that position was updated
      expect(mockModifierBox.style.left).toBe('250px'); // 300 - 50 = 250
      expect(mockModifierBox.style.top).toBe('350px'); // 400 - 50 = 350
      // In jsdom, unset properties return empty string instead of 'auto'
      expect(mockModifierBox.style.right).toBe('');
    });

    test('should not update position when not dragging', () => {
      const originalLeft = mockModifierBox.style.left;
      const originalTop = mockModifierBox.style.top;

      // Move mouse without starting drag
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 300,
        clientY: 400,
        bubbles: true,
      });
      document.dispatchEvent(mouseMoveEvent);

      expect(mockModifierBox.style.left).toBe(originalLeft);
      expect(mockModifierBox.style.top).toBe(originalTop);
    });

    test('should stop drag on mouseup', () => {
      // Start drag
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 250,
        bubbles: true,
      });
      mockHeader.dispatchEvent(mouseDownEvent);

      const removeEventListenerSpy = jest.spyOn(
        document,
        'removeEventListener'
      );

      // End drag
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
      });
      document.dispatchEvent(mouseUpEvent);

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mousemove',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mouseup',
        expect.any(Function)
      );
    });

    test('should calculate correct drag offset', () => {
      mockModifierBox.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 200,
        width: 280,
        height: 150,
      }));

      // Click at specific position within the header
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 120, // 20px from left edge
        clientY: 210, // 10px from top edge
        bubbles: true,
      });
      mockHeader.dispatchEvent(mouseDownEvent);

      // Move to new position
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 320, // Moved 200px right
        clientY: 410, // Moved 200px down
        bubbles: true,
      });
      document.dispatchEvent(mouseMoveEvent);

      // The box should move to maintain the offset
      expect(mockModifierBox.style.left).toBe('300px'); // 320 - 20 = 300
      expect(mockModifierBox.style.top).toBe('400px'); // 410 - 10 = 400
    });

    test('should handle multiple drag sessions', () => {
      // First drag session
      let mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 250,
        bubbles: true,
      });
      mockHeader.dispatchEvent(mouseDownEvent);

      let mouseUpEvent = new MouseEvent('mouseup', { bubbles: true });
      document.dispatchEvent(mouseUpEvent);

      // Second drag session
      mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 180,
        clientY: 280,
        bubbles: true,
      });
      mockHeader.dispatchEvent(mouseDownEvent);

      mouseUpEvent = new MouseEvent('mouseup', { bubbles: true });
      document.dispatchEvent(mouseUpEvent);

      // Should complete without errors
      expect(mockModifierBox).toBeTruthy();
    });

    test('should maintain drag state correctly', () => {
      // Verify initial state (not dragging)
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 300,
        clientY: 400,
        bubbles: true,
      });

      const originalLeft = mockModifierBox.style.left;
      document.dispatchEvent(mouseMoveEvent);
      expect(mockModifierBox.style.left).toBe(originalLeft);

      // Start dragging
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 250,
        bubbles: true,
      });
      mockHeader.dispatchEvent(mouseDownEvent);

      // Now movement should work
      document.dispatchEvent(mouseMoveEvent);
      expect(mockModifierBox.style.left).toBe('250px');

      // Stop dragging
      const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true });
      document.dispatchEvent(mouseUpEvent);

      // Movement should no longer work
      const anotherMoveEvent = new MouseEvent('mousemove', {
        clientX: 500,
        clientY: 600,
        bubbles: true,
      });
      document.dispatchEvent(anotherMoveEvent);
      expect(mockModifierBox.style.left).toBe('250px'); // Should not change
    });
  });

  describe('Error Handling', () => {
    test('should handle missing getBoundingClientRect gracefully', () => {
      const mockBox = document.createElement('div');
      const mockHeader = document.createElement('div');
      mockHeader.className = 'pixels-header';
      mockBox.appendChild(mockHeader);

      // Remove getBoundingClientRect method
      delete mockBox.getBoundingClientRect;

      expect(() => {
        window.ModifierBoxDragHandler.setupDragFunctionality(mockBox);
      }).not.toThrow();
    });

    test('should handle events with missing properties', () => {
      const mockBox = document.createElement('div');
      const mockHeader = document.createElement('div');
      mockHeader.className = 'pixels-header';
      mockBox.appendChild(mockHeader);

      mockBox.getBoundingClientRect = jest.fn(() => ({ left: 0, top: 0 }));

      window.ModifierBoxDragHandler.setupDragFunctionality(mockBox);

      // Create event without clientX/clientY
      const invalidEvent = new Event('mousedown');

      expect(() => {
        mockHeader.dispatchEvent(invalidEvent);
      }).not.toThrow();
    });
  });
});
