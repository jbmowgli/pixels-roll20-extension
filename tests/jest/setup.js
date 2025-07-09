// Jest setup file
// This file runs before each test to set up the testing environment

// Mock Chrome Extension APIs
global.chrome = {
  runtime: {
    getURL: jest.fn(path => `chrome-extension://mock-id/${path}`),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Mock window.ModifierBox and related globals that would be set by other modules
global.window = global.window || {};

// Helper function to reset all mocks between tests
global.resetMocks = () => {
  jest.clearAllMocks();

  // Reset global state
  delete window.ModifierBox;
  delete window.ModifierBoxThemeManager;
  delete window.ModifierBoxDragHandler;
  delete window.ModifierBoxRowManager;
  delete window.ThemeDetector;
  delete window.pixelsModifier;
  delete window.pixelsModifierName;

  // Clear the DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Helper to create mock elements
global.createMockElement = (tag, attributes = {}) => {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'innerHTML') {
      element.innerHTML = value;
    } else if (key === 'textContent') {
      element.textContent = value;
    } else {
      element.setAttribute(key, value);
    }
  });
  return element;
};

// Helper to simulate events
global.simulateEvent = (element, eventType, eventData = {}) => {
  const event = new Event(eventType, { bubbles: true });
  Object.assign(event, eventData);
  element.dispatchEvent(event);
  return event;
};

// Mock Bluetooth API
global.navigator = {
  ...global.navigator,
  bluetooth: {
    requestDevice: jest.fn(),
    getAvailability: jest.fn(() => Promise.resolve(true)),
  },
};

// Run before each test
beforeEach(() => {
  resetMocks();
});
