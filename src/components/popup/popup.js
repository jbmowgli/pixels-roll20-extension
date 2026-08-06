'use strict';

import {
  getProfiles,
  saveProfile,
  deleteProfile,
  getActiveProfile,
  setActiveProfile,
  exportProfiles,
  exportProfile,
  importProfiles,
} from '../../utils/profileStorage.js';
import { getKnownDice, removeKnownDie } from '../../utils/knownDiceStorage.js';

// Simple theme detection and CSS loading
function detectAndApplyTheme() {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        const tab = tabs[0];

        if (
          !tab.url ||
          (!tab.url.includes('roll20.net') &&
            !tab.url.includes('app.roll20.net'))
        ) {
          applyTheme('dark');
          return;
        }

        chrome.tabs.sendMessage(tab.id, { action: 'getTheme' }, response => {
          if (chrome.runtime.lastError) {
            executeThemeDetectionScript(tab.id);
          } else if (response && response.theme) {
            applyTheme(response.theme);
          } else {
            executeThemeDetectionScript(tab.id);
          }
        });
      } else {
        applyTheme('dark');
      }
    });
  } else {
    applyTheme('dark');
  }
}

function executeThemeDetectionScript(tabId) {
  if (chrome.scripting) {
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        func: () => {
          try {
            const roll20Theme = localStorage.getItem('colorTheme');
            if (roll20Theme === 'light') {
              return 'light';
            } else if (roll20Theme === 'dark') {
              return 'dark';
            }
          } catch (e) {
            console.log('Direct script: Error accessing localStorage:', e);
          }

          const body = document.body;
          const html = document.documentElement;

          if (
            body.classList.contains('lightmode') ||
            html.classList.contains('lightmode')
          ) {
            return 'light';
          }

          if (
            body.classList.contains('roll20-light-theme') ||
            html.classList.contains('roll20-light-theme')
          ) {
            return 'light';
          }

          // Check for Roll20's actual theme classes
          if (
            body.classList.contains('darkmode') ||
            html.classList.contains('darkmode')
          ) {
            return 'dark';
          }

          // Log what we actually found
          console.log('Direct script: No theme detected, defaulting to dark');
          console.log(
            'Direct script: All localStorage keys:',
            Object.keys(localStorage)
          );

          // Default to dark theme
          return 'dark';
        },
      })
      .then(results => {
        if (results && results[0] && results[0].result) {
          applyTheme(results[0].result);
        } else {
          applyTheme('dark');
        }
      })
      .catch(_error => {
        applyTheme('dark');
      });
  } else {
    applyTheme('dark');
  }
}

function applyTheme(theme) {
  const existingLightTheme = document.getElementById('popup-light-theme');
  if (existingLightTheme) {
    existingLightTheme.remove();
  }

  // Apply light theme if detected
  if (theme === 'light') {
    const lightThemeLink = document.createElement('link');
    lightThemeLink.id = 'popup-light-theme';
    lightThemeLink.rel = 'stylesheet';
    lightThemeLink.href = 'popup-light.css';

    lightThemeLink.onload = () => {
      document.body.style.border = '2px solid #007bff';
      setTimeout(() => {
        document.body.style.border = '';
      }, 2000);
    };

    lightThemeLink.onerror = () => {};

    document.head.appendChild(lightThemeLink);
  } else {
    // Add a visual indicator that dark theme is applied
    document.body.style.border = '2px solid #ff0000';
    setTimeout(() => {
      document.body.style.border = '';
    }, 2000);
  }
}

function showText(txt) {
  document.getElementById('text').innerHTML = txt;
}

// Send message to injected JS
function sendMessage(data, responseCallback) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, data, response => {
        if (chrome.runtime.lastError) {
          // Content script not available (tab not on Roll20, page not loaded, etc.)
          return;
        }
        if (responseCallback) {
          responseCallback(response);
        }
      });
    }
  });
}

// --- Known Dice ---------------------------------------------------------------

async function renderKnownDice() {
  const section = document.getElementById('knownDiceSection');
  const list = document.getElementById('knownDiceList');
  if (!section || !list) {
    return;
  }

  let dice = [];
  try {
    dice = await getKnownDice();
  } catch {
    dice = [];
  }

  if (dice.length === 0) {
    section.style.display = 'none';
    return;
  }

  // Query which dice are currently connected (with battery info)
  const diceStatus = await new Promise(resolve => {
    sendMessage({ action: 'getConnectedDice' }, response => {
      if (chrome.runtime.lastError || !response) {
        resolve({ connected: [], batteryLevels: {} });
      } else {
        resolve({
          connected: response.connected || [],
          batteryLevels: response.batteryLevels || {},
        });
      }
    });
  });

  section.style.display = 'flex';
  list.innerHTML = '';

  dice.forEach(die => {
    const isConnected = diceStatus.connected.includes(die.name);
    const battery = diceStatus.batteryLevels[die.name];

    const li = document.createElement('li');
    li.className = isConnected
      ? 'known-dice-item connected'
      : 'known-dice-item';

    const statusDot = document.createElement('span');
    statusDot.className = isConnected
      ? 'known-dice-status connected'
      : 'known-dice-status';
    statusDot.title = isConnected ? 'Connected' : 'Disconnected';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'known-dice-name';
    nameSpan.textContent = die.name;

    li.appendChild(statusDot);
    li.appendChild(nameSpan);
    if (isConnected && battery !== undefined) {
      const batterySpan = document.createElement('span');
      batterySpan.className = 'known-dice-battery';
      batterySpan.textContent = `🔋${battery}%`;
      batterySpan.title = `Battery: ${battery}%`;
      li.appendChild(batterySpan);
    }

    if (isConnected) {
      const disconnectBtn = document.createElement('button');
      disconnectBtn.className = 'known-dice-btn forget';
      disconnectBtn.textContent = 'Disconnect';
      disconnectBtn.onclick = () => {
        sendMessage({ action: 'disconnectByName', name: die.name });
        setTimeout(() => renderKnownDice(), 500);
      };
      li.appendChild(disconnectBtn);
    } else {
      const reconnectBtn = document.createElement('button');
      reconnectBtn.className = 'known-dice-btn reconnect';
      reconnectBtn.textContent = 'Reconnect';
      reconnectBtn.onclick = () =>
        sendMessage({ action: 'reconnect', name: die.name });

      const forgetBtn = document.createElement('button');
      forgetBtn.className = 'known-dice-btn forget';
      forgetBtn.textContent = 'Forget';
      forgetBtn.onclick = () => {
        sendMessage({ action: 'forgetByName', name: die.name });
        removeKnownDie(die.name).then(() => renderKnownDice());
      };

      li.appendChild(reconnectBtn);
      li.appendChild(forgetBtn);
    }
    list.appendChild(li);
  });
}

// --- Profiles ---------------------------------------------------------------

// Render the saved-profile list, the active-profile banner, and active marker.
async function renderProfiles() {
  const list = document.getElementById('profileList');
  const empty = document.getElementById('profileEmpty');
  if (!list) {
    return;
  }

  let profiles = {};
  let active = null;
  try {
    [profiles, active] = await Promise.all([getProfiles(), getActiveProfile()]);
  } catch {
    profiles = {};
    active = null;
  }

  // Active profile is only meaningful while it still exists.
  if (active && !(active in profiles)) {
    active = null;
  }
  renderActiveBanner(active);

  const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));
  list.innerHTML = '';

  if (names.length === 0) {
    if (empty) {
      empty.style.display = 'block';
    }
    return;
  }
  if (empty) {
    empty.style.display = 'none';
  }

  names.forEach(name => {
    const li = document.createElement('li');
    li.className = name === active ? 'profile-item active' : 'profile-item';

    const label = document.createElement('span');
    label.className = 'profile-item-name';
    label.title = name;
    if (name === active) {
      const dot = document.createElement('span');
      dot.className = 'active-dot';
      dot.textContent = '●';
      label.appendChild(dot);
    }
    label.appendChild(document.createTextNode(name));

    const loadBtn = document.createElement('button');
    loadBtn.className = 'profile-item-btn load';
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => loadProfile(name);

    const exportBtn = document.createElement('button');
    exportBtn.className = 'profile-item-btn export';
    exportBtn.textContent = 'Export';
    exportBtn.title = `Export "${name}" to a file`;
    exportBtn.onclick = () => exportSingleProfile(name);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'profile-item-btn delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => removeProfile(name);

    li.appendChild(label);
    li.appendChild(loadBtn);
    li.appendChild(exportBtn);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  });
}

// Show/hide the "Active: <name>" banner with its Update button.
function renderActiveBanner(active) {
  const banner = document.getElementById('activeProfileBanner');
  const nameEl = document.getElementById('activeProfileName');
  if (!banner || !nameEl) {
    return;
  }
  if (active) {
    nameEl.textContent = active;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

// Fetch the current popout rows from the active Roll20 tab, then run `next`.
function withCurrentRows(next) {
  sendMessage({ action: 'getCurrentRows' }, rows => {
    if (chrome.runtime.lastError || !rows || !Array.isArray(rows.rows)) {
      showText('Open Roll20 to read the current popout.');
      return;
    }
    next(rows);
  });
}

// Save the current popout's rows as a named profile (confirm before overwrite).
function saveCurrentProfile() {
  const input = document.getElementById('profileName');
  const name = input ? input.value.trim() : '';
  if (!name) {
    showText('Enter a profile name to save.');
    return;
  }

  getProfiles().then(profiles => {
    if (
      name in profiles &&
      !window.confirm(`Profile "${name}" already exists. Overwrite it?`)
    ) {
      return;
    }
    withCurrentRows(rows => {
      saveProfile(name, rows)
        .then(() => setActiveProfile(name))
        .then(() => {
          if (input) {
            input.value = '';
          }
          showText(`Saved profile "${name}".`);
          renderProfiles();
        })
        .catch(() => showText('Failed to save profile.'));
    });
  });
}

// Overwrite the active profile with the current popout state.
function updateActiveProfile() {
  getActiveProfile().then(active => {
    if (!active) {
      showText('No active profile to update.');
      return;
    }
    withCurrentRows(rows => {
      saveProfile(active, rows)
        .then(() => {
          showText(`Updated profile "${active}".`);
          renderProfiles();
        })
        .catch(() => showText('Failed to update profile.'));
    });
  });
}

// Apply a saved profile to the popout and mark it active.
function loadProfile(name) {
  getProfiles().then(profiles => {
    const profile = profiles[name];
    if (!profile) {
      showText('Profile not found.');
      renderProfiles();
      return;
    }
    sendMessage({ action: 'applyProfile', profile }, resp => {
      if (chrome.runtime.lastError || !resp || !resp.success) {
        showText('Open Roll20 to load a profile.');
        return;
      }
      setActiveProfile(name).then(() => {
        showText(`Loaded profile "${name}".`);
        renderProfiles();
      });
    });
  });
}

// Delete a saved profile; clear active if it was the one removed.
function removeProfile(name) {
  Promise.all([deleteProfile(name), getActiveProfile()])
    .then(([, active]) => {
      if (active === name) {
        return setActiveProfile('');
      }
      return undefined;
    })
    .then(() => {
      showText(`Deleted profile "${name}".`);
      renderProfiles();
    })
    .catch(() => showText('Failed to delete profile.'));
}

// Trigger a download of a bundle as a JSON file.
function downloadBundle(bundle, filename) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Make a filesystem-safe slug from a profile name.
function slugify(name) {
  return (
    name
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'profile'
  );
}

// Export all profiles to a downloaded JSON file.
function exportProfilesToFile() {
  exportProfiles()
    .then(bundle => {
      if (!bundle.profiles || Object.keys(bundle.profiles).length === 0) {
        showText('No profiles to export.');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBundle(bundle, `pixels-roll20-profiles-${stamp}.json`);
      showText('Exported all profiles.');
    })
    .catch(() => showText('Failed to export profiles.'));
}

// Export a single profile to a downloaded JSON file.
function exportSingleProfile(name) {
  exportProfile(name)
    .then(bundle => {
      if (!bundle) {
        showText('Profile not found.');
        renderProfiles();
        return;
      }
      downloadBundle(bundle, `pixels-roll20-profile-${slugify(name)}.json`);
      showText(`Exported profile "${name}".`);
    })
    .catch(() => showText('Failed to export profile.'));
}

// Import profiles from a chosen JSON file, merging (keep-both on name clash).
function importProfilesFromFile(file) {
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    let bundle;
    try {
      bundle = JSON.parse(reader.result);
    } catch {
      showText('Could not read that file (invalid JSON).');
      return;
    }
    importProfiles(bundle)
      .then(result => {
        if (result.error || result.imported === 0) {
          showText('No profiles found to import.');
          return;
        }
        showText(`Imported ${result.imported} profile(s).`);
        renderProfiles();
      })
      .catch(() => showText('Failed to import profiles.'));
  };
  reader.onerror = () => showText('Could not read that file.');
  reader.readAsText(file);
}

// Listen on messages from injected JS
chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
  if (request.action === 'showText') {
    showText(request.text);
    renderKnownDice();
  } else if (request.action === 'modifierChanged') {
    // Store the modifier value when changed from floating box
    chrome.storage.sync.set({ modifier: request.modifier });
  }
});

// Initialize popup - content scripts are automatically injected by manifest
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (tabs[0]?.id) {
    // Request initial status from the content script
    sendMessage({ action: 'getStatus' });

    // Poll status every 5 seconds while popup is open to catch silent state changes
    setInterval(() => {
      sendMessage({ action: 'getStatus' });
      renderKnownDice();
    }, 5000);
  }
});

// Initialize theme detection when popup loads
document.addEventListener('DOMContentLoaded', () => {
  const iconElement = document.querySelector('.popup-icon');
  if (iconElement && typeof chrome !== 'undefined' && chrome.runtime) {
    iconElement.src = chrome.runtime.getURL('assets/images/logo-128.png');
  }

  // Setup button event handlers directly to avoid tree-shaking
  const connectBtn = document.getElementById('connect');

  if (connectBtn) {
    connectBtn.onclick = () => sendMessage({ action: 'connect' });
  }

  // Modifier box toggle
  const toggleModBox = document.getElementById('toggleModifierBox');
  if (toggleModBox) {
    // Load saved state
    chrome.storage.local.get('pixels_modifier_box_visible', result => {
      toggleModBox.checked = result.pixels_modifier_box_visible !== false;
    });

    toggleModBox.addEventListener('change', () => {
      const visible = toggleModBox.checked;
      chrome.storage.local.set({ pixels_modifier_box_visible: visible });
      sendMessage({
        action: visible ? 'showModifier' : 'hideModifier',
      });
    });
  }

  // Unprompted rolls toggle
  const allowUnpromptedCb = document.getElementById('allowUnprompted');
  if (allowUnpromptedCb) {
    const updateModifierVisibility = allowed => {
      const modBtns = document.getElementById('modifierButtons');
      const profilesSec = document.getElementById('profilesSection');
      if (modBtns) {
        modBtns.style.display = allowed ? 'flex' : 'none';
      }
      if (profilesSec) {
        profilesSec.style.display = allowed ? 'flex' : 'none';
      }
      if (!allowed) {
        sendMessage({ action: 'hideModifier' });
        chrome.storage.local.set({ pixels_modifier_box_visible: false });
      }
    };

    // Load saved state
    chrome.storage.local.get('pixels_allow_unprompted', result => {
      const allowed = result.pixels_allow_unprompted !== false; // default true
      allowUnpromptedCb.checked = allowed;
      updateModifierVisibility(allowed);
      sendMessage({ action: 'setAllowUnprompted', value: allowed });
    });

    allowUnpromptedCb.addEventListener('change', () => {
      const allowed = allowUnpromptedCb.checked;
      chrome.storage.local.set({ pixels_allow_unprompted: allowed });
      updateModifierVisibility(allowed);
      sendMessage({ action: 'setAllowUnprompted', value: allowed });
      if (allowed) {
        sendMessage({ action: 'showModifier' });
        const toggleModBox = document.getElementById('toggleModifierBox');
        if (toggleModBox) {
          toggleModBox.checked = true;
        }
      }
    });
  }

  // Profiles UI
  const saveProfileBtn = document.getElementById('saveProfile');
  if (saveProfileBtn) {
    saveProfileBtn.onclick = saveCurrentProfile;
  }
  const profileNameInput = document.getElementById('profileName');
  if (profileNameInput) {
    profileNameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        saveCurrentProfile();
      }
    });
  }
  const updateProfileBtn = document.getElementById('updateProfile');
  if (updateProfileBtn) {
    updateProfileBtn.onclick = updateActiveProfile;
  }
  const exportBtn = document.getElementById('exportProfiles');
  if (exportBtn) {
    exportBtn.onclick = exportProfilesToFile;
  }
  const importBtn = document.getElementById('importProfiles');
  const importFile = document.getElementById('importFile');
  if (importBtn && importFile) {
    importBtn.onclick = () => importFile.click();
    importFile.addEventListener('change', () => {
      importProfilesFromFile(importFile.files[0]);
      importFile.value = ''; // allow re-importing the same file
    });
  }
  renderProfiles();
  renderKnownDice();

  detectAndApplyTheme();
});
