'use strict';

import { DiceManager, Pixel } from '@scooper4711/pixels-ble';
import { ChromeStorageAdapter } from '../../utils/ChromeStorageAdapter';

const log = window.log || console.log;
const postChatMessage: (message: string) => void =
  window.postChatMessage || function () {};
const sendTextToExtension: (txt: string) => void =
  window.sendTextToExtension || function () {};

// Resolved lazily because roll20.ts sets this after PixelsBridge loads
const getSendStatusToExtension = (): (() => void) =>
  window.sendStatusToExtension || function () {};

const storage = new ChromeStorageAdapter();
const diceManager = new DiceManager(storage);

function wireRollEvents(pixel: Pixel): void {
  pixel.addEventListener('roll', ({ face, dieType }) => {
    const command = window.PixelsCommand;
    if (command && command.isPromptActive()) {
      command.offerRoll(dieType, face);
      return;
    }

    if (!window.pixelsAllowUnprompted) {
      return;
    }

    const batcher = window.RollBatcher;
    if (batcher && batcher.addRoll) {
      const resolvedDieType = dieType || batcher.parseDieType(pixel.name, face);
      batcher.addRoll({
        dieName: pixel.name,
        dieType: resolvedDieType,
        faceValue: face,
      });
    } else {
      const message =
        '&{template:default} {{name=Pixel Roll}}' +
        ` {{Pixel=${face}}} {{Result=[[${face}]]}}`;
      message.split('\\n').forEach(s => postChatMessage(s));
      sendTextToExtension(`${pixel.name}: face up = ${face}`);
    }
  });

  pixel.addEventListener('status', ({ connected }) => {
    if (connected) {
      log(`Pixel ${pixel.name} connected`);
      sendTextToExtension(`Connected to ${pixel.name}`);
    } else {
      log(`Pixel ${pixel.name} disconnected`);
    }
    getSendStatusToExtension()();
  });

  pixel.addEventListener('battery', ({ level }) => {
    log(`Pixel ${pixel.name} battery: ${level}%`);
  });

  pixel.addEventListener('rssi', ({ rssi }) => {
    log(`Pixel ${pixel.name} RSSI: ${rssi} dBm`);
  });

  // Start RSSI reporting (every 5 seconds)
  pixel.reportRssi(true, 5000).catch(() => {
    // Silently ignore — die may not support RSSI reporting
  });
}

// Wire manager-level events
diceManager.addEventListener('dieAdded', pixel => {
  wireRollEvents(pixel as Pixel);
  getSendStatusToExtension()();
});

diceManager.addEventListener('dieConnected', () => {
  getSendStatusToExtension()();
});

diceManager.addEventListener('dieDisconnected', () => {
  getSendStatusToExtension()();
});

// --- Public API (matches existing PixelsBluetooth exports) ---

export async function connectToPixel(): Promise<Pixel | null> {
  try {
    const pixel = await diceManager.requestPixel();
    log(`Connected to ${pixel.name}`);
    sendTextToExtension(`Connected to ${pixel.name}`);
    return pixel;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      log('User cancelled the device chooser');
      return null;
    }
    throw error;
  }
}

export async function connectToPixelByName(
  name: string
): Promise<Pixel | null> {
  const existing = [...diceManager.dice.values()].find(p => p.name === name);
  if (existing) {
    if (existing.isConnected) return existing;
    await diceManager.reconnect(existing.systemId);
    return existing;
  }
  // Fallback: open chooser (user must select the correct die)
  return connectToPixel();
}

export function disconnectAllPixels(): void {
  for (const pixel of diceManager.dice.values()) {
    if (pixel.isConnected) {
      pixel.disconnect();
    }
  }
}

export function getPixels(): Pixel[] {
  return [...diceManager.dice.values()];
}

export function getConnectedPixelsList(): Pixel[] {
  return diceManager.connectedDice;
}

export function findPixelByName(
  name: string,
  pixelList?: Pixel[]
): Pixel | undefined {
  const list = pixelList || getPixels();
  return list.find(p => p.name === name);
}

export function initialize(): void {
  log('PixelsBridge module initialized');
  diceManager.connectKnownDevices().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    log(`Silent reconnection failed: ${message}`);
  });
}

export { diceManager };

export default {
  connectToPixel,
  connectToPixelByName,
  disconnectAllPixels,
  getPixels,
  getConnectedPixelsList,
  findPixelByName,
  initialize,
  diceManager,
};
