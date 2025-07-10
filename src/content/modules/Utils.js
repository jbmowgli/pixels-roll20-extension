/**
 * Utils.js
 *
 * Common utility functions and helpers used throughout the extension.
 */

'use strict';

// Logging utility
export const log = console.log;

// Helper function to get first element of array safely
export const getArrayFirstElement = (array) => {
  return typeof array === 'undefined' ? undefined : array[0];
};

// Default export with all functions
const PixelsUtils = {
  log,
  getArrayFirstElement,
};

export default PixelsUtils;

// Legacy global exports for backward compatibility (temporary)
if (typeof window !== 'undefined') {
  window.PixelsUtils = PixelsUtils;
  window.log = log;
  window.getArrayFirstElement = getArrayFirstElement;
}
