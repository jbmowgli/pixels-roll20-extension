'use strict';

/**
 * knownDiceStorage.ts
 *
 * Persists previously connected Pixels dice names to chrome.storage.local
 * so the popup can offer quick reconnect buttons.
 */

interface KnownDie {
  name: string;
  lastConnected: number;
  dieType: number | null;
}

const STORAGE_KEY = 'pixels_known_dice';

/**
 * Retrieve the list of known dice from storage.
 * Returns an array of { name, lastConnected } objects sorted by most recent.
 */
export function getKnownDice(): Promise<KnownDie[]> {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve([]);
      return;
    }
    chrome.storage.local.get(
      STORAGE_KEY,
      (result: { [key: string]: KnownDie[] }) => {
        const dice: KnownDie[] = result[STORAGE_KEY] || [];
        resolve(dice);
      }
    );
  });
}

/**
 * Add or update a die in the known dice list.
 * Moves existing entries to the top (most recently connected).
 */
export function saveKnownDie(name: string, dieType?: number): Promise<void> {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }
    chrome.storage.local.get(
      STORAGE_KEY,
      (result: { [key: string]: KnownDie[] }) => {
        const dice: KnownDie[] = result[STORAGE_KEY] || [];
        const existing = dice.find(d => d.name === name);
        const filtered = dice.filter(d => d.name !== name);
        filtered.unshift({
          name,
          lastConnected: Date.now(),
          dieType: dieType || existing?.dieType || null,
        });
        chrome.storage.local.set({ [STORAGE_KEY]: filtered }, resolve);
      }
    );
  });
}

/**
 * Remove a die from the known dice list.
 */
export function removeKnownDie(name: string): Promise<void> {
  return new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }
    chrome.storage.local.get(
      STORAGE_KEY,
      (result: { [key: string]: KnownDie[] }) => {
        const dice: KnownDie[] = (result[STORAGE_KEY] || []).filter(
          (d: KnownDie) => d.name !== name
        );
        chrome.storage.local.set({ [STORAGE_KEY]: dice }, resolve);
      }
    );
  });
}
