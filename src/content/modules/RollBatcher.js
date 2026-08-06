/**
 * RollBatcher.js
 *
 * Groups individual dice roll events that occur within a short time window
 * into a single combined roll message. When multiple Pixels dice are rolled
 * together (e.g., two d6s), this module detects the proximity in time and
 * produces a grouped output like "rolling 2d6 (5 + 4) = 9" instead of
 * posting each die result separately.
 *
 * Single-die rolls still go through immediately after the window expires.
 */

'use strict';

const ROLL_WINDOW_DEFAULT_MS = 2000;
let rollWindowMs = ROLL_WINDOW_DEFAULT_MS;

// Load saved roll window from localStorage
try {
  const saved = localStorage.getItem('pixels_roll_window_seconds');
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (parsed >= 1 && parsed <= 10) {
      rollWindowMs = parsed * 1000;
    }
  }
} catch {
  // localStorage unavailable, use default
}

// Resolve dependencies lazily at call time to avoid load-order issues
function getPostChatMessage() {
  return window.postChatMessage || function () {};
}

function getSendTextToExtension() {
  return window.sendTextToExtension || function () {};
}

/**
 * Parse die type (number of faces) from a Pixel die name.
 * Pixels dice are typically named like "PixelD6_XXXX", "MyD20", etc.
 * Falls back to inferring from the rolled value when name doesn't help.
 */
function parseDieType(dieName, faceValue) {
  const match = dieName.match(/d(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return inferDieSize(faceValue);
}

/**
 * Infer die size from a face value when the name doesn't contain type info.
 * Uses standard RPG die sizes.
 */
function inferDieSize(faceValue) {
  const standardDice = [4, 6, 8, 10, 12, 20, 100];
  for (const size of standardDice) {
    if (faceValue <= size) {
      return size;
    }
  }
  return 20;
}

// Batched roll entries
let pendingRolls = [];
let batchTimer = null;

/**
 * Add a roll to the current batch. If this is the first roll, start the
 * grouping timer. When the timer fires, flush all collected rolls.
 */
function addRoll(rollData) {
  pendingRolls.push(rollData);

  if (batchTimer !== null) {
    clearTimeout(batchTimer);
  }
  batchTimer = setTimeout(flushRolls, rollWindowMs);
}

/**
 * Flush all pending rolls as either a single roll message or a grouped message.
 */
function flushRolls() {
  batchTimer = null;
  const rolls = pendingRolls.slice();
  pendingRolls = [];

  if (rolls.length === 0) {
    return;
  }

  if (rolls.length === 1) {
    postSingleRoll(rolls[0]);
  } else {
    postGroupedRoll(rolls);
  }
}

/**
 * Post a single-die roll (preserves current behavior).
 */
function postSingleRoll(roll) {
  const {
    dieName,
    dieType,
    faceValue,
    modifier,
    modifierName,
    isModifierBoxVisible,
  } = roll;

  let formula;
  if (isModifierBoxVisible && modifier !== 0) {
    formula = buildSingleWithModifierFormula(
      faceValue,
      modifier,
      modifierName,
      dieType,
      dieName
    );
  } else {
    formula = buildSingleSimpleFormula(faceValue, dieType, dieName);
  }

  formula.split('\\n').forEach(s => getPostChatMessage()(s));
  getSendTextToExtension()(`${dieName}: face up = ${faceValue}`);
}

/**
 * Post a grouped multi-dice roll with formula, individual results, and sum.
 */
function postGroupedRoll(rolls) {
  const firstRoll = rolls[0];
  const { modifier, modifierName, isModifierBoxVisible } = firstRoll;

  const rollsByType = groupRollsByDieType(rolls);
  const totalDiceValue = rolls.reduce((sum, r) => sum + r.faceValue, 0);

  const formulaParts = buildDiceFormulaParts(rollsByType);
  const individualValues = rolls
    .map(r => `<span title="${r.dieName}">${r.faceValue}</span>`)
    .join(' + ');

  let message;
  if (isModifierBoxVisible && modifier !== 0) {
    const modifierSign = formatModifierSign(modifier);
    const diceExpr = rolls.map(r => r.faceValue).join('+');
    message =
      `&{template:default} {{name=${modifierName} (Pixels Dice)}}` +
      ` {{Rolling=${formulaParts}${modifierSign}}}` +
      ` {{Dice=( ${individualValues} ) ${modifierSign}}}` +
      ` {{Result=[[(${diceExpr})+${modifier}[${modifierName}]]]}}`;
  } else {
    // Use inline roll so hover shows: Rolling (2+5+6+4+2) = 19
    const diceExpr = rolls.map(r => r.faceValue).join('+');
    message =
      `&{template:default} {{name=Pixels Dice}}` +
      ` {{Rolling=${formulaParts}}}` +
      ` {{Dice=( ${individualValues} )}}` +
      ` {{Result=[[(${diceExpr})]]}}`;
  }

  getPostChatMessage()(message);

  const diceNames = rolls.map(r => r.dieName).join(', ');
  getSendTextToExtension()(`${diceNames}: ${formulaParts} = ${totalDiceValue}`);
}

/**
 * Group rolls by die type and return counts, e.g. { 6: [5, 4], 20: [17] }
 */
function groupRollsByDieType(rolls) {
  const groups = {};
  for (const roll of rolls) {
    const type = roll.dieType;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(roll.faceValue);
  }
  return groups;
}

/**
 * Build the dice formula string like "2d6" or "2d6 + 1d8".
 */
function buildDiceFormulaParts(rollsByType) {
  const sortedTypes = Object.keys(rollsByType)
    .map(Number)
    .sort((a, b) => a - b);
  return sortedTypes
    .map(type => `${rollsByType[type].length}d${type}`)
    .join(' + ');
}

/**
 * Build a single-die formula with modifier (matches existing format).
 */
function buildSingleWithModifierFormula(
  faceValue,
  modifier,
  modifierName,
  dieType,
  dieName
) {
  const modifierSign = formatModifierSign(modifier);
  const diceWithHover = `<span title="${dieName}">${faceValue}</span>`;
  return (
    `&{template:default} {{name=${modifierName} (Pixels Dice)}}` +
    ` {{Rolling=1d${dieType}${modifierSign}}}` +
    ` {{Dice=${diceWithHover} ${modifierSign}}}` +
    ` {{Result=[[${faceValue}+${modifier}[${modifierName}]]]}}`
  );
}

/**
 * Build a single-die formula without modifier (matches existing format).
 */
function buildSingleSimpleFormula(faceValue, dieType, dieName) {
  const diceWithHover = `<span title="${dieName}">${faceValue}</span>`;
  return (
    `&{template:default} {{name=Pixels Dice}}` +
    ` {{Rolling=1d${dieType}}}` +
    ` {{Dice=${diceWithHover}}}` +
    ` {{Result=[[${faceValue}]]}}`
  );
}

function formatModifierSign(modifier) {
  const num = parseInt(modifier, 10) || 0;
  return num >= 0 ? `+${num}` : num.toString();
}

/**
 * Update the roll batching window duration.
 */
function setWindowMs(ms) {
  rollWindowMs = ms;
}

// Public API
const RollBatcher = {
  addRoll,
  parseDieType,
  flushRolls,
  setWindowMs,
};

export { addRoll, parseDieType, flushRolls, setWindowMs };
export default RollBatcher;

// Global export for backward compatibility with content script loading
if (typeof window !== 'undefined') {
  window.RollBatcher = RollBatcher;
}
