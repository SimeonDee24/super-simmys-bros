// Input system. Every player's input for one frame is a single small integer
// (a bitmask). The simulation only ever sees these bitmasks, whether they come
// from a keyboard, the CPU, a replay, or (later) the network.

export const BTN = {
  LEFT: 1, RIGHT: 2, UP: 4, DOWN: 8,
  JUMP: 16, ATTACK: 32, SPECIAL: 64, SMASH: 128, SHIELD: 256, GRAB: 512,
};

// Order matters: bit i of the mask belongs to ACTIONS[i].
export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'smash', 'shield', 'grab'];

export const DEFAULT_BINDINGS = {
  left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
  jump: 'Space', attack: 'KeyJ', special: 'KeyK', smash: 'KeyL', shield: 'KeyU', grab: 'KeyI',
};

// Tracks the physical keyboard. A key tapped and released between two ticks
// still counts as held for one tick, so quick taps are never lost.
export class Keyboard {
  constructor(target = window) {
    this.down = new Set();
    this.tapped = new Set();
    this.blocked = new Set(); // key codes we stop the browser from handling
    target.addEventListener('keydown', (e) => {
      if (this.blocked.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.tapped.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => { this.down.clear(); this.tapped.clear(); });
  }
  held(code) { return this.down.has(code) || this.tapped.has(code); }
  endTick() { this.tapped.clear(); }
}

// Turns keyboard state + key bindings into a bitmask once per tick.
export class KeyboardSource {
  constructor(keyboard, bindings) {
    this.kb = keyboard;
    this.setBindings(bindings);
  }
  setBindings(bindings) {
    this.bindings = bindings;
    for (const a of ACTIONS) this.kb.blocked.add(bindings[a]);
  }
  sample() {
    let mask = 0;
    for (let i = 0; i < ACTIONS.length; i++) {
      if (this.kb.held(this.bindings[ACTIONS[i]])) mask |= 1 << i;
    }
    return mask;
  }
}

// A player that never presses anything (placeholder until the CPU exists).
// The CPU will be another source with the same sample(state, slot) method,
// reading only the game state.
export class IdleSource {
  sample() { return 0; }
}

// Stores every frame's inputs for both players: [p1, p2, p1, p2, ...].
// This is the replay format and the future network payload.
export class InputRecorder {
  constructor() { this.data = []; }
  push(inputs) { this.data.push(inputs[0] | 0, inputs[1] | 0); }
  get frames() { return this.data.length >> 1; }
  get(frame) { return [this.data[frame * 2], this.data[frame * 2 + 1]]; }
}
