// Settings and key bindings, saved in the browser's localStorage.
import { DEFAULT_BINDINGS } from '../engine/input.js';

const KEY = 'supersimmysbros.settings.v1';

// Bump this when the default controls change, so old saved bindings are
// replaced with the new defaults once.
const BINDINGS_VERSION = 2;   // 2: shield moved from U to I (grab to U)

const DEFAULTS = {
  bindings: { ...DEFAULT_BINDINGS },
  volume: 0.6,
  muted: false,       // M toggles sound
  tapJump: false,     // 0 toggles: up (W) also jumps
  showBoxes: false,   // hurtbox / hitbox / ledge-box display
  showDebug: false,   // tick, state hash, fighter state
  cpuLevel: 'lv3',     // P2 CPU: 'dummy' (training) or 'lv1' to 'lv5'
  // The four fighter slots on the select screen. type: 'human' (slot 1 only),
  // 'cpu' or 'off'; char and alt index the roster and its skins; level is the CPU level.
  slots: [
    { type: 'human', char: 0, alt: 0, level: 'lv3', team: 0 },
    { type: 'cpu', char: 0, alt: 1, level: 'lv3', team: 1 },
    { type: 'off', char: 1, alt: 0, level: 'lv3', team: 0 },
    { type: 'off', char: 2, alt: 0, level: 'lv3', team: 1 },
  ],
  mode: 'ffa',   // 'ffa' (free-for-all) or 'teams'
};

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { /* ignore */ }
  const oldBindings = (saved.bindingsVersion || 1) < BINDINGS_VERSION;
  if (saved.cpuLevel === 'fighter') saved.cpuLevel = 'lv3';   // renamed when levels 1-5 arrived
  // older saves had two picks and one CPU level: carry them into slots 1 and 2
  let slots = JSON.parse(JSON.stringify(DEFAULTS.slots));
  if (Array.isArray(saved.slots) && saved.slots.length === 4) slots = saved.slots;
  else if (Array.isArray(saved.picks)) saved.picks.slice(0, 2).forEach((p, i) => { slots[i].char = p.char | 0; slots[i].alt = p.alt | 0; if (i === 1 && saved.cpuLevel) slots[1].level = saved.cpuLevel; });
  saved.slots = slots;
  return {
    ...DEFAULTS, ...saved,
    bindingsVersion: BINDINGS_VERSION,
    bindings: { ...DEFAULT_BINDINGS, ...(oldBindings ? {} : saved.bindings || {}) },
  };
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* private mode etc. */ }
}
