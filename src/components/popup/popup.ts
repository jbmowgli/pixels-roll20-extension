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
} from '../../utils/profileStorage';
import { getKnownDice, removeKnownDie } from '../../utils/knownDiceStorage';

interface KnownDie {
  name: string;
  lastConnected: number;
  dieType: number | null;
}

interface DiceStatusResponse {
  connected: string[];
  batteryLevels: Record<string, number>;
  dieTypes: Record<string, number>;
}

interface MessageResponse {
  success?: boolean;
  theme?: string;
  connected?: string[];
  batteryLevels?: Record<string, number>;
  dieTypes?: Record<string, number>;
  rows?: RowEntry[];
}

type SendMessageCallback = (response: MessageResponse | undefined) => void;

// Simple theme detection and CSS loading
function detectAndApplyTheme(): void {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query(
      { active: true, currentWindow: true },
      (tabs: chrome.tabs.Tab[]) => {
        const tabId = tabs[0]?.id;
        if (tabId !== undefined) {
          const tab = tabs[0];

          if (
            !tab.url ||
            (!tab.url.includes('roll20.net') &&
              !tab.url.includes('app.roll20.net'))
          ) {
            applyTheme('dark');
            return;
          }

          chrome.tabs.sendMessage(
            tabId,
            { action: 'getTheme' },
            (response: MessageResponse | undefined) => {
              if (chrome.runtime.lastError) {
                executeThemeDetectionScript(tabId);
              } else if (response && response.theme) {
                applyTheme(response.theme);
              } else {
                executeThemeDetectionScript(tabId);
              }
            }
          );
        } else {
          applyTheme('dark');
        }
      }
    );
  } else {
    applyTheme('dark');
  }
}

function executeThemeDetectionScript(tabId: number): void {
  if (chrome.scripting) {
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        func: (): string => {
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
      .then((results: chrome.scripting.InjectionResult[]) => {
        if (results && results[0] && results[0].result) {
          applyTheme(results[0].result as string);
        } else {
          applyTheme('dark');
        }
      })
      .catch((_error: unknown) => {
        applyTheme('dark');
      });
  } else {
    applyTheme('dark');
  }
}

function applyTheme(theme: string): void {
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

    lightThemeLink.onload = (): void => {
      document.body.style.border = '2px solid #007bff';
      setTimeout(() => {
        document.body.style.border = '';
      }, 2000);
    };

    lightThemeLink.onerror = (): void => {};

    document.head.appendChild(lightThemeLink);
  } else {
    // Add a visual indicator that dark theme is applied
    document.body.style.border = '2px solid #ff0000';
    setTimeout(() => {
      document.body.style.border = '';
    }, 2000);
  }
}

function showText(_message?: string): void {
  // Status messages are now handled by the Known Dice count label
}

// Send message to injected JS
function sendMessage(
  data: Record<string, unknown>,
  responseCallback?: SendMessageCallback
): void {
  chrome.tabs.query(
    { active: true, currentWindow: true },
    (tabs: chrome.tabs.Tab[]) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          data,
          (response: MessageResponse | undefined) => {
            if (chrome.runtime.lastError) {
              // Content script not available (tab not on Roll20, page not loaded, etc.)
              return;
            }
            if (responseCallback) {
              responseCallback(response);
            }
          }
        );
      }
    }
  );
}

// --- Known Dice ---------------------------------------------------------------

/**
 * Returns an inline SVG element for the given die type.
 * Uses Font Awesome Free dice-d6 and dice-d20 paths where available,
 * and simple geometric shapes for others.
 * Icons: CC BY 4.0 (Font Awesome Free 6.7.2 by @fontawesome)
 */
function createDieIcon(dieType: number | null): SVGSVGElement {
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

function getViewBox(dieType: number | null): string {
  switch (dieType) {
    case 6:
      return '0 0 448 512';
    case 20:
      return '0 0 512 512';
    default:
      return '0 0 512 512';
  }
}

function getDiePath(dieType: number | null): string {
  switch (dieType) {
    // d4: Pixels d4 shape (rounded cube with squat pyramids top/bottom)
    case 4:
      return 'M136 160H376V352H136z M136 145L256 65 376 145z M136 367L256 447 376 367z';
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

async function renderKnownDice(): Promise<void> {
  const section = document.getElementById('knownDiceSection');
  const list = document.getElementById('knownDiceList');
  if (!section || !list) {
    return;
  }

  let dice: KnownDie[] = [];
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
  const diceStatus = await new Promise<DiceStatusResponse>(resolve => {
    sendMessage(
      { action: 'getConnectedDice' },
      (response: MessageResponse | undefined) => {
        if (chrome.runtime.lastError || !response) {
          resolve({ connected: [], batteryLevels: {}, dieTypes: {} });
        } else {
          resolve({
            connected: response.connected || [],
            batteryLevels: response.batteryLevels || {},
            dieTypes: response.dieTypes || {},
          });
        }
      }
    );
  });

  section.style.display = 'flex';
  list.innerHTML = '';

  // Update connected/total count
  const countLabel = document.getElementById('knownDiceCount');
  if (countLabel) {
    const connectedCount = diceStatus.connected.length;
    countLabel.textContent = `${connectedCount}/${dice.length}`;
  }

  // Sort: connected first, then by die type, then alphabetical by name
  const dieTypeOrder: Record<number, number> = {
    4: 0,
    6: 1,
    8: 2,
    10: 3,
    100: 3,
    12: 4,
    20: 5,
  };
  dice.sort((a: KnownDie, b: KnownDie) => {
    const aConnected = diceStatus.connected.includes(a.name);
    const bConnected = diceStatus.connected.includes(b.name);
    if (aConnected !== bConnected) return aConnected ? -1 : 1;
    const aType = diceStatus.dieTypes[a.name] || a.dieType || null;
    const bType = diceStatus.dieTypes[b.name] || b.dieType || null;
    const aOrder = aType !== null ? (dieTypeOrder[aType] ?? 99) : 99;
    const bOrder = bType !== null ? (dieTypeOrder[bType] ?? 99) : 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });

  dice.forEach((die: KnownDie) => {
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

    if (isConnected) {
      nameSpan.classList.add('clickable');
      nameSpan.title = 'Click to blink this die';
      nameSpan.onclick = (): void => {
        sendMessage({ action: 'blinkByName', name: die.name });
      };
    }

    li.appendChild(dieIcon);
    li.appendChild(nameSpan);
    if (isConnected && battery !== undefined) {
      const batterySpan = document.createElement('span');
      batterySpan.className = 'known-dice-battery';
      if (battery <= 15) {
        batterySpan.classList.add('battery-critical');
        batterySpan.textContent = `🪫${battery}%`;
      } else if (battery <= 30) {
        batterySpan.classList.add('battery-low');
        batterySpan.textContent = `🔋${battery}%`;
      } else {
        batterySpan.textContent = `🔋${battery}%`;
      }
      batterySpan.title = `Battery: ${battery}%`;
      li.appendChild(batterySpan);
    }

    if (isConnected) {
      const disconnectBtn = document.createElement('button');
      disconnectBtn.className = 'known-dice-btn forget';
      disconnectBtn.textContent = 'Disconnect';
      disconnectBtn.onclick = (): void => {
        sendMessage({ action: 'disconnectByName', name: die.name });
        setTimeout(() => renderKnownDice(), 500);
      };
      li.appendChild(disconnectBtn);
    } else {
      const reconnectBtn = document.createElement('button');
      reconnectBtn.className = 'known-dice-btn reconnect';
      reconnectBtn.textContent = 'Reconnect';
      reconnectBtn.onclick = (): void =>
        sendMessage({ action: 'reconnect', name: die.name });

      const forgetBtn = document.createElement('button');
      forgetBtn.className = 'known-dice-btn forget';
      forgetBtn.textContent = 'Forget';
      forgetBtn.onclick = (): void => {
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
async function renderProfiles(): Promise<void> {
  const list = document.getElementById('profileList');
  const empty = document.getElementById('profileEmpty');
  if (!list) {
    return;
  }

  let profiles: ProfileMap = {};
  let active: string | null = null;
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

  names.forEach((name: string) => {
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
    loadBtn.onclick = (): void => {
      loadProfile(name);
    };

    const exportBtn = document.createElement('button');
    exportBtn.className = 'profile-item-btn export';
    exportBtn.textContent = 'Export';
    exportBtn.title = `Export "${name}" to a file`;
    exportBtn.onclick = (): void => {
      exportSingleProfile(name);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'profile-item-btn delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = (): void => {
      removeProfile(name);
    };

    li.appendChild(label);
    li.appendChild(loadBtn);
    li.appendChild(exportBtn);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  });
}

// Show/hide the "Active: <name>" banner with its Update button.
function renderActiveBanner(active: string | null): void {
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
function withCurrentRows(next: (rows: RowData) => void): void {
  sendMessage(
    { action: 'getCurrentRows' },
    (response: MessageResponse | undefined) => {
      if (
        chrome.runtime.lastError ||
        !response ||
        !Array.isArray((response as unknown as RowData).rows)
      ) {
        showText('Open Roll20 to read the current popout.');
        return;
      }
      next(response as unknown as RowData);
    }
  );
}

// Save the current popout's rows as a named profile (confirm before overwrite).
function saveCurrentProfile(): void {
  const input = document.getElementById(
    'profileName'
  ) as HTMLInputElement | null;
  const name = input ? input.value.trim() : '';
  if (!name) {
    showText('Enter a profile name to save.');
    return;
  }

  getProfiles().then((profiles: ProfileMap) => {
    if (
      name in profiles &&
      !window.confirm(`Profile "${name}" already exists. Overwrite it?`)
    ) {
      return;
    }
    withCurrentRows((rows: RowData) => {
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
function updateActiveProfile(): void {
  getActiveProfile().then((active: string | null) => {
    if (!active) {
      showText('No active profile to update.');
      return;
    }
    withCurrentRows((rows: RowData) => {
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
function loadProfile(name: string): void {
  getProfiles().then((profiles: ProfileMap) => {
    const profile = profiles[name];
    if (!profile) {
      showText('Profile not found.');
      renderProfiles();
      return;
    }
    sendMessage(
      { action: 'applyProfile', profile },
      (resp: MessageResponse | undefined) => {
        if (chrome.runtime.lastError || !resp || !resp.success) {
          showText('Open Roll20 to load a profile.');
          return;
        }
        setActiveProfile(name).then(() => {
          showText(`Loaded profile "${name}".`);
          renderProfiles();
        });
      }
    );
  });
}

// Delete a saved profile; clear active if it was the one removed.
function removeProfile(name: string): void {
  Promise.all([deleteProfile(name), getActiveProfile()])
    .then(([, active]: [boolean, string | null]) => {
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
function downloadBundle(bundle: ProfileExportBundle, filename: string): void {
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
function slugify(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'profile'
  );
}

// Export all profiles to a downloaded JSON file.
function exportProfilesToFile(): void {
  exportProfiles()
    .then((bundle: ProfileExportBundle) => {
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
function exportSingleProfile(name: string): void {
  exportProfile(name)
    .then((bundle: ProfileExportBundle | null) => {
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
function importProfilesFromFile(file: File | undefined): void {
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = (): void => {
    let bundle: ProfileExportBundle;
    try {
      bundle = JSON.parse(reader.result as string);
    } catch {
      showText('Could not read that file (invalid JSON).');
      return;
    }
    importProfiles(bundle)
      .then((result: { imported: number; skipped: number; error?: string }) => {
        if (result.error || result.imported === 0) {
          showText('No profiles found to import.');
          return;
        }
        showText(`Imported ${result.imported} profile(s).`);
        renderProfiles();
      })
      .catch(() => showText('Failed to import profiles.'));
  };
  reader.onerror = (): void => {
    showText('Could not read that file.');
  };
  reader.readAsText(file);
}

// Listen on messages from injected JS
chrome.runtime.onMessage.addListener(
  (
    request: Record<string, unknown>,
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: unknown) => void
  ) => {
    if (request.action === 'showText') {
      renderKnownDice();
    }
  }
);

// Initialize popup - content scripts are automatically injected by manifest
chrome.tabs.query(
  { active: true, currentWindow: true },
  (tabs: chrome.tabs.Tab[]) => {
    if (tabs[0]?.id) {
      // Request initial status from the content script
      sendMessage({ action: 'getStatus' });

      // Poll status every 5 seconds while popup is open to catch silent state changes
      setInterval(() => {
        sendMessage({ action: 'getStatus' });
        renderKnownDice();
      }, 5000);
    }
  }
);

// Initialize theme detection when popup loads
document.addEventListener('DOMContentLoaded', () => {
  const iconElement = document.querySelector(
    '.popup-icon'
  ) as HTMLImageElement | null;
  if (iconElement && typeof chrome !== 'undefined' && chrome.runtime) {
    iconElement.src = chrome.runtime.getURL('assets/images/logo-128.png');
  }

  // Setup button event handlers directly to avoid tree-shaking
  const connectBtn = document.getElementById('connect');

  if (connectBtn) {
    connectBtn.onclick = (): void => {
      sendMessage({ action: 'connect' });
    };
  }

  // Saved rolls panel toggle
  const toggleSavedRolls = document.getElementById(
    'toggleSavedRolls'
  ) as HTMLInputElement | null;
  if (toggleSavedRolls) {
    // Load saved state
    chrome.storage.local.get(
      'pixels_saved_rolls_visible',
      (result: Record<string, unknown>) => {
        toggleSavedRolls.checked = result.pixels_saved_rolls_visible !== false;
      }
    );

    toggleSavedRolls.addEventListener('change', () => {
      const visible = toggleSavedRolls.checked;
      chrome.storage.local.set({ pixels_saved_rolls_visible: visible });
      sendMessage({
        action: visible ? 'showSavedRolls' : 'hideSavedRolls',
      });
    });
  }

  // Unprompted rolls toggle (independent of saved rolls visibility)
  const allowUnpromptedCb = document.getElementById(
    'allowUnprompted'
  ) as HTMLInputElement | null;
  const rollWindowContainer = document.getElementById(
    'rollWindowContainer'
  ) as HTMLElement | null;
  const rollWindowSlider = document.getElementById(
    'rollWindowSlider'
  ) as HTMLInputElement | null;
  const rollWindowValue = document.getElementById(
    'rollWindowValue'
  ) as HTMLElement | null;

  // Helper to show/hide the roll window slider based on unprompted state
  function updateRollWindowVisibility(allowed: boolean): void {
    if (rollWindowContainer) {
      if (allowed) {
        rollWindowContainer.classList.remove('hidden');
      } else {
        rollWindowContainer.classList.add('hidden');
      }
    }
  }

  // Roll window slider setup
  if (rollWindowSlider && rollWindowValue) {
    chrome.storage.local.get(
      'pixels_roll_window_seconds',
      (result: Record<string, unknown>) => {
        const saved = result.pixels_roll_window_seconds;
        if (typeof saved === 'number' && saved >= 1 && saved <= 10) {
          rollWindowSlider.value = String(saved);
          rollWindowValue.textContent = String(saved);
        }
      }
    );

    rollWindowSlider.addEventListener('input', () => {
      const seconds = parseInt(rollWindowSlider.value, 10);
      rollWindowValue.textContent = String(seconds);
      chrome.storage.local.set({ pixels_roll_window_seconds: seconds });
      sendMessage({ action: 'setRollWindow', value: seconds });
    });
  }

  if (allowUnpromptedCb) {
    // Load saved state
    chrome.storage.local.get(
      'pixels_allow_unprompted',
      (result: Record<string, unknown>) => {
        const allowed = result.pixels_allow_unprompted !== false; // default true
        allowUnpromptedCb.checked = allowed;
        sendMessage({ action: 'setAllowUnprompted', value: allowed });
        updateRollWindowVisibility(allowed);
      }
    );

    allowUnpromptedCb.addEventListener('change', () => {
      const allowed = allowUnpromptedCb.checked;
      chrome.storage.local.set({ pixels_allow_unprompted: allowed });
      sendMessage({ action: 'setAllowUnprompted', value: allowed });
      updateRollWindowVisibility(allowed);
    });
  }

  // Dice substitution toggle
  const diceSubCb = document.getElementById(
    'allowDiceSubstitution'
  ) as HTMLInputElement | null;
  if (diceSubCb) {
    chrome.storage.local.get(
      'pixels_allow_dice_substitution',
      (result: Record<string, unknown>) => {
        const enabled = result.pixels_allow_dice_substitution === true;
        diceSubCb.checked = enabled;
        sendMessage({ action: 'setAllowDiceSubstitution', value: enabled });
      }
    );

    diceSubCb.addEventListener('change', () => {
      const enabled = diceSubCb.checked;
      chrome.storage.local.set({ pixels_allow_dice_substitution: enabled });
      sendMessage({ action: 'setAllowDiceSubstitution', value: enabled });
    });
  }

  // Profiles UI
  const saveProfileBtn = document.getElementById('saveProfile');
  if (saveProfileBtn) {
    saveProfileBtn.onclick = saveCurrentProfile;
  }
  const profileNameInput = document.getElementById('profileName');
  if (profileNameInput) {
    profileNameInput.addEventListener('keydown', (e: KeyboardEvent) => {
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
  const importFile = document.getElementById(
    'importFile'
  ) as HTMLInputElement | null;
  if (importBtn && importFile) {
    importBtn.onclick = (): void => {
      importFile.click();
    };
    importFile.addEventListener('change', () => {
      importProfilesFromFile(importFile.files?.[0]);
      importFile.value = ''; // allow re-importing the same file
    });
  }
  renderProfiles();
  renderKnownDice();

  detectAndApplyTheme();
});
