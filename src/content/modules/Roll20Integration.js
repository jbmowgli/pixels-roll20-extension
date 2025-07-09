/**
 * Roll20Integration.js
 * 
 * Handles Roll20-specific functionality like posting chat messages.
 */

'use strict';

(function() {
  const log = window.log || console.log;
  const getArrayFirstElement = window.getArrayFirstElement || function(array) {
    return typeof array == 'undefined' ? undefined : array[0];
  };

  // Post message to Roll20 chat
  function postChatMessage(message) {
    log('Posting message on Roll20: ' + message);

    const chat = document.getElementById('textchat-input');
    const txt = getArrayFirstElement(chat?.getElementsByTagName('textarea'));
    const btn = getArrayFirstElement(chat?.getElementsByTagName('button'));

    if (typeof txt == 'undefined' || typeof btn == 'undefined') {
      log("Couldn't find Roll20 chat textarea and/or button");
    } else {
      const current_msg = txt.value;
      txt.value = message;
      btn.click();
      txt.value = current_msg;
    }
  }

  // Export functions to global scope
  window.Roll20Integration = {
    postChatMessage
  };

  // Legacy exports for compatibility
  window.postChatMessage = postChatMessage;

})();
