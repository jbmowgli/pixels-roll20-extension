/**
 * Extension Messaging for Pixels Roll20 Extension
 * Handles communication between the content script and the Chrome extension
 */

import { filter } from 'ramda';
import { getKnownDice } from '../utils/knownDiceStorage.js';

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

export const sendStatusToExtension = async () => {
  const pixels = window.pixels || [];

  // Verify actual GATT state for each pixel, not just cached _isConnected
  const connectedPixels = filter(p => {
    try {
      return (
        p.isConnected && p.device && p.device.gatt && p.device.gatt.connected
      );
    } catch {
      return false;
    }
  }, pixels);

  // Use known dice count as the total so status shows progress toward full reconnection
  let knownTotal = 0;
  try {
    const knownDice = await getKnownDice();
    knownTotal = knownDice.length;
  } catch {
    knownTotal = 0;
  }

  const totalToShow = Math.max(knownTotal, pixels.length);

  if (totalToShow === 0) {
    sendTextToExtension('No Pixels connected');
  } else {
    sendTextToExtension(
      `${connectedPixels.length}/${totalToShow} Pixels connected`
    );
  }

  // Update the extension icon badge with the connected count
  sendMessageToExtension({
    action: 'updateBadge',
    count: connectedPixels.length,
  });
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

        switch (msg.action) {
          case 'getStatus':
            sendStatusToExtension();
            break;

          case 'connect':
            try {
              if (window.connectToPixel) {
                window.connectToPixel();
              }
            } catch (error) {
              console.log(`Error in connectToPixel: ${error}`);
              sendTextToExtension(`Failed to connect: ${error.message}`);
            }
            break;

          case 'disconnect':
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
            break;

          default:
            console.log(`Unknown action received: ${msg.action}`);
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
