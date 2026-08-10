# Saved Roll Formulas — Design

## Architecture Overview

The feature repurposes the existing modifier box component (`src/components/modifierBox/`) in-place. The component keeps its file structure, drag/theme/popout infrastructure, but the row data model changes from `{ name, value (number) }` to `{ name, formula (string) }` and the interaction model changes from "select active modifier via radio" to "click Roll to execute formula".

## Data Model

### Row Shape (localStorage: `pixels_modifier_rows`)

```json
{
  "rows": [
    { "name": "Attack", "formula": "1d20+5" },
    { "name": "Fireball", "formula": "8d6" }
  ],
  "version": 2
}
```

Note: `selectedIndex` is removed (no active selection concept).

### Profile Shape (chrome.storage.local: `pixels_profiles`)

Same as before but row objects use the new shape:

```json
{
  "My Character": {
    "rows": [{ "name": "Attack", "formula": "1d20+5" }]
  }
}
```

### Migration

On load, if `version` is missing (v1 format), convert each row:

- `{ name: "Fireball", value: "5" }` → `{ name: "Fireball", formula: "+5" }`
- Removes `selectedIndex` / `originalIndex` fields.
- Sets `version: 2`.

## Component Changes

### modifierBox.html

```
Row template (before):
  drag-handle | radio | name-input | number-input | remove-btn

Row template (after):
  drag-handle | name-input | formula-input | roll-btn | remove-btn
```

- `formula-input`: `<input type="text">` with placeholder "e.g. 2d6+3"
- `roll-btn`: `<button class="roll-formula-btn">Roll</button>`
- Header title: "Saved Rolls"

### rowManager.js

- `addModifierRow` → `addFormulaRow`: creates row with name + formula fields.
- `updateSelectedModifier` → removed (no selection).
- `serializeRows`: returns `{ rows: [{ name, formula }], version: 2 }`.
- `applyRows` / `loadModifierRows`: handles v1→v2 migration.
- `saveModifierRows` → `saveFormulaRows`.
- New: `executeFormula(formula)` — dispatches the formula to PixelsCommand.

### modifierBox.js (orchestrator)

- `showModifierBox` / `hideModifierBox` remain but internal references updated.
- `updateSelectedModifier` / `syncGlobalVars` removed.
- Public API: `show()`, `hide()`, `isVisible()`, `getElement()`, `executeFormula(formula)`.

### Roll Execution Flow

```
User clicks "Roll" button on row
  → rowManager reads formula from that row's input
  → calls PixelsCommand.interceptFormula(formula) (new method)
  → PixelsCommand parses formula, builds slots, shows prompt overlay
  → User rolls physical dice to fill slots
  → Result posted to Roll20 chat
```

New `interceptFormula(formula)` in PixelsCommand.js:

- Same as `interceptCommand` but receives formula directly (no textarea).
- Handles `/gmpixels` prefix if formula starts with "gm:" or similar (stretch goal).

### popup.html / popup.js

- Checkbox label: "Display Saved Roll Formulas"
- `id="toggleModifierBox"` → `id="toggleSavedRolls"`
- Storage key: `pixels_saved_rolls_visible`
- Remove the conditional hiding of the toggle/profiles section based on `allowUnprompted`.
- Profiles section stays visible regardless of unprompted setting.

### PixelsBluetooth.js

- Remove modifier reading from the unprompted roll path.
- `isModifierBoxVisible` check removed from unprompted roll processing.
- Unprompted rolls always use the simple formula (no modifier applied).

### RollBatcher.js

- Remove `modifier`, `modifierName`, `isModifierBoxVisible` from `addRoll()` params.
- `postSingleRoll` and `postGroupedRoll` always use the simple (no-modifier) formula.

### roll20.js

- Remove global `window.pixelsModifier`, `window.pixelsModifierName`.
- Remove `setModifier` message handler.
- Keep `showModifier`/`hideModifier` message handlers (renamed to `showSavedRolls`/`hideSavedRolls`).

### modifierSettings.js

- Remove or gut — no longer needed for active modifier persistence.
- May keep as a thin migration utility.

## Storage Keys Summary

| Old Key                       | New Key                      | Notes                   |
| ----------------------------- | ---------------------------- | ----------------------- |
| `pixels_modifier_box_visible` | `pixels_saved_rolls_visible` | chrome.storage.local    |
| `pixels_modifier_rows`        | `pixels_saved_rolls`         | localStorage            |
| `pixels_roll20_settings`      | (removed)                    | Was for active modifier |

## Files Changed

1. `src/components/modifierBox/modifierBox.html` — template rewrite
2. `src/components/modifierBox/rowManager.js` — major refactor
3. `src/components/modifierBox/modifierBox.js` — remove modifier sync
4. `src/components/modifierBox/componentInitializer.js` — minor updates
5. `src/components/modifierBox/stateManager.js` — no change (manages DOM ref)
6. `src/components/popup/popup.html` — rename label, decouple visibility
7. `src/components/popup/popup.js` — rename key, remove conditional hiding
8. `src/content/modules/PixelsBluetooth.js` — remove modifier from rolls
9. `src/content/modules/RollBatcher.js` — remove modifier from formulas
10. `src/content/modules/PixelsCommand.js` — add `interceptFormula()`
11. `src/content/roll20.js` — remove globals, rename messages
12. `src/utils/modifierSettings.js` — deprecate/remove
13. `src/utils/profileStorage.js` — adapt profile shape for migration
