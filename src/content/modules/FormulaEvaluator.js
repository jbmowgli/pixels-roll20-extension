/**
 * FormulaEvaluator.js
 *
 * Wraps @3d-dice/dice-roller-parser to provide:
 * 1. Formula parsing and validation
 * 2. Slot determination from parsed AST (which physical dice to collect)
 * 3. Explosion/reroll condition checking (should a new slot be added?)
 * 4. Final evaluation with predetermined physical dice values
 *
 * The key challenge: dice-roller-parser expects a synchronous random function,
 * but we collect physical dice interactively. So we:
 *   - parse() to understand what dice are needed
 *   - Walk the AST ourselves to build initial slots and detect modifiers
 *   - Check explosion conditions as each die fills
 *   - Once all values are collected, feed them through the roller for evaluation
 */

'use strict';

import { DiceRoller } from '@3d-dice/dice-roller-parser';

// Safety limit for exploding dice to prevent infinite loops
const MAX_EXPLOSIONS_PER_GROUP = 20;

/**
 * Parse a dice formula string and return structured information.
 * Returns null if the formula is invalid.
 */
/**
 * Parse a dice formula string and return structured information.
 * Returns null if the formula is invalid.
 *
 * Normalizes Roll20-style operators: the library uses Roll20 semantics where
 * ">" means ">=" and "<" means "<=". The ">=" and "<=" tokens aren't
 * recognized by the PEG grammar, so we normalize them before parsing.
 */
function parseFormula(formulaStr) {
  if (!formulaStr || !formulaStr.trim()) {
    return null;
  }

  const normalized = normalizeOperators(formulaStr.trim());
  const roller = new DiceRoller();
  try {
    const ast = roller.parse(normalized);
    return ast;
  } catch {
    return null;
  }
}

/**
 * Normalize comparison operators to match library expectations.
 * Roll20 semantics: ">" means >=, "<" means <=.
 * Users might type ">=" or "<=" which the parser doesn't handle,
 * so convert them to ">" and "<" respectively.
 */
function normalizeOperators(formula) {
  return formula.replace(/>=/g, '>').replace(/<=/g, '<');
}

/**
 * Extract the initial set of dice slots needed from a parsed AST.
 * Each slot represents one physical die the user needs to roll.
 *
 * Returns: {
 *   slots: [{type, value, groupIndex, exploding, rerolling}],
 *   groups: [{dieSize, count, mods, targets, slots: [indices]}],
 *   formula: string (original formula),
 *   ast: object (parsed AST for later evaluation)
 * }
 */
function buildSlotsFromAst(ast, formulaStr) {
  const slots = [];
  const groups = [];

  walkForDice(ast, slots, groups);

  return {
    slots,
    groups,
    formula: formulaStr,
    ast,
  };
}

/**
 * Recursively walk the AST to find all die nodes and build slots.
 */
function walkForDice(node, slots, groups) {
  if (!node) {
    return;
  }

  if (node.type === 'die') {
    const dieSize = extractDieSize(node.die);
    const count = extractCount(node.count);

    if (dieSize === null || count === 0) {
      return;
    }

    const mods = node.mods || [];
    const targets = node.targets || [];
    const groupIndex = groups.length;

    const explosionMod = findExplosionMod(mods);
    const rerollMod = findRerollMod(mods);

    const group = {
      dieSize,
      count,
      mods,
      targets,
      match: node.match || null,
      slotIndices: [],
      explosionMod,
      rerollMod,
    };

    for (let i = 0; i < count; i++) {
      const slotIndex = slots.length;
      slots.push({
        type: dieSize,
        value: null,
        groupIndex,
        isExplosion: false,
        isReroll: false,
      });
      group.slotIndices.push(slotIndex);
    }

    groups.push(group);
    return;
  }

  // Expression: head + ops
  if (node.type === 'expression' || node.type === 'diceExpression') {
    walkForDice(node.head, slots, groups);
    if (node.ops) {
      for (const op of node.ops) {
        if (op.tail) {
          walkForDice(op.tail, slots, groups);
        }
      }
    }
    return;
  }

  // Group rolls: {4d6, 3d8}
  if (node.type === 'group') {
    if (node.rolls) {
      for (const roll of node.rolls) {
        walkForDice(roll, slots, groups);
      }
    }
    return;
  }

  // Inline expression
  if (node.type === 'inline') {
    walkForDice(node.expr, slots, groups);
    return;
  }
}

/**
 * Extract numeric die size from a die node.
 */
function extractDieSize(dieNode) {
  if (!dieNode) {
    return null;
  }
  if (dieNode.type === 'number') {
    return dieNode.value;
  }
  // Fate dice
  if (dieNode.type === 'fate') {
    return 'fate';
  }
  return null;
}

/**
 * Extract numeric count from a count node.
 */
function extractCount(countNode) {
  if (!countNode) {
    return 1;
  }
  if (countNode.type === 'number') {
    return countNode.value;
  }
  return 1;
}

/**
 * Find an explosion modifier in the mods array.
 * Types: "explode", "compound", "penetrate"
 */
function findExplosionMod(mods) {
  if (!mods) {
    return null;
  }
  return (
    mods.find(
      m =>
        m.type === 'explode' || m.type === 'compound' || m.type === 'penetrate'
    ) || null
  );
}

/**
 * Find a reroll modifier in the mods array.
 * Types: "reroll", "rerollOnce"
 */
function findRerollMod(mods) {
  if (!mods) {
    return null;
  }
  return mods.find(m => m.type === 'reroll' || m.type === 'rerollOnce') || null;
}

/**
 * Check if a rolled value triggers an explosion for the given group.
 * Returns true if a new slot should be added.
 */
function checkExplosion(value, group) {
  const mod = group.explosionMod;
  if (!mod) {
    return false;
  }

  // Count current explosions to enforce safety limit
  const explosionCount = group.slotIndices.length - group.count;
  if (explosionCount >= MAX_EXPLOSIONS_PER_GROUP) {
    return false;
  }

  return meetsExplosionTarget(value, group.dieSize, mod);
}

/**
 * Check if a value meets an explosion target condition.
 * Default (no target specified): explodes on max value.
 */
function meetsExplosionTarget(value, dieSize, mod) {
  const target = mod.target;

  // No target: explode on max
  if (!target) {
    return value === dieSize;
  }

  return compareValue(value, target.mod, extractTargetValue(target));
}

/**
 * Check if a rolled value triggers a reroll for the given group.
 * Returns true if this slot should be rerolled (value replaced).
 */
function checkReroll(value, group) {
  const mod = group.rerollMod;
  if (!mod) {
    return false;
  }

  return meetsRerollTarget(value, group.dieSize, mod);
}

/**
 * Check if a value meets a reroll target condition.
 * Default (no target specified): reroll on 1.
 */
function meetsRerollTarget(value, dieSize, mod) {
  const target = mod.target;

  // No target: reroll on min (1)
  if (!target) {
    return value === 1;
  }

  return compareValue(value, target.mod, extractTargetValue(target));
}

/**
 * Extract the numeric value from a target node.
 */
function extractTargetValue(target) {
  if (!target) {
    return null;
  }
  if (target.value && target.value.type === 'number') {
    return target.value.value;
  }
  if (target.expr && target.expr.type === 'number') {
    return target.expr.value;
  }
  return null;
}

/**
 * Compare a value against a target using the given comparison operator.
 */
function compareValue(value, operator, targetValue) {
  if (targetValue === null) {
    return false;
  }

  switch (operator) {
    case '>':
      return value > targetValue;
    case '<':
      return value < targetValue;
    case '=':
      return value === targetValue;
    case '>=':
      return value >= targetValue;
    case '<=':
      return value <= targetValue;
    default:
      // Default: equal
      return value === targetValue;
  }
}

/**
 * Add an explosion slot to a group.
 * Returns the index of the new slot.
 */
function addExplosionSlot(promptData, groupIndex) {
  const group = promptData.groups[groupIndex];
  const newSlotIndex = promptData.slots.length;

  promptData.slots.push({
    type: group.dieSize,
    value: null,
    groupIndex,
    isExplosion: true,
    isReroll: false,
  });

  group.slotIndices.push(newSlotIndex);
  return newSlotIndex;
}

/**
 * Mark a slot for reroll (clear its value so it needs to be filled again).
 * For "rerollOnce" the slot is cleared once. For "reroll" it keeps clearing
 * until the condition is no longer met (handled by the caller checking again).
 */
function markSlotForReroll(promptData, slotIndex) {
  promptData.slots[slotIndex].value = null;
  promptData.slots[slotIndex].isReroll = true;
}

/**
 * Evaluate the final result using the library with collected physical dice values.
 * Feeds predetermined values through the roller's random function.
 *
 * Returns the DiceRoller result object with:
 *   - value: total numeric result (or success count for target rolls)
 *   - successes: number of successes (for target rolls)
 *   - failures: number of failures
 *   - rolls/dice: detailed breakdown
 */
function evaluateWithValues(formulaStr, collectedValues) {
  const values = [...collectedValues];
  let valueIndex = 0;

  const normalized = normalizeOperators(formulaStr.trim());

  const roller = new DiceRoller(() => {
    if (valueIndex >= values.length) {
      // Fallback: shouldn't happen if slots are correctly filled
      return Math.random();
    }
    const { face, dieSize } = values[valueIndex++];
    return (face - 1) / dieSize;
  });

  return roller.roll(normalized);
}

/**
 * Build the ordered list of (face, dieSize) pairs from filled slots.
 * The order must match the order the library's roller will request random values.
 *
 * The roller uses a breadth-first explosion pattern:
 * 1. Roll all original dice for the group
 * 2. Roll one explosion for each die that exploded (round 1)
 * 3. Roll one explosion for each round-1 explosion that also exploded (round 2)
 * 4. Continue until no more explosions trigger
 *
 * Example: 2d6! where both originals explode and one explosion also explodes:
 *   Call order: orig1, orig2, exp-of-1, exp-of-2, exp-of-exp-of-1
 *
 * Groups are processed in AST order (the order they appear in the formula).
 */
function buildEvaluationOrder(promptData) {
  const values = [];

  for (const group of promptData.groups) {
    const groupSlots = group.slotIndices.map(i => promptData.slots[i]);

    // Separate originals from explosions, preserving insertion order
    const originals = groupSlots.filter(s => !s.isExplosion);
    const explosions = groupSlots.filter(s => s.isExplosion);

    // Originals always come first
    for (const slot of originals) {
      values.push({ face: slot.value, dieSize: group.dieSize });
    }

    // Explosions follow in BFS order (the order they were added)
    for (const slot of explosions) {
      values.push({ face: slot.value, dieSize: group.dieSize });
    }
  }

  return values;
}

/**
 * Determine if the formula is a "count successes" type roll.
 * These have targets on the die node (e.g., 8d6>5).
 */
function isSuccessCountRoll(promptData) {
  return promptData.groups.some(
    g =>
      g.targets &&
      g.targets.some(t => t.type === 'success' || t.type === 'failure')
  );
}

/**
 * Get a display-friendly formula string from the parsed data.
 */
function getFormulaDisplay(formulaStr) {
  return formulaStr.trim();
}

/**
 * Validate that a formula can be parsed and contains at least one die.
 */
function isValidFormula(formulaStr) {
  const ast = parseFormula(formulaStr);
  if (!ast) {
    return false;
  }
  const slots = [];
  const groups = [];
  walkForDice(ast, slots, groups);
  return slots.length > 0;
}

const FormulaEvaluator = {
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
  isValidFormula,
  normalizeOperators,
  // Exported for testing
  walkForDice,
  compareValue,
  extractDieSize,
  extractCount,
  meetsExplosionTarget,
  meetsRerollTarget,
};

export {
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
  isValidFormula,
  normalizeOperators,
  walkForDice,
  compareValue,
  extractDieSize,
  extractCount,
  meetsExplosionTarget,
  meetsRerollTarget,
};

export default FormulaEvaluator;
