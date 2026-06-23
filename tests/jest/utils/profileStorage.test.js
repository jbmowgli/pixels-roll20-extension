/**
 * @jest-environment jsdom
 */

const profileStorage = require('../../../src/utils/profileStorage.js');

// In-memory chrome.storage area mock.
function makeArea() {
  const store = {};
  return {
    _store: store,
    get: jest.fn((key, cb) => {
      const result = {};
      if (typeof key === 'string' && key in store) {
        result[key] = store[key];
      }
      cb(result);
    }),
    set: jest.fn((obj, cb) => {
      Object.assign(store, obj);
      cb();
    }),
  };
}

// Area whose set() fails (simulates sync quota exceeded) by raising lastError.
function makeFailingArea() {
  const area = makeArea();
  area.set = jest.fn((obj, cb) => {
    chrome.runtime.lastError = { message: 'QUOTA_BYTES quota exceeded' };
    cb();
    delete chrome.runtime.lastError;
  });
  return area;
}

describe('profileStorage', () => {
  let local;
  let sync;

  beforeEach(() => {
    resetMocks();
    local = makeArea();
    sync = makeArea();
    chrome.storage = { local, sync };
    delete chrome.runtime.lastError;
  });

  describe('saveProfile / getProfiles', () => {
    test('writes the profile to BOTH local and sync', async () => {
      const ok = await profileStorage.saveProfile('Combat', {
        rows: [{ name: 'Rage', value: '2' }],
        selectedIndex: 0,
      });

      expect(ok).toBe(true);
      expect(local._store.pixels_profiles.Combat.rows).toEqual([
        { name: 'Rage', value: '2' },
      ]);
      expect(sync._store.pixels_profiles.Combat.rows).toEqual([
        { name: 'Rage', value: '2' },
      ]);
      expect(local._store.pixels_profiles.Combat.savedAt).toEqual(
        expect.any(Number)
      );
    });

    test('rejects an empty profile name', async () => {
      const ok = await profileStorage.saveProfile('', { rows: [] });
      expect(ok).toBe(false);
      expect(local._store.pixels_profiles).toBeUndefined();
    });

    test('a sync write failure does not break the save (local wins)', async () => {
      sync = makeFailingArea();
      chrome.storage = { local, sync };

      const ok = await profileStorage.saveProfile('Solo', {
        rows: [{ name: 'Bless', value: '1' }],
        selectedIndex: 0,
      });

      expect(ok).toBe(true); // local succeeded
      expect(local._store.pixels_profiles.Solo).toBeDefined();
      expect(sync._store.pixels_profiles).toBeUndefined();
    });

    test('getProfiles returns a merged map', async () => {
      await profileStorage.saveProfile('A', { rows: [], selectedIndex: -1 });
      const profiles = await profileStorage.getProfiles();
      expect(Object.keys(profiles)).toContain('A');
    });
  });

  describe('mergeProfiles', () => {
    test('keeps the newer entry per name by savedAt', () => {
      const localProfiles = {
        A: { rows: [{ name: 'old' }], savedAt: 100 },
        B: { rows: [], savedAt: 50 },
      };
      const syncProfiles = {
        A: { rows: [{ name: 'new' }], savedAt: 200 },
        C: { rows: [], savedAt: 10 },
      };

      const merged = profileStorage.mergeProfiles(localProfiles, syncProfiles);

      expect(merged.A.rows[0].name).toBe('new'); // sync newer
      expect(merged.B).toBeDefined(); // local-only kept
      expect(merged.C).toBeDefined(); // sync-only kept
    });

    test('handles undefined inputs', () => {
      expect(profileStorage.mergeProfiles(undefined, undefined)).toEqual({});
    });
  });

  describe('deleteProfile', () => {
    test('removes a profile from both areas', async () => {
      await profileStorage.saveProfile('Temp', { rows: [], selectedIndex: -1 });
      const removed = await profileStorage.deleteProfile('Temp');

      expect(removed).toBe(true);
      expect(local._store.pixels_profiles.Temp).toBeUndefined();
      expect(sync._store.pixels_profiles.Temp).toBeUndefined();
    });

    test('returns false for an unknown profile', async () => {
      const removed = await profileStorage.deleteProfile('Nope');
      expect(removed).toBe(false);
    });
  });

  describe('minimized flag', () => {
    test('setMinimized writes to local only, getMinimized reads it', async () => {
      const ok = await profileStorage.setMinimized(true);

      expect(ok).toBe(true);
      expect(local._store.pixels_minimized).toBe(true);
      expect(sync._store.pixels_minimized).toBeUndefined();
      expect(await profileStorage.getMinimized()).toBe(true);
    });

    test('defaults to false when unset', async () => {
      expect(await profileStorage.getMinimized()).toBe(false);
    });
  });

  describe('graceful degradation', () => {
    test('getProfiles resolves to {} when chrome.storage is absent', async () => {
      delete chrome.storage;
      expect(await profileStorage.getProfiles()).toEqual({});
    });

    test('saveProfile resolves false when chrome.storage is absent', async () => {
      delete chrome.storage;
      expect(await profileStorage.saveProfile('X', { rows: [] })).toBe(false);
    });
  });
});
