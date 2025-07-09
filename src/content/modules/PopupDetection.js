/**
 * PopupDetection.js
 * 
 * Handles detection of Roll20 popup windows to prevent modifier box display
 * in journal entries, character sheets, and other popout windows.
 */

'use strict';

(function() {
  // Pure function to check if a URL indicates a Roll20 popup window
  function checkUrlForPopup(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    const urlLower = url.toLowerCase();
    return (
      urlLower.includes('popout') ||        // Broad popout detection
      urlLower.includes('popout=true')      // Parameter-based detection
    );
  }

  // Detect if this is a Roll20 popup window (journal entry, character sheet, etc.)
  function isRoll20PopupWindow() {
    try {
      const url = window.location.href;
      const isPopup = checkUrlForPopup(url);
      
      if (isPopup) {
        console.log('Detected Roll20 popup window - modifier box will not be shown');
        console.log('URL:', url);
      } else {
        console.log('Main Roll20 page detected - modifier box will be shown');
      }
      
      return isPopup;
    } catch (error) {
      console.log('Error detecting popup window:', error);
      return false;
    }
  }

  // Export functions to global scope
  window.PopupDetection = {
    checkUrlForPopup,
    isRoll20PopupWindow
  };

  // Legacy exports for testing compatibility
  window.checkUrlForPopup = checkUrlForPopup;
  window.isRoll20PopupWindow = isRoll20PopupWindow;

})();
