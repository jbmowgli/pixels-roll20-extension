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

  if (request.action === 'updateBadge') {
    const count = request.count || 0;
    const text = count > 0 ? count.toString() : '';
    if (sender.tab?.id) {
      chrome.action.setBadgeText({ text, tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({
        color: count > 0 ? '#4ade80' : '#666666',
        tabId: sender.tab.id,
      });
    }
    return false;
  }
});
