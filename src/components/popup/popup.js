'use strict';

// Simple theme detection and CSS loading
function detectAndApplyTheme() {

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        const tab = tabs[0];

        if (
          !tab.url ||
          (!tab.url.includes('roll20.net') &&
            !tab.url.includes('app.roll20.net'))
        ) {
          applyTheme('dark');
          return;
        }

        chrome.tabs.sendMessage(tab.id, { action: 'getTheme' }, response => {
          if (chrome.runtime.lastError) {
            executeThemeDetectionScript(tab.id);
          } else if (response && response.theme) {
            applyTheme(response.theme);
          } else {
            executeThemeDetectionScript(tab.id);
          }
        });
      } else {
        applyTheme('dark');
      }
    });
  } else {
    applyTheme('dark');
  }
}

function executeThemeDetectionScript(tabId) {

  if (chrome.scripting) {
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        func: () => {

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
      .then(results => {
        if (results && results[0] && results[0].result) {
          applyTheme(results[0].result);
        } else {
          applyTheme('dark');
        }
      })
      .catch(error => {
        applyTheme('dark');
      });
  } else {
    applyTheme('dark');
  }
}

function applyTheme(theme) {

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

    lightThemeLink.onload = () => {
      document.body.style.border = '2px solid #007bff';
      setTimeout(() => {
        document.body.style.border = '';
      }, 2000);
    };

    lightThemeLink.onerror = () => {
    };

    document.head.appendChild(lightThemeLink);
  } else {
    // Add a visual indicator that dark theme is applied
    document.body.style.border = '2px solid #ff0000';
    setTimeout(() => {
      document.body.style.border = '';
    }, 2000);
  }

}

function showText(txt) {
  document.getElementById('text').innerHTML = txt;
}

// Send message to injected JS
function sendMessage(data, responseCallback) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, data, responseCallback);
    }
  });
}

// Listen on messages from injected JS
chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
  if (request.action === 'showText') {
    showText(request.text);
  } else if (request.action === 'modifierChanged') {
    // Store the modifier value when changed from floating box
    chrome.storage.sync.set({ modifier: request.modifier });
  }
});

// Initialize popup - content scripts are automatically injected by manifest
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (tabs[0]?.id) {
    // Request initial status from the content script
    sendMessage({ action: 'getStatus' });

    // Load and send stored modifier value
    chrome.storage.sync.get('modifier', data => {
      sendMessage({ action: 'setModifier', modifier: data.modifier || '0' });
    });
  }
});

// Initialize theme detection when popup loads
document.addEventListener('DOMContentLoaded', () => {
  const iconElement = document.querySelector('.popup-icon');
  if (iconElement && typeof chrome !== 'undefined' && chrome.runtime) {
    iconElement.src = chrome.runtime.getURL('assets/images/logo-128.png');
  }

  // Setup button event handlers directly to avoid tree-shaking
  const connectBtn = document.getElementById('connect');
  const showModifierBtn = document.getElementById('showModifier');
  const hideModifierBtn = document.getElementById('hideModifier');

  if (connectBtn) {
    connectBtn.onclick = () => sendMessage({ action: 'connect' });
  }
  if (showModifierBtn) {
    showModifierBtn.onclick = () => sendMessage({ action: 'showModifier' });
  }
  if (hideModifierBtn) {
    hideModifierBtn.onclick = () => sendMessage({ action: 'hideModifier' });
  }

  detectAndApplyTheme();
});
