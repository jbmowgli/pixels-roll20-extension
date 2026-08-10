# Saved Roll Formulas — Requirements

## Overview

Replace the existing "Modifier Box" (a floating panel with named numeric modifiers selected via radio buttons) with a "Saved Roll Formulas" panel. Each row stores a named dice formula that can be executed via a "Roll" button, which programmatically invokes the `/pixels` command with that formula.

## Functional Requirements

### FR-1: Saved Roll Formula Rows

- Each row has a **name** (free text, e.g. "Fireball", "Attack +5") and a **formula** field (e.g. `2d6+5`, `1d20+8`, `4d6kh3`).
- The formula field accepts any string valid for the `/pixels` command parser (dice-roller-parser syntax).
- Each row has a **"Roll"** button (replaces the old radio-button selection).
- Clicking "Roll" executes the formula as if the user typed `/pixels <formula>` in Roll20 chat.

### FR-2: Row Management

- Users can **add** new saved roll rows.
- Users can **remove** individual rows.
- Users can **reorder** rows via drag-and-drop (existing drag handle mechanism).
- A "Clear All" button resets all rows.

### FR-3: Saved Roll Sets (Profiles)

- Users can save the current set of formulas as a named profile.
- Users can load a saved profile, replacing the current rows.
- Users can delete saved profiles.
- Users can **export** profiles to a JSON file and **import** them back.
- Profile data structure stores formula text (not numeric modifier values).

### FR-4: Settings / Visibility

- The popup setting is renamed from "Show Modifier Box" to **"Display Saved Roll Formulas"**.
- The visibility of the saved rolls panel is **independent** of the "Allow unprompted rolls" setting (decoupled).
- Storage key changes from `pixels_modifier_box_visible` to `pixels_saved_rolls_visible`.

### FR-5: Removal of Modifier-on-Unprompted Behavior

- Unprompted rolls (physical dice rolled outside a `/pixels` prompt) no longer apply any modifier from the panel.
- The global `window.pixelsModifier` / `window.pixelsModifierName` variables are removed or deprecated.
- The roll window slider for batching unprompted rolls remains unchanged.

### FR-6: UI Appearance

- The panel header reads **"Saved Rolls"** (with Pixels logo).
- Each row is wider than before: name field + formula text field + "Roll" button + remove button + drag handle.
- No radio buttons.
- The panel retains: drag-to-move, pop-out to window, minimize, theme awareness, resize handle.

## Non-Functional Requirements

### NFR-1: Backward Compatibility

- Existing localStorage data (`pixels_modifier_rows`) is migrated: old `{ name, value }` rows become `{ name, formula: "+<value>" }` (or similar sensible default).
- Existing saved profiles are migrated on load.

### NFR-2: Formula Validation

- Invalid formulas show inline feedback when "Roll" is pressed (e.g. red border flash) but do not prevent saving the row.
- Validation uses the same `parseFormula()` from FormulaEvaluator.js.

### NFR-3: Performance

- The panel must not degrade Roll20 page performance. Lazy-load the formula parser only when "Roll" is pressed.
