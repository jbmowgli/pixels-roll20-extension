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

/**
 * Returns an inline SVG element for the given die type.
 * Uses Font Awesome Free dice-d6 and dice-d20 paths where available,
 * and simple geometric shapes for others.
 * Icons: CC BY 4.0 (Font Awesome Free 6.7.2 by @fontawesome)
 */
function createDieIcon(dieType) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', getViewBox(dieType));
  svg.setAttribute('fill', 'currentColor');
  svg.style.width = '16px';
  svg.style.height = '16px';

  if (dieType === 8) {
    // d8: octahedron faces from game-icons.net (by Delapouite, CC BY 3.0)
    const outline = document.createElementNS(svgNS, 'path');
    outline.setAttribute(
      'd',
      'M256 37.143L77.896 343.853h356.208z M230.154 49.79L72 164.233v157.91z M281.844 49.79L440 322.144V164.232z M88.7 359.852L256 480.912l167.3-121.06z'
    );
    outline.setAttribute('fill', 'currentColor');
    svg.appendChild(outline);

    const edges = document.createElementNS(svgNS, 'path');
    edges.setAttribute(
      'd',
      'M230.154 49.79L256 37.143 281.844 49.79 M77.896 343.853L88.7 359.852 M434.104 343.853L423.3 359.852'
    );
    edges.setAttribute('fill', 'none');
    edges.setAttribute('stroke', 'var(--dice-icon-edge, #000)');
    edges.setAttribute('stroke-width', '12');
    edges.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(edges);
  } else if (dieType === 12) {
    // d12: dodecahedron - 6 pentagon faces from game-icons.net (by Skoll, CC BY 3.0)
    const faces = document.createElementNS(svgNS, 'path');
    faces.setAttribute(
      'd',
      'M450.169 181.354L379.685 84.29 265.629 47.325 265.629 139.977 362.013 210.008z M246.55 139.977L246.55 47.325 132.494 84.29 62.01 181.354 150.166 209.972z M198.59 333.591L313.588 333.591 349.098 224.221 256.089 156.623 163.08 224.222z M196.468 352.67L142.034 427.71 256.089 464.675 370.145 427.71 315.711 352.67z M367.843 228.109L331.033 341.389 385.516 416.382 456 319.366 456 199.503z M144.156 228.109L56 199.491 56 319.425 126.484 416.441 180.966 341.449z'
    );
    faces.setAttribute('fill', 'currentColor');
    svg.appendChild(faces);

    const edges = document.createElementNS(svgNS, 'path');
    edges.setAttribute(
      'd',
      'M265.629 139.977L256.089 156.623 M246.55 139.977L256.089 156.623 M362.013 210.008L349.098 224.221 M150.166 209.972L163.08 224.222 M198.59 333.591L196.468 352.67 M313.588 333.591L315.711 352.67 M349.098 224.221L367.843 228.109 M163.08 224.222L144.156 228.109 M331.033 341.389L313.588 333.591 M180.966 341.449L198.59 333.591'
    );
    edges.setAttribute('fill', 'none');
    edges.setAttribute('stroke', 'var(--dice-icon-edge, #000)');
    edges.setAttribute('stroke-width', '8');
    edges.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(edges);
  } else {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', getDiePath(dieType));
    svg.appendChild(path);
  }
  return svg;
}

function getViewBox(dieType) {
  switch (dieType) {
    case 6:
      return '0 0 448 512';
    case 20:
      return '0 0 512 512';
    default:
      return '0 0 512 512';
  }
}

function getDiePath(dieType) {
  switch (dieType) {
    // d4: triangle (tetrahedron face)
    case 4:
      return 'M256 32L48 480h416L256 32z';
    // d6: Font Awesome Free dice-d6
    case 6:
      return 'M201 10.3c14.3-7.8 31.6-7.8 46 0L422.3 106c5.1 2.8 8.3 8.2 8.3 14s-3.2 11.2-8.3 14L231.7 238c-4.8 2.6-10.5 2.6-15.3 0L25.7 134c-5.1-2.8-8.3-8.2-8.3-14s3.2-11.2 8.3-14L201 10.3zM23.7 170l176 96c5.1 2.8 8.3 8.2 8.3 14l0 216c0 5.6-3 10.9-7.8 13.8s-10.9 3-15.8 .3L25 423.1C9.6 414.7 0 398.6 0 381L0 184c0-5.6 3-10.9 7.8-13.8s10.9-3 15.8-.3zm400.7 0c5-2.7 11-2.6 15.8 .3s7.8 8.1 7.8 13.8l0 197c0 17.6-9.6 33.7-25 42.1L263.7 510c-5 2.7-11 2.6-15.8-.3s-7.8-8.1-7.8-13.8l0-216c0-5.9 3.2-11.2 8.3-14l176-96z';
    // d8: handled specially in createDieIcon
    case 8:
      return 'M256 37.143L77.896 343.853h356.208z';
    // d10: game-icons.net d10 outline (by Skoll, CC BY 3.0), side triangles adjusted
    case 10:
      return 'M375.483 251.243L265.503 302.381 265.716 485.762 477.01 266.346 390.017 244.536z M121.603 244.334L36.893 266.097 246.474 486 246.474 302.38 136.528 251.243z M255.987 26L137.456 231.026 255.988 286.076 374.592 231.026z M265.397 30L470 256 390 230z M245.847 30L40 256 120 234.771z';
    // d12: handled specially in createDieIcon
    case 12:
      return 'M256 32L76 152l0 208 180 120 180-120 0-208L256 32z';
    // d20: Font Awesome Free dice-d20
    case 20:
      return 'M48.7 125.8l53.2 31.9c7.8 4.7 17.8 2 22.2-5.9L201.6 12.1c3-5.4-.9-12.1-7.1-12.1c-1.6 0-3.2 .5-4.6 1.4L47.9 98.8c-9.6 6.6-9.2 20.9 .8 26.9zM16 171.7l0 123.5c0 8 10.4 11 14.7 4.4l60-92c5-7.6 2.6-17.8-5.2-22.5L40.2 158C29.6 151.6 16 159.3 16 171.7zM310.4 12.1l77.6 139.6c4.4 7.9 14.5 10.6 22.2 5.9l53.2-31.9c10-6 10.4-20.3 .8-26.9L322.1 1.4c-1.4-.9-3-1.4-4.6-1.4c-6.2 0-10.1 6.7-7.1 12.1zM496 171.7c0-12.4-13.6-20.1-24.2-13.7l-45.3 27.2c-7.8 4.7-10.1 14.9-5.2 22.5l60 92c4.3 6.7 14.7 3.6 14.7-4.4l0-123.5zm-49.3 246L286.1 436.6c-8.1 .9-14.1 7.8-14.1 15.9l0 52.8c0 3.7 3 6.8 6.8 6.8c.8 0 1.6-.1 2.4-.4l172.7-64c6.1-2.2 10.1-8 10.1-14.5c0-9.3-8.1-16.5-17.3-15.4zM233.2 512c3.7 0 6.8-3 6.8-6.8l0-52.6c0-8.1-6.1-14.9-14.1-15.9l-160.6-19c-9.2-1.1-17.3 6.1-17.3 15.4c0 6.5 4 12.3 10.1 14.5l172.7 64c.8 .3 1.6 .4 2.4 .4zM41.7 382.9l170.9 20.2c7.8 .9 13.4-7.5 9.5-14.3l-85.7-150c-5.9-10.4-20.7-10.8-27.3-.8L30.2 358.2c-6.5 9.9-.3 23.3 11.5 24.7zm439.6-24.8L402.9 238.1c-6.5-10-21.4-9.6-27.3 .8L290.2 388.5c-3.9 6.8 1.6 15.2 9.5 14.3l170.1-20c11.8-1.4 18-14.7 11.5-24.6zm-216.9 11l78.4-137.2c6.1-10.7-1.6-23.9-13.9-23.9l-145.7 0c-12.3 0-20 13.3-13.9 23.9l78.4 137.2c3.7 6.4 13 6.4 16.7 0zM174.4 176l163.2 0c12.2 0 19.9-13.1 14-23.8l-80-144c-2.8-5.1-8.2-8.2-14-8.2l-3.2 0c-5.8 0-11.2 3.2-14 8.2l-80 144c-5.9 10.7 1.8 23.8 14 23.8z';
    // d100/d%: percent symbol (Font Awesome Free)
    case 100:
      return 'M374.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-320 320c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l320-320zM128 128A64 64 0 1 0 0 128a64 64 0 1 0 128 0zM384 384a64 64 0 1 0-128 0 64 64 0 1 0 128 0z';
    // fallback: generic die (d6)
    default:
      return 'M201 10.3c14.3-7.8 31.6-7.8 46 0L422.3 106c5.1 2.8 8.3 8.2 8.3 14s-3.2 11.2-8.3 14L231.7 238c-4.8 2.6-10.5 2.6-15.3 0L25.7 134c-5.1-2.8-8.3-8.2-8.3-14s3.2-11.2 8.3-14L201 10.3zM23.7 170l176 96c5.1 2.8 8.3 8.2 8.3 14l0 216c0 5.6-3 10.9-7.8 13.8s-10.9 3-15.8 .3L25 423.1C9.6 414.7 0 398.6 0 381L0 184c0-5.6 3-10.9 7.8-13.8s10.9-3 15.8-.3zm400.7 0c5-2.7 11-2.6 15.8 .3s7.8 8.1 7.8 13.8l0 197c0 17.6-9.6 33.7-25 42.1L263.7 510c-5 2.7-11 2.6-15.8-.3s-7.8-8.1-7.8-13.8l0-216c0-5.9 3.2-11.2 8.3-14l176-96z';
  }
}

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
        resolve({ connected: [], batteryLevels: {}, dieTypes: {} });
      } else {
        resolve({
          connected: response.connected || [],
          batteryLevels: response.batteryLevels || {},
          dieTypes: response.dieTypes || {},
        });
      }
    });
  });

  section.style.display = 'flex';
  list.innerHTML = '';

  // Sort: connected first, then by die type, then alphabetical by name
  const dieTypeOrder = { 4: 0, 6: 1, 8: 2, 10: 3, 100: 3, 12: 4, 20: 5 };
  dice.sort((a, b) => {
    const aConnected = diceStatus.connected.includes(a.name);
    const bConnected = diceStatus.connected.includes(b.name);
    if (aConnected !== bConnected) return aConnected ? -1 : 1;
    const aType = diceStatus.dieTypes[a.name] || a.dieType || null;
    const bType = diceStatus.dieTypes[b.name] || b.dieType || null;
    const aOrder = dieTypeOrder[aType] ?? 99;
    const bOrder = dieTypeOrder[bType] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });

  dice.forEach(die => {
    const isConnected = diceStatus.connected.includes(die.name);
    const battery = diceStatus.batteryLevels[die.name];
    const dieType = diceStatus.dieTypes[die.name] || die.dieType || null;

    const li = document.createElement('li');
    li.className = isConnected
      ? 'known-dice-item connected'
      : 'known-dice-item';

    const dieIcon = document.createElement('span');
    dieIcon.className = isConnected
      ? 'known-dice-icon connected'
      : 'known-dice-icon';
    dieIcon.appendChild(createDieIcon(dieType));
    dieIcon.title = isConnected ? 'Connected' : 'Disconnected';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'known-dice-name';
    nameSpan.textContent = die.name;

    li.appendChild(dieIcon);
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
