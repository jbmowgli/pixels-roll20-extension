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

  describe('active profile', () => {
    test('set then get returns the name; local only', async () => {
      const ok = await profileStorage.setActiveProfile('Combat');
      expect(ok).toBe(true);
      expect(local._store.pixels_active_profile).toBe('Combat');
      expect(sync._store.pixels_active_profile).toBeUndefined();
      expect(await profileStorage.getActiveProfile()).toBe('Combat');
    });

    test('defaults to null and clears to null', async () => {
      expect(await profileStorage.getActiveProfile()).toBeNull();
      await profileStorage.setActiveProfile('Combat');
      await profileStorage.setActiveProfile('');
      expect(await profileStorage.getActiveProfile()).toBeNull();
    });
  });

  describe('uniqueName', () => {
    test('returns the base name when free', () => {
      expect(profileStorage.uniqueName('A', new Set())).toBe('A');
    });

    test('appends an incrementing suffix on collision', () => {
      const names = new Set(['A', 'A (2)']);
      expect(profileStorage.uniqueName('A', names)).toBe('A (3)');
    });
  });

  describe('exportProfiles / importProfiles', () => {
    test('exportProfiles returns a typed bundle of all profiles', async () => {
      await profileStorage.saveProfile('Combat', {
        rows: [{ name: 'Rage', value: '2' }],
        selectedIndex: 0,
      });

      const bundle = await profileStorage.exportProfiles();

      expect(bundle.type).toBe('pixels-roll20-profiles');
      expect(bundle.version).toBe(1);
      expect(bundle.profiles.Combat).toBeDefined();
    });

    test('exportProfile returns a bundle with only the named profile', async () => {
      await profileStorage.saveProfile('Combat', {
        rows: [{ name: 'Rage', value: '2' }],
        selectedIndex: 0,
      });
      await profileStorage.saveProfile('Social', {
        rows: [],
        selectedIndex: -1,
      });

      const bundle = await profileStorage.exportProfile('Combat');

      expect(bundle.type).toBe('pixels-roll20-profiles');
      expect(Object.keys(bundle.profiles)).toEqual(['Combat']);
    });

    test('exportProfile returns null for an unknown profile', async () => {
      expect(await profileStorage.exportProfile('Nope')).toBeNull();
    });

    test('a single-profile export imports back identically', async () => {
      await profileStorage.saveProfile('Combat', {
        rows: [{ name: 'Rage', value: '2' }],
        selectedIndex: 0,
      });
      const bundle = await profileStorage.exportProfile('Combat');

      // Fresh store
      local = makeArea();
      sync = makeArea();
      chrome.storage = { local, sync };

      const result = await profileStorage.importProfiles(bundle);
      expect(result.imported).toBe(1);
      const profiles = await profileStorage.getProfiles();
      expect(profiles.Combat.rows[0].name).toBe('Rage');
    });

    test('importProfiles keeps both on name collision (rename)', async () => {
      await profileStorage.saveProfile('Combat', {
        rows: [{ name: 'original', value: '0' }],
        selectedIndex: 0,
      });

      const result = await profileStorage.importProfiles({
        type: 'pixels-roll20-profiles',
        profiles: {
          Combat: {
            rows: [{ name: 'imported', value: '9' }],
            selectedIndex: 0,
          },
        },
      });

      expect(result.imported).toBe(1);

      const profiles = await profileStorage.getProfiles();
      // Original is untouched, the import landed under a renamed key.
      expect(profiles.Combat.rows[0].name).toBe('original');
      expect(profiles['Combat (2)'].rows[0].name).toBe('imported');
    });

    test('importProfiles skips invalid entries and reports an invalid bundle', async () => {
      const skipResult = await profileStorage.importProfiles({
        profiles: { Bad: { notRows: true } },
      });
      expect(skipResult.imported).toBe(0);
      expect(skipResult.skipped).toBe(1);

      const badResult = await profileStorage.importProfiles({ nope: true });
      expect(badResult.error).toBe('invalid');
    });
  });
});
