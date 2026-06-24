/**
 * Pop-out Manager Module
 *
 * Moves the existing #pixels-modifier-box node into a Document
 * Picture-in-Picture window (an always-on-top OS window) and back. Because the
 * node stays in the same content-script JS context, all existing wiring (rows,
 * dice rolls, theme monitoring) keeps working with no message passing.
 */

'use strict';

// Class toggled on the box while it lives in the pop-out window.
const POPPED_OUT_CLASS = 'pixels-popped-out';

// Injected <style> elements we mirror into the pop-out document. cssLoader
// fetches each stylesheet and injects it as an inline <style id="...">, so
// cloning these nodes carries the full CSS text across (no URL resolution).
const STYLE_IDS = [
  'pixels-modifier-box-base-styles',
  'pixels-modifier-box-minimized-styles',
  'pixels-modifier-box-light-theme-styles',
  'pixels-modifier-box-styles-fallback',
];

const POPOUT_STYLE_ID = 'pixels-modifier-box-popout-styles';

let pipWindow = null;
let placeholder = null;
let themeSyncObserver = null;

function isSupported() {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

export function setupPopoutControls(modifierBox) {
  if (!modifierBox) {
    return;
  }

  const btn = modifierBox.querySelector('.pixels-popout');
  if (!btn) {
    return;
  }

  // The API needs Chrome 116+; hide the control where it isn't available.
  if (!isSupported()) {
    btn.style.display = 'none';
    return;
  }

  btn.addEventListener('click', async e => {
    e.preventDefault();
    e.stopPropagation();

    // Toggle: a second click (or the window's own close button) restores it.
    if (pipWindow) {
      pipWindow.close();
      return;
    }
    await openPopout(modifierBox);
  });
}

async function openPopout(modifierBox) {
  const rect = modifierBox.getBoundingClientRect();

  try {
    pipWindow = await window.documentPictureInPicture.requestWindow({
      width: Math.max(300, Math.round(rect.width) || 400),
      height: Math.max(200, Math.round(rect.height) || 320),
    });
  } catch (error) {
    console.error('Failed to open modifier box pop-out window:', error);
    pipWindow = null;
    return;
  }

  copyStyles(pipWindow.document);
  injectPopoutStyles(pipWindow.document);
  syncThemeClass(pipWindow.document);
  startThemeSync(pipWindow.document);

  // Remember the box's spot in the page so we can return it exactly.
  placeholder = document.createComment('pixels-modifier-box-popped-out');
  modifierBox.replaceWith(placeholder);

  modifierBox.classList.add(POPPED_OUT_CLASS);
  pipWindow.document.body.appendChild(modifierBox);

  // Fires whether the user closes the window or the browser closes it for us.
  pipWindow.addEventListener('pagehide', () => restore(modifierBox), {
    once: true,
  });
}

function restore(modifierBox) {
  stopThemeSync();
  modifierBox.classList.remove(POPPED_OUT_CLASS);

  if (placeholder && placeholder.parentNode) {
    placeholder.replaceWith(modifierBox);
  } else if (!document.body.contains(modifierBox)) {
    document.body.appendChild(modifierBox);
  }

  placeholder = null;
  pipWindow = null;
}

// Clone our injected stylesheets into the pop-out document.
function copyStyles(targetDoc) {
  STYLE_IDS.forEach(id => {
    const source = document.getElementById(id);
    if (source && !targetDoc.getElementById(id)) {
      targetDoc.head.appendChild(source.cloneNode(true));
    }
  });
}

// Layout overrides so the box fills the pop-out window instead of floating.
// The id+class selector out-specifies the base `#pixels-modifier-box` rules.
function injectPopoutStyles(targetDoc) {
  if (targetDoc.getElementById(POPOUT_STYLE_ID)) {
    return;
  }

  const style = targetDoc.createElement('style');
  style.id = POPOUT_STYLE_ID;
  style.textContent = `
    html, body { margin: 0; padding: 0; height: 100%; background: transparent; }
    #pixels-modifier-box.${POPPED_OUT_CLASS} {
      position: static !important;
      top: auto !important;
      left: auto !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
    #pixels-modifier-box.${POPPED_OUT_CLASS} .pixels-header { cursor: default !important; }
    #pixels-modifier-box.${POPPED_OUT_CLASS} .pixels-resize-handle { display: none !important; }
  `;
  targetDoc.head.appendChild(style);
}

// Mirror the page's `roll20-*-theme` class onto the pop-out body so the
// light-theme rules (scoped under `.roll20-light-theme`) still match.
function syncThemeClass(targetDoc) {
  const themeClasses = Array.from(document.body.classList).filter(
    c => c.startsWith('roll20-') && c.endsWith('-theme')
  );
  targetDoc.body.classList.remove('roll20-light-theme', 'roll20-dark-theme');
  themeClasses.forEach(c => targetDoc.body.classList.add(c));
}

// Keep the pop-out theme in sync if the page theme changes while popped out.
function startThemeSync(targetDoc) {
  if (typeof MutationObserver === 'undefined') {
    return;
  }
  themeSyncObserver = new MutationObserver(() => syncThemeClass(targetDoc));
  themeSyncObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

function stopThemeSync() {
  if (themeSyncObserver) {
    themeSyncObserver.disconnect();
    themeSyncObserver = null;
  }
}

const PopoutManager = {
  setupPopoutControls,
  isSupported,
};

export default PopoutManager;

if (typeof window !== 'undefined') {
  window.ModifierBoxPopoutManager = PopoutManager;
}
