'use strict';

/**
 * Jest manual mock for @scooper4711/pixels-ble
 *
 * Provides stub implementations so tests that import PixelsBridge (which
 * depends on this ESM-only package) can run in Jest's CJS environment.
 */

class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  addEventListener(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(listener);
  }

  removeEventListener(event, listener) {
    const set = this._listeners.get(event);
    if (set) set.delete(listener);
  }

  emit(event, data) {
    const set = this._listeners.get(event);
    if (set) set.forEach(fn => fn(data));
  }
}

class Pixel extends EventEmitter {
  constructor(device, knownInfo) {
    super();
    this.systemId = device?.id || 'mock-system-id';
    this.name = (knownInfo && knownInfo.name) || device?.name || 'MockPixel';
    this.dieType = (knownInfo && knownInfo.dieType) || null;
    this.batteryLevel = null;
    this.rssi = null;
    this.isConnected = false;
  }

  async connect() {
    this.isConnected = true;
  }

  async disconnect() {
    this.isConnected = false;
  }

  async blink() {}

  async reportRssi() {}

  startConnectionMonitoring() {}

  stopConnectionMonitoring() {}
}

class DiceManager extends EventEmitter {
  constructor() {
    super();
    this._diceMap = new Map();
  }

  get dice() {
    return this._diceMap;
  }

  get connectedDice() {
    return [...this._diceMap.values()].filter(p => p.isConnected);
  }

  async requestPixel() {
    const pixel = new Pixel({ id: 'requested-id', name: 'RequestedPixel' });
    pixel.isConnected = true;
    this._diceMap.set(pixel.systemId, pixel);
    this.emit('dieAdded', pixel);
    return pixel;
  }

  getPixel(systemId) {
    return this._diceMap.get(systemId);
  }

  async connectKnownDevices() {}

  async reconnect() {}

  async forget(systemId) {
    this._diceMap.delete(systemId);
  }
}

function convertFaceValue(faceIndex, dieType) {
  if (dieType === 100) return faceIndex === 0 ? 100 : faceIndex * 10;
  if (dieType === 10) return faceIndex === 0 ? 10 : faceIndex;
  return faceIndex + 1;
}

async function attemptReconnection() {}
function resetStrategy() {}
function getStrategy() {
  return 'unknown';
}
function startMonitoring() {}
function stopMonitoring() {}

module.exports = {
  Pixel,
  DiceManager,
  EventEmitter,
  convertFaceValue,
  attemptReconnection,
  resetStrategy,
  getStrategy,
  startMonitoring,
  stopMonitoring,
};
