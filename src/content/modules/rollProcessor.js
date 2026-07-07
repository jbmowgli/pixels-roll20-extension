/**
 * rollProcessor.js
 *
 * Face-event parsing and roll/chat formatting shared by both connectivity
 * paths: PixelsBluetooth.js (Chrome/Web Bluetooth) and PixelsNativeBridge.js
 * (Firefox/native messaging). Neither path duplicates this logic — they
 * just get notification bytes onto a DataView however they can and call
 * processNotification().
 */

// Utility functions
const postChatMessage = window.postChatMessage || function () {};
const sendTextToExtension = window.sendTextToExtension || function () {};

// Roll formulas
const pixelsFormulaWithModifier =
  '&{template:default} {{name=#modifier_name (#modifier_sign)}} {{Pixel=#face_value}} {{Result=[[#face_value + #modifier]]}}';
const pixelsFormulaSimple =
  '&{template:default} {{name=Pixel Roll}} {{Pixel=#face_value}} {{Result=[[#result]]}}';

// Helper function to format modifier with proper sign
export const formatModifierSign = modifier => {
  const num = parseInt(modifier) || 0;
  return num >= 0 ? `+${num}` : num.toString();
};

// dieState is a mutable { hasMoved, face } object owned by the caller (one
// per die) and passed in by reference, so movement/face state persists
// across calls without this module tracking per-die identity itself.
const handleFaceEvent = (dieName, dieState, ev, face) => {
  if (!dieState.hasMoved) {
    if (ev !== 1) {
      dieState.hasMoved = true;
    }
    return;
  }

  if (ev !== 1) {
    return;
  }

  dieState.face = face;
  const txt = `${dieName}: face up = ${face + 1}`;

  // Check if modifier box is visible to determine modifier application
  const isModifierBoxVisible =
    window.ModifierBox &&
    window.ModifierBox.isVisible &&
    window.ModifierBox.isVisible();

  // Sync modifier values from the modifier box before processing roll (only if visible)
  if (
    isModifierBoxVisible &&
    typeof window.ModifierBox !== 'undefined' &&
    window.ModifierBox.syncGlobalVars
  ) {
    window.ModifierBox.syncGlobalVars();
  }

  const diceValue = face + 1;
  const modifier = isModifierBoxVisible
    ? parseInt(window.pixelsModifier) || 0
    : 0;
  const result = diceValue + modifier;

  // Choose formula based on modifier box visibility
  let formula = isModifierBoxVisible
    ? pixelsFormulaWithModifier
    : pixelsFormulaSimple;

  // Add critical hit message if face value is 20
  if (diceValue === 20 && isModifierBoxVisible) {
    formula = formula.replace(
      '{{Pixel=#face_value}}',
      '{{&#128293; <span style="color: #ff4444; font-size: 20px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">CRITICAL!</span> &#128293;}} {{Pixel=#face_value}}'
    );
  }

  // Add fumble message if face value is 1
  if (diceValue === 1 && isModifierBoxVisible) {
    formula = formula.replace(
      '{{Pixel=#face_value}}',
      '{{&#128128; <span style="color: #888888; font-size: 16px; font-style: italic; opacity: 0.7;">FUMBLE!</span> &#128128;}} {{Pixel=#face_value}}'
    );
  }

  const message = formula
    .replaceAll('#modifier_name', window.pixelsModifierName)
    .replaceAll('#modifier_sign', formatModifierSign(modifier))
    .replaceAll('#face_value', diceValue.toString())
    .replaceAll('#pixel_name', dieName)
    .replaceAll('#modifier', modifier.toString())
    .replaceAll('#result', result.toString());

  message.split('\\n').forEach(s => postChatMessage(s));

  sendTextToExtension(txt);
};

// Entry point for both connectivity paths: dataView is the raw notification
// bytes from the die's notify characteristic, unmodified. Byte 0 === 3
// identifies a face-event notification; anything else is ignored here.
export const processNotification = (dieName, dieState, dataView) => {
  if (dataView.getUint8(0) !== 3) {
    return;
  }
  handleFaceEvent(
    dieName,
    dieState,
    dataView.getUint8(1),
    dataView.getUint8(2)
  );
};

export default { processNotification, formatModifierSign };

// Expose for testing (matches the pattern used by PixelsBluetooth.js)
if (typeof global !== 'undefined') {
  global.rollProcessor = { processNotification, formatModifierSign };
}
