/**
 * HTML Generator Module
 * Handles fallback HTML creation for the modifier box when templates fail to load
 */

'use strict';

// Generate the modifier box HTML structure
export function generateModifierBoxHTML(logoUrl = 'assets/images/logo-128.png') {
  return `
    <div class="pixels-header">
        <span class="pixels-title">
            <img src="${logoUrl}" alt="Pixels" class="pixels-logo"> Modifiers
        </span>
        <div class="pixels-controls">
            <button class="add-modifier-btn" type="button" title="Add Row">Add</button>
            <button class="clear-all-btn" type="button" title="Clear All">Clear All</button>
            <button class="pixels-minimize" title="Minimize">−</button>
        </div>
    </div>
    <div class="pixels-content">
        <div class="modifier-row">
            <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
            <input type="radio" name="modifier-select" value="0" class="modifier-radio" id="mod-0" checked>
            <input type="text" class="modifier-name" placeholder="Modifier" value="Modifier" data-index="0">
            <input type="number" class="modifier-value" value="0" min="-99" max="99" data-index="0">
            <button class="remove-row-btn" type="button">×</button>
        </div>
    </div>
    <div class="pixels-resize-handle"></div>
  `;
}

export function getLogoUrl() {
  let logoUrl = 'assets/images/logo-128.png';
  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.getURL
    ) {
      logoUrl = chrome.runtime.getURL('assets/images/logo-128.png');
    }
  } catch {
    // Using fallback logo URL (not in extension context)
  }
  return logoUrl;
}

export function createModifierBoxElement() {
  const modifierBox = document.createElement('div');
  modifierBox.id = 'pixels-modifier-box';
  modifierBox.setAttribute('data-testid', 'pixels-modifier-box');
  modifierBox.className = 'PIXELS_EXTENSION_BOX_FIND_ME';

  const logoUrl = getLogoUrl();
  modifierBox.innerHTML = generateModifierBoxHTML(logoUrl);

  return modifierBox;
}

export function processTemplateHTML(htmlTemplate, logoUrl = null) {
  if (!logoUrl) {
    logoUrl = getLogoUrl();
  }
  return htmlTemplate.replace('{{logoUrl}}', logoUrl);
}

export function extractModifierBoxFromTemplate(processedHTML) {
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = processedHTML;
  return tempContainer.firstElementChild;
}

const HTMLGenerator = {
  generateModifierBoxHTML,
  getLogoUrl,
  createModifierBoxElement,
  processTemplateHTML,
  extractModifierBoxFromTemplate,
};

export default HTMLGenerator;

if (typeof window !== 'undefined') {
  window.ModifierBoxHTMLGenerator = HTMLGenerator;
}
