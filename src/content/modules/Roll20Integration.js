/**
 * Roll20Integration.js
 *
 * Handles Roll20-specific functionality like posting chat messages.
 */

'use strict';

import { log, getArrayFirstElement } from './Utils.js';

// Post message to Roll20 chat
export const postChatMessage = message => {
  const chat = document.getElementById('textchat-input');
  const txt = getArrayFirstElement(chat?.getElementsByTagName('textarea'));
  const btn = getArrayFirstElement(chat?.getElementsByTagName('button'));

  if (typeof txt === 'undefined' || typeof btn === 'undefined') {
    log("Couldn't find Roll20 chat textarea and/or button");
  } else {
    const current_msg = txt.value;
    txt.value = message;
    btn.click();
    txt.value = current_msg;
  }
};

// Default export with all functions
const Roll20Integration = {
  postChatMessage,
};

export default Roll20Integration;

// Legacy global exports for backward compatibility (temporary)
if (typeof window !== 'undefined') {
  window.Roll20Integration = Roll20Integration;
  window.postChatMessage = postChatMessage;
}
