// The deterministic simulation.
//   next state = step(previous state, both players' input bitmasks)
// Nothing here reads the clock, the keyboard, Math.random or floating-point
// trig. The state is plain data (integers, strings, arrays), so it can be
// serialized, hashed, sent over a network, or replayed.
import { CONFIG } from '../config/config.js';
import { getStage } from '../stages/index.js';
import { getCharacter } from '../characters/index.js';
import { newFighter, updateFighter } from './fighter.js';
import { moveFighter, checkBlastZones } from './physics.js';
import { resolveHits } from './combat.js';
import { stepProjectiles, resolveProjectileHits } from './projectiles.js';

// setup = { stageId, players: [{ charId, alt }, { charId, alt }], stocks, seed }
export function createMatch(setup) {
  const stage = getStage(setup.stageId);
  const stocks = setup.stocks || CONFIG.DEFAULT_STOCKS;
  return {
    tick: 0,
    rng: (setup.seed || CONFIG.DEFAULT_SEED) | 0,
    stageId: setup.stageId,
    fighters: setup.players.map((p, i) => newFighter(i, p.charId, p.alt | 0, stage.spawns[i], stocks)),
    projectiles: [],
  };
}

export function step(state, inputs) {
  const stage = getStage(state.stageId);
  for (let i = 0; i < state.fighters.length; i++) {
    const f = state.fighters[i];
    const st = getCharacter(f.charId).stats;
    // Hitlag: both fighters freeze for a few frames when a hit lands.
    // Inputs pressed during the freeze still count on the first frame after it.
    if (f.hitlag > 0) { f.hitlag--; continue; }
    updateFighter(state, f, inputs[i] | 0);
    moveFighter(f, stage, st);
    checkBlastZones(f, stage);
  }
  stepProjectiles(state);
  resolveHits(state);
  resolveProjectileHits(state);
  state.tick++;
  return state;
}

export const serialize = (state) => JSON.stringify(state);
export const deserialize = (text) => JSON.parse(text);

// FNV-1a hash over the whole state, visiting object keys in sorted order.
// Two machines in sync always show the same 8 hex digits.
export function hashState(state) {
  let h = 0x811c9dc5;
  const byte = (b) => { h ^= b & 0xff; h = Math.imul(h, 0x01000193); };
  const int = (n) => { byte(n); byte(n >> 8); byte(n >> 16); byte(n >> 24); };
  const walk = (v) => {
    if (typeof v === 'number') {
      if (!Number.isInteger(v)) throw new Error('Non-integer value in game state: ' + v);
      int(v | 0); int(Math.floor(v / 4294967296));
    } else if (typeof v === 'string') {
      int(v.length);
      for (let i = 0; i < v.length; i++) byte(v.charCodeAt(i));
    } else if (Array.isArray(v)) {
      int(v.length);
      for (let i = 0; i < v.length; i++) walk(v[i]);
    } else if (v && typeof v === 'object') {
      const keys = Object.keys(v).sort();
      for (let i = 0; i < keys.length; i++) { walk(keys[i]); walk(v[keys[i]]); }
    } else {
      byte(v ? 1 : 0);
    }
  };
  walk(state);
  return (h >>> 0).toString(16).padStart(8, '0');
}
