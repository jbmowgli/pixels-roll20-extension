/**
 * ExtensionMessaging.js
 * 
 * Handles communication between the content script and the extension.
 */

'use strict';

(function() {
  const log = window.log || console.log;

  // Send message to extension with error handling
  function sendMessageToExtension(data) {
    if (
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.sendMessage
    ) {
      try {
        chrome.runtime.sendMessage(data);
      } catch (error) {
        console.log('Could not send message to extension:', error.message);
      }
    }
  }

  // Send text message to extension
  function sendTextToExtension(txt) {
    sendMessageToExtension({ action: 'showText', text: txt });
  }

  // Send status update to extension
  function sendStatusToExtension() {
    const pixels = window.pixels || [];
    const connectedPixels = pixels.filter(p => p.isConnected);
    const totalPixels = pixels.length;

    if (totalPixels == 0) {
      sendTextToExtension('No Pixel connected');
    } else if (totalPixels == 1) {
      const status = connectedPixels.length == 1 ? 'connected' : 'disconnected';
      sendTextToExtension(`1 Pixel ${status}`);
    } else {
      sendTextToExtension(
        `${connectedPixels.length}/${totalPixels} Pixels connected`
      );
    }
  }

  // Message handler for extension communication
  window.sendMessageToExtension = function (data) {
    try {
      if (
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.sendMessage
      ) {
        chrome.runtime.sendMessage(data);
      }
    } catch (error) {
      // Only log if it's not the common "Extension context invalidated" error
      if (!error.message.includes('Extension context invalidated')) {
        console.log('Could not send message to extension:', error);
      }
      // Extension context invalidated is normal when extension is reloaded - ignore silently
    }
  };

  // Export functions to global scope
  window.ExtensionMessaging = {
    sendMessageToExtension,
    sendTextToExtension,
    sendStatusToExtension
  };

  // Legacy exports for compatibility
  window.sendTextToExtension = sendTextToExtension;
  window.sendStatusToExtension = sendStatusToExtension;

})();
