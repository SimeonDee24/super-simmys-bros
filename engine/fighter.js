// Fighter state machine. Milestone 1: movement only.
// Later milestones add states to the STATES table (attacks, shield, grabs,
// ledge, hitstun...) without changing how the table is driven.
import { BTN } from './input.js';
import { CONFIG } from '../config/config.js';
import { FX, approach, clamp } from './fixed.js';
import { getCharacter } from '../characters/index.js';

export function newFighter(slot, charId, alt, spawn, stocks) {
  const st = getCharacter(charId).stats;
  return {
    slot, charId, alt,
    x: spawn.x * FX, y: spawn.y * FX, vx: 0, vy: 0,
    facing: spawn.facing,
    state: 'idle', stateFrame: 0,
    anim: 'idle', animFrame: 0,
    grounded: 1, ground: spawn.ground || 0,
    jumpsLeft: st.airJumps, fastFall: 0, landLag: 0,
    wallSide: 0,            // -1 / 1 while touching a wall in the air (for wall jumps)
    prevIn: 0, tapDir: 0, tapTimer: 0,
    percent: 0, stocks, falls: 0,
    invuln: 0,
  };
}

export function setAnim(f, name) {
  if (f.anim !== name) { f.anim = name; f.animFrame = 0; }
}
export function setState(f, state, animName) {
  f.state = state;
  f.stateFrame = 0;
  if (animName) setAnim(f, animName);
}

export function enterAir(f, animName) {
  f.grounded = 0;
  f.ground = -1;
  setState(f, 'air', animName || 'fall');
}

export function land(f, groundIndex, st) {
  f.y = f.y | 0;
  f.vy = 0;
  f.grounded = 1;
  f.ground = groundIndex;
  f.landLag = f.fastFall ? st.hardLandLag : st.softLandLag;
  f.fastFall = 0;
  f.jumpsLeft = st.airJumps;
  f.wallSide = 0;
  setState(f, 'land', 'land');
}

function tryJump(c) {
  if (c.pressed & BTN.JUMP) { setState(c.f, 'jumpsquat', 'jumpsquat'); return true; }
  return false;
}
function startDash(c, d) {
  const f = c.f;
  f.facing = d;
  f.vx = d * c.st.dashSpeed;
  f.tapTimer = 0;
  setState(f, 'dash', 'run');
}
function toCrouch(c) {
  if (c.input & BTN.DOWN) { setState(c.f, 'crouch', 'crouch'); return true; }
  return false;
}

const STATES = {
  idle(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.traction);
    if (tryJump(c) || toCrouch(c)) return;
    if (c.dir) {
      f.facing = c.dir;
      if (c.dashInput) startDash(c, c.dir); else setState(f, 'walk', 'walk');
    }
  },

  walk(c) {
    const { f, st } = c;
    if (tryJump(c) || toCrouch(c)) return;
    if (!c.dir) { setState(f, 'idle', 'idle'); return; }
    if (c.dashInput) { startDash(c, c.dir); return; }
    f.facing = c.dir;
    f.vx = approach(f.vx, c.dir * st.walkSpeed, st.walkAccel);
  },

  // Initial dash: a fixed burst of speed. Tapping the other way restarts it
  // in that direction (dash dancing).
  dash(c) {
    const { f, st } = c;
    if (tryJump(c)) return;
    if (c.tap === -f.facing) { startDash(c, c.tap); return; }
    f.vx = f.facing * st.dashSpeed;
    if (f.stateFrame >= st.dashFrames) {
      if (c.dir === f.facing) setState(f, 'run', 'run');
      else setState(f, 'brake', 'brake');
    }
  },

  run(c) {
    const { f, st } = c;
    if (tryJump(c) || toCrouch(c)) return;
    if (c.dir === f.facing) f.vx = approach(f.vx, f.facing * st.runSpeed, st.runAccel);
    else if (c.dir === -f.facing) { f.facing = -f.facing; setState(f, 'turn', 'brake'); }
    else setState(f, 'brake', 'brake');
  },

  // Skid to a stop after letting go of run.
  brake(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.traction);
    if (tryJump(c)) return;
    if (c.dashInput) { startDash(c, c.dashInput); return; }
    if (f.stateFrame >= st.brakeFrames) setState(f, 'idle', 'idle');
  },

  // Run turnaround: slide, then run the other way if the direction is held.
  turn(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.turnTraction);
    if (tryJump(c)) return;
    if (f.stateFrame >= st.turnFrames) {
      if (c.dir === f.facing) { f.vx = f.facing * st.turnExitSpeed; setState(f, 'run', 'run'); }
      else setState(f, 'idle', 'idle');
    }
  },

  crouch(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.traction);
    if (tryJump(c)) return;
    if (!(c.input & BTN.DOWN)) setState(f, 'idle', 'idle');
  },

  // Jump startup. Leaving the ground: JUMP still held = full hop, released = short hop.
  jumpsquat(c) {
    const { f, st } = c;
    if (f.stateFrame >= st.jumpSquat) {
      f.vy = -((c.input & BTN.JUMP) ? st.jumpVel : st.shortHopVel);
      f.vx = clamp(f.vx, -st.jumpMaxH, st.jumpMaxH);
      enterAir(f, 'jump');
    }
  },

  air(c) {
    const { f, st } = c;
    // Double jump
    if ((c.pressed & BTN.JUMP) && f.jumpsLeft > 0) {
      f.jumpsLeft--;
      f.vy = -st.doubleJumpVel;
      f.fastFall = 0;
      if (c.dir) f.vx = c.dir * st.doubleJumpH;
      f.anim = 'djump'; f.animFrame = 0;
    }
    // Air drift
    if (c.dir) {
      const target = c.dir * st.airSpeed;
      const slower = c.dir > 0 ? f.vx < target : f.vx > target;
      f.vx = approach(f.vx, target, slower ? st.airAccel : st.airFriction);
    } else {
      f.vx = approach(f.vx, 0, st.airFriction);
    }
    // Fast fall: tap down at or after the peak
    if ((c.pressed & BTN.DOWN) && f.vy >= 0 && !f.fastFall) f.fastFall = 1;
    if (f.fastFall) f.vy = st.fastFallSpeed;
    else f.vy = Math.min(f.vy + st.gravity, st.fallSpeed);

    if (!(f.anim === 'djump' && f.animFrame < st.doubleJumpAnimFrames)) {
      setAnim(f, f.vy < 0 ? 'jump' : 'fall');
    }
  },

  land(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.traction);
    if (f.stateFrame >= f.landLag) {
      if (tryJump(c)) return;
      setState(f, 'idle', 'idle');
    }
  },
};

// Advance one fighter by one tick using only its previous state and this
// frame's input bitmask.
export function updateFighter(match, f, input) {
  const st = getCharacter(f.charId).stats;
  const pressed = input & ~f.prevIn;
  let dir = 0;
  if (input & BTN.LEFT) dir -= 1;
  if (input & BTN.RIGHT) dir += 1;

  // Double-tap detection for dashing.
  let tap = 0;
  if (pressed & BTN.LEFT) tap = -1; else if (pressed & BTN.RIGHT) tap = 1;
  const dashInput = tap !== 0 && tap === f.tapDir && f.tapTimer > 0 ? tap : 0;
  if (tap) { f.tapDir = tap; f.tapTimer = CONFIG.DOUBLE_TAP_WINDOW; }
  else if (f.tapTimer > 0) f.tapTimer--;

  f.stateFrame++;
  f.animFrame++;
  if (f.invuln > 0) f.invuln--;
  STATES[f.state]({ match, f, st, input, pressed, dir, tap, dashInput });
  f.prevIn = input;
}
