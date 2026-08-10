/**
 * PixelsCommand.js
 *
 * Intercepts /pixels, /pixel, or /pix commands in the Roll20 chat input.
 * Parses a dice formula using @3d-dice/dice-roller-parser, shows a prompt
 * overlay that collects physical dice rolls by type, handles dynamic
 * explosion/reroll slots, and posts the evaluated result when complete.
 *
 * Supports Roll20 roll queries: ?{Prompt|default} and ?{Prompt|opt1|opt2}
 * are resolved via a modal before the formula is parsed.
 */

'use strict';

import {
  parseFormula,
  buildSlotsFromAst,
  checkExplosion,
  checkReroll,
  addExplosionSlot,
  markSlotForReroll,
  evaluateWithValues,
  buildEvaluationOrder,
  isSuccessCountRoll,
  getFormulaDisplay,
} from './FormulaEvaluator.js';

const COMMAND_PATTERN = /^\/pix(?:el(?:s)?)?(?:\s+(.+))?$/i;
const GM_COMMAND_PATTERN = /^\/gmpix(?:el(?:s)?)?(?:\s+(.+))?$/i;
const ROLL_QUERY_PATTERN = /\?\{([^}]+)\}/g;

let pendingPrompt = null;

// --- Roll Query Resolution ---

/**
 * Parse a roll query token like "Modifier|0" or "Damage|1d6|1d8|2d6".
 * Returns { label, defaultValue, options }.
 * - Single value after label: text input with that default
 * - Multiple values after label: dropdown with those options
 * - No value after label: text input with empty default
 */
function parseQueryToken(token) {
  const parts = token.split('|');
  const label = parts[0].trim();

  if (parts.length <= 1) {
    return { label, defaultValue: '', options: null };
  }
  if (parts.length === 2) {
    return { label, defaultValue: parts[1].trim(), options: null };
  }
  // 3+ parts: dropdown options (first option is default/selected)
  const options = parts.slice(1).map(p => p.trim());
  return { label, defaultValue: options[0], options };
}

/**
 * Check if a formula contains roll queries.
 */
function containsRollQueries(formula) {
  return ROLL_QUERY_PATTERN.test(formula);
}

/**
 * Extract all roll query tokens from a formula.
 * Returns an array of { label, defaultValue, options, fullMatch }.
 */
function extractRollQueries(formula) {
  const queries = [];
  // Reset lastIndex since the regex is global
  ROLL_QUERY_PATTERN.lastIndex = 0;
  let match;
  while ((match = ROLL_QUERY_PATTERN.exec(formula)) !== null) {
    const parsed = parseQueryToken(match[1]);
    queries.push({ ...parsed, fullMatch: match[0] });
  }
  return queries;
}

/**
 * Show a modal to resolve all roll queries, then call onResolved with the
 * substituted formula string. Calls onCancelled if the user cancels.
 */
function resolveRollQueries(formula, onResolved, onCancelled) {
  const queries = extractRollQueries(formula);
  if (queries.length === 0) {
    onResolved(formula);
    return;
  }
  showQueryModal(
    queries,
    values => {
      let resolved = formula;
      for (let i = 0; i < queries.length; i++) {
        resolved = resolved.replace(queries[i].fullMatch, values[i]);
      }
      onResolved(resolved);
    },
    onCancelled
  );
}

// --- Roll Query Modal UI ---

let queryModalElement = null;

function createQueryModal() {
  const modal = document.createElement('div');
  modal.id = 'pixels-query-modal';
  modal.innerHTML = `
    <div class="pixels-query-header">
      <span class="pixels-query-title">Roll Parameters</span>
      <button class="pixels-query-cancel" title="Cancel">✕</button>
    </div>
    <div class="pixels-query-fields"></div>
    <div class="pixels-query-actions">
      <button class="pixels-query-submit">Roll</button>
    </div>
  `;
  document.body.appendChild(modal);
  injectQueryModalStyles();
  return modal;
}

function showQueryModal(queries, onSubmit, onCancel) {
  if (!queryModalElement) {
    queryModalElement = createQueryModal();
  }
  queryModalElement.style.display = 'block';

  const fieldsEl = queryModalElement.querySelector('.pixels-query-fields');
  fieldsEl.innerHTML = '';

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const row = document.createElement('div');
    row.className = 'pixels-query-row';

    const label = document.createElement('label');
    label.className = 'pixels-query-label';
    label.textContent = query.label;
    label.setAttribute('for', `pixels-query-input-${i}`);
    row.appendChild(label);

    if (query.options) {
      const select = document.createElement('select');
      select.className = 'pixels-query-select';
      select.id = `pixels-query-input-${i}`;
      select.dataset.index = i;
      for (const opt of query.options) {
        const optEl = document.createElement('option');
        optEl.value = opt;
        optEl.textContent = opt;
        select.appendChild(optEl);
      }
      row.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.className = 'pixels-query-input';
      input.id = `pixels-query-input-${i}`;
      input.type = 'text';
      input.value = query.defaultValue;
      input.dataset.index = i;
      row.appendChild(input);
    }

    fieldsEl.appendChild(row);
  }

  // Wire up event handlers (replace old ones via cloneNode)
  const cancelBtn = queryModalElement.querySelector('.pixels-query-cancel');
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  const submitBtn = queryModalElement.querySelector('.pixels-query-submit');
  const newSubmitBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

  const collectValues = () => {
    const values = [];
    for (let i = 0; i < queries.length; i++) {
      const el = queryModalElement.querySelector(`#pixels-query-input-${i}`);
      values.push(el.value);
    }
    return values;
  };

  const handleSubmit = () => {
    const values = collectValues();
    hideQueryModal();
    onSubmit(values);
  };

  const handleCancel = () => {
    hideQueryModal();
    if (onCancel) {
      onCancel();
    }
  };

  newCancelBtn.addEventListener('click', handleCancel);
  newSubmitBtn.addEventListener('click', handleSubmit);

  // Submit on Enter from any input
  fieldsEl.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  });

  // Focus the first input/select
  const firstInput = fieldsEl.querySelector('input, select');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 0);
  }
}

function hideQueryModal() {
  if (queryModalElement) {
    queryModalElement.style.display = 'none';
  }
}

function injectQueryModalStyles() {
  if (document.getElementById('pixels-query-styles')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'pixels-query-styles';
  style.textContent = `
    #pixels-query-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000002;
      background: #2b2b2b;
      border: 2px solid #4a9eff;
      border-radius: 12px;
      padding: 20px;
      min-width: 280px;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: Arial, sans-serif;
      color: #ffffff;
      display: none;
    }
    .pixels-query-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .pixels-query-title {
      font-size: 16px;
      font-weight: bold;
    }
    .pixels-query-cancel {
      background: none;
      border: 1px solid #666;
      border-radius: 4px;
      color: #ccc;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 8px;
    }
    .pixels-query-cancel:hover {
      background: #5a2a2a;
      border-color: #f87171;
      color: #f87171;
    }
    .pixels-query-fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }
    .pixels-query-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pixels-query-label {
      font-size: 13px;
      color: #ccc;
    }
    .pixels-query-input,
    .pixels-query-select {
      background: #1a1a1a;
      border: 1px solid #555;
      border-radius: 6px;
      color: #fff;
      font-size: 14px;
      padding: 8px 10px;
      outline: none;
    }
    .pixels-query-input:focus,
    .pixels-query-select:focus {
      border-color: #4a9eff;
    }
    .pixels-query-actions {
      display: flex;
      justify-content: flex-end;
    }
    .pixels-query-submit {
      background: #4a9eff;
      border: none;
      border-radius: 6px;
      color: #fff;
      font-size: 14px;
      font-weight: bold;
      padding: 8px 20px;
      cursor: pointer;
    }
    .pixels-query-submit:hover {
      background: #3b82f6;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Start a prompted roll session from a parsed formula.
 */
function startPrompt(promptData) {
  pendingPrompt = promptData;
  showPromptOverlay(pendingPrompt);
}

/**
 * Mapping from larger die types to the smaller die they can substitute for.
 * d8 → d4, d12 → d6, d20 → d10.
 */
const SUBSTITUTION_MAP = { 8: 4, 12: 6, 20: 10 };

/**
 * Convert a face value from a larger die to fit the smaller die's range.
 * If the value exceeds half the larger die's max, subtract half.
 * Example: d20 rolls 19 → 19 > 10, so result is 19 - 10 = 9.
 */
function convertSubstitutedValue(faceValue, largerDieType) {
  const half = largerDieType / 2;
  return faceValue > half ? faceValue - half : faceValue;
}

/**
 * Attempt to fill a slot with an incoming roll. Returns true if consumed.
 */
function offerRoll(dieType, faceValue) {
  if (!pendingPrompt) {
    return false;
  }

  // Find first unfilled slot matching this die type exactly
  const slot = pendingPrompt.slots.find(
    s => s.value === null && s.type === dieType
  );

  if (slot) {
    return fillSlot(slot, faceValue);
  }

  // No exact match — d100 (percentile) always works as d10
  // Convert tens (10,20...90,100) to 1-10 range
  if (dieType === 100) {
    const d10Slot = pendingPrompt.slots.find(
      s => s.value === null && s.type === 10
    );
    if (d10Slot) {
      const convertedValue = faceValue === 100 ? 10 : faceValue / 10;
      return fillSlot(d10Slot, convertedValue);
    }
  }

  // No exact match — try die substitution if enabled
  if (window.pixelsAllowDiceSubstitution && dieType in SUBSTITUTION_MAP) {
    const smallerType = SUBSTITUTION_MAP[dieType];

    // Only substitute if there is no unfilled slot that actually needs this
    // larger die type (exact-match slots take priority)
    const exactSlotExists = pendingPrompt.slots.some(
      s => s.value === null && s.type === dieType
    );
    if (!exactSlotExists) {
      const substituteSlot = pendingPrompt.slots.find(
        s => s.value === null && s.type === smallerType
      );
      if (substituteSlot) {
        const convertedValue = convertSubstitutedValue(faceValue, dieType);
        return fillSlot(substituteSlot, convertedValue);
      }
    }
  }

  // Wrong die type — signal rejection
  shakeOverlay();
  return true; // Consumed (don't pass to batcher)
}

/**
 * Fill a slot with a value and handle explosion/reroll/completion checks.
 */
function fillSlot(slot, value) {
  slot.value = value;

  // Check for explosion: does this value trigger a new slot?
  const group = pendingPrompt.groups[slot.groupIndex];
  if (checkExplosion(value, group)) {
    addExplosionSlot(pendingPrompt, slot.groupIndex);
  }

  // Check for reroll: does this value need to be re-rolled?
  // For "rerollOnce", clear the slot once and let the user roll again.
  // For "reroll", keep clearing until the condition is no longer met.
  // In practice, for physical dice we only support "rerollOnce" semantics
  // since we can't force the user to keep rolling until a condition fails.
  // We'll prompt for one re-roll and accept whatever comes.
  if (!slot.isReroll && checkReroll(value, group)) {
    markSlotForReroll(pendingPrompt, pendingPrompt.slots.indexOf(slot));
    updateOverlaySlots(pendingPrompt);
    return true;
  }

  updateOverlaySlots(pendingPrompt);

  // Check if all slots are filled
  const allFilled = pendingPrompt.slots.every(s => s.value !== null);
  if (allFilled) {
    completePrompt();
  }

  return true;
}

/**
 * Cancel the current prompt.
 */
function cancelPrompt() {
  pendingPrompt = null;
  hideOverlay();
}

/**
 * Check if a prompt is currently active.
 */
function isPromptActive() {
  return pendingPrompt !== null;
}

/**
 * Post the completed roll result to chat.
 * Uses dice-roller-parser for full evaluation with collected physical values.
 */
function completePrompt() {
  const postChatMessage = window.postChatMessage || function () {};
  const sendText = window.sendTextToExtension || function () {};

  const formulaStr = pendingPrompt.formula;
  const isWhisper = pendingPrompt.whisper || false;
  const evaluationOrder = buildEvaluationOrder(pendingPrompt);
  const result = evaluateWithValues(formulaStr, evaluationOrder);

  const formulaDisplay = getFormulaDisplay(formulaStr);
  const isSuccessRoll = isSuccessCountRoll(pendingPrompt);

  // Build the chat message
  const message = buildChatMessage(result, formulaDisplay, isSuccessRoll);

  if (isWhisper) {
    postChatMessage(`/w gm ${message}`);
  } else {
    postChatMessage(message);
  }

  // Send status to extension popup
  const total = result.value;
  const whisperLabel = isWhisper ? ' (GM whisper)' : '';
  sendText(`Prompted roll: ${formulaDisplay} = ${total}${whisperLabel}`);

  pendingPrompt = null;
  hideOverlay();
}

/**
 * Build a Roll20 chat message from the evaluation result.
 */
function buildChatMessage(result, formulaDisplay, isSuccessRoll) {
  const diceDisplay = buildDiceDisplay(result);

  let resultValue;
  if (isSuccessRoll) {
    resultValue = `${result.value} success${result.value !== 1 ? 'es' : ''}`;
  } else {
    resultValue = `[[${result.value}]]`;
  }

  return (
    `&{template:default} {{name=Pixels Dice}}` +
    ` {{Rolling=${formulaDisplay}}}` +
    ` {{Dice=${diceDisplay}}}` +
    ` {{Result=${resultValue}}}`
  );
}

/**
 * Build the dice display string from evaluation result.
 * Shows individual die values, with dropped values as strikethrough
 * and exploded dice marked.
 */
function buildDiceDisplay(result) {
  const parts = [];
  collectDiceDisplayParts(result, parts);
  return `( ${parts.join(' + ')} )`;
}

/**
 * Recursively collect display parts from the result tree.
 * Roll20 template fields support *italic* and **bold** markdown.
 * Bold requires whitespace before/after the ** markers.
 * - Dropped: italic parenthesized (de-emphasized)
 * - Exploding: bold with "!" suffix
 * - Successes: bold
 * - Non-successes: italic (de-emphasized against successes)
 * - Normal kept: plain
 */
function collectDiceDisplayParts(node, parts) {
  if (!node) {
    return;
  }

  // Single die group with rolls
  if (node.type === 'die' && node.rolls) {
    for (const roll of node.rolls) {
      if (!roll.valid) {
        // Dropped (keep/drop) — italic parenthesized
        parts.push(`*(${roll.roll})*`);
      } else if (roll.explode) {
        // Exploded — bold with bang suffix
        parts.push(`**${roll.roll}!**`);
      } else if (roll.success === true) {
        // Success — bold
        parts.push(`**${roll.roll}**`);
      } else if (roll.success === false) {
        // Non-success — italic
        parts.push(`*${roll.roll}*`);
      } else {
        parts.push(`${roll.roll}`);
      }
    }
    return;
  }

  // Expression with multiple dice groups
  if (node.type === 'expressionroll' || node.type === 'diceexpressionroll') {
    if (node.dice) {
      for (const die of node.dice) {
        collectDiceDisplayParts(die, parts);
      }
    }
    return;
  }

  // Group roll
  if (node.type === 'grouproll') {
    if (node.dice) {
      for (const die of node.dice) {
        collectDiceDisplayParts(die, parts);
      }
    }
    return;
  }
}

// --- Overlay UI ---

let overlayElement = null;

function createOverlayElement() {
  const overlay = document.createElement('div');
  overlay.id = 'pixels-command-overlay';
  overlay.innerHTML = `
    <div class="pixels-cmd-header">
      <span class="pixels-cmd-title">Roll Your Dice</span>
      <button class="pixels-cmd-cancel" title="Cancel">✕</button>
    </div>
    <div class="pixels-cmd-formula"></div>
    <div class="pixels-cmd-slots"></div>
    <div class="pixels-cmd-hint">Roll the highlighted dice to fill each slot</div>
  `;
  overlay
    .querySelector('.pixels-cmd-cancel')
    .addEventListener('click', cancelPrompt);
  document.body.appendChild(overlay);
  injectOverlayStyles();
  return overlay;
}

function showPromptOverlay(prompt) {
  if (!overlayElement) {
    overlayElement = createOverlayElement();
  }
  overlayElement.style.display = 'block';

  // Update title for whisper rolls
  const titleEl = overlayElement.querySelector('.pixels-cmd-title');
  titleEl.textContent = prompt.whisper
    ? 'Roll Your Dice (GM Only)'
    : 'Roll Your Dice';

  // Show the formula
  const formulaEl = overlayElement.querySelector('.pixels-cmd-formula');
  formulaEl.textContent = getFormulaDisplay(prompt.formula);

  updateOverlaySlots(prompt);
}

function updateOverlaySlots(prompt) {
  if (!overlayElement) {
    return;
  }
  const slotsEl = overlayElement.querySelector('.pixels-cmd-slots');
  slotsEl.innerHTML = '';

  for (const slot of prompt.slots) {
    const slotDiv = document.createElement('div');
    const baseClass = 'pixels-cmd-slot';

    let stateClass;
    if (slot.value !== null) {
      stateClass = 'filled';
    } else if (slot.isReroll) {
      stateClass = 'reroll';
    } else if (slot.isExplosion) {
      stateClass = 'explosion';
    } else {
      stateClass = 'waiting';
    }

    slotDiv.className = `${baseClass} ${stateClass}`;

    const typeLabel = slot.type === 'fate' ? 'dF' : `d${slot.type}`;
    let decorator = '';
    if (slot.isExplosion) {
      decorator = '💥';
    }
    if (slot.isReroll) {
      decorator = '🔄';
    }

    if (slot.value !== null) {
      slotDiv.innerHTML =
        `<span class="slot-value">${slot.value}</span>` +
        `<span class="slot-type">${typeLabel}${decorator}</span>`;
    } else {
      slotDiv.innerHTML =
        `<span class="slot-placeholder">${decorator || '?'}</span>` +
        `<span class="slot-type">${typeLabel}</span>`;
    }

    slotsEl.appendChild(slotDiv);
  }
}

function shakeOverlay() {
  if (!overlayElement) {
    return;
  }
  overlayElement.classList.remove('shake');
  void overlayElement.offsetWidth; // Force reflow
  overlayElement.classList.add('shake');
}

function hideOverlay() {
  if (overlayElement) {
    overlayElement.style.display = 'none';
    overlayElement.classList.remove('shake');
  }
}

function injectOverlayStyles() {
  if (document.getElementById('pixels-cmd-styles')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'pixels-cmd-styles';
  style.textContent = `
    #pixels-command-overlay {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000001;
      background: #2b2b2b;
      border: 2px solid #4a9eff;
      border-radius: 12px;
      padding: 20px;
      min-width: 280px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: Arial, sans-serif;
      color: #ffffff;
      display: none;
    }
    #pixels-command-overlay.shake {
      animation: pixels-shake 0.3s ease;
    }
    @keyframes pixels-shake {
      0%, 100% { transform: translate(-50%, -50%); }
      25% { transform: translate(calc(-50% - 8px), -50%); }
      75% { transform: translate(calc(-50% + 8px), -50%); }
    }
    .pixels-cmd-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .pixels-cmd-title {
      font-size: 16px;
      font-weight: bold;
    }
    .pixels-cmd-cancel {
      background: none;
      border: 1px solid #666;
      border-radius: 4px;
      color: #ccc;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 8px;
    }
    .pixels-cmd-cancel:hover {
      background: #5a2a2a;
      border-color: #f87171;
      color: #f87171;
    }
    .pixels-cmd-formula {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      color: #4a9eff;
      margin-bottom: 16px;
    }
    .pixels-cmd-slots {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-bottom: 12px;
    }
    .pixels-cmd-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 64px;
      border-radius: 8px;
      border: 2px solid #555;
      background: #1a1a1a;
    }
    .pixels-cmd-slot.waiting {
      border-color: #4a9eff;
      animation: pixels-pulse 1.5s infinite;
    }
    .pixels-cmd-slot.filled {
      border-color: #4ade80;
      background: #1a2e1a;
    }
    .pixels-cmd-slot.explosion {
      border-color: #f59e0b;
      animation: pixels-pulse-explosion 1.5s infinite;
    }
    .pixels-cmd-slot.reroll {
      border-color: #a855f7;
      animation: pixels-pulse-reroll 1.5s infinite;
    }
    @keyframes pixels-pulse {
      0%, 100% { border-color: #4a9eff; }
      50% { border-color: #2a6ecf; }
    }
    @keyframes pixels-pulse-explosion {
      0%, 100% { border-color: #f59e0b; }
      50% { border-color: #d97706; }
    }
    @keyframes pixels-pulse-reroll {
      0%, 100% { border-color: #a855f7; }
      50% { border-color: #7c3aed; }
    }
    .slot-placeholder {
      font-size: 24px;
      color: #666;
    }
    .slot-value {
      font-size: 22px;
      font-weight: bold;
      color: #4ade80;
    }
    .slot-type {
      font-size: 11px;
      color: #999;
      margin-top: 2px;
    }
    .pixels-cmd-hint {
      text-align: center;
      font-size: 12px;
      color: #888;
    }
  `;
  document.head.appendChild(style);
}

// --- Chat Interception ---

/**
 * Set up interception of the Roll20 chat input.
 * Listens for form submit and Enter key on the textarea.
 */
function setupChatInterception() {
  // Wait for Roll20's chat to be available
  const observer = new MutationObserver(() => {
    const chatInput = document.getElementById('textchat-input');
    if (chatInput && !chatInput.dataset.pixelsIntercepted) {
      chatInput.dataset.pixelsIntercepted = 'true';
      attachChatListeners(chatInput);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also try immediately in case it already exists
  const chatInput = document.getElementById('textchat-input');
  if (chatInput && !chatInput.dataset.pixelsIntercepted) {
    chatInput.dataset.pixelsIntercepted = 'true';
    attachChatListeners(chatInput);
  }
}

function attachChatListeners(chatInput) {
  const textarea = chatInput.querySelector('textarea');
  const button = chatInput.querySelector('button');

  if (textarea) {
    textarea.addEventListener(
      'keydown',
      event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          if (interceptCommand(textarea)) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      },
      true
    );
  }

  if (button) {
    button.addEventListener(
      'click',
      event => {
        const ta = chatInput.querySelector('textarea');
        if (ta && interceptCommand(ta)) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );
  }
}

/**
 * Check if the textarea contains a /pixels or /gmpixels command.
 * If so, parse the formula and start a prompt.
 * Returns true if the command was intercepted.
 */
function interceptCommand(textarea) {
  const text = textarea.value.trim();

  let formulaStr = null;
  let isWhisper = false;

  const gmMatch = text.match(GM_COMMAND_PATTERN);
  if (gmMatch) {
    formulaStr = gmMatch[1];
    isWhisper = true;
  } else {
    const match = text.match(COMMAND_PATTERN);
    if (!match) {
      return false;
    }
    formulaStr = match[1];
  }

  if (!formulaStr) {
    // No formula — show help
    textarea.value = '';
    const postChat = window.postChatMessage || function () {};
    const prefix = isWhisper ? '/gmpixels' : '/pixels';
    postChat(
      `Usage: ${prefix} 2d6+1d8+3 — prompts you to roll physical dice. ` +
        'Supports: keep/drop (4d6kh3), count successes (8d6>5), ' +
        'exploding (2d6!), roll queries (?{Modifier|0}), and more.'
    );
    return true;
  }

  textarea.value = '';

  // If formula contains roll queries, resolve them via modal first
  if (containsRollQueries(formulaStr)) {
    resolveRollQueries(
      formulaStr,
      resolved => processFormula(resolved, isWhisper),
      () => {} // cancelled — do nothing
    );
  } else {
    processFormula(formulaStr, isWhisper);
  }

  return true;
}

/**
 * Process a fully resolved formula string: parse, validate, and start prompt.
 */
function processFormula(formulaStr, isWhisper) {
  const postChat = window.postChatMessage || function () {};

  const ast = parseFormula(formulaStr);
  if (!ast) {
    postChat(`Invalid dice formula: ${formulaStr}`);
    return;
  }

  const promptData = buildSlotsFromAst(ast, formulaStr);
  if (promptData.slots.length === 0) {
    postChat(`No dice found in formula: ${formulaStr}`);
    return;
  }

  promptData.whisper = isWhisper;
  startPrompt(promptData);
}

/**
 * Programmatic entry point for executing a dice formula.
 * Called by the saved rolls panel when the user clicks a "Roll" button.
 * Parses the formula, validates it, and starts the roll prompt overlay.
 * Returns true if the formula was accepted, false otherwise.
 */
function interceptFormula(formulaStr) {
  if (!formulaStr || !formulaStr.trim()) {
    return false;
  }

  const trimmed = formulaStr.trim();

  // If formula contains roll queries, resolve them via modal first
  if (containsRollQueries(trimmed)) {
    resolveRollQueries(
      trimmed,
      resolved => processFormula(resolved, false),
      () => {} // cancelled
    );
    return true;
  }

  const postChat = window.postChatMessage || function () {};

  const ast = parseFormula(trimmed);
  if (!ast) {
    postChat(`Invalid dice formula: ${trimmed}`);
    return false;
  }

  const promptData = buildSlotsFromAst(ast, trimmed);
  if (promptData.slots.length === 0) {
    postChat(`No dice found in formula: ${trimmed}`);
    return false;
  }

  promptData.whisper = false;
  startPrompt(promptData);
  return true;
}

// --- Public API ---

const PixelsCommand = {
  setupChatInterception,
  offerRoll,
  isPromptActive,
  cancelPrompt,
  parseFormula,
  interceptFormula,
};

export {
  setupChatInterception,
  offerRoll,
  isPromptActive,
  cancelPrompt,
  parseFormula,
  interceptFormula,
};
export default PixelsCommand;

if (typeof window !== 'undefined') {
  window.PixelsCommand = PixelsCommand;
}
