/**
 * Extension Messaging for Pixels Roll20 Extension
 * Handles communication between the content script and the Chrome extension
 */

import { filter } from 'ramda';
import { getKnownDice } from '../utils/knownDiceStorage';

interface ExtensionMessage {
  action: string;
  text?: string;
  count?: number;
  [key: string]: unknown;
}

// Message handler for extension communication
export const sendMessageToExtension = (data: ExtensionMessage): void => {
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
      (error as Error).message &&
      (error as Error).message.includes('Extension context invalidated')
    ) {
      // Don't log these common extension reload errors
      return;
    }
    console.log('Could not send message to extension:', error);
  }
};

export const sendTextToExtension = (txt: string): void => {
  sendMessageToExtension({ action: 'showText', text: txt });
};

export const sendStatusToExtension = async (): Promise<void> => {
  const pixels: PixelDie[] = window.pixels || [];

  // Verify actual GATT state for each pixel, not just cached _isConnected
  const connectedPixels = filter((p: PixelDie) => {
    try {
      return (
        p.isConnected &&
        p.device !== null &&
        p.device.gatt !== undefined &&
        p.device.gatt!.connected
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

export const setupMessageListener = (): void => {
  // Only set up message listener if in extension context
  if (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    chrome.runtime.onMessage
  ) {
    try {
      chrome.runtime.onMessage.addListener(
        (msg: Record<string, unknown>, _sender, _sendResponse) => {
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
                console.log('Error connecting to pixel:', error);
              }
              break;

            case 'disconnect':
              try {
                if (window.disconnectAllPixels) {
                  window.disconnectAllPixels();
                }
              } catch (error) {
                console.log('Error disconnecting pixels:', error);
              }
              break;

            default:
              break;
          }
        }
      );
    } catch (error) {
      console.log(
        'Could not set up extension message listener:',
        (error as Error).message
      );
    }
  }
};

// Legacy global exports for backward compatibility
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).sendMessageToExtension =
    sendMessageToExtension;
}
