/**
 * PixelsCommand.js
 *
 * Intercepts /pixels, /pixel, or /pix commands in the Roll20 chat input.
 * Parses a dice formula using @3d-dice/dice-roller-parser, shows a prompt
 * overlay that collects physical dice rolls by type, handles dynamic
 * explosion/reroll slots, and posts the evaluated result when complete.
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

let pendingPrompt = null;

/**
 * Start a prompted roll session from a parsed formula.
 */
function startPrompt(promptData) {
  pendingPrompt = promptData;
  showPromptOverlay(pendingPrompt);
}

/**
 * Attempt to fill a slot with an incoming roll. Returns true if consumed.
 */
function offerRoll(dieType, faceValue) {
  if (!pendingPrompt) {
    return false;
  }

  // Find first unfilled slot matching this die type
  const slot = pendingPrompt.slots.find(
    s => s.value === null && s.type === dieType
  );

  if (!slot) {
    // Wrong die type — signal rejection
    shakeOverlay();
    return true; // Consumed (don't pass to batcher)
  }

  slot.value = faceValue;

  // Check for explosion: does this value trigger a new slot?
  const group = pendingPrompt.groups[slot.groupIndex];
  if (checkExplosion(faceValue, group)) {
    addExplosionSlot(pendingPrompt, slot.groupIndex);
  }

  // Check for reroll: does this value need to be re-rolled?
  // For "rerollOnce", clear the slot once and let the user roll again.
  // For "reroll", keep clearing until the condition is no longer met.
  // In practice, for physical dice we only support "rerollOnce" semantics
  // since we can't force the user to keep rolling until a condition fails.
  // We'll prompt for one re-roll and accept whatever comes.
  if (!slot.isReroll && checkReroll(faceValue, group)) {
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
  const critText = buildCritText(result);

  let resultValue;
  if (isSuccessRoll) {
    resultValue = `${result.value} success${result.value !== 1 ? 'es' : ''}`;
  } else {
    resultValue = `[[${result.value}]]`;
  }

  return (
    `&{template:default} {{name=Pixels Dice${critText}}}` +
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
 */
function collectDiceDisplayParts(node, parts) {
  if (!node) {
    return;
  }

  // Single die group with rolls
  if (node.type === 'die' && node.rolls) {
    for (const roll of node.rolls) {
      if (!roll.valid) {
        parts.push(`~~${roll.roll}~~`);
      } else if (roll.explode) {
        parts.push(`**${roll.roll}!**`);
      } else if (roll.success === true) {
        parts.push(`**${roll.roll}**`);
      } else if (roll.success === false) {
        parts.push(`~~${roll.roll}~~`);
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

/**
 * Determine crit/fumble text from the result.
 */
function buildCritText(result) {
  let hasCrit = false;
  let hasFumble = false;

  checkCritRecursive(result, critical => {
    if (critical === 'success') {
      hasCrit = true;
    }
    if (critical === 'failure') {
      hasFumble = true;
    }
  });

  if (hasCrit && hasFumble) {
    return ' &#9876; CRIT & FUMBLE';
  }
  if (hasCrit) {
    return ' &#9876; CRITICAL';
  }
  if (hasFumble) {
    return ' &#9760; FUMBLE';
  }
  return '';
}

/**
 * Recursively check for critical rolls in result tree.
 */
function checkCritRecursive(node, callback) {
  if (!node) {
    return;
  }

  if (node.type === 'die' && node.rolls) {
    for (const roll of node.rolls) {
      if (roll.critical && roll.valid) {
        callback(roll.critical);
      }
    }
    return;
  }

  if (node.dice) {
    for (const die of node.dice) {
      checkCritRecursive(die, callback);
    }
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
        'exploding (2d6!), and more.'
    );
    return true;
  }

  const ast = parseFormula(formulaStr);
  if (!ast) {
    textarea.value = '';
    const postChat = window.postChatMessage || function () {};
    postChat(`Invalid dice formula: ${formulaStr}`);
    return true;
  }

  const promptData = buildSlotsFromAst(ast, formulaStr);
  if (promptData.slots.length === 0) {
    textarea.value = '';
    const postChat = window.postChatMessage || function () {};
    postChat(`No dice found in formula: ${formulaStr}`);
    return true;
  }

  promptData.whisper = isWhisper;
  textarea.value = '';
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
};

export {
  setupChatInterception,
  offerRoll,
  isPromptActive,
  cancelPrompt,
  parseFormula,
};
export default PixelsCommand;

if (typeof window !== 'undefined') {
  window.PixelsCommand = PixelsCommand;
}
