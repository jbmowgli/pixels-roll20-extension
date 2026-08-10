# Saved Roll Formulas — Tasks

## Phase 1: Core UI Refactor

- [ ] 1. Rewrite `modifierBox.html` template: replace radio+number row with name+formula+Roll button row; rename header to "Saved Rolls"
- [ ] 2. Refactor `rowManager.js`: change row data model to `{ name, formula }`, remove `updateSelectedModifier`, add `executeFormula()`, rename save/load functions, add v1→v2 migration
- [ ] 3. Update `modifierBox.js` orchestrator: remove `syncGlobalVars` / modifier selection logic, keep show/hide/popout, expose `executeFormula()`
- [ ] 4. Update `componentInitializer.js`: remove modifier-specific setup, wire Roll button event listeners

## Phase 2: Roll Execution Integration

- [ ] 5. Add `interceptFormula(formula)` to `PixelsCommand.js`: programmatic entry point that parses and starts a prompt without needing a textarea
- [ ] 6. Wire Roll button click → `PixelsCommand.interceptFormula(formula)` in rowManager
- [ ] 7. Remove modifier logic from `PixelsBluetooth.js`: unprompted rolls use simple formula only, no modifier reading
- [ ] 8. Remove modifier logic from `RollBatcher.js`: strip `modifier`, `modifierName`, `isModifierBoxVisible` from roll data and chat message building

## Phase 3: Settings & Popup

- [ ] 9. Update `popup.html`: rename checkbox label to "Display Saved Roll Formulas", change id to `toggleSavedRolls`
- [ ] 10. Update `popup.js`: use new storage key `pixels_saved_rolls_visible`, decouple saved rolls visibility from unprompted toggle, rename message actions
- [ ] 11. Update `roll20.js`: remove `window.pixelsModifier`/`window.pixelsModifierName` globals, rename message handlers (`showModifier`→`showSavedRolls`), remove `setModifier` handler

## Phase 4: Storage & Migration

- [ ] 12. Update localStorage key from `pixels_modifier_rows` to `pixels_saved_rolls` with v1→v2 migration on read
- [ ] 13. Update `profileStorage.js` / profile save/load to use new row shape; migrate existing profiles on load
- [ ] 14. Remove or deprecate `modifierSettings.js` (no longer needed for active modifier state)

## Phase 5: Cleanup & Verification

- [ ] 15. Update CSS styles for wider formula rows and Roll button styling
- [ ] 16. Run `npm run lint` — fix all errors
- [ ] 17. Run `npm test` — fix failing tests (update test mocks/assertions for removed modifier globals)
- [ ] 18. Manual verification: build extension, load in Chrome, confirm Roll button triggers `/pixels` prompt
