// Settings and key bindings, saved in the browser's localStorage.
import { DEFAULT_BINDINGS } from '../engine/input.js';

const KEY = 'supersimmysbros.settings.v1';

// Bump this when the default controls change, so old saved bindings are
// replaced with the new defaults once.
const BINDINGS_VERSION = 2;   // 2: shield moved from U to I (grab to U)

const DEFAULTS = {
  bindings: { ...DEFAULT_BINDINGS },
  volume: 0.6,
  showBoxes: false,   // hurtbox / hitbox / ledge-box display
  showDebug: false,   // tick, state hash, fighter state
  cpuLevel: 'fighter', // P2 CPU: 'dummy' (training) or 'fighter'
};

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { /* ignore */ }
  const oldBindings = (saved.bindingsVersion || 1) < BINDINGS_VERSION;
  return {
    ...DEFAULTS, ...saved,
    bindingsVersion: BINDINGS_VERSION,
    bindings: { ...DEFAULT_BINDINGS, ...(oldBindings ? {} : saved.bindings || {}) },
  };
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* private mode etc. */ }
}
