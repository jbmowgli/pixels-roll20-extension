/**
 * Popup theme tests
 */

describe('Popup Theme System', () => {
  // Mock chrome API
  const mockChrome = {
    tabs: {
      query: jest.fn(),
      executeScript: jest.fn(),
      sendMessage: jest.fn(),
    },
    scripting: {
      executeScript: jest.fn(),
    },
    storage: {
      sync: {
        get: jest.fn((key, callback) => {
          callback({ modifier: '0' });
        }),
        set: jest.fn(),
      },
    },
    runtime: {
      onMessage: {
        addListener: jest.fn(),
      },
      lastError: null,
      getURL: jest.fn(path => `chrome-extension://test-extension-id/${path}`),
    },
  };

  beforeEach(() => {
    // Set up DOM with required elements
    document.head.innerHTML = '';
    document.body.innerHTML = `
      <div class="popup-container">
        <div class="popup-header">
          <img src="" alt="Pixels Roll20" class="popup-icon">
          <span class="popup-title">Pixels Roll20</span>
        </div>
        <div class="popup-content">
          <div class="connection-section">
            <button id="connect" class="primary-button">Connect to Pixel</button>
            <div class="connection-status">
              <div id="text" class="status-text"></div>
            </div>
          </div>
          <div class="modifier-section">
            <div class="button-container">
              <button id="showModifier" class="secondary-button">Show Modifier Box</button>
              <button id="hideModifier" class="secondary-button">Hide Modifier Box</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Mock chrome global
    global.chrome = mockChrome;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    delete global.chrome;
  });

  test('should apply dark theme by default', () => {
    // Mock chrome.tabs.query to call callback with no tabs
    mockChrome.tabs.query.mockImplementation((query, callback) => {
      callback([]);
    });

    // Load popup script
    require('../../src/components/popup/popup.js');

    // Simulate DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Should not add light theme link
    const lightThemeLink = document.getElementById('popup-light-theme');
    expect(lightThemeLink).toBeNull();
  });

  test('should apply light theme when Roll20 is in light mode', done => {
    // Mock chrome.tabs.query to return active Roll20 tab
    mockChrome.tabs.query.mockImplementation((query, callback) => {
      callback([{ id: 1, url: 'https://app.roll20.net/editor/game/123' }]);
    });

    // Mock chrome.tabs.sendMessage to return light theme
    mockChrome.tabs.sendMessage.mockImplementation(
      (tabId, message, callback) => {
        callback({ theme: 'light' });
      }
    );

    // Load popup script
    require('../../src/components/popup/popup.js');

    // Simulate DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Wait for async operations
    setTimeout(() => {
      // Should add light theme link
      const lightThemeLink = document.getElementById('popup-light-theme');
      expect(lightThemeLink).toBeTruthy();
      expect(lightThemeLink.href).toContain('popup-light.css');
      done();
    }, 100);
  });

  test('should apply dark theme when Roll20 is in dark mode', () => {
    // Mock chrome.tabs.query to return active Roll20 tab
    mockChrome.tabs.query.mockImplementation((query, callback) => {
      callback([{ id: 1, url: 'https://app.roll20.net/editor/game/123' }]);
    });

    // Mock chrome.tabs.sendMessage to return dark theme
    mockChrome.tabs.sendMessage.mockImplementation(
      (tabId, message, callback) => {
        callback({ theme: 'dark' });
      }
    );

    // Load popup script
    require('../../src/components/popup/popup.js');

    // Simulate DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Should not add light theme link for dark mode
    const lightThemeLink = document.getElementById('popup-light-theme');
    expect(lightThemeLink).toBeNull();
  });

  test('should handle script execution failures gracefully', done => {
    // Mock chrome.tabs.query to return active Roll20 tab
    mockChrome.tabs.query.mockImplementation((query, callback) => {
      callback([{ id: 1, url: 'https://app.roll20.net/editor/game/123' }]);
    });

    // Mock chrome.tabs.sendMessage to fail (content script not available)
    mockChrome.tabs.sendMessage.mockImplementation(
      (tabId, message, callback) => {
        mockChrome.runtime.lastError = {
          message: 'Content script not available',
        };
        callback(null);
      }
    );

    // Mock chrome.scripting.executeScript to return light theme
    mockChrome.scripting.executeScript.mockImplementation(options => {
      return Promise.resolve([{ result: 'light' }]);
    });

    // Load popup script
    require('../../src/components/popup/popup.js');

    // Simulate DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Should fall back to direct script execution and detect light theme
    setTimeout(() => {
      const lightThemeLink = document.getElementById('popup-light-theme');
      expect(lightThemeLink).toBeTruthy();
      done();
    }, 100);
  });

  test('placeholder test to prevent empty test suite error', () => {
    // This is a placeholder test to prevent Jest from failing
    // due to empty test suite. Real popup tests should be added here.
    expect(true).toBe(true);
  });
});
