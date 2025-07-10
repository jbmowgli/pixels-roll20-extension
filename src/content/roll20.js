/**
 * roll20.js - Main Pixels Roll20 Extension Content Script
 *
 * Coordinates all extension functionality and handles initialization.
 * This is the main entry point that loads and coordinates all other modules.
 */

import {
  initialize as initializePixelsBluetooth,
  connectToPixel,
  disconnectAllPixels,
  getPixels,
} from './modules/PixelsBluetooth.js';
import {
  sendTextToExtension,
  sendStatusToExtension,
  setupMessageListener,
} from '../core/extensionMessaging.js';

if (typeof window.roll20PixelsLoaded === 'undefined') {
  const _roll20PixelsLoaded = true;

  // Global modifier variables (accessed by modifierBox.js)
  window.pixelsModifier = '0';
  window.pixelsModifierName = 'Modifier 1';

  // Initialize modules and set up message handling
  function initializeExtension() {
    const log = window.log || console.log;

    log('Starting Pixels Roll20 extension');

    // Initialize the Bluetooth module
    initializePixelsBluetooth();

    // Expose functions to global scope for backwards compatibility
    window.connectToPixel = connectToPixel;
    window.disconnectAllPixels = disconnectAllPixels;
    window.getPixels = getPixels;
    window.sendTextToExtension = sendTextToExtension;
    window.sendStatusToExtension = sendStatusToExtension;

    // Set up extension messaging
    setupMessageListener();

    // Set up formulas
    const pixelsFormulaWithModifier =
      '&{template:default} {{name=#modifier_name}} {{Result=[[#face_value + #modifier]]}}';
    const _pixelsFormulaSimple =
      '&{template:default} {{name=Result}} {{Pixel Dice=[[#result]]}}';
    const _pixelsFormula = pixelsFormulaWithModifier; // Legacy compatibility

    // Only set up message listener if in extension context
    if (
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.onMessage
    ) {
      try {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
          // Handle null/undefined messages gracefully
          if (!msg || typeof msg !== 'object') {
            log(`Received invalid message: ${JSON.stringify(msg)}`);
            return;
          }

          switch (msg.action) {
            case 'getStatus':
              window.sendStatusToExtension();
              break;

            case 'setModifier':
              handleSetModifierMessage(msg);
              break;

            case 'showModifier':
              window.showModifierBox();
              break;

            case 'hideModifier':
              window.hideModifierBox();
              break;

            case 'connect':
              // Handle connect asynchronously to catch all errors properly
              (async () => {
                try {
                  await connectToPixel();
                } catch (error) {
                  log(`Error connecting to Pixel: ${error.message}`);
                  if (typeof window.sendTextToExtension === 'function') {
                    window.sendTextToExtension(
                      `Failed to connect: ${error.message}`
                    );
                  }
                }
              })();
              break;

            case 'disconnect':
              disconnectAllPixels();
              break;

            case 'getTheme':
              // Get current theme from ThemeDetector
              const theme = window.ThemeDetector
                ? window.ThemeDetector.detectTheme()
                : 'dark';
              sendResponse({ theme: theme });
              return true; // Keep the message channel open for async response

            default:
              log(`Unknown action received: ${msg.action}`);
          }
        });
      } catch (error) {
        console.log(
          'Could not set up extension message listener:',
          error.message
        );
      }
    }
  }

  // Handle setModifier message
  function handleSetModifierMessage(msg) {
    // Instead of overwriting the UI, sync FROM the UI TO the global variables
    // This prevents resetting user-entered values when the popup initializes
    if (typeof window.ModifierBox !== 'undefined') {
      const modifierBox = window.ModifierBox.getElement();
      if (modifierBox) {
        // Check if the modifier box has any user data
        const selectedRadio = modifierBox.querySelector(
          'input[name="modifier-select"]:checked'
        );
        if (selectedRadio) {
          const index = parseInt(selectedRadio.value);
          const rows = modifierBox.querySelectorAll('.modifier-row');
          const row = rows[index];
          if (row) {
            const valueInput = row.querySelector('.modifier-value');
            const nameInput = row.querySelector('.modifier-name');

            // If there's already user data in the UI, sync FROM UI TO global vars
            if (valueInput && nameInput) {
              const currentValue = valueInput.value;
              const currentName = nameInput.value;

              // Only update if the UI has meaningful data
              if (currentValue !== '' && currentName !== '') {
                window.pixelsModifier = currentValue;
                window.pixelsModifierName = currentName;
                window.log(
                  `Synced FROM UI: modifier=${currentValue}, name=${currentName}`
                );
                window.saveModifierSettings();
                return; // Exit early, don't overwrite UI
              }
            }
          }
        }
      }
    }

    // If no meaningful UI data exists, then apply the popup's value
    if (window.pixelsModifier !== msg.modifier) {
      window.pixelsModifier = msg.modifier || '0';
      window.log(`Updated modifier from popup: ${window.pixelsModifier}`);
      window.saveModifierSettings();

      // Only update UI if there's no existing meaningful data
      if (typeof window.ModifierBox !== 'undefined') {
        const modifierBox = window.ModifierBox.getElement();
        if (modifierBox) {
          const selectedRadio = modifierBox.querySelector(
            'input[name="modifier-select"]:checked'
          );
          if (selectedRadio) {
            const index = parseInt(selectedRadio.value);
            const rows = modifierBox.querySelectorAll('.modifier-row');
            const row = rows[index];
            if (row) {
              const valueInput = row.querySelector('.modifier-value');
              if (
                valueInput &&
                (valueInput.value === '' || valueInput.value === '0')
              ) {
                valueInput.value = window.pixelsModifier;
                window.log(
                  `Updated UI with popup value: ${window.pixelsModifier}`
                );
              }
            }
          }
        }
      }
    }
  }

  // Initialize after all modules are loaded
  function startExtension() {
    initializeExtension();

    // Send initial status
    window.sendStatusToExtension();

    // Load modifier settings from localStorage
    window.log('Loading modifier settings from localStorage...');
    window.loadModifierSettings();

    // Show modifier box by default after a delay
    window.log('Attempting to show modifier box automatically...');
    setTimeout(() => {
      try {
        // Only show modifier box if not in a popup window
        if (!window.isRoll20PopupWindow()) {
          window.showModifierBox();
          window.log('Modifier box shown successfully on page load');
        } else {
          window.log(
            'Skipping automatic modifier box display - this is a Roll20 popup window'
          );
        }
      } catch (error) {
        window.log(`Error showing modifier box: ${error}`);
      }
    }, 1000);
  }

  // Start the extension once all dependencies are available
  // This allows for all modules to be loaded first
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startExtension);
  } else {
    // DOM is already loaded
    setTimeout(startExtension, 100); // Small delay to ensure all modules are loaded
  }
}
