'use strict';

/**
 * profileStorage.js
 *
 * Persistence wrapper for the Pixels Roll20 extension.
 *
 * Saved profiles (named sets of modifier rows) are written to BOTH
 * chrome.storage.local and chrome.storage.sync. Reads prefer/merge sync and
 * local per-profile by `savedAt` (last-write-wins). The minimized-state flag is
 * stored in chrome.storage.local only, since it is a per-device UI preference.
 *
 * Why dual-write for profiles: chrome.storage.sync only propagates across
 * devices on browsers wired to a sync backend (Chrome, Edge). On Brave / Opera /
 * Vivaldi the sync API exists but silently behaves like local, so the local copy
 * is always the source of truth there. Dual-write gives cross-device sync where
 * available and correct single-device behavior everywhere, with no failure modes
 * introduced (sync writes that exceed quota are caught and ignored).
 */

const PROFILES_KEY = 'pixels_profiles';
const MINIMIZED_KEY = 'pixels_minimized';
const ACTIVE_KEY = 'pixels_active_profile';
const EXPORT_TYPE = 'pixels-roll20-profiles';

// Resolve a chrome.storage area ('local' | 'sync'), or null if it is not
// available in this context (e.g. test environment without a storage mock).
function area(name) {
  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage[name]
    ) {
      return chrome.storage[name];
    }
  } catch {
    // chrome is not accessible in this context
  }
  return null;
}

function hasLastError() {
  try {
    return Boolean(
      typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.lastError
    );
  } catch {
    return false;
  }
}

// Promise wrapper around chrome.storage[area].get for a single key. Resolves
// undefined if the area is unavailable or the read fails; never rejects.
function readArea(name, key) {
  const a = area(name);
  if (!a) {
    return Promise.resolve(undefined);
  }
  return new Promise(resolve => {
    try {
      a.get(key, result => {
        if (hasLastError()) {
          resolve(undefined);
          return;
        }
        resolve(result ? result[key] : undefined);
      });
    } catch {
      resolve(undefined);
    }
  });
}

// Promise wrapper around chrome.storage[area].set. Resolves true on success,
// false on failure (e.g. sync quota exceeded). Never rejects, so a failed sync
// write cannot break a save.
function writeArea(name, key, value) {
  const a = area(name);
  if (!a) {
    return Promise.resolve(false);
  }
  return new Promise(resolve => {
    try {
      a.set({ [key]: value }, () => {
        resolve(!hasLastError());
      });
    } catch {
      resolve(false);
    }
  });
}

// Merge two profile maps, keeping the newer entry per name by savedAt.
function mergeProfiles(localProfiles, syncProfiles) {
  const merged = { ...(localProfiles || {}) };
  Object.entries(syncProfiles || {}).forEach(([name, profile]) => {
    const existing = merged[name];
    if (!existing || (profile?.savedAt || 0) >= (existing.savedAt || 0)) {
      merged[name] = profile;
    }
  });
  return merged;
}

// Return all saved profiles as a { name: { rows, selectedIndex, savedAt } } map.
async function getProfiles() {
  const [localProfiles, syncProfiles] = await Promise.all([
    readArea('local', PROFILES_KEY),
    readArea('sync', PROFILES_KEY),
  ]);
  return mergeProfiles(localProfiles, syncProfiles);
}

// Save (or overwrite) a profile by name. `data` is { rows, selectedIndex }.
// Returns true if the local (source-of-truth) write succeeded.
async function saveProfile(name, data) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  const profiles = await getProfiles();
  profiles[name] = {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    selectedIndex: Number.isInteger(data?.selectedIndex)
      ? data.selectedIndex
      : -1,
    savedAt: Date.now(),
  };
  const [localOk] = await Promise.all([
    writeArea('local', PROFILES_KEY, profiles),
    writeArea('sync', PROFILES_KEY, profiles),
  ]);
  return localOk;
}

// Delete a profile by name from both storage areas. Returns true if it existed.
async function deleteProfile(name) {
  const profiles = await getProfiles();
  if (!name || !(name in profiles)) {
    return false;
  }
  delete profiles[name];
  await Promise.all([
    writeArea('local', PROFILES_KEY, profiles),
    writeArea('sync', PROFILES_KEY, profiles),
  ]);
  return true;
}

// Minimized flag — per-device UI preference, stored in local only.
async function getMinimized() {
  const value = await readArea('local', MINIMIZED_KEY);
  return value === true;
}

async function setMinimized(value) {
  return writeArea('local', MINIMIZED_KEY, Boolean(value));
}

// Active profile — which saved profile is currently loaded. Per-device, stored
// in local only. Returns null when none is active.
async function getActiveProfile() {
  const value = await readArea('local', ACTIVE_KEY);
  return typeof value === 'string' && value ? value : null;
}

async function setActiveProfile(name) {
  return writeArea('local', ACTIVE_KEY, typeof name === 'string' ? name : '');
}

// Build a serializable bundle of all profiles for export to a file.
async function exportProfiles() {
  const profiles = await getProfiles();
  return {
    type: EXPORT_TYPE,
    version: 1,
    exportedAt: Date.now(),
    profiles,
  };
}

// Return a name not already present in `existingNames` (a Set), appending
// " (2)", " (3)", ... as needed. Implements the keep-both import strategy.
function uniqueName(base, existingNames) {
  if (!existingNames.has(base)) {
    return base;
  }
  let n = 2;
  let candidate = `${base} (${n})`;
  while (existingNames.has(candidate)) {
    n += 1;
    candidate = `${base} (${n})`;
  }
  return candidate;
}

// Merge an exported bundle into the saved profiles. On name collision the
// incoming profile is kept under a renamed key (never overwrites existing).
// Returns { imported, skipped }.
async function importProfiles(bundle) {
  const incoming =
    bundle && bundle.profiles && typeof bundle.profiles === 'object'
      ? bundle.profiles
      : null;
  if (!incoming) {
    return { imported: 0, skipped: 0, error: 'invalid' };
  }

  const profiles = await getProfiles();
  const names = new Set(Object.keys(profiles));
  let imported = 0;
  let skipped = 0;

  Object.entries(incoming).forEach(([name, profile]) => {
    if (!profile || !Array.isArray(profile.rows)) {
      skipped += 1;
      return;
    }
    const finalName = uniqueName(name, names);
    profiles[finalName] = {
      rows: profile.rows,
      selectedIndex: Number.isInteger(profile.selectedIndex)
        ? profile.selectedIndex
        : -1,
      savedAt: Date.now(),
    };
    names.add(finalName);
    imported += 1;
  });

  if (imported > 0) {
    await Promise.all([
      writeArea('local', PROFILES_KEY, profiles),
      writeArea('sync', PROFILES_KEY, profiles),
    ]);
  }

  return { imported, skipped };
}

const ProfileStorage = {
  getProfiles,
  saveProfile,
  deleteProfile,
  getMinimized,
  setMinimized,
  getActiveProfile,
  setActiveProfile,
  exportProfiles,
  importProfiles,
  // Exposed for tests
  mergeProfiles,
  uniqueName,
  PROFILES_KEY,
  MINIMIZED_KEY,
  ACTIVE_KEY,
};

export {
  getProfiles,
  saveProfile,
  deleteProfile,
  getMinimized,
  setMinimized,
  getActiveProfile,
  setActiveProfile,
  exportProfiles,
  importProfiles,
  mergeProfiles,
  uniqueName,
  PROFILES_KEY,
  MINIMIZED_KEY,
  ACTIVE_KEY,
};

export default ProfileStorage;

// Legacy global export for content-script consumers (matches repo convention).
if (typeof window !== 'undefined') {
  window.PixelsProfileStorage = ProfileStorage;
}
