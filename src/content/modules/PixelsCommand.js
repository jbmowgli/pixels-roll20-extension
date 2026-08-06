/**
 * PixelsCommand.js
 *
 * Intercepts /pixels, /pixel, or /pix commands in the Roll20 chat input.
 * Parses a dice formula (e.g., "2d6+1d8+3"), shows a prompt overlay that
 * collects physical dice rolls by type, and posts the combined result
 * when all slots are filled.
 */

'use strict';

const COMMAND_PATTERN = /^\/pix(?:el(?:s)?)?(?:\s+(.+))?$/i;

// Dice formula token: "2d6kh3", "d20cs>19cf<2", etc.
const DICE_TOKEN =
  /(\d*)d(\d+)((?:k[hl]?\d+|d[hl]?\d+)*)((?:cs[<>=]?\d+|cf[<>=]?\d+)*)/gi;
const PERCENT_TOKEN = /(\d*)d%/gi;
const MODIFIER_TOKEN = /([+-]\d+)$/;

let pendingPrompt = null;

/**
 * Parse a dice formula string into structured roll requirements.
 * Examples:
 *   "2d6+3"       → { dice: [{type:6, count:2}], modifier: 3 }
 *   "4d6kh3"      → { dice: [{type:6, count:4, keep:{high:3}}] }
 *   "1d20cs>19cf1" → { dice: [{type:20, count:1, crit:{success:19, failure:1}}] }
 *   "d%"          → { dice: [{type:100, count:1, percentile:true}, {type:10, count:1, percentile:true}] }
 */
function parseFormula(formulaStr) {
  if (!formulaStr || !formulaStr.trim()) {
    return null;
  }

  let formula = formulaStr.trim();
  const dice = [];
  let match;

  // Expand d% into d100 + d10 (percentile pair)
  PERCENT_TOKEN.lastIndex = 0;
  while ((match = PERCENT_TOKEN.exec(formula)) !== null) {
    const count = parseInt(match[1], 10) || 1;
    for (let i = 0; i < count; i++) {
      dice.push({ type: 100, count: 1, percentile: true });
      dice.push({ type: 10, count: 1, percentile: true });
    }
  }
  // Remove d% tokens so DICE_TOKEN doesn't re-match them
  formula = formula.replace(PERCENT_TOKEN, '');

  DICE_TOKEN.lastIndex = 0;
  while ((match = DICE_TOKEN.exec(formula)) !== null) {
    const count = parseInt(match[1], 10) || 1;
    const type = parseInt(match[2], 10);
    if (type <= 0) {
      continue;
    }

    const spec = { type, count };

    // Parse keep/drop modifiers
    const kdStr = match[3];
    if (kdStr) {
      const kdMatch = kdStr.match(/(k|d)(h|l)?(\d+)/i);
      if (kdMatch) {
        const action = kdMatch[1].toLowerCase(); // k or d
        const end = (kdMatch[2] || (action === 'k' ? 'h' : 'l')).toLowerCase();
        const n = parseInt(kdMatch[3], 10);
        if (action === 'k') {
          spec.keep = end === 'h' ? { high: n } : { low: n };
        } else {
          spec.drop = end === 'h' ? { high: n } : { low: n };
        }
      }
    }

    // Parse crit success/failure markers
    const csStr = match[4];
    if (csStr) {
      spec.crit = {};
      const csMatch = csStr.match(/cs[<>=]?(\d+)/i);
      if (csMatch) {
        spec.crit.success = parseInt(csMatch[1], 10);
      }
      const cfMatch = csStr.match(/cf[<>=]?(\d+)/i);
      if (cfMatch) {
        spec.crit.failure = parseInt(cfMatch[1], 10);
      }
    }

    dice.push(spec);
  }

  if (dice.length === 0) {
    return null;
  }

  let modifier = 0;
  const modMatch = formula.match(MODIFIER_TOKEN);
  if (modMatch) {
    modifier = parseInt(modMatch[1], 10);
  }

  return { dice, modifier };
}

/**
 * Build the list of individual slots needed.
 * Each slot tracks which dice spec it belongs to for keep/drop rules.
 */
function buildSlots(diceSpecs) {
  const slots = [];
  for (let specIdx = 0; specIdx < diceSpecs.length; specIdx++) {
    const spec = diceSpecs[specIdx];
    for (let i = 0; i < spec.count; i++) {
      slots.push({ type: spec.type, value: null, specIndex: specIdx });
    }
  }
  return slots;
}

/**
 * Start a prompted roll session.
 */
function startPrompt(parsed) {
  const slots = buildSlots(parsed.dice);
  pendingPrompt = {
    slots,
    diceSpecs: parsed.dice,
    modifier: parsed.modifier,
    onComplete: null,
    onCancel: null,
  };
  showPromptOverlay(pendingPrompt);
}

/**
 * Attempt to fill a slot with an incoming roll. Returns true if accepted.
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
 * Compute percentile value from d00 and d10 face values.
 */
function computePercentileValue(d100Face, d10Face) {
  if (d100Face === 100 && d10Face === 0) {
    return 100;
  }
  if (d100Face === 100) {
    return d10Face;
  }
  return d100Face + d10Face;
}

/**
 * Post the completed roll result to chat.
 * Applies keep/drop rules and crit/fumble markers.
 */
function completePrompt() {
  const { slots, diceSpecs, modifier } = pendingPrompt;
  const postChatMessage = window.postChatMessage || function () {};

  // Group slots by their spec index
  const slotsBySpec = {};
  for (const slot of slots) {
    if (!slotsBySpec[slot.specIndex]) {
      slotsBySpec[slot.specIndex] = [];
    }
    slotsBySpec[slot.specIndex].push(slot.value);
  }

  // Combine percentile pairs (d100 + d10) into a single value
  let hasPercentile = false;
  const percentileD100Indices = [];
  const percentileD10Indices = [];
  for (let i = 0; i < diceSpecs.length; i++) {
    if (diceSpecs[i].percentile && diceSpecs[i].type === 100) {
      percentileD100Indices.push(i);
      hasPercentile = true;
    }
    if (diceSpecs[i].percentile && diceSpecs[i].type === 10) {
      percentileD10Indices.push(i);
    }
  }

  // Replace percentile pairs with combined values
  const combinedPercentiles = [];
  if (hasPercentile) {
    for (let p = 0; p < percentileD100Indices.length; p++) {
      const d100Val = (slotsBySpec[percentileD100Indices[p]] || [])[0] || 0;
      const d10Val = (slotsBySpec[percentileD10Indices[p]] || [])[0] || 0;
      const combined = computePercentileValue(d100Val, d10Val);
      combinedPercentiles.push(combined);
    }
  }

  // Apply keep/drop per spec and build display data
  const allKept = [];
  const allDropped = [];
  const formulaSegments = [];
  let hasCrit = false;
  let hasFumble = false;

  // Track which percentile pair we're on
  const percentileSpecIndices = new Set([
    ...percentileD100Indices,
    ...percentileD10Indices,
  ]);

  // Add combined percentile values first
  if (hasPercentile) {
    for (const combined of combinedPercentiles) {
      allKept.push(combined);
    }
    const pCount = combinedPercentiles.length;
    formulaSegments.push(`${pCount > 1 ? pCount : ''}d%`);
  }

  for (let i = 0; i < diceSpecs.length; i++) {
    // Skip percentile sub-specs (already handled above)
    if (percentileSpecIndices.has(i)) {
      continue;
    }

    const spec = diceSpecs[i];
    const values = slotsBySpec[i] || [];
    const sorted = [...values].sort((a, b) => a - b);

    let kept = [...values];
    let dropped = [];

    if (spec.keep) {
      if (spec.keep.high) {
        const sortedDesc = [...values].sort((a, b) => b - a);
        kept = sortedDesc.slice(0, spec.keep.high);
        dropped = sortedDesc.slice(spec.keep.high);
      } else if (spec.keep.low) {
        kept = sorted.slice(0, spec.keep.low);
        dropped = sorted.slice(spec.keep.low);
      }
    } else if (spec.drop) {
      if (spec.drop.low) {
        dropped = sorted.slice(0, spec.drop.low);
        kept = sorted.slice(spec.drop.low);
      } else if (spec.drop.high) {
        const sortedDesc = [...values].sort((a, b) => b - a);
        dropped = sortedDesc.slice(0, spec.drop.high);
        kept = sortedDesc.slice(spec.drop.high);
      }
    }

    // Check crit/fumble on kept values
    if (spec.crit) {
      for (const v of kept) {
        if (spec.crit.success && v >= spec.crit.success) {
          hasCrit = true;
        }
        if (spec.crit.failure && v <= spec.crit.failure) {
          hasFumble = true;
        }
      }
    }

    allKept.push(...kept);
    allDropped.push(...dropped);

    // Build formula segment
    const label = spec.type === 100 ? 'd%' : `d${spec.type}`;
    let segment = `${spec.count}${label}`;
    if (spec.keep) {
      const end = spec.keep.high ? 'kh' : 'kl';
      segment += `${end}${spec.keep.high || spec.keep.low}`;
    } else if (spec.drop) {
      const end = spec.drop.high ? 'dh' : 'dl';
      segment += `${end}${spec.drop.high || spec.drop.low}`;
    }
    formulaSegments.push(segment);
  }

  const formulaParts = formulaSegments.join(' + ');
  const totalDice = allKept.reduce((sum, v) => sum + v, 0);
  const total = totalDice + modifier;

  // Build dice display
  const diceDisplay = buildDiceDisplay(
    slots,
    diceSpecs,
    slotsBySpec,
    allDropped,
    percentileSpecIndices,
    combinedPercentiles
  );

  // Build the chat message
  let message;
  const modSign =
    modifier !== 0
      ? modifier >= 0
        ? `+${modifier}`
        : modifier.toString()
      : '';

  // Determine crit/fumble display suffix
  let critText = '';
  if (hasCrit && hasFumble) {
    critText = ' &#9876; CRIT & FUMBLE';
  } else if (hasCrit) {
    critText = ' &#9876; CRITICAL';
  } else if (hasFumble) {
    critText = ' &#9760; FUMBLE';
  }

  const keptExpr = allKept.join('+');

  if (modifier !== 0) {
    message =
      `&{template:default} {{name=Pixels Dice${critText}}}` +
      ` {{Rolling=${formulaParts}${modSign}}}` +
      ` {{Dice=${diceDisplay} ${modSign}}}` +
      ` {{Result=[[(${keptExpr})+${modifier}]]}}`;
  } else {
    message =
      `&{template:default} {{name=Pixels Dice${critText}}}` +
      ` {{Rolling=${formulaParts}}}` +
      ` {{Dice=${diceDisplay}}}` +
      ` {{Result=[[(${keptExpr})]]}}`;
  }

  postChatMessage(message);

  const sendText = window.sendTextToExtension || function () {};
  sendText(`Prompted roll: ${formulaParts}${modSign} = ${total}`);

  pendingPrompt = null;
  hideOverlay();
}

/**
 * Build the dice display string with dropped values shown as strikethrough.
 */
function buildDiceDisplay(
  slots,
  diceSpecs,
  slotsBySpec,
  allDropped,
  percentileSpecIndices,
  combinedPercentiles
) {
  const parts = [];
  const droppedTracker = [...allDropped];

  // Show combined percentile values first
  if (combinedPercentiles && combinedPercentiles.length > 0) {
    for (const v of combinedPercentiles) {
      parts.push(`${v}`);
    }
  }

  for (let i = 0; i < diceSpecs.length; i++) {
    // Skip percentile sub-specs
    if (percentileSpecIndices && percentileSpecIndices.has(i)) {
      continue;
    }

    const values = slotsBySpec[i] || [];
    for (const v of values) {
      const droppedIdx = droppedTracker.indexOf(v);
      if (droppedIdx >= 0) {
        droppedTracker.splice(droppedIdx, 1);
        parts.push(`~~${v}~~`);
      } else {
        parts.push(`${v}`);
      }
    }
  }

  return `( ${parts.join(' + ')} )`;
}

/**
 * Check if a prompt is currently active.
 */
function isPromptActive() {
  return pendingPrompt !== null;
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

  // Build formula display from diceSpecs
  const formulaEl = overlayElement.querySelector('.pixels-cmd-formula');
  const parts = [];
  for (const spec of prompt.diceSpecs) {
    const label = spec.type === 100 ? 'd%' : `d${spec.type}`;
    let segment = `${spec.count}${label}`;
    if (spec.keep) {
      const end = spec.keep.high ? 'kh' : 'kl';
      segment += `${end}${spec.keep.high || spec.keep.low}`;
    } else if (spec.drop) {
      const end = spec.drop.high ? 'dh' : 'dl';
      segment += `${end}${spec.drop.high || spec.drop.low}`;
    }
    parts.push(segment);
  }
  if (prompt.modifier !== 0) {
    const sign = prompt.modifier >= 0 ? `+${prompt.modifier}` : prompt.modifier;
    parts.push(sign.toString());
  }
  formulaEl.textContent = parts.join(' + ');

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
    slotDiv.className =
      slot.value !== null
        ? 'pixels-cmd-slot filled'
        : 'pixels-cmd-slot waiting';
    slotDiv.innerHTML =
      slot.value !== null
        ? `<span class="slot-value">${slot.value}</span><span class="slot-type">d${slot.type}</span>`
        : `<span class="slot-placeholder">?</span><span class="slot-type">d${slot.type}</span>`;
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
    @keyframes pixels-pulse {
      0%, 100% { border-color: #4a9eff; }
      50% { border-color: #2a6ecf; }
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
 * Check if the textarea contains a /pixels command. If so, parse and start prompt.
 * Returns true if the command was intercepted.
 */
function interceptCommand(textarea) {
  const text = textarea.value.trim();
  const match = text.match(COMMAND_PATTERN);
  if (!match) {
    return false;
  }

  const formulaStr = match[1];
  if (!formulaStr) {
    // Just "/pixels" with no formula — show help
    textarea.value = '';
    const postChat = window.postChatMessage || function () {};
    postChat('Usage: /pixels 2d6+1d8+3 — prompts you to roll physical dice');
    return true;
  }

  const parsed = parseFormula(formulaStr);
  if (!parsed) {
    textarea.value = '';
    const postChat = window.postChatMessage || function () {};
    postChat(`Invalid dice formula: ${formulaStr}`);
    return true;
  }

  textarea.value = '';
  startPrompt(parsed);
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
