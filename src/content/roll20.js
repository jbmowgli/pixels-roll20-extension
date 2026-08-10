/**
 * roll20.js - Main Pixels Roll20 Extension Content Script
 *
 * Coordinates all extension functionality and handles initialization.
 * This is the main entry point that loads and coordinates all other modules.
 */

import {
  initialize as initializePixelsBluetooth,
  connectToPixel,
  connectToPixelByName,
  disconnectAllPixels,
  getPixels,
  findPixelByName,
} from './modules/PixelsBluetooth.js';
import { setupChatInterception } from './modules/PixelsCommand.js';
import {
  sendTextToExtension,
  sendStatusToExtension,
  setupMessageListener,
} from '../core/extensionMessaging.js';

if (typeof window.roll20PixelsLoaded === 'undefined') {
  const _roll20PixelsLoaded = true;

  // Global settings
  window.pixelsAllowUnprompted = true; // Default: process all rolls
  window.pixelsAllowDiceSubstitution = false; // Default: no substitution

  // Load saved unprompted setting
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get('pixels_allow_unprompted', result => {
      window.pixelsAllowUnprompted = result.pixels_allow_unprompted !== false;
    });
    chrome.storage.local.get('pixels_allow_dice_substitution', result => {
      window.pixelsAllowDiceSubstitution =
        result.pixels_allow_dice_substitution === true;
    });
  }

  // Initialize modules and set up message handling
  function initializeExtension() {
    const log = window.log || console.log;

    log('Starting Pixels Roll20 extension');

    // Initialize the Bluetooth module
    initializePixelsBluetooth();

    // Initialize /pixels chat command interception
    setupChatInterception();

    // Expose functions to global scope for backwards compatibility
    window.connectToPixel = connectToPixel;
    window.connectToPixelByName = connectToPixelByName;
    window.disconnectAllPixels = disconnectAllPixels;
    window.getPixels = getPixels;
    window.sendTextToExtension = sendTextToExtension;
    window.sendStatusToExtension = sendStatusToExtension;

    // Set up extension messaging
    setupMessageListener();

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

            case 'showSavedRolls':
              window.showModifierBox();
              break;

            case 'hideSavedRolls':
              window.hideModifierBox();
              break;

            case 'setAllowUnprompted':
              window.pixelsAllowUnprompted = msg.value !== false;
              break;

            case 'setAllowDiceSubstitution':
              window.pixelsAllowDiceSubstitution = msg.value === true;
              break;

            case 'getCurrentRows': {
              // Return the current saved roll rows for the popup to save as a
              // profile. Prefer the live DOM; fall back to persisted rows.
              let rowsData = null;
              const box = window.ModifierBox?.getElement?.();
              if (box && window.ModifierBoxRowManager?.serializeRows) {
                rowsData = window.ModifierBoxRowManager.serializeRows(box);
              }
              if (!rowsData || !rowsData.rows || rowsData.rows.length === 0) {
                try {
                  const stored =
                    localStorage.getItem('pixels_saved_rolls') ||
                    localStorage.getItem('pixels_modifier_rows');
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    rowsData = {
                      rows: parsed.rows || [],
                      version: parsed.version || 1,
                    };
                  }
                } catch (e) {
                  log(`Could not read stored rows: ${e.message}`);
                }
              }
              sendResponse(rowsData || { rows: [], version: 2 });
              break;
            }

            case 'applyProfile': {
              // Apply a saved profile's rows to the panel, creating/showing it
              // first if necessary. Responds asynchronously.
              (async () => {
                try {
                  // Ensure the box exists and is visible before applying.
                  if (window.ModifierBox?.show) {
                    await window.ModifierBox.show();
                  }
                  const box = window.ModifierBox?.getElement?.();
                  const ok =
                    box && window.ModifierBoxRowManager?.applyProfileRows
                      ? window.ModifierBoxRowManager.applyProfileRows(
                          box,
                          msg.profile
                        )
                      : false;
                  sendResponse({ success: Boolean(ok) });
                } catch (e) {
                  log(`Error applying profile: ${e.message}`);
                  sendResponse({ success: false, error: e.message });
                }
              })();
              return true; // keep the message channel open for async response
            }

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

            case 'reconnect':
              // Reconnect to a specific die by name (filtered Bluetooth chooser)
              (async () => {
                try {
                  await connectToPixelByName(msg.name);
                } catch (error) {
                  log(`Error reconnecting to ${msg.name}: ${error.message}`);
                  if (typeof window.sendTextToExtension === 'function') {
                    window.sendTextToExtension(
                      `Failed to reconnect to ${msg.name}: ${error.message}`
                    );
                  }
                }
              })();
              break;

            case 'disconnect':
              disconnectAllPixels();
              break;

            case 'disconnectByName': {
              const pixel = findPixelByName(msg.name, getPixels());
              if (pixel) {
                pixel.disconnect();
                log(`Disconnected ${msg.name}`);
              }
              break;
            }

            case 'forgetByName': {
              const pixelToForget = findPixelByName(msg.name, getPixels());
              if (pixelToForget) {
                const device = pixelToForget.device;
                pixelToForget.destroy();
                if (device && device.forget) {
                  device
                    .forget()
                    .catch(err =>
                      log(`Could not un-pair ${msg.name}: ${err.message}`)
                    );
                }
              }
              break;
            }

            case 'getConnectedDice': {
              const connectedPixels = getPixels().filter(p => p.isConnected);
              const connected = connectedPixels.map(p => p.name);
              const batteryLevels = {};
              const dieTypes = {};
              connectedPixels.forEach(p => {
                if (p.batteryLevel !== null) {
                  batteryLevels[p.name] = p.batteryLevel;
                }
                if (p.dieType !== null) {
                  dieTypes[p.name] = p.dieType;
                }
              });
              sendResponse({ connected, batteryLevels, dieTypes });
              return true;
            }

            case 'getTheme': {
              // Get current theme from ThemeDetector
              const theme = window.ThemeDetector
                ? window.ThemeDetector.detectTheme()
                : 'dark';
              sendResponse({ theme: theme });
              return true; // Keep the message channel open for async response
            }

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

  // Initialize after all modules are loaded
  function startExtension() {
    initializeExtension();

    // Send initial status
    window.sendStatusToExtension();

    // Initialize the saved rolls panel and apply saved visibility after DOM settles
    setTimeout(() => {
      try {
        if (window.isRoll20PopupWindow()) {
          window.log('Skipping saved rolls panel in popup window');
          return;
        }
        // Apply saved visibility preference (independent of unprompted setting)
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get('pixels_saved_rolls_visible', result => {
            if (result.pixels_saved_rolls_visible !== false) {
              window.showModifierBox();
            }
          });
        } else {
          window.showModifierBox();
        }
      } catch (error) {
        window.log(`Error showing saved rolls panel: ${error}`);
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
