// Fighter state machine. Milestone 1: movement only.
// Later milestones add states to the STATES table (attacks, shield, grabs,
// ledge, hitstun...) without changing how the table is driven.
import { BTN } from './input.js';
import { CONFIG } from '../config/config.js';
import { FX, approach, clamp } from './fixed.js';
import { getCharacter } from '../characters/index.js';
import { getStage } from '../stages/index.js';

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
    ledge: -1, ledgeCd: 0,  // ledge being held, and frames until one can be grabbed again
    wallSide: 0,            // -1 / 1 while touching a wall in the air (for wall jumps)
    prevIn: 0, tapDir: 0, tapTimer: 0,
    percent: 0, stocks, falls: 0,
    koX: 0, koY: 0,         // where the last KO happened (pixels), for the blast effect
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
    else if (c.dir) { f.facing = c.dir; setState(f, 'crawl', 'crawl'); }
  },

  // Walking while crouched.
  crawl(c) {
    const { f, st } = c;
    if (tryJump(c)) return;
    if (!(c.input & BTN.DOWN)) { setState(f, c.dir ? 'walk' : 'idle', c.dir ? 'walk' : 'idle'); return; }
    if (!c.dir) { setState(f, 'crouch', 'crouch'); f.animFrame = 99; return; } // stay down, skip the crouch-down blend
    f.facing = c.dir;
    f.vx = approach(f.vx, c.dir * st.crawlSpeed, st.walkAccel);
  },

  // KO'd: gone until the respawn delay passes. Out of stocks = out for good.
  dead(c) {
    const { f } = c;
    if (f.stateFrame < CONFIG.KO_RESPAWN_DELAY) return;
    if (f.stocks <= 0) { setState(f, 'out', 'idle'); return; }
    const stage = getStage(c.match.stageId);
    f.x = (stage.respawn.x + (f.slot === 0 ? -1 : 1) * CONFIG.RESPAWN_SLOT_OFFSET) * FX;
    f.y = (stage.respawn.y - CONFIG.RESPAWN_DROP_PX) * FX;
    f.facing = f.slot === 0 ? 1 : -1;
    f.invuln = 2;
    setState(f, 'respawn', 'idle');
  },
  out() {},

  // Standing on the respawn platform as it floats down. Invincible. Any
  // movement input (or waiting too long) leaves the platform.
  respawn(c) {
    const { f, st } = c;
    const stage = getStage(c.match.stageId);
    const D = CONFIG.RESPAWN_DESCEND;
    const left = Math.max(0, D - f.stateFrame);
    f.y = stage.respawn.y * FX - Math.trunc((CONFIG.RESPAWN_DROP_PX * FX * left) / D);
    f.invuln = 2;
    if (f.stateFrame < D) return;
    const wants = c.dir || (c.pressed & BTN.JUMP) || (c.input & BTN.DOWN);
    if (wants || f.stateFrame >= D + CONFIG.RESPAWN_PLATFORM_FRAMES) {
      f.invuln = CONFIG.RESPAWN_INVULN;
      f.jumpsLeft = st.airJumps;
      f.vx = 0;
      if (c.pressed & BTN.JUMP) { f.vy = -st.jumpVel; enterAir(f, 'jump'); }
      else { f.vy = 0; enterAir(f, 'fall'); }
    }
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

  // Hanging from a ledge. Toward the stage (or up) = get up, jump = ledge jump,
  // down or away = let go. (Ledge attack, roll, intangibility and trumping
  // arrive with milestone 3.)
  ledge(c) {
    const { f, st } = c;
    if (f.stateFrame < st.ledgeMinHang) return;
    if (c.pressed & BTN.JUMP) {
      f.ledge = -1; f.ledgeCd = CONFIG.LEDGE_REGRAB_FRAMES;
      f.vy = -st.ledgeJumpVel; f.vx = f.facing * st.ledgeJumpH;
      enterAir(f, 'jump');
    } else if (c.dir === f.facing || (c.input & BTN.UP)) {
      setState(f, 'ledgeGetup', 'ledgeGetup');
    } else if ((c.input & BTN.DOWN) || c.dir === -f.facing) {
      f.ledge = -1; f.ledgeCd = CONFIG.LEDGE_REGRAB_FRAMES;
      enterAir(f, 'fall');
    }
  },

  // Climb up: rise beside the wall, then step onto the stage.
  ledgeGetup(c) {
    const { f, st } = c;
    const l = getStage(c.match.stageId).ledges[f.ledge];
    const rise = st.ledgeGetupFrames - 7;
    if (f.stateFrame <= rise) {
      f.y = l.y * FX + Math.trunc((st.ledgeHang * (rise - f.stateFrame)) / rise);
    } else {
      f.y = l.y * FX;
      f.x += f.facing * FX * 2;
    }
    if (f.stateFrame >= st.ledgeGetupFrames) {
      f.grounded = 1; f.ground = l.solid; f.ledge = -1;
      f.vx = 0; f.vy = 0;
      setState(f, 'idle', 'idle');
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
  if (f.ledgeCd > 0) f.ledgeCd--;
  STATES[f.state]({ match, f, st, input, pressed, dir, tap, dashInput });
  f.prevIn = input;
}
