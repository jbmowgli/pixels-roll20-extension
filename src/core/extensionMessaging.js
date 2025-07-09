/**
 * Extension Messaging for Pixels Roll20 Extension
 * Handles communication between the content script and the Chrome extension
 */

import { filter } from 'ramda';

// Message handler for extension communication
export const sendMessageToExtension = data => {
  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.sendMessage
    ) {
      chrome.runtime.sendMessage(data);
    }
  } catch (error) {
    // Silently handle extension context invalidated errors (common when extension reloads)
    if (
      error.message &&
      error.message.includes('Extension context invalidated')
    ) {
      // Don't log these common extension reload errors
      return;
    }
    console.log('Could not send message to extension:', error);
  }
};

export const sendTextToExtension = txt => {
  sendMessageToExtension({ action: 'showText', text: txt });
};

export const sendStatusToExtension = () => {
  const connectedPixels = filter(p => p.isConnected, window.pixels || []);
  const totalPixels = (window.pixels || []).length;

  if (totalPixels === 0) {
    sendTextToExtension('No Pixel connected');
  } else if (totalPixels === 1) {
    const status = connectedPixels.length === 1 ? 'connected' : 'disconnected';
    sendTextToExtension(`1 Pixel ${status}`);
  } else {
    sendTextToExtension(
      `${connectedPixels.length}/${totalPixels} Pixels connected`
    );
  }
};

export const setupMessageListener = () => {
  // Only set up message listener if in extension context
  if (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    chrome.runtime.onMessage
  ) {
    try {
      chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
        // Handle null/undefined messages gracefully
        if (!msg || typeof msg !== 'object') {
          console.log(`Received invalid message: ${JSON.stringify(msg)}`);
          return;
        }

        console.log(`Received message from extension: ${msg.action}`);

        if (msg.action === 'getStatus') {
          sendStatusToExtension();
        } else if (msg.action === 'setModifier') {
          if (window.pixelsModifier !== msg.modifier) {
            window.pixelsModifier = msg.modifier || '0';
            console.log(`Updated modifier: ${window.pixelsModifier}`);

            if (window.saveModifierSettings) {
              window.saveModifierSettings(); // Save to localStorage
            }

            // Update floating box if it exists and ModifierBox is loaded
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
                    if (valueInput) {
                      valueInput.value = window.pixelsModifier;
                    }
                  }
                }
              }
            }
          }
        } else if (msg.action === 'showModifier') {
          console.log('Received showModifier message');
          if (window.showModifierBox) {
            window.showModifierBox();
          }
        } else if (msg.action === 'hideModifier') {
          console.log('Received hideModifier message');
          if (window.hideModifierBox) {
            window.hideModifierBox();
          }
        } else if (msg.action === 'connect') {
          console.log('Connect button clicked, attempting to connect to Pixel');
          try {
            if (window.connectToPixel) {
              window.connectToPixel();
            }
          } catch (error) {
            console.log(`Error in connectToPixel: ${error}`);
            sendTextToExtension(`Failed to connect: ${error.message}`);
          }
        } else if (msg.action === 'disconnect') {
          if (
            window.PixelsBluetoothManager &&
            window.PixelsBluetoothManager.disconnectAllPixels
          ) {
            window.PixelsBluetoothManager.disconnectAllPixels();
          } else if (window.pixels) {
            // Fallback to direct pixel manipulation
            window.pixels.forEach(pixel => {
              pixel.disconnect();
            });
            window.pixels = [];
            sendStatusToExtension();
          }
        }
      });
    } catch (error) {
      console.log(
        'Could not set up extension message listener:',
        error.message
      );
    }
  }
};

// Default export
export default {
  sendMessageToExtension,
  sendTextToExtension,
  sendStatusToExtension,
  setupMessageListener,
};

// Legacy global exports for compatibility (when not using modules)
if (typeof window !== 'undefined') {
  window.PixelsExtensionMessaging = {
    sendMessageToExtension,
    sendTextToExtension,
    sendStatusToExtension,
    setupMessageListener,
  };

  // Make functions available globally for backward compatibility
  window.sendMessageToExtension = sendMessageToExtension;
  window.sendTextToExtension = sendTextToExtension;
  window.sendStatusToExtension = sendStatusToExtension;
}
