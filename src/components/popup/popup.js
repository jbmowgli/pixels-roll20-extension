'use strict';

// Simple theme detection and CSS loading
function detectAndApplyTheme() {
  console.log('Popup: Starting theme detection...');
  
  // Check if we're in a Chrome extension popup context
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    // Get the active tab to check Roll20's theme
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      console.log('Popup: Active tabs found:', tabs);
      
      if (tabs[0]?.id) {
        const tab = tabs[0];
        console.log('Popup: Tab URL:', tab.url);
        
        // Check if this is a Roll20 tab
        if (!tab.url || (!tab.url.includes('roll20.net') && !tab.url.includes('app.roll20.net'))) {
          console.log('Popup: Not a Roll20 tab, defaulting to dark theme');
          applyTheme('dark');
          return;
        }
        
        console.log('Popup: Requesting theme from content script...');
        
        // First try to communicate with our content script
        chrome.tabs.sendMessage(tab.id, { action: 'getTheme' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Popup: Content script not available, using direct detection');
            // Fallback to direct script execution
            executeThemeDetectionScript(tab.id);
          } else if (response && response.theme) {
            console.log('Popup: Theme from content script:', response.theme);
            applyTheme(response.theme);
          } else {
            console.log('Popup: No theme response, using direct detection');
            executeThemeDetectionScript(tab.id);
          }
        });
      } else {
        console.log('Popup: No active tab found, defaulting to dark theme');
        applyTheme('dark');
      }
    });
  } else {
    console.log('Popup: Not in extension context, defaulting to dark theme');
    applyTheme('dark');
  }
}

function executeThemeDetectionScript(tabId) {
  console.log('Popup: Executing direct theme detection script...');
  
  // Use chrome.scripting for Manifest V3
  if (chrome.scripting) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        console.log('Direct script: Checking Roll20 theme...');
        
        // Check Roll20's localStorage for theme setting
        try {
          const roll20Theme = localStorage.getItem('colorTheme');
          console.log('Direct script: localStorage colorTheme =', roll20Theme);
          
          if (roll20Theme === 'light') {
            console.log('Direct script: Detected light theme from localStorage');
            return 'light';
          } else if (roll20Theme === 'dark') {
            console.log('Direct script: Detected dark theme from localStorage');
            return 'dark';
          }
        } catch (e) {
          console.log('Direct script: Error accessing localStorage:', e);
        }
        
        // Fallback: Check for Roll20's theme classes
        const body = document.body;
        const html = document.documentElement;
        
        console.log('Direct script: body classes:', body.className);
        console.log('Direct script: html classes:', html.className);
        
        if (body.classList.contains('lightmode') || html.classList.contains('lightmode')) {
          console.log('Direct script: Detected light theme from classes');
          return 'light';
        }
        
        if (body.classList.contains('roll20-light-theme') || html.classList.contains('roll20-light-theme')) {
          console.log('Direct script: Detected light theme from roll20 classes');
          return 'light';
        }
        
        // Check for Roll20's actual theme classes
        if (body.classList.contains('darkmode') || html.classList.contains('darkmode')) {
          console.log('Direct script: Detected dark theme from classes');
          return 'dark';
        }
        
        // Log what we actually found
        console.log('Direct script: No theme detected, defaulting to dark');
        console.log('Direct script: All localStorage keys:', Object.keys(localStorage));
        
        // Default to dark theme
        return 'dark';
      }
    }).then((results) => {
      console.log('Popup: Direct script results:', results);
      
      if (results && results[0] && results[0].result) {
        console.log('Popup: Detected theme:', results[0].result);
        applyTheme(results[0].result);
      } else {
        console.log('Popup: No results, defaulting to dark theme');
        applyTheme('dark');
      }
    }).catch((error) => {
      console.error('Popup: Direct script execution error:', error);
      applyTheme('dark');
    });
  } else {
    console.log('Popup: chrome.scripting not available, defaulting to dark theme');
    applyTheme('dark');
  }
}

function applyTheme(theme) {
  console.log('Popup: Applying theme:', theme);
  
  // Remove existing theme stylesheets
  const existingLightTheme = document.getElementById('popup-light-theme');
  if (existingLightTheme) {
    console.log('Popup: Removing existing light theme');
    existingLightTheme.remove();
  }
  
  // Apply light theme if detected
  if (theme === 'light') {
    console.log('Popup: Adding light theme CSS');
    const lightThemeLink = document.createElement('link');
    lightThemeLink.id = 'popup-light-theme';
    lightThemeLink.rel = 'stylesheet';
    lightThemeLink.href = 'popup-light.css';
    
    lightThemeLink.onload = () => {
      console.log('Popup: Light theme CSS loaded successfully');
      // Add a visual indicator that light theme is applied
      document.body.style.border = '2px solid #007bff';
      setTimeout(() => {
        document.body.style.border = '';
      }, 2000);
    };
    
    lightThemeLink.onerror = () => {
      console.error('Popup: Failed to load light theme CSS');
    };
    
    document.head.appendChild(lightThemeLink);
    console.log('Popup: Light theme link added to head');
  } else {
    console.log('Popup: Using default dark theme');
    // Add a visual indicator that dark theme is applied
    document.body.style.border = '2px solid #ff0000';
    setTimeout(() => {
      document.body.style.border = '';
    }, 2000);
  }
  
  console.log(`Popup: Theme application complete - ${theme}`);
}

function hookButton(name) {
  document.getElementById(name).onclick = element =>
    sendMessage({ action: name });
}

// Hooks "connect" and "showModifier" buttons to injected JS
hookButton('connect');
hookButton('showModifier');
hookButton('hideModifier');

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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action == 'showText') showText(request.text);
  else if (request.action == 'modifierChanged') {
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
  console.log('Popup: DOM loaded, starting theme detection...');
  
  // Set the correct icon URL using Chrome extension API
  const iconElement = document.querySelector('.popup-icon');
  if (iconElement && typeof chrome !== 'undefined' && chrome.runtime) {
    iconElement.src = chrome.runtime.getURL('assets/images/logo-128.png');
  }
  
  detectAndApplyTheme();
});
