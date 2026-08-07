/**
 * knownDiceStorage.js
 *
 * Persists previously connected Pixels dice names to chrome.storage.local
 * so the popup can offer quick reconnect buttons.
 */

'use strict';

const STORAGE_KEY = 'pixels_known_dice';

/**
 * Retrieve the list of known dice from storage.
 * Returns an array of { name, lastConnected } objects sorted by most recent.
 */
export function getKnownDice() {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve([]);
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, result => {
      const dice = result[STORAGE_KEY] || [];
      resolve(dice);
    });
  });
}

/**
 * Add or update a die in the known dice list.
 * Moves existing entries to the top (most recently connected).
 * @param {string} name - The die name.
 * @param {number} [dieType] - Number of faces (4, 6, 8, 10, 12, 20, 100).
 */
export function saveKnownDie(name, dieType) {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, result => {
      const dice = result[STORAGE_KEY] || [];
      const existing = dice.find(d => d.name === name);
      const filtered = dice.filter(d => d.name !== name);
      filtered.unshift({
        name,
        lastConnected: Date.now(),
        dieType: dieType || existing?.dieType || null,
      });
      chrome.storage.local.set({ [STORAGE_KEY]: filtered }, resolve);
    });
  });
}

/**
 * Remove a die from the known dice list.
 */
export function removeKnownDie(name) {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, result => {
      const dice = (result[STORAGE_KEY] || []).filter(d => d.name !== name);
      chrome.storage.local.set({ [STORAGE_KEY]: dice }, resolve);
    });
  });
}
