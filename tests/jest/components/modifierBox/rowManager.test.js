/**
 * @jest-environment jsdom
 */

const rowManagerModule = require('../../../../src/components/modifierBox/rowManager.js');

describe('Saved Roll Formula Row Manager', () => {
  beforeEach(() => {
    resetMocks();

    if (rowManagerModule.resetState) {
      rowManagerModule.resetState();
    }

    if (rowManagerModule.default) {
      window.ModifierBoxRowManager = rowManagerModule.default;
    }

    window.ModifierBoxThemeManager = {
      forceElementUpdates: jest.fn(),
    };
  });

  describe('Module Initialization', () => {
    test('should initialize ModifierBoxRowManager global object', () => {
      expect(window.ModifierBoxRowManager).toBeDefined();
      expect(typeof window.ModifierBoxRowManager).toBe('object');
    });

    test('should expose correct API methods', () => {
      expect(window.ModifierBoxRowManager.setupModifierRowLogic).toBeInstanceOf(
        Function
      );
      expect(window.ModifierBoxRowManager.addModifierRow).toBeInstanceOf(
        Function
      );
      expect(window.ModifierBoxRowManager.removeModifierRow).toBeInstanceOf(
        Function
      );
      expect(window.ModifierBoxRowManager.updateEventListeners).toBeInstanceOf(
        Function
      );
      expect(window.ModifierBoxRowManager.executeFormula).toBeInstanceOf(
        Function
      );
      expect(window.ModifierBoxRowManager.getRowCounter).toBeInstanceOf(
        Function
      );
      expect(window.ModifierBoxRowManager.setRowCounter).toBeInstanceOf(
        Function
      );
    });

    test('should initialize with correct row counter', () => {
      expect(window.ModifierBoxRowManager.getRowCounter()).toBe(1);
    });

    test('updateSelectedModifier should be a no-op for backward compat', () => {
      expect(() => {
        window.ModifierBoxRowManager.updateSelectedModifier(null);
      }).not.toThrow();
    });
  });

  describe('setupModifierRowLogic', () => {
    test('should handle null modifierBox parameter', () => {
      window.ModifierBoxRowManager.setupModifierRowLogic(null);

      expect(console.error).toHaveBeenCalledWith(
        'setupRowLogic: modifierBox is required'
      );
    });

    test('should set up add button listener', () => {
      const box = createMockSavedRollsBox();

      window.ModifierBoxRowManager.setupModifierRowLogic(box);

      const addButton = box.querySelector('.add-modifier-btn');
      expect(addButton.getAttribute('data-listener-added')).toBe('true');
    });
  });

  describe('addModifierRow (addFormulaRow)', () => {
    test('should handle null modifierBox parameter', () => {
      window.ModifierBoxRowManager.addModifierRow(null);

      expect(console.error).toHaveBeenCalledWith(
        'addFormulaRow: modifierBox is required'
      );
    });

    test('should handle missing content area', () => {
      const box = document.createElement('div');
      window.ModifierBoxRowManager.addModifierRow(box);

      expect(console.error).toHaveBeenCalledWith(
        'addFormulaRow: content area not found'
      );
    });

    test('should create row with correct formula structure', () => {
      const box = createMockSavedRollsBox();
      const initialRows = box.querySelectorAll('.modifier-row').length;

      window.ModifierBoxRowManager.addModifierRow(box);

      const rows = box.querySelectorAll('.modifier-row');
      expect(rows.length).toBe(initialRows + 1);

      const newRow = rows[rows.length - 1];
      const nameInput = newRow.querySelector('.modifier-name');
      const formulaInput = newRow.querySelector('.formula-input');
      const rollBtn = newRow.querySelector('.roll-formula-btn');
      const removeBtn = newRow.querySelector('.remove-row-btn');
      const dragHandle = newRow.querySelector('.drag-handle');

      expect(nameInput).toBeTruthy();
      expect(formulaInput).toBeTruthy();
      expect(rollBtn).toBeTruthy();
      expect(removeBtn).toBeTruthy();
      expect(dragHandle).toBeTruthy();
      expect(nameInput.value).toBe('Roll');
      expect(formulaInput.placeholder).toBe('e.g. 2d6+3');
    });

    test('should increment row counter', () => {
      const box = createMockSavedRollsBox();
      const before = window.ModifierBoxRowManager.getRowCounter();

      window.ModifierBoxRowManager.addModifierRow(box);

      expect(window.ModifierBoxRowManager.getRowCounter()).toBe(before + 1);
    });

    test('should focus new row name field', () => {
      const box = createMockSavedRollsBox();
      document.body.appendChild(box);

      window.ModifierBoxRowManager.addModifierRow(box);

      const rows = box.querySelectorAll('.modifier-row');
      const newRow = rows[rows.length - 1];
      const nameInput = newRow.querySelector('.modifier-name');
      expect(document.activeElement).toBe(nameInput);
    });
  });

  describe('removeModifierRow (removeRow)', () => {
    test('should handle null rowElement parameter', () => {
      const box = createMockSavedRollsBox();
      window.ModifierBoxRowManager.removeModifierRow(null, box);

      expect(console.error).toHaveBeenCalledWith(
        'removeRow: rowElement is null or undefined'
      );
    });

    test('should handle null modifierBox parameter', () => {
      const row = document.createElement('div');
      window.ModifierBoxRowManager.removeModifierRow(row, null);

      expect(console.error).toHaveBeenCalledWith(
        'removeRow: modifierBox is required'
      );
    });

    test('should reset last remaining row instead of removing it', () => {
      const box = createMockSavedRollsBox();
      const row = box.querySelector('.modifier-row');

      window.ModifierBoxRowManager.removeModifierRow(row, box);

      // Should still have one row
      const rows = box.querySelectorAll('.modifier-row');
      expect(rows.length).toBe(1);
      // Should be reset to defaults
      expect(row.querySelector('.modifier-name').value).toBe('Roll');
      expect(row.querySelector('.formula-input').value).toBe('1d20');
    });

    test('should remove row when multiple rows exist', () => {
      const box = createMockSavedRollsBox();
      window.ModifierBoxRowManager.addModifierRow(box);

      const rows = box.querySelectorAll('.modifier-row');
      expect(rows.length).toBe(2);

      window.ModifierBoxRowManager.removeModifierRow(rows[1], box);

      expect(box.querySelectorAll('.modifier-row').length).toBe(1);
    });
  });

  describe('serializeRows', () => {
    test('should serialize rows with name and formula', () => {
      const box = createMockSavedRollsBox();
      const data = window.ModifierBoxRowManager.serializeRows(box);

      expect(data.version).toBe(2);
      expect(data.rows).toEqual([{ name: 'Attack', formula: '1d20' }]);
    });

    test('should handle null box', () => {
      const data = window.ModifierBoxRowManager.serializeRows(null);
      expect(data).toEqual({ rows: [], version: 2 });
    });

    test('should preserve DOM order', () => {
      const box = createMockSavedRollsBox();
      window.ModifierBoxRowManager.addModifierRow(box);

      // Set second row values
      const rows = box.querySelectorAll('.modifier-row');
      rows[1].querySelector('.modifier-name').value = 'Fireball';
      rows[1].querySelector('.formula-input').value = '8d6';

      const data = window.ModifierBoxRowManager.serializeRows(box);
      expect(data.rows).toEqual([
        { name: 'Attack', formula: '1d20' },
        { name: 'Fireball', formula: '8d6' },
      ]);
    });
  });

  describe('applyRows', () => {
    test('should rebuild rows from v2 data', () => {
      const box = createMockSavedRollsBox();
      const data = {
        rows: [
          { name: 'Sword', formula: '1d20+5' },
          { name: 'Damage', formula: '2d6+3' },
        ],
        version: 2,
      };

      const result = window.ModifierBoxRowManager.applyRows(box, data);
      expect(result).toBe(true);

      const rows = box.querySelectorAll('.modifier-row');
      expect(rows.length).toBe(2);
      expect(rows[0].querySelector('.modifier-name').value).toBe('Sword');
      expect(rows[0].querySelector('.formula-input').value).toBe('1d20+5');
      expect(rows[1].querySelector('.modifier-name').value).toBe('Damage');
      expect(rows[1].querySelector('.formula-input').value).toBe('2d6+3');
    });

    test('should migrate v1 data (numeric modifiers) to v2 formulas', () => {
      const box = createMockSavedRollsBox();
      const v1Data = {
        rows: [
          { name: 'Attack', value: '5', originalIndex: '0' },
          { name: 'Defense', value: '-2', originalIndex: '1' },
          { name: 'None', value: '0', originalIndex: '2' },
        ],
        selectedIndex: 0,
      };

      const result = window.ModifierBoxRowManager.applyRows(box, v1Data);
      expect(result).toBe(true);

      const rows = box.querySelectorAll('.modifier-row');
      expect(rows.length).toBe(3);
      expect(rows[0].querySelector('.formula-input').value).toBe('1d20+5');
      expect(rows[1].querySelector('.formula-input').value).toBe('1d20-2');
      expect(rows[2].querySelector('.formula-input').value).toBe('1d20');
    });

    test('should return false for null box', () => {
      const result = window.ModifierBoxRowManager.applyRows(null, {
        rows: [],
        version: 2,
      });
      expect(result).toBe(false);
    });

    test('should return false for invalid data', () => {
      const box = createMockSavedRollsBox();
      const result = window.ModifierBoxRowManager.applyRows(box, null);
      expect(result).toBe(false);
    });
  });

  describe('saveRows and loadRows', () => {
    test('should persist rows to localStorage under new key', () => {
      const box = createMockSavedRollsBox();
      window.ModifierBoxRowManager.saveModifierRows(box);

      const stored = localStorage.getItem('pixels_saved_rolls');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored);
      expect(parsed.rows).toEqual([{ name: 'Attack', formula: '1d20' }]);
      expect(parsed.version).toBe(2);
    });

    test('should load rows from localStorage', () => {
      const data = {
        rows: [{ name: 'Spell', formula: '4d6kh3' }],
        version: 2,
        rowCounter: 2,
      };
      localStorage.setItem('pixels_saved_rolls', JSON.stringify(data));

      const box = createMockSavedRollsBox();
      const result = window.ModifierBoxRowManager.loadModifierRows(box);
      expect(result).toBe(true);

      const rows = box.querySelectorAll('.modifier-row');
      expect(rows[0].querySelector('.modifier-name').value).toBe('Spell');
      expect(rows[0].querySelector('.formula-input').value).toBe('4d6kh3');
    });

    test('should migrate from legacy storage key', () => {
      localStorage.clear();
      const legacyData = {
        rows: [{ name: 'Old', value: '3', originalIndex: '0' }],
        selectedIndex: 0,
        rowCounter: 2,
      };
      localStorage.setItem('pixels_modifier_rows', JSON.stringify(legacyData));

      const box = createMockSavedRollsBox();
      const result = window.ModifierBoxRowManager.loadModifierRows(box);
      expect(result).toBe(true);

      // Should have migrated to new key
      expect(localStorage.getItem('pixels_saved_rolls')).toBeTruthy();
      expect(localStorage.getItem('pixels_modifier_rows')).toBeNull();

      const rows = box.querySelectorAll('.modifier-row');
      expect(rows[0].querySelector('.formula-input').value).toBe('1d20+3');
    });
  });

  describe('executeFormula', () => {
    test('should call PixelsCommand.interceptFormula', () => {
      window.PixelsCommand = { interceptFormula: jest.fn() };

      window.ModifierBoxRowManager.executeFormula('2d6+3');

      expect(window.PixelsCommand.interceptFormula).toHaveBeenCalledWith(
        '2d6+3'
      );
    });

    test('should not call anything for empty formula', () => {
      window.PixelsCommand = { interceptFormula: jest.fn() };

      window.ModifierBoxRowManager.executeFormula('');
      window.ModifierBoxRowManager.executeFormula(null);

      expect(window.PixelsCommand.interceptFormula).not.toHaveBeenCalled();
    });

    test('should trim whitespace from formula', () => {
      window.PixelsCommand = { interceptFormula: jest.fn() };

      window.ModifierBoxRowManager.executeFormula('  2d6+3  ');

      expect(window.PixelsCommand.interceptFormula).toHaveBeenCalledWith(
        '2d6+3'
      );
    });
  });

  describe('resetAllRows', () => {
    test('should reset to a single default row', () => {
      const box = createMockSavedRollsBox();
      window.ModifierBoxRowManager.addModifierRow(box);
      window.ModifierBoxRowManager.addModifierRow(box);
      expect(box.querySelectorAll('.modifier-row').length).toBe(3);

      window.ModifierBoxRowManager.resetAllRows(box);

      const rows = box.querySelectorAll('.modifier-row');
      expect(rows.length).toBe(1);
      expect(rows[0].querySelector('.modifier-name').value).toBe('Attack');
      expect(rows[0].querySelector('.formula-input').value).toBe('1d20');
    });

    test('should handle null modifierBox', () => {
      window.ModifierBoxRowManager.resetAllRows(null);
      expect(console.error).toHaveBeenCalledWith(
        'resetAllRows: modifierBox is required'
      );
    });
  });

  describe('reindexRows', () => {
    test('should update data-index attributes after row removal', () => {
      const box = createMockSavedRollsBox();
      window.ModifierBoxRowManager.addModifierRow(box);
      window.ModifierBoxRowManager.addModifierRow(box);

      // Remove middle row manually
      const rows = box.querySelectorAll('.modifier-row');
      rows[1].remove();

      window.ModifierBoxRowManager.reindexRows(box);

      const remaining = box.querySelectorAll('.modifier-row');
      expect(
        remaining[0].querySelector('.modifier-name').getAttribute('data-index')
      ).toBe('0');
      expect(
        remaining[1].querySelector('.modifier-name').getAttribute('data-index')
      ).toBe('1');
    });
  });

  // Helper function to create a mock saved rolls box (new formula-based structure)
  function createMockSavedRollsBox() {
    const box = document.createElement('div');
    box.id = 'pixels-modifier-box';
    box.innerHTML = `
      <div class="pixels-header">
        <span class="pixels-title">
          <img src="logo.png" alt="Pixels" class="pixels-logo"> Saved Rolls
        </span>
        <div class="pixels-controls">
          <button class="add-modifier-btn" type="button">Add</button>
        </div>
      </div>
      <div class="pixels-content">
        <div class="modifier-row">
          <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
          <input type="text" class="modifier-name" placeholder="Name" value="Attack" data-index="0">
          <input type="text" class="formula-input" placeholder="e.g. 2d6+3" value="1d20" data-index="0">
          <button class="roll-formula-btn" type="button" title="Roll this formula">Roll</button>
          <button class="remove-row-btn" type="button">×</button>
        </div>
      </div>
    `;
    document.body.appendChild(box);
    return box;
  }
});
