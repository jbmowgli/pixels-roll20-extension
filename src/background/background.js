'use strict';

chrome.runtime.onInstalled.addListener(function () {
  console.log('Pixels Roll20 Extension installed successfully');

  // Initialize storage if needed
  chrome.storage.sync.get(['pixelsSettings'], function (result) {
    if (!result.pixelsSettings) {
      chrome.storage.sync.set(
        {
          pixelsSettings: {
            autoConnect: true,
            showModifierBox: true,
            theme: 'auto',
          },
        },
        function () {
          console.log('Default settings initialized');
        }
      );
    }
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['pixelsSettings'], function (result) {
      sendResponse(result.pixelsSettings || {});
    });
    return true; // Will respond asynchronously
  }

  if (request.action === 'saveSettings') {
    chrome.storage.sync.set({ pixelsSettings: request.settings }, function () {
      sendResponse({ success: true });
    });
    return true; // Will respond asynchronously
  }
});

// Firefox native-messaging relay: content scripts (PixelsNativeBridge.js)
// can't call connectNative() themselves, so the background script opens the
// native host on their behalf and pipes messages both ways. See
// native-host/PROTOCOL.md for the message shapes being relayed.
const NATIVE_HOST_NAME = 'pixels_roll20_helper';
const NATIVE_PORT_NAME = 'pixels-native';

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== NATIVE_PORT_NAME) {
    return;
  }

  let nativePort;
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
  } catch (error) {
    console.log(`Failed to connect to native host: ${error.message}`);
    safePostMessage(port, { event: 'hostMissing' });
    return;
  }

  nativePort.onMessage.addListener(message => {
    safePostMessage(port, message);
  });

  nativePort.onDisconnect.addListener(() => {
    // connectNative() doesn't fail synchronously when the host isn't
    // installed/registered — the browser reports that asynchronously here,
    // via onDisconnect with lastError set, instead of throwing above.
    const error = chrome.runtime.lastError;
    if (error) {
      console.log(`Native host disconnected: ${error.message}`);
      safePostMessage(port, { event: 'hostMissing' });
    }
  });

  port.onMessage.addListener(message => {
    try {
      nativePort.postMessage(message);
    } catch (error) {
      console.log(`Failed to forward message to native host: ${error.message}`);
    }
  });

  port.onDisconnect.addListener(() => {
    try {
      nativePort.disconnect();
    } catch {
      // Already disconnected.
    }
  });
});

function safePostMessage(port, message) {
  try {
    port.postMessage(message);
  } catch {
    // Content-script port already closed; nothing to relay to.
  }
}
