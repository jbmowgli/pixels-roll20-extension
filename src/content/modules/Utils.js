/**
 * Utils.js
 * 
 * Common utility functions and helpers used throughout the extension.
 */

'use strict';

(function() {
  // Logging utility
  const log = console.log;

  // Helper function to get first element of array safely
  function getArrayFirstElement(array) {
    return typeof array == 'undefined' ? undefined : array[0];
  }

  // Export functions to global scope
  window.PixelsUtils = {
    log,
    getArrayFirstElement
  };

  // Legacy exports for compatibility
  window.log = log;
  window.getArrayFirstElement = getArrayFirstElement;

})();
