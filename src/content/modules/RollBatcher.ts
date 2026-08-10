/**
 * RollBatcher.ts
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
function getPostChatMessage(): (message: string) => void {
  return window.postChatMessage || function () {};
}

function getSendTextToExtension(): (txt: string) => void {
  return window.sendTextToExtension || function () {};
}

/**
 * Parse die type (number of faces) from a Pixel die name.
 * Pixels dice are typically named like "PixelD6_XXXX", "MyD20", etc.
 * Falls back to inferring from the rolled value when name doesn't help.
 */
function parseDieType(dieName: string, faceValue: number): number {
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
function inferDieSize(faceValue: number): number {
  const standardDice = [4, 6, 8, 10, 12, 20, 100];
  for (const size of standardDice) {
    if (faceValue <= size) {
      return size;
    }
  }
  return 20;
}

// Batched roll entries
let pendingRolls: RollData[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Add a roll to the current batch. If this is the first roll, start the
 * grouping timer. When the timer fires, flush all collected rolls.
 */
function addRoll(rollData: RollData): void {
  pendingRolls.push(rollData);

  if (batchTimer !== null) {
    clearTimeout(batchTimer);
  }
  batchTimer = setTimeout(flushRolls, rollWindowMs);
}

/**
 * Flush all pending rolls as either a single roll message or a grouped message.
 */
function flushRolls(): void {
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
 * Post a single-die roll result to Roll20 chat.
 */
function postSingleRoll(roll: RollData): void {
  const { dieName, dieType, faceValue } = roll;

  const formula = buildSingleSimpleFormula(faceValue, dieType, dieName);
  formula.split('\\n').forEach(s => getPostChatMessage()(s));
  getSendTextToExtension()(`${dieName}: face up = ${faceValue}`);
}

/**
 * Post a grouped multi-dice roll with formula, individual results, and sum.
 */
function postGroupedRoll(rolls: RollData[]): void {
  // Detect percentile combo: exactly one d% and one d10
  const percentileRolls = rolls.filter(r => r.dieType === 100);
  const d10Rolls = rolls.filter(r => r.dieType === 10);
  const otherRolls = rolls.filter(r => r.dieType !== 100 && r.dieType !== 10);

  if (percentileRolls.length === 1 && d10Rolls.length === 1) {
    const percentileResult = computePercentileValue(
      percentileRolls[0].faceValue,
      d10Rolls[0].faceValue
    );
    // Combine into a single virtual "d%" roll
    const combinedRolls: RollData[] = [
      ...otherRolls,
      {
        dieName: `${percentileRolls[0].dieName}+${d10Rolls[0].dieName}`,
        dieType: 101, // Special marker for combined percentile
        faceValue: percentileResult,
      },
    ];

    if (combinedRolls.length === 1) {
      postSingleRoll(combinedRolls[0]);
      const diceNames = `${percentileRolls[0].dieName}, ${d10Rolls[0].dieName}`;
      getSendTextToExtension()(`${diceNames}: d% = ${percentileResult}`);
      return;
    }
    // If there are other dice beyond the percentile pair, post as grouped
    postGroupedRollFromList(combinedRolls);
    return;
  }

  postGroupedRollFromList(rolls);
}

/**
 * Compute percentile value from d% and d10 face values.
 */
function computePercentileValue(
  percentileFace: number,
  d10Face: number
): number {
  const d10AsZero = d10Face === 10 ? 0 : d10Face;
  if (percentileFace === 100 && d10AsZero === 0) {
    return 100;
  }
  if (percentileFace === 100) {
    return d10AsZero;
  }
  return percentileFace + d10AsZero;
}

/**
 * Post a grouped roll from a pre-processed list of rolls.
 */
function postGroupedRollFromList(rolls: RollData[]): void {
  const rollsByType = groupRollsByDieType(rolls);
  const totalDiceValue = rolls.reduce((sum, r) => sum + r.faceValue, 0);

  const formulaParts = buildDiceFormulaParts(rollsByType);

  // Sort rolls by die type to match the formula ordering
  const sortedRolls = [...rolls].sort((a, b) => a.dieType - b.dieType);
  const individualValues = sortedRolls
    .map(r => `<span title="${r.dieName}">${r.faceValue}</span>`)
    .join(' + ');

  const diceExpr = sortedRolls.map(r => r.faceValue).join('+');
  const message =
    `&{template:default} {{name=Pixels Dice}}` +
    ` {{Rolling=${formulaParts}}}` +
    ` {{Dice=( ${individualValues} )}}` +
    ` {{Result=[[(${diceExpr})]]}}`;

  getPostChatMessage()(message);

  const diceNames = rolls.map(r => r.dieName).join(', ');
  getSendTextToExtension()(`${diceNames}: ${formulaParts} = ${totalDiceValue}`);
}

/**
 * Group rolls by die type and return counts.
 */
function groupRollsByDieType(rolls: RollData[]): Record<number, number[]> {
  const groups: Record<number, number[]> = {};
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
function buildDiceFormulaParts(rollsByType: Record<number, number[]>): string {
  const sortedTypes = Object.keys(rollsByType)
    .map(Number)
    .sort((a, b) => a - b);
  return sortedTypes
    .map(type => {
      let label: string;
      if (type === 101) {
        label = 'd%';
      } else if (type === 100) {
        label = 'd00';
      } else {
        label = `d${type}`;
      }
      return `${rollsByType[type].length}${label}`;
    })
    .join(' + ');
}

/**
 * Build a single-die chat message (no modifier).
 */
function buildSingleSimpleFormula(
  faceValue: number,
  dieType: number,
  dieName: string
): string {
  const diceWithHover = `<span title="${dieName}">${faceValue}</span>`;
  const dieLabel =
    dieType === 101 ? 'd%' : dieType === 100 ? 'd00' : `d${dieType}`;
  return (
    `&{template:default} {{name=Pixels Dice}}` +
    ` {{Rolling=1${dieLabel}}}` +
    ` {{Dice=${diceWithHover}}}` +
    ` {{Result=[[${faceValue}]]}}`
  );
}

/**
 * Update the roll batching window duration.
 */
function setWindowMs(ms: number): void {
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
