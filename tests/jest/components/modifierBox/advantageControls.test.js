/**
 * @jest-environment jsdom
 */

const uiControlsModule = require('../../../../src/components/modifierBox/uiControls.js');

const setupAdvantageControls = uiControlsModule.setupAdvantageControls;

function createMockModifierBox() {
  const box = document.createElement('div');
  box.id = 'pixels-modifier-box';
  box.innerHTML = `
    <div class="pixels-advantage-footer">
      <span class="pixels-advantage-label">Roll:</span>
      <div class="pixels-advantage-buttons">
        <button class="advantage-btn active" data-type="normal">Normal</button>
        <button class="advantage-btn" data-type="advantage">Adv</button>
        <button class="advantage-btn" data-type="disadvantage">Dis</button>
      </div>
    </div>
  `;
  document.body.appendChild(box);
  return box;
}

describe('Advantage Controls', () => {
  beforeEach(() => {
    resetMocks();
    localStorage.clear();
    window.pixelsRollType = 'normal';
  });

  describe('Initialization', () => {
    test('defaults to normal when localStorage is empty', () => {
      const box = createMockModifierBox();
      setupAdvantageControls(box);

      expect(window.pixelsRollType).toBe('normal');
      const normalBtn = box.querySelector('[data-type="normal"]');
      expect(normalBtn.classList.contains('active')).toBe(true);
    });

    test('restores saved roll type from localStorage', () => {
      localStorage.setItem('pixels_roll_type', 'advantage');
      const box = createMockModifierBox();
      setupAdvantageControls(box);

      expect(window.pixelsRollType).toBe('advantage');
      const advBtn = box.querySelector('[data-type="advantage"]');
      expect(advBtn.classList.contains('active')).toBe(true);
      const normalBtn = box.querySelector('[data-type="normal"]');
      expect(normalBtn.classList.contains('active')).toBe(false);
    });

    test('restores disadvantage from localStorage', () => {
      localStorage.setItem('pixels_roll_type', 'disadvantage');
      const box = createMockModifierBox();
      setupAdvantageControls(box);

      expect(window.pixelsRollType).toBe('disadvantage');
      const disBtn = box.querySelector('[data-type="disadvantage"]');
      expect(disBtn.classList.contains('active')).toBe(true);
    });

    test('does nothing if modifierBox is null', () => {
      expect(() => setupAdvantageControls(null)).not.toThrow();
    });

    test('does nothing if no advantage buttons are present', () => {
      const box = document.createElement('div');
      expect(() => setupAdvantageControls(box)).not.toThrow();
    });
  });

  describe('Button clicks', () => {
    test('clicking Adv sets pixelsRollType to advantage', () => {
      const box = createMockModifierBox();
      setupAdvantageControls(box);

      const advBtn = box.querySelector('[data-type="advantage"]');
      advBtn.click();

      expect(window.pixelsRollType).toBe('advantage');
    });

    test('clicking Adv persists to localStorage', () => {
      const box = createMockModifierBox();
      setupAdvantageControls(box);

      const advBtn = box.querySelector('[data-type="advantage"]');
      advBtn.click();

      expect(localStorage.getItem('pixels_roll_type')).toBe('advantage');
    });

    test('clicking Adv adds active class to Adv and removes from others', () => {
      const box = createMockModifierBox();
      setupAdvantageControls(box);

      const advBtn = box.querySelector('[data-type="advantage"]');
      const normalBtn = box.querySelector('[data-type="normal"]');
      const disBtn = box.querySelector('[data-type="disadvantage"]');
      advBtn.click();

      expect(advBtn.classList.contains('active')).toBe(true);
      expect(normalBtn.classList.contains('active')).toBe(false);
      expect(disBtn.classList.contains('active')).toBe(false);
    });

    test('clicking Dis sets pixelsRollType to disadvantage', () => {
      const box = createMockModifierBox();
      setupAdvantageControls(box);

      box.querySelector('[data-type="disadvantage"]').click();

      expect(window.pixelsRollType).toBe('disadvantage');
      expect(localStorage.getItem('pixels_roll_type')).toBe('disadvantage');
    });

    test('clicking Normal after Adv resets to normal', () => {
      localStorage.setItem('pixels_roll_type', 'advantage');
      const box = createMockModifierBox();
      setupAdvantageControls(box);

      box.querySelector('[data-type="normal"]').click();

      expect(window.pixelsRollType).toBe('normal');
      expect(localStorage.getItem('pixels_roll_type')).toBe('normal');
      const normalBtn = box.querySelector('[data-type="normal"]');
      expect(normalBtn.classList.contains('active')).toBe(true);
    });
  });
});
