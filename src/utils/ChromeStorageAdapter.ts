'use strict';

import type { StorageAdapter, KnownDie } from '@scooper4711/pixels-ble';

const STORAGE_KEY = 'pixels_known_dice';

/**
 * Chrome extension storage adapter for persisting known Pixels dice.
 * Implements the StorageAdapter interface from @scooper4711/pixels-ble
 * using chrome.storage.local as the backing store.
 */
export class ChromeStorageAdapter implements StorageAdapter {
  async load(): Promise<KnownDie[]> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return [];
    }
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, result => {
        const raw = (result[STORAGE_KEY] || []) as Record<string, unknown>[];
        // Handle legacy format that may not have systemId
        const dice: KnownDie[] = raw.map(entry => ({
          name: entry.name as string,
          systemId: (entry.systemId as string) || (entry.name as string),
          dieType: (entry.dieType as number) ?? null,
          lastConnected: (entry.lastConnected as number) || 0,
        }));
        resolve(dice);
      });
    });
  }

  async save(dice: KnownDie[]): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORAGE_KEY]: dice }, () => resolve());
    });
  }
}
