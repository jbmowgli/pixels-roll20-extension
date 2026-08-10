/**
 * PixelsCommand.ts
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
} from './FormulaEvaluator';
import type { PromptData, Slot } from './FormulaEvaluator';
import type { RollBase } from '@3d-dice/dice-roller-parser';

const COMMAND_PATTERN = /^\/pix(?:el(?:s)?)?(?:\s+(.+))?$/i;
const GM_COMMAND_PATTERN = /^\/gmpix(?:el(?:s)?)?(?:\s+(.+))?$/i;
const ROLL_QUERY_PATTERN = /\?\{([^}]+)\}/g;

let pendingPrompt: PromptData | null = null;

// --- Roll Query Resolution ---

interface QueryToken {
  label: string;
  defaultValue: string;
  options: string[] | null;
}

interface ExtractedQuery extends QueryToken {
  fullMatch: string;
}

function parseQueryToken(token: string): QueryToken {
  const parts = token.split('|');
  const label = parts[0].trim();

  if (parts.length <= 1) {
    return { label, defaultValue: '', options: null };
  }
  if (parts.length === 2) {
    return { label, defaultValue: parts[1].trim(), options: null };
  }
  const options = parts.slice(1).map(p => p.trim());
  return { label, defaultValue: options[0], options };
}

function containsRollQueries(formula: string): boolean {
  return ROLL_QUERY_PATTERN.test(formula);
}

function extractRollQueries(formula: string): ExtractedQuery[] {
  const queries: ExtractedQuery[] = [];
  ROLL_QUERY_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ROLL_QUERY_PATTERN.exec(formula)) !== null) {
    const parsed = parseQueryToken(match[1]);
    queries.push({ ...parsed, fullMatch: match[0] });
  }
  return queries;
}

function resolveRollQueries(
  formula: string,
  onResolved: (resolved: string) => void,
  onCancelled: () => void
): void {
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

let queryModalElement: HTMLElement | null = null;

function createQueryModal(): HTMLElement {
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

function showQueryModal(
  queries: ExtractedQuery[],
  onSubmit: (values: string[]) => void,
  onCancel: () => void
): void {
  if (!queryModalElement) {
    queryModalElement = createQueryModal();
  }
  queryModalElement.style.display = 'block';

  const fieldsEl = queryModalElement.querySelector('.pixels-query-fields')!;
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
      select.dataset.index = String(i);
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
      input.dataset.index = String(i);
      row.appendChild(input);
    }

    fieldsEl.appendChild(row);
  }

  // Wire up event handlers (replace old ones via cloneNode)
  const cancelBtn = queryModalElement.querySelector('.pixels-query-cancel')!;
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode!.replaceChild(newCancelBtn, cancelBtn);

  const submitBtn = queryModalElement.querySelector('.pixels-query-submit')!;
  const newSubmitBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode!.replaceChild(newSubmitBtn, submitBtn);

  const collectValues = (): string[] => {
    const values: string[] = [];
    for (let i = 0; i < queries.length; i++) {
      const el = queryModalElement!.querySelector(
        `#pixels-query-input-${i}`
      ) as HTMLInputElement | HTMLSelectElement;
      values.push(el.value);
    }
    return values;
  };

  const handleSubmit = (): void => {
    const values = collectValues();
    hideQueryModal();
    onSubmit(values);
  };

  const handleCancel = (): void => {
    hideQueryModal();
    if (onCancel) {
      onCancel();
    }
  };

  newCancelBtn.addEventListener('click', handleCancel);
  newSubmitBtn.addEventListener('click', handleSubmit);

  fieldsEl.addEventListener('keydown', (event: Event) => {
    if ((event as KeyboardEvent).key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  });

  const firstInput = fieldsEl.querySelector(
    'input, select'
  ) as HTMLElement | null;
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 0);
  }
}

function hideQueryModal(): void {
  if (queryModalElement) {
    queryModalElement.style.display = 'none';
  }
}

function injectQueryModalStyles(): void {
  if (document.getElementById('pixels-query-styles')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'pixels-query-styles';
  style.textContent = `
    #pixels-query-modal {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 1000002; background: #2b2b2b; border: 2px solid #4a9eff;
      border-radius: 12px; padding: 20px; min-width: 280px; max-width: 400px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5); font-family: Arial, sans-serif;
      color: #ffffff; display: none;
    }
    .pixels-query-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .pixels-query-title { font-size: 16px; font-weight: bold; }
    .pixels-query-cancel { background: none; border: 1px solid #666; border-radius: 4px; color: #ccc; font-size: 16px; cursor: pointer; padding: 2px 8px; }
    .pixels-query-cancel:hover { background: #5a2a2a; border-color: #f87171; color: #f87171; }
    .pixels-query-fields { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .pixels-query-row { display: flex; flex-direction: column; gap: 4px; }
    .pixels-query-label { font-size: 13px; color: #ccc; }
    .pixels-query-input, .pixels-query-select { background: #1a1a1a; border: 1px solid #555; border-radius: 6px; color: #fff; font-size: 14px; padding: 8px 10px; outline: none; }
    .pixels-query-input:focus, .pixels-query-select:focus { border-color: #4a9eff; }
    .pixels-query-actions { display: flex; justify-content: flex-end; }
    .pixels-query-submit { background: #4a9eff; border: none; border-radius: 6px; color: #fff; font-size: 14px; font-weight: bold; padding: 8px 20px; cursor: pointer; }
    .pixels-query-submit:hover { background: #3b82f6; }
  `;
  document.head.appendChild(style);
}

/**
 * Start a prompted roll session from a parsed formula.
 */
function startPrompt(promptData: PromptData): void {
  pendingPrompt = promptData;
  showPromptOverlay(pendingPrompt);
}

const SUBSTITUTION_MAP: Record<number, number> = { 8: 4, 12: 6, 20: 10 };

function convertSubstitutedValue(
  faceValue: number,
  largerDieType: number
): number {
  const half = largerDieType / 2;
  return faceValue > half ? faceValue - half : faceValue;
}

/**
 * Attempt to fill a slot with an incoming roll. Returns true if consumed.
 */
function offerRoll(dieType: number, faceValue: number): boolean {
  if (!pendingPrompt) {
    return false;
  }

  const slot = pendingPrompt.slots.find(
    s => s.value === null && s.type === dieType
  );

  if (slot) {
    return fillSlot(slot, faceValue);
  }

  // d100 (percentile) always works as d10
  if (dieType === 100) {
    const d10Slot = pendingPrompt.slots.find(
      s => s.value === null && s.type === 10
    );
    if (d10Slot) {
      const convertedValue = faceValue === 100 ? 10 : faceValue / 10;
      return fillSlot(d10Slot, convertedValue);
    }
  }

  // Die substitution if enabled
  if (window.pixelsAllowDiceSubstitution && dieType in SUBSTITUTION_MAP) {
    const smallerType = SUBSTITUTION_MAP[dieType];
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

  shakeOverlay();
  return true;
}

function fillSlot(slot: Slot, value: number): boolean {
  slot.value = value;

  const group = pendingPrompt!.groups[slot.groupIndex];
  if (checkExplosion(value, group)) {
    addExplosionSlot(pendingPrompt!, slot.groupIndex);
  }

  if (!slot.isReroll && checkReroll(value, group)) {
    markSlotForReroll(pendingPrompt!, pendingPrompt!.slots.indexOf(slot));
    updateOverlaySlots(pendingPrompt!);
    return true;
  }

  updateOverlaySlots(pendingPrompt!);

  const allFilled = pendingPrompt!.slots.every(s => s.value !== null);
  if (allFilled) {
    completePrompt();
  }

  return true;
}

function cancelPrompt(): void {
  pendingPrompt = null;
  hideOverlay();
}

function isPromptActive(): boolean {
  return pendingPrompt !== null;
}

function completePrompt(): void {
  const postChatMessage: (msg: string) => void =
    window.postChatMessage || function () {};
  const sendText: (txt: string) => void =
    window.sendTextToExtension || function () {};

  const formulaStr = pendingPrompt!.formula;
  const isWhisper = pendingPrompt!.whisper || false;
  const evaluationOrder = buildEvaluationOrder(pendingPrompt!);
  const result = evaluateWithValues(formulaStr, evaluationOrder);

  const formulaDisplay = getFormulaDisplay(formulaStr);
  const isSuccessRoll = isSuccessCountRoll(pendingPrompt!);

  const message = buildChatMessage(result, formulaDisplay, isSuccessRoll);

  if (isWhisper) {
    postChatMessage(`/w gm ${message}`);
  } else {
    postChatMessage(message);
  }

  const total = result.value;
  const whisperLabel = isWhisper ? ' (GM whisper)' : '';
  sendText(`Prompted roll: ${formulaDisplay} = ${total}${whisperLabel}`);

  pendingPrompt = null;
  hideOverlay();
}

function buildChatMessage(
  result: RollBase,
  formulaDisplay: string,
  isSuccessRoll: boolean
): string {
  const diceDisplay = buildDiceDisplay(result);

  let resultValue: string;
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

function buildDiceDisplay(result: RollBase): string {
  const parts: string[] = [];
  collectDiceDisplayParts(result, parts);
  return `( ${parts.join(' + ')} )`;
}

interface DiceRollNode extends RollBase {
  rolls?: Array<{
    roll: number;
    valid: boolean;
    explode?: boolean;
    success?: boolean;
  }>;
  dice?: RollBase[];
}

function collectDiceDisplayParts(node: RollBase | null, parts: string[]): void {
  if (!node) {
    return;
  }

  const diceNode = node as DiceRollNode;

  if (node.type === 'die' && diceNode.rolls) {
    for (const roll of diceNode.rolls!) {
      if (!roll.valid) {
        parts.push(`*(${roll.roll})*`);
      } else if (roll.explode) {
        parts.push(`**${roll.roll}!**`);
      } else if (roll.success === true) {
        parts.push(`**${roll.roll}**`);
      } else if (roll.success === false) {
        parts.push(`*${roll.roll}*`);
      } else {
        parts.push(`${roll.roll}`);
      }
    }
    return;
  }

  if (node.type === 'expressionroll' || node.type === 'diceexpressionroll') {
    if (diceNode.dice) {
      for (const die of diceNode.dice) {
        collectDiceDisplayParts(die, parts);
      }
    }
    return;
  }

  if (node.type === 'grouproll') {
    if (diceNode.dice) {
      for (const die of diceNode.dice) {
        collectDiceDisplayParts(die, parts);
      }
    }
    return;
  }
}

// --- Overlay UI ---

let overlayElement: HTMLElement | null = null;

function createOverlayElement(): HTMLElement {
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
    .querySelector('.pixels-cmd-cancel')!
    .addEventListener('click', cancelPrompt);
  document.body.appendChild(overlay);
  injectOverlayStyles();
  return overlay;
}

function showPromptOverlay(prompt: PromptData): void {
  if (!overlayElement) {
    overlayElement = createOverlayElement();
  }
  overlayElement.style.display = 'block';

  const titleEl = overlayElement.querySelector('.pixels-cmd-title')!;
  titleEl.textContent = prompt.whisper
    ? 'Roll Your Dice (GM Only)'
    : 'Roll Your Dice';

  const formulaEl = overlayElement.querySelector('.pixels-cmd-formula')!;
  formulaEl.textContent = getFormulaDisplay(prompt.formula);

  updateOverlaySlots(prompt);
}

function updateOverlaySlots(prompt: PromptData): void {
  if (!overlayElement) {
    return;
  }
  const slotsEl = overlayElement.querySelector('.pixels-cmd-slots')!;
  slotsEl.innerHTML = '';

  for (const slot of prompt.slots) {
    const slotDiv = document.createElement('div');
    const baseClass = 'pixels-cmd-slot';

    let stateClass: string;
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

function shakeOverlay(): void {
  if (!overlayElement) {
    return;
  }
  overlayElement.classList.remove('shake');
  void overlayElement.offsetWidth;
  overlayElement.classList.add('shake');
}

function hideOverlay(): void {
  if (overlayElement) {
    overlayElement.style.display = 'none';
    overlayElement.classList.remove('shake');
  }
}

function injectOverlayStyles(): void {
  if (document.getElementById('pixels-cmd-styles')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'pixels-cmd-styles';
  style.textContent = `
    #pixels-command-overlay { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000001; background: #2b2b2b; border: 2px solid #4a9eff; border-radius: 12px; padding: 20px; min-width: 280px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); font-family: Arial, sans-serif; color: #ffffff; display: none; }
    #pixels-command-overlay.shake { animation: pixels-shake 0.3s ease; }
    @keyframes pixels-shake { 0%, 100% { transform: translate(-50%, -50%); } 25% { transform: translate(calc(-50% - 8px), -50%); } 75% { transform: translate(calc(-50% + 8px), -50%); } }
    .pixels-cmd-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .pixels-cmd-title { font-size: 16px; font-weight: bold; }
    .pixels-cmd-cancel { background: none; border: 1px solid #666; border-radius: 4px; color: #ccc; font-size: 16px; cursor: pointer; padding: 2px 8px; }
    .pixels-cmd-cancel:hover { background: #5a2a2a; border-color: #f87171; color: #f87171; }
    .pixels-cmd-formula { text-align: center; font-size: 18px; font-weight: bold; color: #4a9eff; margin-bottom: 16px; }
    .pixels-cmd-slots { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 12px; }
    .pixels-cmd-slot { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 56px; height: 64px; border-radius: 8px; border: 2px solid #555; background: #1a1a1a; }
    .pixels-cmd-slot.waiting { border-color: #4a9eff; animation: pixels-pulse 1.5s infinite; }
    .pixels-cmd-slot.filled { border-color: #4ade80; background: #1a2e1a; }
    .pixels-cmd-slot.explosion { border-color: #f59e0b; animation: pixels-pulse-explosion 1.5s infinite; }
    .pixels-cmd-slot.reroll { border-color: #a855f7; animation: pixels-pulse-reroll 1.5s infinite; }
    @keyframes pixels-pulse { 0%, 100% { border-color: #4a9eff; } 50% { border-color: #2a6ecf; } }
    @keyframes pixels-pulse-explosion { 0%, 100% { border-color: #f59e0b; } 50% { border-color: #d97706; } }
    @keyframes pixels-pulse-reroll { 0%, 100% { border-color: #a855f7; } 50% { border-color: #7c3aed; } }
    .slot-placeholder { font-size: 24px; color: #666; }
    .slot-value { font-size: 22px; font-weight: bold; color: #4ade80; }
    .slot-type { font-size: 11px; color: #999; margin-top: 2px; }
    .pixels-cmd-hint { text-align: center; font-size: 12px; color: #888; }
  `;
  document.head.appendChild(style);
}

// --- Chat Interception ---

function setupChatInterception(): void {
  const observer = new MutationObserver(() => {
    const chatInput = document.getElementById('textchat-input');
    if (chatInput && !chatInput.dataset.pixelsIntercepted) {
      chatInput.dataset.pixelsIntercepted = 'true';
      attachChatListeners(chatInput);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const chatInput = document.getElementById('textchat-input');
  if (chatInput && !chatInput.dataset.pixelsIntercepted) {
    chatInput.dataset.pixelsIntercepted = 'true';
    attachChatListeners(chatInput);
  }
}

function attachChatListeners(chatInput: HTMLElement): void {
  const textarea = chatInput.querySelector('textarea');
  const button = chatInput.querySelector('button');

  if (textarea) {
    textarea.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
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
      (event: MouseEvent) => {
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

function interceptCommand(textarea: HTMLTextAreaElement): boolean {
  const text = textarea.value.trim();

  let formulaStr: string | null | undefined = null;
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
    textarea.value = '';
    const postChat: (msg: string) => void =
      window.postChatMessage || function () {};
    const prefix = isWhisper ? '/gmpixels' : '/pixels';
    postChat(
      `Usage: ${prefix} 2d6+1d8+3 — prompts you to roll physical dice. ` +
        'Supports: keep/drop (4d6kh3), count successes (8d6>5), ' +
        'exploding (2d6!), roll queries (?{Modifier|0}), and more.'
    );
    return true;
  }

  textarea.value = '';

  if (containsRollQueries(formulaStr)) {
    resolveRollQueries(
      formulaStr,
      resolved => processFormula(resolved, isWhisper),
      () => {}
    );
  } else {
    processFormula(formulaStr, isWhisper);
  }

  return true;
}

function processFormula(formulaStr: string, isWhisper: boolean): void {
  const postChat: (msg: string) => void =
    window.postChatMessage || function () {};

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

function interceptFormula(formulaStr: string): boolean {
  if (!formulaStr || !formulaStr.trim()) {
    return false;
  }

  const trimmed = formulaStr.trim();

  if (containsRollQueries(trimmed)) {
    resolveRollQueries(
      trimmed,
      resolved => processFormula(resolved, false),
      () => {}
    );
    return true;
  }

  const postChat: (msg: string) => void =
    window.postChatMessage || function () {};

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
