/**
 * FormulaEvaluator.ts
 *
 * Wraps @3d-dice/dice-roller-parser to provide:
 * 1. Formula parsing and validation
 * 2. Slot determination from parsed AST (which physical dice to collect)
 * 3. Explosion/reroll condition checking (should a new slot be added?)
 * 4. Final evaluation with predetermined physical dice values
 */

'use strict';

import { DiceRoller } from '@3d-dice/dice-roller-parser';
import type { RootType, ParsedType } from '@3d-dice/dice-roller-parser';
import type { RollBase } from '@3d-dice/dice-roller-parser';

// Safety limit for exploding dice to prevent infinite loops
const MAX_EXPLOSIONS_PER_GROUP = 20;

// --- Local Types ---

type DieSize = number | 'fate';

interface Slot {
  type: DieSize;
  value: number | null;
  groupIndex: number;
  isExplosion: boolean;
  isReroll: boolean;
}

interface ModTarget {
  mod?: string;
  value?: ParsedType;
  expr?: ParsedType;
}

interface DieMod {
  type: string;
  target?: ModTarget;
}

interface DieGroup {
  dieSize: DieSize;
  count: number;
  mods: DieMod[];
  targets: ParsedType[];
  match: ParsedType | null;
  slotIndices: number[];
  explosionMod: DieMod | null;
  rerollMod: DieMod | null;
}

interface PromptData {
  slots: Slot[];
  groups: DieGroup[];
  formula: string;
  ast: RootType;
  whisper?: boolean;
}

interface EvaluationValue {
  face: number;
  dieSize: DieSize;
}

// AST node shape (loose — the PEG parser produces untyped sub-nodes)
interface AstNode {
  type: string;
  die?: ParsedType;
  count?: ParsedType;
  mods?: DieMod[];
  targets?: ParsedType[];
  match?: ParsedType | null;
  head?: AstNode;
  ops?: Array<{ tail?: AstNode }>;
  rolls?: AstNode[];
  expr?: AstNode;
  value?: number;
}

/**
 * Parse a dice formula string and return structured information.
 * Returns null if the formula is invalid.
 */
function parseFormula(formulaStr: string): RootType | null {
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
 */
function normalizeOperators(formula: string): string {
  return formula.replace(/>=/g, '>').replace(/<=/g, '<');
}

/**
 * Extract the initial set of dice slots needed from a parsed AST.
 */
function buildSlotsFromAst(ast: RootType, formulaStr: string): PromptData {
  const slots: Slot[] = [];
  const groups: DieGroup[] = [];

  walkForDice(ast as unknown as AstNode, slots, groups);

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
function walkForDice(
  node: AstNode | null,
  slots: Slot[],
  groups: DieGroup[]
): void {
  if (!node) {
    return;
  }

  if (node.type === 'die') {
    const dieSize = extractDieSize(node.die as AstNode | undefined);
    const count = extractCount(node.count as AstNode | undefined);

    if (dieSize === null || count === 0) {
      return;
    }

    const mods: DieMod[] = node.mods || [];
    const targets: ParsedType[] = node.targets || [];
    const groupIndex = groups.length;

    const explosionMod = findExplosionMod(mods);
    const rerollMod = findRerollMod(mods);

    const group: DieGroup = {
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
    walkForDice(node.head || null, slots, groups);
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
    walkForDice(node.expr || null, slots, groups);
    return;
  }
}

/**
 * Extract numeric die size from a die node.
 */
function extractDieSize(dieNode: AstNode | undefined): DieSize | null {
  if (!dieNode) {
    return null;
  }
  if (dieNode.type === 'number') {
    return dieNode.value!;
  }
  if (dieNode.type === 'fate') {
    return 'fate';
  }
  return null;
}

/**
 * Extract numeric count from a count node.
 */
function extractCount(countNode: AstNode | undefined): number {
  if (!countNode) {
    return 1;
  }
  if (countNode.type === 'number') {
    return countNode.value!;
  }
  return 1;
}

/**
 * Find an explosion modifier in the mods array.
 */
function findExplosionMod(mods: DieMod[] | null): DieMod | null {
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
 */
function findRerollMod(mods: DieMod[] | null): DieMod | null {
  if (!mods) {
    return null;
  }
  return mods.find(m => m.type === 'reroll' || m.type === 'rerollOnce') || null;
}

/**
 * Check if a rolled value triggers an explosion for the given group.
 */
function checkExplosion(value: number, group: DieGroup): boolean {
  const mod = group.explosionMod;
  if (!mod) {
    return false;
  }

  const explosionCount = group.slotIndices.length - group.count;
  if (explosionCount >= MAX_EXPLOSIONS_PER_GROUP) {
    return false;
  }

  return meetsExplosionTarget(value, group.dieSize, mod);
}

/**
 * Check if a value meets an explosion target condition.
 */
function meetsExplosionTarget(
  value: number,
  dieSize: DieSize,
  mod: DieMod
): boolean {
  const target = mod.target;

  // No target: explode on max
  if (!target) {
    return value === dieSize;
  }

  return compareValue(value, target.mod || '=', extractTargetValue(target));
}

/**
 * Check if a rolled value triggers a reroll for the given group.
 */
function checkReroll(value: number, group: DieGroup): boolean {
  const mod = group.rerollMod;
  if (!mod) {
    return false;
  }

  return meetsRerollTarget(value, group.dieSize, mod);
}

/**
 * Check if a value meets a reroll target condition.
 */
function meetsRerollTarget(
  value: number,
  _dieSize: DieSize,
  mod: DieMod
): boolean {
  const target = mod.target;

  // No target: reroll on min (1)
  if (!target) {
    return value === 1;
  }

  return compareValue(value, target.mod || '=', extractTargetValue(target));
}

/**
 * Extract the numeric value from a target node.
 */
function extractTargetValue(target: ModTarget): number | null {
  if (!target) {
    return null;
  }
  if (target.value && (target.value as AstNode).type === 'number') {
    return (target.value as AstNode).value!;
  }
  if (target.expr && (target.expr as AstNode).type === 'number') {
    return (target.expr as AstNode).value!;
  }
  return null;
}

/**
 * Compare a value against a target using the given comparison operator.
 */
function compareValue(
  value: number,
  operator: string,
  targetValue: number | null
): boolean {
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
      return value === targetValue;
  }
}

/**
 * Add an explosion slot to a group.
 */
function addExplosionSlot(promptData: PromptData, groupIndex: number): number {
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
 */
function markSlotForReroll(promptData: PromptData, slotIndex: number): void {
  promptData.slots[slotIndex].value = null;
  promptData.slots[slotIndex].isReroll = true;
}

/**
 * Evaluate the final result using the library with collected physical dice values.
 */
function evaluateWithValues(
  formulaStr: string,
  collectedValues: EvaluationValue[]
): RollBase {
  const values = [...collectedValues];
  let valueIndex = 0;

  const normalized = normalizeOperators(formulaStr.trim());

  const roller = new DiceRoller(() => {
    if (valueIndex >= values.length) {
      return Math.random();
    }
    const { face, dieSize } = values[valueIndex++];
    return (face - 1) / (dieSize as number);
  });

  return roller.roll(normalized);
}

/**
 * Build the ordered list of (face, dieSize) pairs from filled slots.
 */
function buildEvaluationOrder(promptData: PromptData): EvaluationValue[] {
  const values: EvaluationValue[] = [];

  for (const group of promptData.groups) {
    const groupSlots = group.slotIndices.map(i => promptData.slots[i]);

    const originals = groupSlots.filter(s => !s.isExplosion);
    const explosions = groupSlots.filter(s => s.isExplosion);

    for (const slot of originals) {
      values.push({ face: slot.value!, dieSize: group.dieSize });
    }

    for (const slot of explosions) {
      values.push({ face: slot.value!, dieSize: group.dieSize });
    }
  }

  return values;
}

/**
 * Determine if the formula is a "count successes" type roll.
 */
function isSuccessCountRoll(promptData: PromptData): boolean {
  return promptData.groups.some(
    g =>
      g.targets &&
      g.targets.some(t => t.type === 'success' || t.type === 'failure')
  );
}

/**
 * Get a display-friendly formula string from the parsed data.
 */
function getFormulaDisplay(formulaStr: string): string {
  return formulaStr.trim();
}

/**
 * Validate that a formula can be parsed and contains at least one die.
 */
function isValidFormula(formulaStr: string): boolean {
  const ast = parseFormula(formulaStr);
  if (!ast) {
    return false;
  }
  const slots: Slot[] = [];
  const groups: DieGroup[] = [];
  walkForDice(ast as unknown as AstNode, slots, groups);
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

export type { Slot, DieGroup, PromptData, EvaluationValue, DieSize };

export default FormulaEvaluator;
