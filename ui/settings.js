// Settings and key bindings, saved in the browser's localStorage.
import { DEFAULT_BINDINGS } from '../engine/input.js';

const KEY = 'supersimmysbros.settings.v1';

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
  return { ...DEFAULTS, ...saved, bindings: { ...DEFAULT_BINDINGS, ...(saved.bindings || {}) } };
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* private mode etc. */ }
}
